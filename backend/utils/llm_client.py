from openai import OpenAI
import os

# DeepSeek client
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")


def stream_chat_completion_with_config(
    messages,
    model="deepseek-chat",
    max_tokens=250,
    temperature=1.3,
    top_p=0.9,
    presence_penalty=0,
    frequency_penalty=0,
):
    stream = client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
        presence_penalty=presence_penalty,
        frequency_penalty=frequency_penalty,
        stream=True,
        stream_options={"include_usage": True},
    )

    for chunk in stream:
        chunk_usage = getattr(chunk, "usage", None)
        if chunk_usage is not None:
            yield {"type": "usage", "usage": chunk_usage}

        choices = getattr(chunk, "choices", None) or []
        if not choices:
            continue

        content = getattr(choices[0].delta, "content", None)
        if content is not None:
            yield {"type": "delta", "content": content}