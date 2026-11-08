<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Branding uses one imported raster seal in the header and launch overlay; derive favicons and installable icons from it, and keep paper texture scoped to the launch screen — why: consistent identity without changing reader themes.
- Editorial `/api/public/editorial/*` routes always verify the cron secret (preview URL is public too); AI drafting only runs with `AI_DRAFTING_ENABLED=true` — why: no unauthenticated writes, no surprise AI spend.
- Server-side link probing stays disabled (`LINK_PROBE_ENABLED=false`) until egress can be pinned to a validated IP — why: string checks cannot stop DNS rebinding SSRF.
- Server loads use `retryTransient` (max 2, transient errors only) — why: retrying permanent errors only delays the error state.
- Content-drop detection is a pure-SQL pg_cron job calling run_content_health_check (SECURITY INVOKER, editor-gated); alerts only in the editor's desk — why: no external service, no personal data.
- Public leaderboard is a snapshot table (no user ids) refreshed by a revoked SECURITY DEFINER function via triggers + weekly pg_cron; own place via invoker my_leaderboard_place — why: no elevated RPC exposed. Reads retry only network/408/429/502-504, max 2; mutations never retry — why: no replayed writes.

- Topic Sheet owns individual lazy resource overlays; gateways and titles share the same sheet opener — why: preserve themed compositions and sheet scroll while reusing rights-gated media.
- All public source overlays use the pure viewer-media resolver; official player inference and browser-direct publisher files do not confer hosting rights or editorial approval, and explicit blocked/broken/link-only restrictions win — why: imported defaults must not prevent lawful display or override source restrictions.
- Bibliography links classify with the same resolver using public media metadata before click; unsupported sources retain native external links and viewer navigation filters them out — why: avoid useless intermediary views while preserving restrictions and modified-click behavior.
- Remote PDFs use lazy browser-only PDF.js with CORS, bounded loading/rendering and no persistence; stored PDFs retain their existing rights gate and progress — why: sandboxed native PDF plugins can silently stay blank, and publisher CORS restrictions must not be bypassed.
- Public topic/source prose uses the display-only reader-copy helper and omits workflow badges; never sanitize stored research or alter eligibility to clean wording — why: keep reader copy topical without losing audit evidence or source restrictions.
- Reader topic titles use the bundled reviewed mapping through topicTitle at display boundaries, keyed by canonical ID with slug validation; language changes never mutate fetched objects or query keys — why: consistent localization without altering research, search, ordering or pagination.
- Reader summaries use topicContext with bundled reviewed copy and exact ID/slug/title/context guards; untranslated source prose stays canonical rather than using unreviewed machine output — why: prevent stale translations and scientific mistranslations without changing data or eligibility.
- Reader source and takeaway translations use finite manually authored exact-string maps against a safe-public snapshot; source names, original-title tooltips and media language remain canonical — why: independently auditable French display without translating evidence or changing catalogue objects.
- Reader reads are append-only (SELECT/INSERT only) and source health uses separate columns (link_status, access_level, topic_fit_status, credibility_status, needs_review) — why: leaderboard integrity, and link success must never imply editorial approval.
- Account export/deletion live in src/lib/account-data.functions.ts; deletion refuses editor/owner accounts — why: never orphan the library or delete shared content.
- RLS role tests live in tests/rls/rls_roles.sql and always abort themselves — why: safe to run against the shared live database.
- Write abuse limits live in BEFORE INSERT triggers that count per account and server-stamp timestamps (raise 'rate_limited'); no IP logging — why: works without external services and can't be bypassed by forged dates.
- The old metadata-only source agent is retired; the verification panel is the single review workflow, and replacements go only through apply_verified_replacement (structured inspection evidence, idempotency key, expected updated_at) — why: no approvals from prose or metadata, no duplicate replacements, no overwriting owner edits.
- Resource imports use authenticated editor-only bounded insert-ignore batches, deterministic per-file/account row IDs, and expiring browser checkpoints; supplied records are retained in editor-private metadata — why: resume partial writes without overwriting sources, fetching external pages, or exposing research notes.
- Source verification (src/lib/source-verification.server.ts + source-rules.ts) never edits source rows: tri-state rules (unknown = blocked, never failure), rejections open replacement gaps and only apply_verified_replacement (same kind, atomic) hides a source; hourly schedule stays paused until the route is live — why: no fake verification, no lost coverage, no failing jobs.
- Web research uses only the Tavily keyless adapter (src/lib/tavily-keyless.server.ts, fixed endpoints, no key) via the 10-topic pilot; budget is reserved in reserve_research_call before each call and evidence lives in research_candidates/research_evidence, never content_resources — why: no paid fallback, hard caps, and machine-extracted text never auto-approves a source.
- Agent integrations: MCP tools live in src/lib/mcp/ (OAuth via Cloud Auth issuer, caller-scoped client, read-only); consent at /.lovable/oauth/consent; /auth honours a validated `next` — why: assistants act as the reader under existing RLS, never with elevated keys.
