/**
 * Verification batch. Bounded (≤25), single-flight via a lease on
 * verification_cursor, resumable via an id cursor. It makes NO network
 * fetches and NO AI calls, and it NEVER modifies a source row: it only
 * records outcomes and opens replacement gaps. A rejected source stays
 * visible until a verified same-kind replacement is published atomically
 * through apply_source_replacement (which needs a search/inspection
 * provider that is not configured).
 */
import { evaluateSource, productionKey, type RuleInput } from "@/lib/source-rules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export const SEARCH_BLOCKER =
  "Replacement discovery blocked: no search provider and no safe page/video inspector are configured.";

type Row = RuleInput & { id: string; topic_id: number; review_status: string; created_at: string; title: string };

export async function runVerificationBatch(db: Client, runSource: string, limit = 25) {
  const leaseUntil = new Date(Date.now() + 120_000).toISOString();
  const { data: lease } = await db
    .from("verification_cursor")
    .update({ lease_until: leaseUntil, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .lt("lease_until", new Date().toISOString())
    .select("last_resource_id, passes")
    .maybeSingle();
  if (!lease) return { processed: 0, busy: true, counts: {} as Record<string, number> };
  const release = () => db.from("verification_cursor").update({ lease_until: "epoch" }).eq("id", 1);

  const size = Math.min(Math.max(limit, 1), 25);
  const cols = "id, topic_id, kind, title, url, creator, author, publication, source, published_at, access_level, verification, review_status, created_at";
  let q = db.from("content_resources").select(cols).neq("review_status", "rejected").order("id").limit(size);
  if (lease.last_resource_id) q = q.gt("id", lease.last_resource_id);
  const { data: rows, error } = await q;
  if (error) {
    await release();
    return { processed: 0, busy: false, error: "Could not read sources.", counts: {} };
  }
  const batch = (rows ?? []) as Row[];
  const topicIds = [...new Set(batch.map((r) => r.topic_id))];
  const { data: siblings } = topicIds.length
    ? await db.from("content_resources").select("id, topic_id, kind, url, creator, title, created_at").in("topic_id", topicIds).neq("review_status", "rejected")
    : { data: [] };

  const counts: Record<string, number> = {};
  let last: string | null = lease.last_resource_id;
  for (const r of batch) {
    const key = productionKey(r);
    const dup = ((siblings ?? []) as Row[]).some(
      (s) => s.id !== r.id && s.topic_id === r.topic_id && s.kind === r.kind && productionKey(s) === key &&
        (s.created_at < r.created_at || (s.created_at === r.created_at && s.id < r.id)),
    );
    const ev = evaluateSource(r, { duplicateProduction: dup });
    counts[ev.outcome] = (counts[ev.outcome] ?? 0) + 1;
    let action = "recorded";
    if (ev.outcome === "rejected") {
      action = "rejection_pending_replacement";
      await db.from("replacement_gaps").upsert(
        { resource_id: r.id, topic_id: r.topic_id, reason: [...ev.hard, ...ev.missing].join(", "), blocker: SEARCH_BLOCKER, status: "open" },
        { onConflict: "resource_id" },
      );
    }
    await db.from("resource_verification_log").insert({
      resource_id: r.id,
      topic_id: r.topic_id,
      outcome: ev.outcome,
      failed_rules: [...ev.hard, ...ev.missing],
      exception_reason: ev.reason,
      evidence: ev.unknown.length
        ? `stored fields only; not inspected: ${ev.unknown.join(", ")}`
        : "stored fields and recorded checks; no page/video/transcript fetched by this run",
      page_inspected: false,
      action,
      run_source: runSource,
    });
    last = r.id;
  }
  const wrapped = batch.length < size;
  await db
    .from("verification_cursor")
    .update({
      last_resource_id: wrapped ? null : last,
      passes: wrapped ? (lease.passes ?? 0) + 1 : lease.passes,
      lease_until: "epoch",
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  return { processed: batch.length, busy: false, counts };
}
