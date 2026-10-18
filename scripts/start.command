#!/bin/zsh
cd "$(dirname "$0")/.." || exit 1
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Для сборки интерфейса установите Node.js 22.13+ и npm."
  exit 1
fi
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (!((major === 22 && minor >= 13) || major === 24 || major >= 26)) { console.error("Нужен Node.js 22.13+ (рекомендуется 24 LTS)."); process.exit(1); }' || exit 1
if [[ ! -d node_modules ]]; then
  npm ci || exit 1
fi
npm run build || exit 1
exec python3 backend/server.py
