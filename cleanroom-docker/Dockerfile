FROM python:3.12-slim

# No Node, no pre-installed Python packages beyond pip
RUN apt-get update && apt-get install -y git curl socat && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir \
    "fastapi>=0.111" \
    "uvicorn[standard]>=0.29" \
    "sse-starlette>=2.1" \
    "aiofiles>=23.2" \
    "psutil>=5.9" \
    "httpx>=0.27" \
    "pydantic>=2" \
    "agentsuite[ollama] @ git+https://github.com/scottconverse/AgentSuite.git@17fda3140087ef85f3a72ca48a05551fce983740"

ENV PYTHONPATH=/app

COPY cleanroom-docker/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8765
CMD ["/start.sh"]
