from openai import OpenAI
import os

# DeepSeek client
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")

def stream_chat_completion(messages, max_tokens=250, temperature=1.3, top_p=0.9):
    """
    Stream chat completion from DeepSeek API.
    Yields chunks of text as they arrive.
    """
    stream = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
        stream=True
    )
    
    for chunk in stream:
        if chunk.choices[0].delta.content is not None:
            yield chunk.choices[0].delta.content