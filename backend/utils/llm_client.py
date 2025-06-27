from huggingface_hub import InferenceClient
import os

# Huggingface client
HF_TOKEN = os.getenv("HF_API_KEY")
client = InferenceClient(token=HF_TOKEN)