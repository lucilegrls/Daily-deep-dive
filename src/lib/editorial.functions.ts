import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSafeSourceUrl, slugify } from "@/lib/content-safety";
import { LINK_PROBE_DISABLED_REASON, LINK_PROBE_ENABLED, probeLink } from "@/lib/link-safety";
import type { HealthIncident } from "@/lib/content-health";

async function assertEditor(supabase: {
  rpc: (name: "is_editor") => Promise<{ data: unknown; error: unknown }>;
}) {
  const { data, error } = await supabase.rpc("is_editor");
  if (error || data !== true) {
    throw new Response("Forbidden", { status: 403 });
  }
}

export const getEditorStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("is_editor");
    return { isEditor: data === true };
  });

export const getEditorialDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context.supabase as never);
    const supabase = context.supabase;

    const [topics, resources, runs, backlog, counts] = await Promise.all([
      supabase
        .from("content_topics")
        .select("id, slug, title, category, status, origin, last_verified, updated_at")
        .neq("status", "published")
        .order("updated_at", { ascending: false })
        .limit(50),
      supabase
        .from("content_resources")
        .select(
          "id, topic_id, kind, title, url, creator, duration, difficulty, format, review_status, last_checked, content_resource_private(selection_reason, credibility_notes, rejection_reason)",
        )
        .eq("review_status", "candidate")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("editorial_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(10),
      supabase
        .from("topic_backlog")
        .select("id, family, idea, status")
        .eq("status", "open")
        .limit(20),
      supabase
        .from("content_topics")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
    ]);

    const { count: videoTopics } = await supabase
      .from("content_resources")
      .select("topic_id", { count: "exact", head: true })
      .eq("kind", "videos")
      .eq("review_status", "approved");

    // The private review fields live in editor-only storage; they are flattened
    // here purely for the editor's desk, never for a public response.
    type PrivateBits = {
      selection_reason?: string | null;
      credibility_notes?: string | null;
      rejection_reason?: string | null;
    };
    const candidateResources = (resources.data ?? []).map((row) => {
      const { content_resource_private, ...rest } = row as typeof row & {
        content_resource_private: PrivateBits | PrivateBits[] | null;
      };
      const priv = (
        Array.isArray(content_resource_private)
          ? content_resource_private[0]
          : content_resource_private
      ) as PrivateBits | undefined;
      return {
        ...rest,
        selection_reason: priv?.selection_reason ?? null,
        credibility_notes: priv?.credibility_notes ?? null,
        rejection_reason: priv?.rejection_reason ?? null,
      };
    });

    return {
      drafts: topics.data ?? [],
      candidateResources,
      runs: runs.data ?? [],
      backlog: backlog.data ?? [],
      publishedCount: counts.count ?? 0,
      approvedVideoCount: videoTopics ?? 0,
    };
  });

export const setTopicStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const input = (data ?? {}) as Record<string, unknown>;
    const status = String(input["status"] ?? "");
    if (!["draft", "in_review", "published", "rejected"].includes(status)) {
      throw new Error("Unknown status");
    }
    return { id: Number(input["id"]), status, notes: String(input["notes"] ?? "") };
  })
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase as never);
    const { error } = await context.supabase
      .from("content_topics")
      .update({
        status: data.status,
        published_at: data.status === "published" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.notes) {
      const { error: noteError } = await context.supabase
        .from("content_topic_private")
        .upsert(
          { topic_id: data.id, editorial_notes: data.notes },
          { onConflict: "topic_id" },
        );
      if (noteError) throw new Error(noteError.message);
    }
    return { ok: true };
  });

export const reviewResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const input = (data ?? {}) as Record<string, unknown>;
    const status = String(input["review_status"] ?? "");
    if (!["candidate", "approved", "rejected"].includes(status)) {
      throw new Error("Unknown review status");
    }
    return {
      id: String(input["id"] ?? ""),
      review_status: status,
      reason: String(input["reason"] ?? ""),
      verificationExtent: String(input["verificationExtent"] ?? ""),
    };
  })
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase as never);
    const { error } = await context.supabase
      .from("content_resources")
      .update({
        review_status: data.review_status,
        last_checked: new Date().toISOString().slice(0, 10),
        verification: {
          reviewLevel: data.verificationExtent || "editor review",
          checkedAt: new Date().toISOString().slice(0, 10),
          ...(data.review_status === "approved" && data.reason
            ? { limitation: data.reason }
            : {}),
        },
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { error: privateError } = await context.supabase
      .from("content_resource_private")
      .upsert(
        {
          resource_id: data.id,
          rejection_reason:
            data.review_status === "rejected" ? data.reason || null : null,
        },
        { onConflict: "resource_id" },
      );
    if (privateError) throw new Error(privateError.message);
    return { ok: true };
  });

export const addResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const input = (data ?? {}) as Record<string, unknown>;
    const url = String(input["url"] ?? "");
    if (!isSafeSourceUrl(url)) {
      throw new Error("That link is not allowed: only http/https, and never Wikipedia.");
    }
    return {
      topic_id: Number(input["topic_id"]),
      kind: String(input["kind"] ?? "articles"),
      title: String(input["title"] ?? "").slice(0, 300),
      url,
      creator: String(input["creator"] ?? ""),
      duration: String(input["duration"] ?? ""),
      selection_reason: String(input["selection_reason"] ?? ""),
    };
  })
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase as never);
    const { data: inserted, error } = await context.supabase
      .from("content_resources")
      .insert({
        topic_id: data.topic_id,
        kind: data.kind,
        title: data.title,
        url: data.url,
        creator: data.creator || null,
        duration: data.duration || null,
        review_status: "candidate",
        origin: "editor",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.selection_reason && inserted) {
      const { error: reasonError } = await context.supabase
        .from("content_resource_private")
        .upsert(
          { resource_id: inserted.id, selection_reason: data.selection_reason },
          { onConflict: "resource_id" },
        );
      if (reasonError) throw new Error(reasonError.message);
    }
    return { ok: true };
  });

export const createTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const input = (data ?? {}) as Record<string, unknown>;
    const title = String(input["title"] ?? "").trim();
    if (title.length < 6) throw new Error("Give the topic a real title.");
    return {
      title,
      category: String(input["category"] ?? "Uncategorised"),
      context: String(input["context"] ?? ""),
    };
  })
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase as never);
    const slug = slugify(data.title);
    const { data: existing } = await context.supabase
      .from("content_topics")
      .select("id")
      .eq("slug", slug)
      .limit(1);
    if (existing && existing.length > 0) {
      throw new Error("A topic with that title already exists.");
    }
    const { data: maxRow } = await context.supabase
      .from("content_topics")
      .select("id")
      .order("id", { ascending: false })
      .limit(1);
    const id = (maxRow?.[0]?.id ?? 0) + 1;
    const { error } = await context.supabase.from("content_topics").insert({
      id,
      slug,
      title: data.title,
      category: data.category,
      context: data.context,
      status: "draft",
      origin: "editor",
    });
    if (error) throw new Error(error.message);
    return { id, slug };
  });

/**
 * Reader suggestions — editor side. Reads and writes go through the signed-in
 * editor's own database role, gated by is_editor() in RLS. No service role.
 */
export const listSuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context.supabase as never);
    const { data, error } = await context.supabase
      .from("topic_suggestions")
      .select(
        "id, title, details, lane_slug, status, created_at, topic_suggestion_private(editor_note)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => {
      const { topic_suggestion_private, ...rest } = row as typeof row & {
        topic_suggestion_private:
          | { editor_note: string | null }
          | { editor_note: string | null }[]
          | null;
      };
      const priv = Array.isArray(topic_suggestion_private)
        ? topic_suggestion_private[0]
        : topic_suggestion_private;
      return { ...rest, editor_note: priv?.editor_note ?? null };
    });
  });

export const setSuggestionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const input = (data ?? {}) as Record<string, unknown>;
    const status = String(input["status"] ?? "");
    if (!["new", "reviewed", "planned", "declined", "published"].includes(status)) {
      throw new Error("Unknown status");
    }
    const note = String(input["editor_note"] ?? "").trim();
    return {
      id: String(input["id"] ?? ""),
      status,
      editor_note: note.length > 0 ? note : null,
    };
  })
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase as never);
    const { error } = await context.supabase
      .from("topic_suggestions")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const { error: noteError } = await context.supabase
      .from("topic_suggestion_private")
      .upsert(
        { suggestion_id: data.id, editor_note: data.editor_note },
        { onConflict: "suggestion_id" },
      );
    if (noteError) throw new Error(noteError.message);
    return { ok: true };
  });

/**
 * Source-health checker — on demand, editor only, one batch per call so each
 * request stays short. Results go to source_link_checks (editor-only table).
 */

export const checkSourceLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const offset = Math.max(0, Math.floor(Number((data as { offset?: unknown })?.offset ?? 0)));
    return { offset, limit: 24 };
  })
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase as never);
    // Server-side probing is disabled: the runtime cannot pin a connection to
    // a validated IP, so DNS rebinding to internal addresses can't be ruled out.
    const result = await probeLink("", { enabled: LINK_PROBE_ENABLED });
    return {
      disabled: true as const,
      reason: result.detail ?? LINK_PROBE_DISABLED_REASON,
      checked: 0,
      next: data.offset,
      total: 0,
      done: true,
    };
  });

export const getSourceHealthReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context.supabase as never);
    const { data, error } = await context.supabase
      .from("source_link_checks")
      .select("outcome, status_code, final_url, detail, checked_at, content_resources(title, url, topic_id)")
      .order("checked_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((row) => {
      const res = row.content_resources as unknown as
        | { title: string; url: string; topic_id: number }
        | { title: string; url: string; topic_id: number }[]
        | null;
      const r = Array.isArray(res) ? res[0] : res;
      return { ...row, content_resources: undefined, title: r?.title ?? "", url: r?.url ?? "", topic_id: r?.topic_id ?? null };
    });
    const summary = { ok: 0, redirected: 0, broken: 0, blocked: 0, error: 0 } as Record<string, number>;
    for (const r of rows) summary[r.outcome] = (summary[r.outcome] ?? 0) + 1;
    return { summary, problems: rows.filter((r) => r.outcome !== "ok"), lastChecked: rows[0]?.checked_at ?? null };
  });

/** Content health (editor only). Reads incidents + last check; totals only, no personal data. */
export const getContentHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context.supabase as never);
    const [incidents, lastCheck] = await Promise.all([
      context.supabase
        .from("content_health_incidents")
        .select("metric, status, baseline, threshold, observed, lowest_observed, seen_count, opened_at, last_seen_at, resolved_at, resolved_observed")
        .order("opened_at", { ascending: false })
        .limit(20),
      context.supabase
        .from("content_health_checks")
        .select("checked_at, source, totals, healthy")
        .order("checked_at", { ascending: false })
        .limit(1),
    ]);
    if (incidents.error) throw new Error(incidents.error.message);
    if (lastCheck.error) throw new Error(lastCheck.error.message);
    const last = lastCheck.data?.[0] ?? null;
    return {
      incidents: (incidents.data ?? []) as HealthIncident[],
      lastCheck: last
        ? { checkedAt: last.checked_at, source: last.source, healthy: last.healthy, totals: last.totals as Record<string, number> }
        : null,
    };
  });

export const recheckContentHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context.supabase as never);
    const { data, error } = await context.supabase.rpc("run_content_health_check", { _source: "editor" });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const HEALTH_KEYS = ["published_topics", "approved_sources", "published_categories", "active_lanes"] as const;

/** Preview: current live totals next to the stored reference values (editor only). */
export const previewHealthBaselines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context.supabase as never);
    const [current, baselines] = await Promise.all([
      context.supabase.rpc("content_health_current_totals"),
      context.supabase.from("content_health_baselines").select("metric, baseline, tolerance"),
    ]);
    if (current.error) throw new Error(current.error.message);
    if (baselines.error) throw new Error(baselines.error.message);
    return {
      current: current.data as Record<string, number>,
      baselines: (baselines.data ?? []).map((b) => ({ metric: b.metric, baseline: b.baseline, tolerance: Number(b.tolerance) })),
    };
  });

/** Applies the previewed totals as new references; refused if totals changed since the preview. */
export const applyHealthBaselines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { expected: Record<string, number> }) => {
    const e = input?.expected;
    if (!e || typeof e !== "object") throw new Error("Invalid preview");
    const clean: Record<string, number> = {};
    for (const k of HEALTH_KEYS) {
      const v = e[k];
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 1_000_000) throw new Error("Invalid preview");
      clean[k] = v;
    }
    if (Object.keys(e).length !== HEALTH_KEYS.length) throw new Error("Invalid preview");
    return { expected: clean };
  })
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase as never);
    const { data: rows, error } = await context.supabase.rpc("rebase_content_health_baselines", { _expected: data.expected });
    if (error) throw new Error(error.message);
    const row = (rows ?? [])[0];
    return { changed: !!row?.changed, reason: String(row?.reason ?? "unknown") };
  });
