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
    const db = context.supabase;
    const [cursor, log, gaps, total] = await Promise.all([
      db.from("verification_cursor").select("passes, last_resource_id, updated_at, scheduler_state, scheduler_note").eq("id", 1).maybeSingle(),
      db.from("resource_verification_log").select("resource_id, topic_id, outcome, failed_rules, exception_reason, evidence, action, run_source, created_at").order("created_at", { ascending: false }).limit(2000),
      db.from("replacement_gaps").select("resource_id, topic_id, reason, blocker, status, opened_at").eq("status", "open").order("opened_at", { ascending: false }).limit(100),
      db.from("content_resources").select("id", { count: "exact", head: true }).neq("review_status", "rejected"),
    ]);
    const latest = new Map<string, { outcome: string; topic_id: number }>();
    for (const r of log.data ?? []) if (!latest.has(r.resource_id)) latest.set(r.resource_id, r);
    const counts: Record<string, number> = { passing: 0, exceptional: 0, blocked: 0, rejected: 0 };
    const topics = new Set<number>();
    for (const v of latest.values()) {
      counts[v.outcome] = (counts[v.outcome] ?? 0) + 1;
      topics.add(v.topic_id);
    }
    return {
      cursor: cursor.data,
      checked: latest.size,
      total: total.count ?? 0,
      topicsCovered: topics.size,
      counts,
      recent: (log.data ?? []).slice(0, 30),
      gaps: gaps.data ?? [],
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
    const { error } = await context.supabase.from("content_resources").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete this source (it may be linked to reader progress).");
    return { ok: true };
  });
