from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from huggingface_hub import InferenceClient
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = InferenceClient(
    model="mistralai/Mistral-7B-Instruct-v0.3",
    token=os.getenv("HF_API_KEY")
)

@app.post("/chat")
async def chat(request: Request):
    data = await request.json()
    user_input = data.get("message", "")
    persona = "You are a helpful, friendly assistant who responds with clear, complete sentences."
    prompt = f"{persona}\nUser: {user_input}\nAssistant:"
    try:
        result = client.text_generation(
            prompt,
            max_new_tokens=100,
            do_sample=True,
            temperature=0.7,
            top_p=0.9,
            repetition_penalty=1.1,
            stop=["User:", "\nUser:"]
            )
        return {"reply": result}
    except Exception as e:
        return {"reply": f"Error: {str(e)}"}

app.mount("/", StaticFiles(directory=".", html=True), name="static")