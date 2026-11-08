import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertEditor(supabase: { rpc: (n: "is_editor") => PromiseLike<{ data: unknown }> }) {
  const { data } = await supabase.rpc("is_editor");
  if (data !== true) throw new Response("Forbidden", { status: 403 });
}

export const runVerificationNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context.supabase as never);
    const { runVerificationBatch } = await import("@/lib/source-verification.server");
    return runVerificationBatch(context.supabase, "editor", 25);
  });

export const getVerificationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context.supabase as never);
    // New trust tables are additive and may be newer than the generated client
    // types in an older checkout, so this dashboard intentionally performs a
    // narrow runtime query and validates/folds the returned values below.
    const db = context.supabase as any;
    const [cursor, log, gaps, total, health, sourceReviews, claimReviews] = await Promise.all([
      db.from("verification_cursor").select("passes, last_resource_id, updated_at, scheduler_state, scheduler_note").eq("id", 1).maybeSingle(),
      db.from("resource_verification_log").select("resource_id, topic_id, outcome, failed_rules, exception_reason, evidence, action, run_source, created_at").order("created_at", { ascending: false }).limit(2000),
      db.from("replacement_gaps").select("resource_id, topic_id, reason, blocker, status, opened_at").eq("status", "open").order("opened_at", { ascending: false }).limit(100),
      db.from("content_resources").select("id", { count: "exact", head: true }).neq("review_status", "rejected"),
      db.from("content_resources")
        .select("id, topic_id, kind, title, url, technical_status, embed_status, link_status, final_url, source_domain, mime_type, response_time_ms, last_checked_at, last_successful_check_at, last_failed_check_at, consecutive_failures, needs_review, needs_review_reason, next_check_at, content_topics(title, category, risk_level, last_editorial_review_at, next_editorial_review_due_at)")
        .eq("review_status", "approved").limit(2500),
      db.from("resource_editorial_reviews").select("resource_id", { count: "exact" }).limit(1),
      db.from("claim_editorial_reviews").select("id", { count: "exact", head: true }),
    ]);
    const latest = new Map<string, { outcome: string; topic_id: number }>();
    for (const r of log.data ?? []) if (!latest.has(r.resource_id)) latest.set(r.resource_id, r);
    const counts: Record<string, number> = { passing: 0, exceptional: 0, blocked: 0, rejected: 0 };
    const topics = new Set<number>();
    for (const v of latest.values()) {
      counts[v.outcome] = (counts[v.outcome] ?? 0) + 1;
      topics.add(v.topic_id);
    }
    const healthRows = (health.data ?? []).map((row: any) => {
      const joined = Array.isArray(row.content_topics) ? row.content_topics[0] : row.content_topics;
      return { ...row, content_topics: undefined, topic: joined ?? null };
    });
    const technicalCounts: Record<string, number> = { total: healthRows.length };
    const now = Date.now();
    const staleBefore = now - 35 * 86_400_000;
    for (const row of healthRows) {
      const status = row.technical_status ?? "unknown";
      technicalCounts[status] = (technicalCounts[status] ?? 0) + 1;
      if (!row.last_checked_at) technicalCounts["never_checked"] = (technicalCounts["never_checked"] ?? 0) + 1;
      else if (new Date(row.last_checked_at).getTime() < staleBefore) technicalCounts["stale"] = (technicalCounts["stale"] ?? 0) + 1;
      if (row.embed_status === "unavailable" || row.embed_status === "restricted") technicalCounts["embed_failures"] = (technicalCounts["embed_failures"] ?? 0) + 1;
      const due = row.topic?.next_editorial_review_due_at;
      if (due && new Date(due).getTime() < now) technicalCounts["editorial_review_due"] = (technicalCounts["editorial_review_due"] ?? 0) + 1;
      if (row.topic?.risk_level === "high" && (!row.topic.last_editorial_review_at || (due && new Date(due).getTime() < now))) {
        technicalCounts["high_risk_overdue"] = (technicalCounts["high_risk_overdue"] ?? 0) + 1;
      }
    }
    const severity = (row: any) => {
      const high = row.topic?.risk_level === "high";
      if (high && ["broken", "removed", "unknown"].includes(row.technical_status)) return 0;
      if (row.technical_status === "removed" || row.consecutive_failures >= 3) return 1;
      if (row.needs_review || ["broken", "needs_review"].includes(row.technical_status)) return 2;
      if (["redirected", "restricted", "paywalled", "embed_unavailable", "temporarily_unavailable"].includes(row.technical_status)) return 3;
      if (!row.last_checked_at || new Date(row.last_checked_at).getTime() < staleBefore) return 4;
      return 5;
    };
    const exceptionQueue = healthRows.filter((r: any) => severity(r) < 5).sort((a: any, b: any) => severity(a) - severity(b)).slice(0, 250);
    return {
      cursor: cursor.data,
      checked: latest.size,
      total: total.count ?? 0,
      topicsCovered: topics.size,
      counts,
      recent: (log.data ?? []).slice(0, 30),
      gaps: gaps.data ?? [],
      health: {
        counts: technicalCounts,
        queue: exceptionQueue,
        sourceReviews: sourceReviews.count ?? 0,
        claimReviews: claimReviews.count ?? 0,
        queryError: health.error?.message ?? sourceReviews.error?.message ?? claimReviews.error?.message ?? null,
      },
      blockers: [
        "Content inspection blocked: no safe page/video/transcript fetcher is configured (link probing stays off for DNS-rebinding safety).",
        "Replacement discovery blocked: no search provider is configured in this project.",
        "No AI model is used: judging stored metadata with a model would not verify live sources.",
        cursor.data?.scheduler_note ?? "Scheduler state unknown.",
      ],
    };
  });

export const editResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const i = (d ?? {}) as Record<string, unknown>;
    const title = String(i["title"] ?? "").trim().slice(0, 300);
    if (!title) throw new Error("Title required");
    return { id: String(i["id"] ?? ""), title };
  })
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase as never);
    const { error } = await context.supabase.from("content_resources").update({ title: data.title }).eq("id", data.id);
    if (error) throw new Error("Could not save.");
    return { ok: true };
  });

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ({ id: String(((d ?? {}) as Record<string, unknown>)["id"] ?? "") }))
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase as never);
    // Preserve the source, progress references and audit trail. “Delete” is a
    // legacy function name kept for client compatibility; the action retires.
    const { error } = await context.supabase.from("content_resources").update({
      review_status: "rejected",
      needs_review: false,
      needs_review_reason: "Retired by an editor; historical row retained",
    }).eq("id", data.id);
    if (error) throw new Error("Could not retire this source.");
    const { error: reviewError } = await (context.supabase as any).from("resource_editorial_reviews").insert({
      resource_id: data.id,
      reviewer: context.userId,
      decision: "rejected",
      notes: "Retired from publication. The source row was retained.",
    });
    if (reviewError) throw new Error("The source was retired, but its review audit event could not be recorded.");
    return { ok: true };
  });
