#!/usr/bin/env bash
set -euo pipefail

# Inicia apenas o frontend estatico em modo desenvolvimento.
# Uso: ./start.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Frontend estatico -> http://localhost:3000"
echo ""

cd "$ROOT"
npm run dev
