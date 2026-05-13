#!/usr/bin/env bash
# Inicia o backend FastAPI (porta 8000) e o frontend Next.js (porta 3000)
# Uso: ./start.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Backend  → http://localhost:8000"
echo "🌐 Frontend → http://localhost:3000"
echo ""

# Backend
"$ROOT/.venv/bin/uvicorn" src.api:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Frontend (dev mode)
cd "$ROOT/frontend" && npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

wait
