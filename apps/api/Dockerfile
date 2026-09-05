# Build context is the REPOSITORY ROOT (see infra/compose/docker-compose.yml)
# so the API image can vendor packages/agent alongside the app.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv

COPY packages/agent/ ./packages/agent/
COPY packages/retrieval/ ./packages/retrieval/
COPY packages/tools/ ./packages/tools/
COPY apps/api/ ./apps/api/

RUN pip install --no-cache-dir /srv/packages/agent "/srv/packages/retrieval[parse,store]" /srv/packages/tools /srv/apps/api

# Repair layer: an engine crash mid-build once left null-byte-corrupted
# site-packages files; force-reinstall the entrypoint deps so the console
# script is guaranteed intact (small, cached-base rebuild).
RUN pip install --no-cache-dir --force-reinstall uvicorn==0.52.4

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
