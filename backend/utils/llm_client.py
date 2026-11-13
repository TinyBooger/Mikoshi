from openai import AsyncOpenAI
import logging
import os

from model_configs import PROVIDER_DEEPSEEK, get_model

logger = logging.getLogger(__name__)

# Hard ceiling (seconds) on every socket operation against the model
# providers. The SDK raises openai.APITimeoutError if a request stalls past
# this instead of letting the caller block forever. Applied once, at client
# construction, so both providers inherit it.
CLIENT_TIMEOUT_SECONDS = 90.0


def _build_client(api_key, base_url):
    return AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=CLIENT_TIMEOUT_SECONDS)


# DeepSeek client
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

# Aliyun Bailian / DashScope compatible client for Qwen models
QWEN_API_KEY = os.getenv("QWEN_API_KEY")
QWEN_BASE_URL = os.getenv("QWEN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")

client = _build_client(DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL)
qwen_client = _build_client(QWEN_API_KEY, QWEN_BASE_URL)

DEEPSEEK_DIRECT_MODELS = {"deepseek-v4-pro", "deepseek-v4-flash"}


def _is_deepseek_model(model):
    """``True`` when *model* is served by the DeepSeek platform.

    The registry is authoritative; the fallback set only covers ids that are not
    registered (it keeps an unknown model pinned to the provider it used to hit).
    """
    config = get_model(model) if isinstance(model, str) else None
    if config is not None:
        return config.provider == PROVIDER_DEEPSEEK
    return isinstance(model, str) and model in DEEPSEEK_DIRECT_MODELS


def _get_client_for_model(model):
    if _is_deepseek_model(model):
        return client
    return qwen_client


def _thinking_off_extra_body(model):
    """Provider-shaped fields that disable reasoning (see model_configs).

    Falling back to the DashScope shape keeps an unregistered model from
    silently reverting to provider-default thinking.
    """
    config = get_model(model) if isinstance(model, str) else None
    if config is not None:
        return config.disable_thinking_payload() or None
    if _is_deepseek_model(model):
        return {"thinking": {"type": "disabled"}}
    return {"enable_thinking": False}


_LOGGED_THINKING_POLICY = set()


def _log_thinking_policy_once(model, extra_body):
    """Record the reasoning switch actually sent, once per model per process."""
    if model in _LOGGED_THINKING_POLICY:
        return
    _LOGGED_THINKING_POLICY.add(model)
    logger.info(
        "🧠 Reasoning disabled | model=%s | provider_fields=%s",
        model,
        extra_body or "none (model has no thinking mode)",
    )


async def stream_chat_completion_with_config(
    messages,
    model="deepseek-v4-flash",
    max_tokens=4000,
    temperature=1.3,
    top_p=0.9,
    presence_penalty=0,
    frequency_penalty=0,
):
    selected_client = _get_client_for_model(model)
    extra_body = _thinking_off_extra_body(model)
    _log_thinking_policy_once(model, extra_body)
    stream = await selected_client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
        presence_penalty=presence_penalty,
        frequency_penalty=frequency_penalty,
        stream=True,
        stream_options={"include_usage": True},
        extra_body=extra_body,
    )

    async for chunk in stream:
        chunk_usage = getattr(chunk, "usage", None)
        if chunk_usage is not None:
            yield {"type": "usage", "usage": chunk_usage}

        choices = getattr(chunk, "choices", None) or []
        if not choices:
            continue

        content = getattr(choices[0].delta, "content", None)
        if content is not None:
            yield {"type": "delta", "content": content}