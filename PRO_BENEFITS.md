# Pro Benefits (Currently Implemented)

This document lists the Pro benefits that are **implemented right now**.

## 1) Unlimited Daily Messages

- Pro users are not blocked by the non-Pro daily message cap.
- Non-Pro users still follow `NON_PRO_DAILY_MESSAGE_CAP` and warning thresholds.

## 2) Doubled Context Length Before Summarization

- Pro users get a higher pre-summarization context threshold.
- Effective behavior: Pro soft context limit is `2x` the base soft token limit.
- Config key: `CHAT_CONTEXT_PRO_SOFT_LIMIT_MULTIPLIER` (current default: `2.0`).

## Notes

- This file is intentionally minimal and only reflects live, implemented benefits.
- If new Pro benefits are shipped, add them here.
