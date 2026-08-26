#!/usr/bin/env bash
# NIRVA evaluation harness runner — Phase 5 exit-condition gate.
# Measures (against the REAL composed stack):
#   - Recall@5 >= 0.85 on the golden retrieval set
#   - groundedness (share of claims with valid citations)
#   - abstention scoring (thin-evidence cases must abstain)
#
# Until the AI lane lands packages/retrieval eval fixtures and the API lane
# exposes the eval endpoints, this script verifies stack health and exits
# non-zero with a clear "not ready" marker instead of pretending success.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_BASE="${NIRVA_API_BASE:-http://127.0.0.1:8000}"
EVAL_FIXTURES="${REPO_ROOT}/data/synthetic/evals"

log() { printf '[run-evals] %s\n' "$*"; }
die() { printf '[run-evals] ERROR: %s\n' "$*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || die "curl required."
command -v python3 >/dev/null 2>&1 || die "python3 required."

status="$(curl -s -o /dev/null -w '%{http_code}' "${API_BASE}/api/health" || true)"
[ "${status}" = "200" ] || die "stack unhealthy (${status}). Bring it up first: see docs/runbook.md."

if [ ! -d "${EVAL_FIXTURES}" ]; then
  log "eval fixtures missing at data/synthetic/evals/ (AI lane, Phase 5)."
  log "NOT READY: refusing to emit a passing result without measurements."
  exit 2
fi

TOKEN="$(curl -sf -X POST "${API_BASE}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin-password"}' |
  python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')" ||
  die "admin login failed."

mkdir -p "${REPO_ROOT}/docs/eval-results"
results_file="${REPO_ROOT}/docs/eval-results/results-$(date +%Y%m%d-%H%M%S).json"

log "running eval suite against ${API_BASE} ..."
curl -sf -X POST "${API_BASE}/api/admin/evals/run" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"fixtures_dir\": \"evals\"}" -o "${results_file}" ||
  die "eval endpoint unavailable (API lane Phase 5 scope)."

python3 - "${results_file}" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    r = json.load(f)
recall = r.get("recall_at_5", 0.0)
grounded = r.get("groundedness", 0.0)
abstain = r.get("abstention_score", 0.0)
print(f"[run-evals] Recall@5={recall:.3f} (target>=0.85)")
print(f"[run-evals] Groundedness={grounded:.3f}")
print(f"[run-evals] Abstention={abstain:.3f}")
sys.exit(0 if recall >= 0.85 else 1)
PY

log "PASS — results saved to ${results_file}"
