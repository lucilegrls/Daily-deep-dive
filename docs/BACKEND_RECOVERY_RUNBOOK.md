# Backend recovery runbook

Scope: the Deep Dive database (Lovable Cloud). Never run destructive recovery against production without a verified copy first.

## What protects us today
- Lovable Cloud runs managed daily backups; availability and retention depend on the plan and are **not verifiable from inside the project** — confirm in Lovable Cloud settings before relying on them. Point-in-time restore is not assumed.
- Every schema change is an additive, recorded migration (`supabase/migrations/`, `drizzle/migrations/`). Destructive SQL is blocked or needs owner approval.
- Source link changes are kept in `content_resource_url_history`; health checks in `content_health_checks`; incidents in `content_health_incidents`.
- Content-drop detection (pg_cron) opens an editor-desk incident if published topics/sources fall below baseline.

## Logical export (do this before any risky import or migration)
Run read-only queries and save the results outside the app:
`content_topics`, `content_resources`, `content_resource_private`, `content_topic_source_codes`, `content_topic_translations`, `concept_glossary`, `interest_lanes`, `interest_lane_categories`, `user_roles`.
Verify the copy: row counts match `select count(*)` on the live tables, and spot-check topic #1, #74, #331.

## Scenarios
1. **Accidental deletion of topics/sources** — stop editorial runs; compare live counts with the last export / health journal; re-insert missing rows from the export by `id`/`slug` with `ON CONFLICT DO NOTHING`. User saves/notes cascade with their topic, so restore topics *before* asking readers to re-save.
2. **Bad migration** — do not drop anything. Write a forward-fix migration (add back a column/policy, restore the previous function body from the earlier migration file).
3. **Broken deployment** — the database is shared by preview and live; roll back the site by restoring the previous version in Lovable history, then republish. No data step needed.
4. **Corrupted import** — imports are tagged by `origin` (e.g. `master-pdf-2026-09-27`). Identify rows by origin, set them to `status='draft'` (reversible) instead of deleting, then fix and re-publish.
5. **Account deletion request** — readers use *Account → Delete my account*. Their profile, interests, saves, reads, notes, progress and suggestions are removed; topics and sources are never touched. Editor/owner accounts are refused until the role is handed over.

## Owner steps: verify backups (non-destructive)
1. Open Lovable → project → Cloud (backend) settings and look for the backups / database section. Note: is a daily backup listed, its date, retention, and whether point-in-time restore is offered on your plan.
2. If nothing is shown, treat backups as **unverified** and do a logical export (above) before every risky change; ask Lovable support to confirm backup retention in writing.
3. Record the date checked and what you saw in `roadmap.md`. Never assume a restore works until one has been done into a separate copy.

## Restore into a separate environment (never over production)
1. Create a remix/copy of the project (its own empty backend) or a draft with an isolated backend.
2. Load the latest logical export into that copy only (topics, sources, source codes, glossary, lanes, translations).
3. Validate there: counts match the export, topics #1/#74/#331 open, feed shows 12 cards, `bash tests/rls/run.sh` (or the agent's privileged SQL tool) reports `failed=0` for both suites.
4. Only then repair production with targeted, additive re-inserts (`ON CONFLICT DO NOTHING`) by id/slug — never a full overwrite, which would erase readers' newer notes/saves.

## Rolling back
- **Bad migration:** forward-fix only (add back the column/policy/function body from the previous migration file); migrations are additive so old code keeps working meanwhile. Rerun both test suites.
- **Broken deployment:** restore the previous version from Lovable's version history, check the preview, then republish. The database is shared and is not touched.
- **Corrupted import:** find rows by `origin`, set `status='draft'`, fix, republish. Never delete.
- **Accidental deletion:** stop editorial work, compare counts with the latest export/health journal, re-insert missing rows from the export.

## Running the database tests
`bash tests/rls/run.sh` needs a privileged session (postgres). The sandbox's default SQL user is **not** privileged and reports "NO SUMMARY"; in that case paste each file into the agent's privileged SQL tool. Both scripts abort themselves: expect `RLS_RESULTS passed=21 failed=0` and `HEALTH_RESULTS passed=7 failed=0`.

## Verification checklist after any recovery
- `select count(*) from content_topics where status='published'` matches expectation.
- Run the role tests: `tests/rls/rls_roles.sql` (privileged session; always rolls back; expect `failed=0`).
- Open the feed signed out, open a topic, open a source.
