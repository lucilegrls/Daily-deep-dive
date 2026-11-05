#!/usr/bin/env bash
# Full database security suite: RLS role tests + source-health tests.
# Needs a privileged SQL session (psql as postgres via PG* env vars). Every
# script aborts its own transaction, so no test data is ever kept.
# Exits non-zero if any check fails or a summary is missing (CI-friendly).
set -u
dir="$(dirname "$0")"
status=0
for f in rls_roles.sql health_checks.sql rate_limits.sql streaks.sql; do
  out="$(psql -X -q -f "$dir/$f" 2>&1 | grep -oE '(RLS|HEALTH|RATE|STREAK)_RESULTS.*' | head -1)"
  echo "$f: ${out:-NO SUMMARY (script error)}"
  case "$out" in *"failed=0 "*) ;; *) status=1 ;; esac
done
exit $status
