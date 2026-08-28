"""Configuration for live DashScope paraformer-realtime ASR."""
import os

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")

ASR_MODEL = "paraformer-realtime-8k-v2"
ASR_SAMPLE_RATE = 16000
