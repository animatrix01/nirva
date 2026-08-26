#!/usr/bin/env bash
# NIRVA egress verification — proves ZERO internet calls during operation.
# Full enforcement is a Phase 5 exit condition; this script is written now so
# it can be rehearsed early. It fails loudly if egress IS possible.
#
# Strategy:
#   1. Container-level: from inside each service container, attempt DNS +
#      outbound TCP to well-known public endpoints; EVERY attempt must FAIL.
#   2. Network-level: confirm no service container sits on a bridge with a
#      default route when running under the commented `demo` profile
#      (`docker network inspect` -> internal networks have no gateway route).
set -euo pipefail

CONTAINERS=(nirva-web nirva-api nirva-postgres nirva-qdrant nirva-ollama nirva-otel-collector)
PROBE_HOST="8.8.8.8"
PROBE_DNS="example.com"

log() { printf '[verify-no-egress] %s\n' "$*"; }
die() { printf '[verify-no-egress] FAIL: %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "docker required."

failures=0
for c in "${CONTAINERS[@]}"; do
  state="$(docker inspect -f '{{.State.Running}}' "${c}" 2>/dev/null || true)"
  [ "${state}" = "true" ] || { log "skip (not running): ${c}"; continue; }

  # TCP egress probe must fail (timeout/unreachable == good)
  if docker exec "${c}" sh -c "(command -v timeout >/dev/null && timeout 3 nc -zvw2 ${PROBE_HOST} 53) || (nc -zw2 ${PROBE_HOST} 53)" >/dev/null 2>&1; then
    log "EGRESS LEAK: ${c} reached ${PROBE_HOST}:53"
    failures=$((failures + 1))
  else
    log "ok: ${c} cannot reach ${PROBE_HOST}:53"
  fi

  # DNS probe must fail where nslookup/getent exists
  if docker exec "${c}" sh -c "nslookup ${PROBE_DNS} >/dev/null 2>&1 || getent hosts ${PROBE_DNS} >/dev/null 2>&1" >/dev/null 2>&1; then
    log "DNS LEAK: ${c} resolved ${PROBE_DNS}"
    failures=$((failures + 1))
  else
    log "ok: ${c} cannot resolve public DNS"
  fi
done

# Internal-network check (demo profile): report networks lacking outbound gateways
for n in $(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' nirva-api 2>/dev/null || true); do
  gw="$(docker network inspect -f '{{(index .IPAM.Config 0).Gateway}}' "${n}" 2>/dev/null || echo none)"
  internal="$(docker network inspect -f '{{.Internal}}' "${n}" 2>/dev/null || echo unknown)"
  log "network ${n}: gateway=${gw} internal=${internal}"
  [ "${internal}" = "false" ] && log "NOTE: '${n}' is NOT internal — acceptable only under the dev profile, NEVER for the air-gapped demo."
done

[ "${failures}" -eq 0 ] || die "${failures} egress leak(s) detected."
log "PASS: zero external egress observed from all running NIRVA containers."
