# Build context is the REPOSITORY ROOT (see infra/compose/docker-compose.yml)
# so the API image can vendor packages/agent alongside the app.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv

COPY packages/agent/ ./packages/agent/
COPY apps/api/ ./apps/api/

RUN pip install --no-cache-dir /srv/packages/agent /srv/apps/api

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
