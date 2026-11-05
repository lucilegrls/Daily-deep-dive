# Observability (production-safe diagnostics)

No external monitoring service is connected. Everything below uses what already exists.

## What is logged
One JSON line per event via `src/lib/diagnostics.ts` (`logEvent`, `safeMessage`, `friendlyError`).

| Area | Typical events | Level |
|---|---|---|
| auth | sign-in failure, session expired | warn/error |
| database | failed read/write (code only) | error |
| resource_load | embed blocked, source failed to display (expected) | info |
| source_check | link-check run summary (checker currently OFF) | info/warn |
| viewer | overlay/PDF failures | info/error |
| account | export/delete failures | error |
| api | unexpected errors that reached friendlyError | error |

Fields kept: time, area, event, level, HTTP status, database error code, short technical strings.

## Never logged
- Fields whose name contains token, password, secret, authorization, cookie, email, body, note, key, jwt, bearer, session, phone, address, name, or `ip`.
- In any value: email addresses, JWT-shaped strings, `sb_publishable_`/`sb_secret_` keys, long opaque tokens (replaced with `[email]` / `[redacted]`).
- Raw database messages are never shown to readers.
- No IP addresses are stored by the app. Rate limits count per account, not per IP.

## Noise control
The same area + event + level + code + status is printed at most once per 30 seconds per server instance or browser tab.

## Retention recommendation
- Function/server logs: keep the platform default (short, days). Don't export them anywhere else.
- `content_health_checks`: keep 90 days. `source_link_checks` holds only the latest result per source.
- `topic_reads` is the reading history and stays (needed for streaks); it is included in account export/deletion.

## How the owner inspects failures
1. Editor's desk → content-health panel: open incidents and the latest check.
2. Backend → Logs: search for `"level":"error"` and the area name.
3. Database checks: `bash tests/rls/run.sh` (role, source-health and rate-limit tests; all self-cancelling).
4. Scale check: `psql -X -f tests/perf/feed_benchmark.sql` (temporary copy, no real data touched).

## Alert thresholds (manual review, no paging service)
- More than 20 `database` errors in an hour, or any spike after a release → investigate or roll forward.
- More than 5 `auth` session errors per hour from different pages → check the sign-in service.
- Content-health incident open (published topics or approved sources fell below baseline) → treat as urgent.
- A reader hitting `rate_limited` more than once a day → check for a client loop, not abuse first.
- Feed benchmark execution time above 200 ms at 5,000 topics → revisit feed ordering.

## Write limits (per account, database-enforced)
| Write | Limit | Message |
|---|---|---|
| Topic suggestions | 10 per 24 h, no duplicate open title | own wording |
| "Source didn't display" reports | 1 per source per day, 20 per day | "Please wait…" |
| Reading-history entries | 1 per topic per day, 300 topics per day | "Please wait…" |
| Saves | 300 new saves per 24 h | "Please wait…" |
| Notes / progress | one row per topic/source, size-capped; updates single-flight in the app | — |

Sign-in, sign-up and password-reset rate limits are handled by the hosted authentication service, not by this app.
