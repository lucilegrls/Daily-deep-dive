# Backend runbook — Deep Dive

## Shared database
The preview and the published app use **the same Lovable Cloud database**. Anything done while testing the preview (sign-ups, reads, suggestions, editor actions) affects real data. Test destructive scenarios only inside a transaction that ends in rollback (see "Safe access tests").

## Baseline (2026-09-26)
74 topics (all published) · 144 sources (all approved) · 13 interest lanes · 420 backlog ideas · 1 account (owner) · 1 note · 2 reads · 0 saves · 0 suggestions · 0 translations · 0 link checks.

## Integrity check (run before and after any migration)
```sql
select (select count(*) from content_topics where status='published') published,
       (select count(*) from content_resources where review_status='approved') approved,
       (select count(*) from topic_backlog) backlog,
       (select count(*) from profiles) profiles,
       (select count(*) from auth.users) users,
       (select count(*) from user_roles where role='owner') owners,
       (select count(*) from auth.users u left join profiles p on p.id=u.id where p.id is null) users_without_profile;
```
Alarm if `published` or `approved` drops unexpectedly, `owners` ≠ 1, or `users_without_profile` > 0. Profiles are created by the `on_auth_user_created` trigger (`ON CONFLICT DO NOTHING`, idempotent, never overwrites preferences).

## Safe access tests
Wrap in `DO $$ … RAISE EXCEPTION 'RESULT: %', r; $$` — the exception rolls everything back and returns the result. Impersonate with
`set_config('request.jwt.claims', json_build_object('sub',<uuid>,'role','authenticated')::text, true); SET LOCAL ROLE authenticated;`

## Operational safeguards in place
- Editorial HTTP endpoints (`/api/public/editorial/import`, `/daily-expansion`) always require the cron secret, in preview too.
- AI drafting is paused: `runDailyExpansion` makes no AI call unless `AI_DRAFTING_ENABLED=true`; it also refuses a second run within an hour.
- Link checker: **server-side probing is disabled** (`LINK_PROBE_ENABLED = false` in `src/lib/link-safety.ts`). The Worker runtime has no DNS resolution API and no fetch pinned to a validated IP, so a public name resolving or rebinding to an internal address cannot be excluded; string/IP checks alone are not SSRF protection. `checkSourceLinks` still requires an editor, makes no network request and returns `disabled`; a unit test proves no fetch is called. Old reports remain visible. The guarded implementation (`probeLink`, manual redirects re-validated, 5 hops, 9 s) is kept for a future platform with pinned egress.
- Reads: one per reader/topic/UTC day; `read_at`, `read_day` set by the server; seconds clamped 0–3600.
- Ranking exposes only display name, totals, place and an `is_me` flag; limit capped at 100.
- Suggestions: max 10 per reader per 24 h; identical waiting title refused.
- Feed: 10 s server timeout per database call and a 12 s browser-side timeout (`withTimeout`); automatic retries only for transient errors (max 2; a browser timeout is not retried); separate loading / empty / error / end states; failed next page keeps loaded topics and offers Retry.

## Backup and restore
- Lovable Cloud takes managed database backups; restoring is done from Cloud settings / support, not from the app. Storage files (e.g. uploaded assets) are separate from database backups.
- Before any risky change: export the integrity query output and the tables you touch (`copy (select …) to stdout`).
- Restore verification: restore into a **separate** project or branch, run the integrity query, compare with the baseline. Never test a restore on production.
- No destructive migrations: removals are done by status (`draft`, `rejected`, `declined`), not by deletion.

## Report — backend plan follow-up (2026-09-26)

### Migrations
1. `topic_reads` unique (user, topic, UTC day) + server-stamped guard trigger; `leaderboard` without user ids (`is_me` flag, limit ≤ 100); suggestion rate limit (10/24 h) + duplicate guard.
2. `feed_topics` (both overloads), `search_topics`, `is_editor`, `apply_onboarding` → SECURITY INVOKER (existing RLS already grants exactly what they need); `pg_trgm` moved from `public` to `extensions`.

Auth setting applied: leaked-password protection (HIBP) ON. Unchanged: sign-up open, email confirmation required, anonymous sign-in off.

### Security linter — 11 findings before, 2 after
| Lint | Object | Decision |
|---|---|---|
| 0014 extension_in_public | pg_trgm | Fixed: moved to `extensions`; trigram functions verified working |
| 0028/0029 | feed_topics (8 args) | Fixed: SECURITY INVOKER; anon still sees 74 published, 0 drafts |
| 0028/0029 | feed_topics (7 args, legacy) | Fixed: SECURITY INVOKER (kept, not removed) |
| 0028/0029 | search_topics | Fixed: SECURITY INVOKER |
| 0029 | is_editor | Fixed: SECURITY INVOKER; reads only the caller's own role row (allowed by `roles_select_own`); owner true, reader false |
| 0029 | apply_onboarding | Fixed: SECURITY INVOKER; own-row policies cover writes; already_onboarded / too_few_interests / ok verified |
| 0028 + 0029 | leaderboard | **Kept, accepted**: must aggregate other readers' private reads; returns only display name, totals, place, `is_me`; limit capped |

### Access matrix (rolled-back transactions against the real database)
| Action | Visitor | Reader A | Reader B | Owner/editor |
|---|---|---|---|---|
| Published topics / approved sources | yes (74/144) | yes | yes | yes |
| Drafts, private editorial notes | no | no | no | yes |
| Notes / reads / profile of another user | no | no | no (0 rows; updates affect 0) | own only |
| Own note | — | allowed by RLS | — | yes |
| Insert role / self-promote | no | no | no | no (roles not writable via API) |
| Forge another user's read | — | — | denied | — |
| Suggestion with non-`new` status | — | — | denied | — |
| Write link-check rows | no | no | denied | yes |
| Onboarding / streak functions | denied | yes | yes | yes |
| Ranking | name, totals, place | same | same | same |

### Loading states — browser test (network intercepted in the test browser only)
| Scenario | Result |
|---|---|
| Hung feed call | error + Try again after 12.5 s, 1 request, recovered on Try again |
| HTTP 500 | error after 0.6 s, 1 request (permanent → no retry), recovered |
| Proxy 502 | error after 0.6 s, 1 request, recovered |
| Empty result (nonsense search) | "Nothing in the library matches that yet." — no error, no zero-count flash |
| Next page fails | 12 topics kept, inline Try again, 24 after retry |
Limit: the first page is rendered with the page itself, so interception applies to client-side refetches (search/filter/next page). A raw 502 from the app host is not recognised as transient (the client sees a generic error), so it is not retried; database/gateway errors reported by the server are retried up to 2 times (unit-tested).

### Checklist
- Profiles: `on_auth_user_created` trigger, `ON CONFLICT DO NOTHING`; 0 users without profile; onboarding never rewrites preferences unless forced by the reader.
- Constraints: PKs on saves/notes (one per user/topic), reads unique per day, FKs with cascade, unique slug; 0 orphans, 0 duplicate slugs, 0 duplicate source URLs per topic, 0 Wikipedia URLs, 0 tables without RLS.
- Pagination: deterministic ordering (seeded hash + id tiebreak), offset/limit capped at 60.
- Logs: server logs record error codes only (no notes, emails, tokens).
- Cache: no shared caching of personal responses; no service worker (no cross-account cache).
- Content health for editors: see "Content-drop detection" below.
- Deployment: nothing published by this work.

### Commands (exit code 0 unless noted)
`bunx tsgo --noEmit` → 0 errors · `bunx vitest run` → 66 tests passed (4 files) · build log → build OK · browser scripts `/tmp/browser/final/run.py`, `/tmp/browser/net/feed_net2.py`.

### Counts before → after
74 published · 144 approved sources · 420 backlog · 1 profile · 1 owner · 1 note · 2 reads · 0 suggestions — unchanged. user_interests: 4 (not counted before this round).

### Still open (external action needed)
- Pinned-egress link checking: needs a platform capability that is not available; checker stays off.
- Daily expansion: not scheduled; AI drafting remains paused by choice.

## Content-drop detection (2026-09-26)
- **Scheduler:** Lovable Cloud's built-in database scheduler (`pg_cron`, part of the existing backend — no external service or cost). Job `content-health-daily`, `0 6 * * *` (06:00 UTC), runs pure SQL `SELECT public.run_content_health_check('scheduled');` — no HTTP, no secret. Verified active in `cron.job`; the same command was run once manually and returned all healthy.
- **Metrics / baselines** (`content_health_baselines`): published_topics 74 (tolerance 10% → threshold 67), approved_sources on published topics 144 (→130), published_categories 20 (→18), active_lanes 13 (tolerance 0 → 13). Update a baseline deliberately after a planned change (`update content_health_baselines set baseline=… where metric=…`).
- **Log** (`content_health_checks`): time, source (scheduled/editor), totals of those four metrics, healthy flag. No user data.
- **Incidents** (`content_health_incidents`): one open incident per metric (partial unique index); repeated failures update `observed`, `lowest_observed`, `seen_count`, `last_seen_at` instead of creating new alerts; recovery sets `status='resolved'`, `resolved_at`, `resolved_observed`.
- **Access:** tables and function readable/runnable only by owner/editor (`is_editor()` RLS); function is SECURITY INVOKER and refuses readers and visitors; the scheduler runs as the database owner.
- **Where it shows:** a persistent banner at the top of the editor's desk (normal / unusual drop / no check in 36 h) with "Check again now". **Not an out-of-session alert:** nothing is emailed or pushed; an editor sees it when opening the desk.
- **Tests:** SQL scenario run in a rolled-back transaction: normal → healthy, 0 open; 20 topics unpublished → 3 incidents (approved_sources 91<130, published_categories 11<18, published_topics 54<67); repeat → still 3 incidents, seen_count 2; restore → healthy, 0 open, 3 resolved; reader run DENIED, reader sees 0 incidents/0 checks, reader insert DENIED; visitor run DENIED; scheduler-context run OK. Unit tests for the banner (normal, alert, recovery, stale). Browser: owner opens /editor → "Library health: normal", "Check again now" records a new check.
- **Migrations:** health tables + `pg_cron` + function; SECURITY INVOKER + editor write policies; variable-name fix.
- **Results:** `bunx tsgo --noEmit` 0 errors · `bunx vitest run` 70 passed (5 files) · build OK · linter: 2 findings (leaderboard, accepted — unchanged).

## Backend limits follow-up (2026-09-26, second pass)

### 1. Ranking without elevated functions
- **Before:** linter `0028_anon_security_definer_function_executable` and `0029_authenticated_security_definer_function_executable`, both on `public.leaderboard(text, integer)`.
- **After:** linter "No linter issues found". Security scan: 0 warnings, 2 info findings (public read of `interest_lanes`, `interest_lane_categories` — an intentional catalogue). An intermediate scan flagged `lov_db_rls_tautology_permissive_v1_b2a4825486d25d3e` (unbounded public read of the snapshot); the policy is now limited to `place <= 100` and the finding is gone.
- **Architecture:** `leaderboard_snapshot(period, place, display_name, reads, refreshed_at)` has no user ID, email or private profile field. Public read only (top 100), no client write. It is refreshed by `refresh_leaderboard_snapshot()` (SECURITY DEFINER, EXECUTE revoked from PUBLIC/anon/authenticated) via statement triggers on `topic_reads` insert/update/delete and on `profiles` display_name update/delete, plus the weekly job `leaderboard-weekly-reset` (`1 0 * * 1`) so a new week starts empty. The old `leaderboard()` function was dropped.
- **"You":** `my_leaderboard_place(_period)` (SECURITY INVOKER, authenticated only) counts the caller's own reads through RLS and derives the place from public snapshot totals. The page marks the one row matching the caller's place, total and public name. Limit: two readers with the same name, place and total can't be told apart, and a place beyond 100 shows as about 101.

### 2. Retry on hosting or network outages
- `src/lib/retry.ts`: retries only network errors (failed to fetch, ECONNRESET…) and HTTP 408/429/502/503/504; at most 2 retries; backoff 500 ms → 1 s (4 s cap). Never retries other 4xx, validation, authorisation, 500, schema errors, or a final client timeout (12 s).
- `src/router.tsx`: read queries use this rule by default, and mutations use `retry: false`, so writes are never replayed. Feed and saved list use the same `retryDelay`.
- Retry button: with no page loaded, the feed is reset (`resetQueries`) and returns to a clean loading state. After a failed next page, the loaded pages are kept and only that page is fetched again.
- Tests (`src/lib/retry.test.ts`, deterministic with injected sleep/fake timers): network crash then success; network crash exhausted after 3 calls; 503 then success (one 500 ms wait); 401 in one call; final timeout surfaced after one call; bounded backoff; status table.

### 3. Updating health reference values
- Editor's desk → Library health → "Use current counts as reference…" shows a preview table (current reference vs. new value), then "Apply these references".
- Server: `previewHealthBaselines` / `applyHealthBaselines` (editor check plus strict validation of the 4 integer keys) → `rebase_content_health_baselines(_expected)` (SECURITY INVOKER, editor only). It refuses if live totals changed since the preview (`totals_changed_since_preview`), does nothing if values already match (`already_current`, no log row), and otherwise updates and writes old/new totals to `content_health_baseline_changes`. It never runs automatically; incidents are untouched.
- Rolled-back SQL test: rebase already current → false; stale preview → refused; 80→74 applied, 1 log row, open incident kept; repeat → already_current; reader: preview/rebase DENIED, direct update 0 rows, log invisible. Browser: preview shows 74/144/20/13, and Apply returns "already match; nothing changed".

### 4. Isolation method for tests
Access tests run in rolled-back transactions with simulated roles/JWT claims (`SET LOCAL ROLE anon|authenticated`, `request.jwt.claims` with the owner ID or a random UUID for a "reader"). No reader account or persistent test data is created. This is the chosen method.

### 5. Notifications
There is no external notification (no email provider, subscription or secret). Alerts stay as a persistent banner on the editor's desk.

### 6. Link checker
It stays disabled (`LINK_PROBE_ENABLED=false`). The test "probeLink when disabled never calls fetch" is kept and passes. No arbitrary server-side fetch is possible.

### Migrations (this pass)
1. `leaderboard_snapshot`, `refresh_leaderboard_snapshot`, triggers, `my_leaderboard_place`, drop `leaderboard`; `content_health_baseline_changes`, `content_health_current_totals`, `rebase_content_health_baselines`, editor UPDATE on baselines.
2. Public snapshot policy limited to `place <= 100`.
Jobs: `content-health-daily` (`0 6 * * *`), `leaderboard-weekly-reset` (`1 0 * * 1`).

### Files
`src/lib/retry.ts`, `src/lib/retry.test.ts`, `src/router.tsx`, `src/routes/index.tsx`, `src/routes/leaderboard.tsx`, `src/lib/editorial.functions.ts`, `src/routes/_authenticated/editor.tsx`.

### Commands and results
`bunx tsgo --noEmit` 0 errors · `bunx vitest run` 76 passed · build OK · linter clean · security scan 0 warnings.
Counts: 74 published topics, 144 approved sources, 20 categories, 13 active lanes, 420 backlog, 1 profile (owner), 1 note, 2 reads, 0 saves, 0 suggestions, 2 snapshot rows, 0 incidents, 2 health checks, 0 reference changes; 23/23 public tables with RLS.

### Limits that genuinely can't be solved here
- Link checking: no pinned egress IP in the runtime, so it stays disabled.
- Notifications outside the app: need a provider the user hasn't approved; the banner is the only alert.

## Home stuck on "Unsealing the first envelopes…" (2026-09-26, 14:34 UTC)
- **Diagnosis:** the backend and migrations weren't the cause. `feed_topics` was unchanged, and the preview's own network log shows the feed request returned 74 topics. Fresh headless reloads (visitor, signed in, Dark academia/Y2K/Maximalist, fr/ar/en, 670 px) all showed 12 cards. Of the two open preview tabs, one worked and the other didn't respond to scripts at all, which points to a tab frozen or never hydrated during the dev-server reloads caused by the last edits. The weak point: the home page's first page was fetched only after hydration, so server HTML always showed the loading text and stayed that way if the page never hydrated.
- **Fix:** the `/` loader now fetches the default first page on the server (bounded by an 8 s `withTimeout`; on failure it returns `null` and logs, so no pending SSR promise). The component uses it as `placeholderData` until the personalised page arrives, and endless scrolling waits for the real data. The day seed now comes from the loader, so SSR and hydration match.
- **Verification:** without JavaScript, 12 cards and "74 published topics" in 1.2 s. Visitor and signed in: 12 cards after 1.5 s, 24 after scrolling, total 74. Leaderboard as visitor shows "lucile"; signed in shows "lucile (you)". `tsgo` 0 errors, 76 tests, build OK, security scan 0 warnings (2 intentional info findings).
