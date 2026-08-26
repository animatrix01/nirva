#!/usr/bin/env bash
# NIRVA demo-data seeding — idempotent; safe to re-run.
# Requires the composed stack healthy (api on http://127.0.0.1:8000).
#
# Seeds: demo users are provisioned by API-lane migrations (all four roles);
# this script logs in as admin and uploads AI-lane synthetic documents
# (data/synthetic/*) through the real POST /api/documents/upload contract.
set -euo pipefail

API_BASE="${NIRVA_API_BASE:-http://127.0.0.1:8000}"
SYNTH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../data/synthetic" 2>/dev/null && pwd || true)"
UPLOADS_DIR="${NIRVA_UPLOADS_DIR:-${SYNTH_DIR:-}}"

log() { printf '[seed] %s\n' "$*"; }
die() { printf '[seed] ERROR: %s\n' "$*" >&2; exit 1; }

wait_for_health() {
  log "waiting for ${API_BASE}/api/health ..."
  for _ in $(seq 1 60); do
    status="$(curl -s -o /dev/null -w '%{http_code}' "${API_BASE}/api/health" || true)"
    [ "${status}" = "200" ] && return 0
    sleep 2
  done
  die "api health never returned 200. Check: docker compose ps / logs nirva-api."
}

login() { # $1 user, $2 pass -> echoes JWT
  curl -sf -X POST "${API_BASE}/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$1\",\"password\":\"$2\"}" |
    python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])'
}

wait_for_health

ADMIN_TOKEN="$(login admin admin-password || true)"
[ -n "${ADMIN_TOKEN:-}" ] || die "admin login failed — has the API lane seeded the four demo users yet?"

# Golden-workflow equipment anchor: Pump P-204 corpus.
if [ -z "${UPLOADS_DIR}" ] || [ ! -d "${UPLOADS_DIR}" ]; then
  log "no synthetic corpus found (data/synthetic/* not landed by AI lane yet)."
  log "Seeding nothing beyond users. Re-run once data/synthetic exists."
  exit 0
fi

shopt -s nullglob
files=("${UPLOADS_DIR}"/*.{pdf,csv,txt})
count=0
for f in ${files[@]+"${files[@]}"}; do
  log "uploading $(basename "${f}")"
  resp="$(curl -s -X POST "${API_BASE}/api/documents/upload" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -F "file=@${f}" \
    -F "title=$(basename "${f}")" \
    -F "document_type=manual" \
    -F "revision=A" \
    -F "effective_date=2026-01-01" \
    -F "department=maintenance" \
    -F "equipment_id=P-204" \
    -F "confidentiality_level=internal" \
    -F "allowed_roles=engineer,safety_officer,supervisor,admin")" ||
    die "upload failed for ${f}"
  dup="$(printf '%s' "${resp}" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("duplicate",False))' || true)"
  [ "${dup}" = "True" ] && log "duplicate (already seeded): $(basename "${f}")"
  count=$((count + 1))
done
log "processed ${count} document(s). Demo corpus ready."
