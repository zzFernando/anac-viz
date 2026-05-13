FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY requirements-api.txt .
RUN pip install --no-cache-dir -r requirements-api.txt

# Source
COPY src/api.py src/api.py
COPY src/__init__.py src/__init__.py

# Slim parquets: 4 MB disco, 48 MB RAM (pré-computados com tipos otimizados)
COPY data/processed/stats_slim.parquet        data/processed/stats_slim.parquet
COPY data/processed/aerodromos.parquet        data/processed/aerodromos.parquet
COPY data/processed/percentuais_slim.parquet  data/processed/percentuais_slim.parquet

# Render injeta $PORT em runtime
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn src.api:app --host 0.0.0.0 --port ${PORT}"]
