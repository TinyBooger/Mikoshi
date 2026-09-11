# -*- coding: utf-8 -*-
"""Unit tests for the context-window budget, compaction trigger, and guard.

Run from the backend/ directory:

    python -m unittest tests.test_context_window -v

(Or: python -m unittest discover -s tests -t .)

The summarizer API call is stubbed out — no network, no keys needed.
"""
import asyncio
import os
import unittest
from unittest import mock

# utils.llm_client constructs AsyncOpenAI clients for BOTH providers at import
# time from env keys and raises if either key is unset — even though the tests
# below stub out the summarizer and never touch the network. Provide dummy
# placeholders (setdefault so real keys in a dev shell still win).
os.environ.setdefault("DEEPSEEK_API_KEY", "test-dummy-not-used")
os.environ.setdefault("QWEN_API_KEY", "test-dummy-not-used")

from model_configs import get_model, derive_per_turn_context_budget
from utils.context_window import (
    SUMMARY_PREFIX,
    compact_conversation_messages,
    estimate_guard_input,
)

FAKE_SUMMARY_TEXT = "Compressed memory of the older turns."
FAKE_SUMMARY_USAGE = {"prompt_tokens": 25, "completion_tokens": 30, "total_tokens": 55}


def _usage(prompt_tokens, completion_tokens=10):
    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
    }


def _msg(role, text, *, message_id=None, is_pinned=False, usage=None):
    msg = {"role": role, "content": text}
    if message_id:
        msg["message_id"] = message_id
    if is_pinned:
        msg["is_pinned"] = True
    if usage:
        msg["usage"] = usage
    return msg


def _long_text(word_count=50):
    return " ".join(f"word{i}" for i in range(word_count))


async def _fake_summarize(summary_input, *, summary_max_tokens):
    """Stand-in for the LLM summarizer: always succeeds."""
    return FAKE_SUMMARY_TEXT, dict(FAKE_SUMMARY_USAGE)


def _run(coro):
    return asyncio.run(coro)


class DerivePerTurnContextBudgetTest(unittest.TestCase):
    """The qwen3.7-flash-style mismatched-cap case: max_input_tokens < context."""

    def test_qwen37_flash_input_cap_wins_over_context_length(self):
        cfg = get_model("qwen3.7-flash")
        self.assertIsNotNone(cfg)
        budget = derive_per_turn_context_budget(cfg, requested_max_tokens=4000)
        # 1M advertised context, but the provider's real input cap is 32k.
        self.assertEqual(budget["soft_token_limit"], 32_000)
        self.assertEqual(budget["provider_input_cap"], 32_000)
        self.assertEqual(budget["clamped_max_tokens"], 4000)

    def test_qwen37_flash_output_request_never_inflates_budget(self):
        cfg = get_model("qwen3.7-flash")
        # Even a huge requested output must not make the input budget appear to
        # exceed the real 32k provider input cap.
        budget = derive_per_turn_context_budget(cfg, requested_max_tokens=200_000)
        self.assertEqual(budget["clamped_max_tokens"], 128_000)  # model output cap
        self.assertEqual(budget["soft_token_limit"], 32_000)

    def test_small_character_model_reserves_output_room(self):
        cfg = get_model("qwen-plus-character")  # 32k context / 4k max output
        budget = derive_per_turn_context_budget(cfg, requested_max_tokens=8000)
        self.assertEqual(budget["clamped_max_tokens"], 4000)
        self.assertEqual(budget["soft_token_limit"], 32_000 - 4000)
        self.assertEqual(budget["provider_input_cap"], 32_000)

    def test_deepseek_no_explicit_input_cap_budgets_from_context(self):
        cfg = get_model("deepseek-v4-flash")  # 1M context, no max_input_tokens
        budget = derive_per_turn_context_budget(cfg, requested_max_tokens=4000)
        self.assertEqual(budget["provider_input_cap"], 1_000_000)
        self.assertEqual(budget["soft_token_limit"], 1_000_000 - 4000)


class CompactFirstTurnNoUsageTest(unittest.TestCase):
    """First turn / no usage data anywhere: naive estimate, no fold."""

    def test_small_conversation_never_compacts(self):
        messages = [
            _msg("user", "Hello there, how are you today?", message_id="u0"),
            _msg("assistant", "I am doing great, thank you for asking!", message_id="a0"),
        ]
        compacted, info, state_update = _run(
            compact_conversation_messages(messages, soft_token_limit=8000)
        )
        self.assertIsNone(state_update)
        self.assertEqual(info["measured_input_tokens"], 0)
        self.assertEqual(len(compacted), 2)
        self.assertEqual(compacted[0]["role"], "user")
        self.assertEqual(compacted[1]["role"], "assistant")


class CompactTriggerAndFoldTest(unittest.TestCase):
    """Over the trigger, with a measured anchor: folds and advances the cursor."""

    def _over_budget_history(self):
        # assistant at index 1 carries the measured prompt_tokens of the last
        # provider-accepted request; several never-seen turns follow it.
        return [
            _msg("user", _long_text(30), message_id="m0"),
            _msg(
                "assistant",
                _long_text(5),
                message_id="m1",
                usage=_usage(prompt_tokens=150),
            ),
            _msg("user", _long_text(50), message_id="m2"),
            _msg("assistant", _long_text(50), message_id="m3"),
            _msg("user", _long_text(50), message_id="m4"),
            _msg("assistant", _long_text(50), message_id="m5"),
        ]

    @mock.patch("utils.context_window._summarize_with_prompt", side_effect=_fake_summarize)
    def test_fold_advances_cursor_and_keeps_recent_turns(self, _fake):
        messages = self._over_budget_history()
        compacted, info, state_update = _run(
            compact_conversation_messages(messages, soft_token_limit=200)
        )
        self.assertIsNotNone(state_update)
        self.assertEqual(state_update["through_message_id"], "m3")
        # Request = [summary system message] + the 2 most recent turns.
        self.assertEqual(len(compacted), 3)
        self.assertEqual(compacted[0]["role"], "system")
        self.assertTrue(compacted[0]["content"].startswith(SUMMARY_PREFIX))
        sent_ids = {m.get("message_id") for m in compacted if m.get("message_id")}
        self.assertEqual(sent_ids, {"m4", "m5"})
        self.assertGreater(info["measured_input_tokens"], 0)

    @mock.patch("utils.context_window._summarize_with_prompt", side_effect=_fake_summarize)
    def test_summarizer_failure_never_advances_cursor(self, _fake):
        _fake.side_effect = RuntimeError("provider down")
        messages = self._over_budget_history()
        compacted, _info, state_update = _run(
            compact_conversation_messages(messages, soft_token_limit=200)
        )
        # Failed fold: nothing dropped, no cursor movement, no state to persist.
        self.assertIsNone(state_update)
        self.assertEqual(len(compacted), len(messages))

    @mock.patch("utils.context_window._summarize_with_prompt", side_effect=_fake_summarize)
    def test_measure_only_never_folds(self, _fake):
        messages = self._over_budget_history()
        compacted, _info, state_update = _run(
            compact_conversation_messages(
                messages, soft_token_limit=200, measure_only=True
            )
        )
        self.assertIsNone(state_update)
        self.assertEqual(len(compacted), len(messages))
        self.assertEqual(_fake.call_count, 0)


class FullyPinnedHistoryTest(unittest.TestCase):
    """Pinned messages are only dropped when the emergency force pass runs."""

    def _fully_pinned_history(self):
        return [
            _msg("user", _long_text(50), message_id=f"p{i}", is_pinned=True)
            for i in range(6)
        ]

    @mock.patch("utils.context_window._summarize_with_prompt", side_effect=_fake_summarize)
    def test_normal_compaction_keeps_pinned_messages_verbatim(self, _fake):
        messages = self._fully_pinned_history()
        compacted, _info, state_update = _run(
            compact_conversation_messages(messages, soft_token_limit=200)
        )
        # Over the trigger, but everything is pinned: nothing may be folded.
        self.assertIsNone(state_update)
        self.assertEqual(len(compacted), len(messages))
        sent_ids = {m.get("message_id") for m in compacted if m.get("message_id")}
        self.assertEqual(sent_ids, {f"p{i}" for i in range(6)})

    @mock.patch("utils.context_window._summarize_with_prompt", side_effect=_fake_summarize)
    def test_force_compact_ignores_pinning_and_folds_old_pinned(self, _fake):
        messages = self._fully_pinned_history()
        compacted, _info, state_update = _run(
            compact_conversation_messages(messages, soft_token_limit=200, force_compact=True)
        )
        self.assertIsNotNone(state_update)
        # [summary] + the 2 most recent messages; all old pinned messages folded.
        self.assertEqual(len(compacted), 3)
        self.assertTrue(compacted[0]["content"].startswith(SUMMARY_PREFIX))
        sent_ids = {m.get("message_id") for m in compacted if m.get("message_id")}
        self.assertEqual(sent_ids, {"p4", "p5"})


class SystemPromptBudgetTest(unittest.TestCase):
    """The character card is not a fold candidate.

    It is subtracted from the per-turn budget instead of counting towards the
    trigger. Counting it (the old ``naive_shape_estimate``) made the trigger a
    constant: once system prompt + summary + recent turns crossed the
    threshold, every subsequent request satisfied it.
    """

    def test_foldable_budget_excludes_the_system_prompt(self):
        messages = [
            _msg("system", _long_text(50)),
            _msg("user", "hello there", message_id="u0"),
            _msg("assistant", "hi", message_id="a0"),
        ]
        _compacted, info, state_update = _run(
            compact_conversation_messages(messages, soft_token_limit=1000)
        )
        self.assertGreater(info["system_prompt_tokens"], 0)
        self.assertEqual(
            info["foldable_token_budget"], 1000 - info["system_prompt_tokens"]
        )
        self.assertIsNone(state_update)

    @mock.patch("utils.context_window._summarize_with_prompt", side_effect=_fake_summarize)
    def test_oversized_system_prompt_alone_cannot_fold_a_tiny_conversation(self, _fake):
        # The card is bigger than the whole budget, but it can never be folded
        # away, so the (tiny) foldable tail must not be summarized.
        messages = [
            _msg("system", _long_text(400)),
            _msg("user", _long_text(50), message_id="u0"),
            _msg("assistant", _long_text(50), message_id="a0"),
            _msg("user", _long_text(50), message_id="u1"),
        ]
        compacted, info, state_update = _run(
            compact_conversation_messages(messages, soft_token_limit=400)
        )
        self.assertGreater(info["system_prompt_tokens"], 400)
        self.assertEqual(info["fold_skipped_reason"], "too_few_messages")
        self.assertEqual(_fake.call_count, 0)
        self.assertIsNone(state_update)
        self.assertEqual(len(compacted), len(messages))


class FoldAmortizationTest(unittest.TestCase):
    """A fold must amortize several turns instead of running every request."""

    CURSOR_STATE = {"branch_main": {"text": "old memory", "through_message_id": "m1"}}

    def _history(self, extra_turns):
        # Cursor sits on m1; everything after it is still raw.
        messages = [
            _msg("user", _long_text(50), message_id="m0"),
            _msg(
                "assistant",
                _long_text(50),
                message_id="m1",
                usage=_usage(prompt_tokens=200),
            ),
        ]
        for i in range(extra_turns):
            role = "user" if i % 2 == 0 else "assistant"
            messages.append(_msg(role, _long_text(50), message_id=f"x{i}"))
        return messages

    def _compact(self, extra_turns, **kwargs):
        return _run(
            compact_conversation_messages(
                self._history(extra_turns),
                soft_token_limit=200,
                summary_state=self.CURSOR_STATE,
                branch_id="branch_main",
                **kwargs,
            )
        )

    @mock.patch("utils.context_window._summarize_with_prompt", side_effect=_fake_summarize)
    def test_single_aged_out_message_is_not_folded(self, _fake):
        # Steady state: the cursor sits one message behind, so the fold window
        # holds exactly one message. Folding it charged a full summarizer call
        # to buy back a single turn — and then repeated on the next request.
        _compacted, info, state_update = self._compact(3)
        self.assertEqual(info["fold_skipped_reason"], "too_few_messages")
        self.assertEqual(_fake.call_count, 0)
        self.assertIsNone(state_update)

    @mock.patch("utils.context_window._summarize_with_prompt", side_effect=_fake_summarize)
    def test_fold_waits_until_enough_messages_accumulate(self, _fake):
        compacted, info, state_update = self._compact(6)
        self.assertEqual(_fake.call_count, 1)
        self.assertEqual(state_update["through_message_id"], "x3")
        self.assertGreater(info["fold_saving_tokens"], 0)
        sent_ids = {m.get("message_id") for m in compacted if m.get("message_id")}
        self.assertEqual(sent_ids, {"x4", "x5"})

    @mock.patch("utils.context_window._summarize_with_prompt", side_effect=_fake_summarize)
    def test_emergency_pass_ignores_the_minimum_fold_size(self, _fake):
        # Same single-candidate window as above, but the fail-closed rung must
        # still shed messages: the gates only apply to normal compaction.
        _compacted, _info, state_update = self._compact(3, force_compact=True)
        self.assertIsNotNone(state_update)
        self.assertEqual(state_update["through_message_id"], "x0")


class EstimateGuardInputTest(unittest.TestCase):
    """The folded-vs-not-folded guard detection the route depends on."""

    def test_folded_state_uses_shaped_request_estimate(self):
        info = {
            "measured_input_tokens": 10_000,  # present but irrelevant when folded
            "sent_estimate_tokens": 100,
            "estimated_new_tokens": 0,
        }
        state_update = {"text": "summary", "through_message_id": "m3"}
        # int(1.15 * 100) == 114 (floating-point truncation, not 115).
        self.assertEqual(estimate_guard_input(info, state_update), 114)

    def test_unfolded_with_measured_anchor_cushions_only_delta(self):
        info = {
            "measured_input_tokens": 1000,
            "sent_estimate_tokens": 1000,
            "estimated_new_tokens": 40,
        }
        self.assertEqual(estimate_guard_input(info, None), 1000 + 54)

    def test_state_update_without_through_id_is_not_a_fold(self):
        # Regression case: a dict update that never advanced the cursor (no
        # through_message_id) must fall back to the measured-delta branch, NOT
        # the folded branch — otherwise a stale update could hide an overflow.
        info = {
            "measured_input_tokens": 1000,
            "sent_estimate_tokens": 500,
            "estimated_new_tokens": 40,
        }
        for bad_update in ({}, {"text": "x"}, {"text": "x", "through_message_id": ""}):
            self.assertEqual(estimate_guard_input(info, bad_update), 1000 + 54)

    def test_no_signal_uses_full_estimate(self):
        info = {
            "measured_input_tokens": 0,
            "sent_estimate_tokens": 50,
            "estimated_new_tokens": 60,
        }
        self.assertEqual(estimate_guard_input(info, None), 69)


if __name__ == "__main__":
    unittest.main()
