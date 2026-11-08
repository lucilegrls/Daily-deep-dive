# Resource verification and trust

## Implementation assessment (before migration 0010)

The application already had three related but separate mechanisms:

- `source_link_checks` and a `link_check_rollup` trigger for technical link results;
- `resource_verification_log` for formal rules applied to stored metadata;
- `resource_embed_failures` for reader-reported display failures.

The editor desk exposed the latter two. The link-check route was deliberately
disabled because the Cloudflare worker cannot resolve and pin an outbound
connection to a validated public IP. Enabling ordinary `fetch` would leave a DNS
rebinding SSRF path. Existing source fields mixed legacy names (`last_checked`,
`last_checked_at`, `last_verified`) and did not provide a dedicated append-only
technical observation record, a human source-review record, or claim evidence.
The editor UI also offered permanent source deletion.

No live link-check evidence was fabricated during this implementation. The local
environment contains only a publishable Supabase key; read-only live count
requests timed out, and it cannot apply migrations or run a privileged backfill.

## Trust levels

1. **Link checked**: a row in `resource_technical_checks`. This records only a
   bounded network observation and rolls up into technical fields on
   `content_resources`.
2. **Source reviewed**: a row in `resource_editorial_reviews`, inserted by an
   authenticated editor. Link checks never write this table.
3. **Claim verified**: a claim in `topic_claims`, its evidence links in
   `claim_supporting_resources`, and a human decision in
   `claim_editorial_reviews`.

The public “Last reviewed” label reads only
`content_topics.last_editorial_review_at`, and only for elevated/high-risk
topics. A technical check cannot update that column.

## Health behavior

Technical states are `healthy`, `redirected`, `restricted`, `paywalled`,
`embed_unavailable`, `temporarily_unavailable`, `broken`, `removed`,
`needs_review`, and `unknown`. Link and embed state remain separate fields.

One network failure stays temporary. Repeated temporary failures become an
editor exception; persistent failures can be classified as broken by the
checker. HTTP 401/403 are restricted, 429 is temporary, and 410 is removed.
Normal cadence is 30 days, elevated 14 days, and high risk 7 days. Temporary
failures use bounded exponential backoff. These defaults live in
`src/lib/resource-health.ts` and must stay aligned with the database rollup.

## Security boundary

`LINK_PROBE_ENABLED` remains `false` in the application runtime. The stored probe
implementation blocks non-HTTP(S) schemes, credentials, unusual ports,
localhost, private/link-local/reserved IP ranges and internal host suffixes; it
revalidates every redirect, caps redirects at five, times out after nine seconds,
uses HEAD with a one-byte GET fallback and never executes remote JavaScript.

Those string checks cannot defeat DNS rebinding. Scheduled checking must run only
in an egress worker that resolves every hostname, rejects every non-public
address, and pins the request socket to the validated address while preserving
TLS SNI. Every redirect must repeat that process. Do not enable worker `fetch`
probing as a shortcut.

## Deployment and backfill

1. Apply `supabase/migrations/20261027120000_resource_health_and_trust.sql` in a
   non-production branch and run the RLS tests.
2. Regenerate `src/integrations/supabase/types.ts` from that branch.
3. Deploy a DNS-validating, IP-pinned egress worker with service-role access.
   Keep concurrency at four, batches at twelve or fewer, a five-redirect limit,
   a nine-second timeout and a small response cap.
4. Insert every observation into `resource_technical_checks`; never update or
   delete an observation. Use `resource_check_runs` for run-level metrics.
5. Backfill all approved resources in bounded batches until none remain with
   `technical_status='unknown'`. Resume from stored database state, not process
   memory.
6. Review the editor exception queue in priority order: high-risk broken/unknown,
   removed or repeatedly failing, overdue high-risk editorial reviews,
   embed-only failures, redirects/restrictions, then stale/never checked.

The migration is additive and preserves all existing rows. The former editor
“Delete” action now retires a resource by setting `review_status='rejected'` and
records a human review event; it does not delete the row.

## Complete inventory audit (2026-11-03)

The local snapshot captured on 2026-10-22 contains 331 published topics and
1,300 resource records (1,253 unique URLs). Every resource completed a bounded,
DNS-validating and IP-pinned technical check, followed by two exception retry
passes. Final record-level results:

- healthy: 970
- redirected: 134
- restricted: 110
- needs review after repeated inconclusive checks: 55
- embed unavailable: 22
- persistently broken: 9

There were no resources left in `temporarily_unavailable`. The 196-item
attention queue must not be described as 196 broken links: restrictions,
publisher bot controls and embed limitations are distinct from link failure.
The full machine-readable evidence is in
`verification-results/2026-11-03-resource-verification.json`; the readable queue
is in the adjacent Markdown report. Proposed actions for the nine persistent
404 records are documented separately in
`verification-results/2026-11-03-broken-resource-candidates.md`.

This audit is technical only. The available snapshot contains no trustworthy
human review events. One hundred topics fall into the existing high-risk law,
health, finance/economics, politics/institutions, or digital-rights categories;
they must be treated as never-confirmed editorially reviewed until review-table
evidence proves otherwise. Automated checks must never populate an editorial
review date.

## Verification performed locally

- Complete resource inventory audit: 1,300/1,300 records checked.
- Production build: passed.
- Unit suite: 20 files, 246 tests passed.
- Focused health/SSRF suite: 32 tests passed.
- Live schema migration, RLS execution and audit import: not performed because
  this checkout has no service-role credential. Run
  `node scripts/import-resource-verification.mjs` for a read-only dry run; after
  applying migration 0010, use `--commit` only with a service-role credential.

