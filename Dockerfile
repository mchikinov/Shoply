FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SHOPLY_HOST=0.0.0.0 \
    SHOPLY_PORT=8765 \
    SHOPLY_DATA_DIR=/app/var/data

WORKDIR /app
RUN groupadd --gid 10001 shoply && useradd --uid 10001 --gid shoply --no-create-home shoply
COPY --chown=shoply:shoply backend/ backend/
COPY --chown=shoply:shoply public/ public/
RUN mkdir -p var/data public/assets/uploads && chown -R shoply:shoply var public/assets/uploads
USER shoply
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "from urllib.request import urlopen; urlopen('http://127.0.0.1:8765/api/health', timeout=3).close()"
CMD ["python", "backend/server.py"]
