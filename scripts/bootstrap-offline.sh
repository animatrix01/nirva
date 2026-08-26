#!/usr/bin/env bash
# NIRVA bootstrap — prepares an OFFLINE-capable machine from zero.
# Run this WHILE STILL ONLINE (model pulls need internet exactly once);
# afterwards the stack runs fully air-gapped.
#
# Usage: bash scripts/bootstrap-offline.sh [--verify-models]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODELS_YAML="${REPO_ROOT}/infra/model-config/models.yaml"
COMPOSE_FILE="${REPO_ROOT}/infra/compose/docker-compose.yml"
ENV_FILE="${REPO_ROOT}/.env"

log() { printf '[bootstrap] %s\n' "$*"; }
die() { printf '[bootstrap] ERROR: %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "docker not installed/running. Start Docker Desktop first."
docker compose version >/dev/null 2>&1 || die "docker compose v2 plugin missing."

# 1) .env from template
if [ ! -f "${ENV_FILE}" ]; then
  cp "${REPO_ROOT}/.env.example" "${ENV_FILE}"
  log "created .env from .env.example — EDIT IT: set a long random JWT_SECRET."
else
  log ".env already present, leaving untouched."
fi
grep -q '^JWT_SECRET=change-me' "${ENV_FILE}" && \
  log "WARNING: JWT_SECRET still set to template value — change before any demo."

# 2) Pre-pull images so later offline `up` never needs the network
log "pre-pulling pinned images (one-time, online)..."
docker compose -f "${COMPOSE_FILE}" pull --ignore-buildable-images || \
  die "image pull failed — fix connectivity or pin available versions."

# 3) Models: pull once now, verify checksums on every run thereafter
TEXT_MODEL="qwen2.5:7b-instruct-q4_K_M"
VISION_MODEL="qwen2.5vl:3b"
EMBED_MODEL="bge-m3"

detect_low_vram() {
  # <= 6 GB VRAM -> fall back to qwen2.5:3b (registry rule)
  if command -v nvidia-smi >/dev/null 2>&1; then
    total_mib="$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -n1)"
    if [ "${total_mib:-0}" -le 6144 ]; then
      TEXT_MODEL="qwen2.5:3b-instruct-q4_K_M"
      log "VRAM <= 6GB detected (${total_mib} MiB) -> pinning fallback text model qwen2.5:3b."
    fi
  fi
}
detect_low_vram

start_ollama_only() {
  docker compose -f "${COMPOSE_FILE}" up -d ollama
  for _ in $(seq 1 30); do
    [ "$(docker inspect -f '{{.State.Health.Status}}' nirva-ollama 2>/dev/null)" = "healthy" ] && return 0
    sleep 2
  done
  die "ollama container failed to become healthy."
}

if [ "${1:-}" = "--verify-models" ]; then
  start_ollama_only
  for m in "${TEXT_MODEL}" "${VISION_MODEL}" "${EMBED_MODEL}"; do
    docker exec nirva-ollama ollama show "${m}" >/dev/null 2>&1 || \
      die "model ${m} missing from local registry — rerun without --verify-models while ONLINE to pull it."
    log "verified present: ${m}"
  done
  grep -q 'PENDING_FIRST_PULL_VERIFY' "${MODELS_YAML}" && \
    log "NOTE: record sha256 digests into ${MODELS_YAML} after first pull (see file header)."
  exit 0
fi

start_ollama_only
for m in "${TEXT_MODEL}" "${VISION_MODEL}" "${EMBED_MODEL}"; do
  log "pulling ${m} (one-time, online)..."
  docker exec nirva-ollama ollama pull "${m}" || die "pull failed for ${m}"
done

# 4) Bring the rest of the stack up (builds api/web via their lanes' Dockerfiles)
log "starting full stack..."
docker compose -f "${COMPOSE_FILE}" up -d --build
log "DONE. Next: bash scripts/seed-demo-data.sh, then docs/runbook.md."
