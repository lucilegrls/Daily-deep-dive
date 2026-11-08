# Resource trust update — 2026-11-04

End-to-end application of the verified resource-trust handoff
(`verification-upload-2026-11-04.zip` + `2026-11-04-resource-replacement-candidates.json`).

## Code merge

Merged at exact repository paths, preserving newer project work (AGENTS.md kept
the newer branding and MCP rules; the zip's `drizzle/migrations/0010` was NOT
copied because `0010_keyless_research_pilot.sql` already occupies that number):

- `docs/RESOURCE_VERIFICATION.md` (new), `docs/BACKEND_RUNBOOK.md` (one added pointer)
- `scripts/verify-resource-inventory.mjs`, `scripts/import-resource-verification.mjs` (new)
- `src/lib/resource-health.ts`, `src/lib/resource-health.test.ts` (new)
- `src/lib/source-verification.functions.ts` (health dashboard query; legacy "delete" now retires)
- `src/lib/content.functions.ts`, `src/data/topics.ts` (risk level + genuine editorial review date)
- `src/components/VerificationPanel.tsx` (health queue, filters), `src/components/TopicSheet.tsx` (review date display)
- `supabase/migrations/20261027120000_resource_health_and_trust.sql` (canonical record)
- `verification-results/*` (audit artifacts)

Type fixes applied after merge: bracket access for index-signature counts in
`source-verification.functions.ts`, explicit callback parameter types in
`VerificationPanel.tsx`.

## Migration

Applied via the managed migration tool as `drizzle/migrations/0011_resource_health_and_trust.sql`
(byte-identical SQL to the supplied supabase migration). Adds trust columns on
`content_topics`/`content_resources`, append-only `resource_technical_checks`,
`resource_check_runs`, `resource_editorial_reviews`, `topic_claims`,
`claim_supporting_resources`, `claim_editorial_reviews`, editor-only RLS,
grants, and the `resource_technical_check_rollup` trigger.
`LINK_PROBE_ENABLED` remains disabled; no runtime probing was enabled.

## Observation import

1,300 technical observations from `verification-results/2026-11-03-resource-verification.json`
imported into `resource_technical_checks` under backfill run
`e25039c7-0b0e-4d46-97a8-3969dc1180e1` (checker `curiosity-resource-checker/1.0.0`):
1,236 succeeded, 64 failed, 134 redirected, 1 embed failure, avg 927 ms.
These are technical checks only; no editorial-review dates were created from them.
Three additional `editor_retry` observations record the confirmed false positives.

## Replacement ledger (31 records)

- 27 `replace` actions applied, all recorded in `source_replacements` with
  run_source `ledger-2026-11-04` and structured evidence (page_read,
  inspected 2026-11-04, no unknown checks):
  - 22 via `apply_verified_replacement` (atomic: new approved same-kind row,
    old row retired to `rejected`, audit row inserted).
  - 5 whose verified destination URL was already public in the same topic
    (29c818dc, 5bfea1a5, 8f0956c3, 938f5639, c81be42f): old row retired to
    `rejected`, audit row points at the existing public row
    (`destinationAlreadyPublic: true`). No duplicate rows created.
- 3 confirmed false positives kept (FTC dark patterns, FTC advertising,
  LINC/CNIL video): each received a fresh `healthy` technical observation;
  rollup reset their failure counters.
- 1 low-confidence Nature candidate (4e9e5bbc, topic 243): broken Nature URL
  retired from public display (back to `candidate`, needs_review with reason),
  replacement gap opened; the Nature Communications candidate was NOT
  auto-approved and waits in the editorial queue.
- No audit or history rows were deleted.

One integration fix during application: the replacement for topic 12 was first
inserted with an incorrect title (operator error); the title and audit note
were immediately corrected to the ledger values
("Studying the Influence of Gut Microbiota on Brain and Behavior: Part I", NCCIH).

## Verification

- Database: 1,294 approved, 29 rejected, 1 candidate (Nature), 331 published
  topics, 1,303 technical check rows, 27 ledger replacement records.
- Zero approved resources remain in `broken` / `embed_unavailable` / `removed`
  technical state.
- Test suite: 246 tests across 20 files, all passing.
- Typecheck: clean. Production build: OK.

## Not done / limits

- The observation import script (`scripts/import-resource-verification.mjs`)
  was not used directly because a service-role key is not available on this
  backend; the identical insert shape was applied through the managed SQL
  channel instead.
- Security scan results predating this change show only the two known
  info-level notes about the public theme catalogue (by design).
