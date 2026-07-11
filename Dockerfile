FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/ /app/backend/
COPY agents/ /app/agents/

WORKDIR /app/backend

ENV PYTHONPATH=/app
ENV CODE_REPOS_DIR=/app/backend/data/code_repos

RUN mkdir -p /app/backend/data/chroma /app/backend/data/code_repos

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
