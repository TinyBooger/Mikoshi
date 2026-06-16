FROM python:3.11-slim
WORKDIR /app

# Use Tencent Cloud intranet PyPI mirror for faster pip installs on Tencent servers
ENV PIP_INDEX_URL=http://mirrors.tencentyun.com/pypi/simple
ENV PIP_TRUSTED_HOST=mirrors.tencentyun.com

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --use-pep517 --timeout=60 --retries=3 -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]