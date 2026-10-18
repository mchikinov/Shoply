FROM node:24-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY frontend/ frontend/
COPY vite.config.ts tsconfig.json ./
COPY scripts/publish_frontend.mjs scripts/publish_frontend.mjs
RUN npm run build

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SHOPLY_HOST=0.0.0.0 \
    SHOPLY_PORT=8765 \
    SHOPLY_DATA_DIR=/app/var/data

WORKDIR /app
RUN groupadd --gid 10001 shoply && useradd --uid 10001 --gid shoply --no-create-home shoply
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=shoply:shoply backend/ backend/
COPY --chown=shoply:shoply public/ public/
COPY --from=frontend --chown=shoply:shoply /app/public/index.html /app/public/admin.html public/
COPY --from=frontend --chown=shoply:shoply /app/public/assets/build/ public/assets/build/
RUN mkdir -p var/data public/assets/uploads && chown -R shoply:shoply var public/assets/uploads
USER shoply
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "from urllib.request import urlopen; urlopen('http://127.0.0.1:8765/api/health', timeout=3).close()"
CMD ["python", "backend/server.py"]
