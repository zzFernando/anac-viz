FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY requirements-api.txt .
RUN pip install --no-cache-dir -r requirements-api.txt

# Copy only what the API needs
COPY src/api.py src/api.py
COPY src/__init__.py src/__init__.py

# Only the 3 parquets used by the API (~16 MB total)
COPY data/processed/stats_v2.parquet        data/processed/stats_v2.parquet
COPY data/processed/aerodromos.parquet      data/processed/aerodromos.parquet
COPY data/processed/percentuais_mes.parquet data/processed/percentuais_mes.parquet

# Render injects $PORT at runtime; fallback to 8000 locally
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn src.api:app --host 0.0.0.0 --port ${PORT}"]
