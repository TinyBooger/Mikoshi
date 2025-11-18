FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --use-pep517 --timeout=60 --retries=3 -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]