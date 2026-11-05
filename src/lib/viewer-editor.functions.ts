import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSafeSourceUrl } from "@/lib/content-safety";
import { EMBED_TYPES, EMBEDDING_STATUSES, RIGHTS_STATUSES } from "@/lib/viewer-media";

async function assertEditor(supabase: { rpc: (n: "is_editor") => PromiseLike<{ data: unknown; error: unknown }> }) {
  const { data, error } = await supabase.rpc("is_editor");
  if (error || data !== true) throw new Response("Forbidden", { status: 403 });
}

export interface EditorViewerResource {
  id: string;
  kind: string;
  title: string;
  url: string;
  review_status: string;
  embed_type: string;
  embedding_status: string;
  rights_status: string;
  embed_url: string | null;
  thumbnail_url: string | null;
  content_url: string | null;
  is_start_here: boolean;
  published_at: string | null;
  last_checked_at: string | null;
  rights_notes: string | null;
  has_body: boolean;
  failures: number;
}

/** Every item (any status) for one topic, editors only. */
export const listViewerResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const topicId = Number((d as Record<string, unknown>)?.["topicId"]);
    if (!Number.isInteger(topicId) || topicId < 1) throw new Error("Invalid topic");
    return { topicId };
  })
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase);
    const sb = context.supabase;
    const { data: topic } = await sb.from("content_topics").select("id, title, slug").eq("id", data.topicId).maybeSingle();
    const { data: rows, error } = await sb
      .from("content_resources")
      .select("id, kind, title, url, review_status, embed_type, embedding_status, rights_status, embed_url, thumbnail_url, content_url, is_start_here, published_at, last_checked_at, position, content_resource_private(rights_notes)")
      .eq("topic_id", data.topicId)
      .order("position");
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.id);
    const [bodies, fails] = ids.length
      ? await Promise.all([
          sb.from("content_resource_bodies").select("resource_id").in("resource_id", ids),
          sb.from("resource_embed_failures").select("resource_id").in("resource_id", ids),
        ])
      : [{ data: [] }, { data: [] }];
    const bodySet = new Set((bodies.data ?? []).map((b) => b.resource_id));
    const failCount = new Map<string, number>();
    for (const f of fails.data ?? []) failCount.set(f.resource_id, (failCount.get(f.resource_id) ?? 0) + 1);
    const items: EditorViewerResource[] = (rows ?? []).map((r) => {
      const priv = r.content_resource_private as unknown as { rights_notes: string | null } | { rights_notes: string | null }[] | null;
      const p = Array.isArray(priv) ? priv[0] : priv;
      return {
        id: r.id, kind: r.kind, title: r.title, url: r.url, review_status: r.review_status,
        embed_type: r.embed_type, embedding_status: r.embedding_status, rights_status: r.rights_status,
        embed_url: r.embed_url, thumbnail_url: r.thumbnail_url, content_url: r.content_url,
        is_start_here: r.is_start_here, published_at: r.published_at, last_checked_at: r.last_checked_at,
        rights_notes: p?.rights_notes ?? null, has_body: bodySet.has(r.id), failures: failCount.get(r.id) ?? 0,
      };
    });
    return { topic, items };
  });

const optUrl = (v: unknown) => {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (!/^https:\/\//i.test(s) || !isSafeSourceUrl(s)) throw new Error("Links must be safe https addresses");
  return s.slice(0, 1000);
};
const pick = <T extends string>(list: readonly T[], v: unknown, label: string): T => {
  if (!list.includes(v as T)) throw new Error(`Invalid ${label}`);
  return v as T;
};

export const updateViewerResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const i = (d ?? {}) as Record<string, unknown>;
    const id = String(i["id"] ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid resource");
    const url = String(i["url"] ?? "").trim();
    if (!/^https?:\/\//i.test(url) || !isSafeSourceUrl(url)) throw new Error("Invalid source link");
    return {
      id,
      url,
      review_status: pick(["candidate", "approved", "rejected"] as const, i["review_status"], "approval"),
      embed_type: pick(EMBED_TYPES, i["embed_type"], "display mode"),
      embedding_status: pick(EMBEDDING_STATUSES, i["embedding_status"], "embed status"),
      rights_status: pick(RIGHTS_STATUSES, i["rights_status"], "rights status"),
      embed_url: optUrl(i["embed_url"]),
      thumbnail_url: optUrl(i["thumbnail_url"]),
      content_url: optUrl(i["content_url"]),
      is_start_here: i["is_start_here"] === true,
      mark_checked: i["mark_checked"] === true,
      rights_notes: typeof i["rights_notes"] === "string" ? i["rights_notes"].slice(0, 2000) : null,
      content_html: typeof i["content_html"] === "string" ? i["content_html"].slice(0, 400_000) : undefined,
    };
  })
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase);
    const sb = context.supabase;
    const { data: row, error: readErr } = await sb.from("content_resources").select("topic_id").eq("id", data.id).single();
    if (readErr) throw new Error(readErr.message);
    // Only one "Start here" per topic: clear the others first.
    if (data.is_start_here) {
      const { error } = await sb.from("content_resources").update({ is_start_here: false }).eq("topic_id", row.topic_id).neq("id", data.id).eq("is_start_here", true);
      if (error) throw new Error(error.message);
    }
    const { error } = await sb
      .from("content_resources")
      .update({
        url: data.url,
        review_status: data.review_status,
        embed_type: data.embed_type,
        embedding_status: data.embedding_status,
        rights_status: data.rights_status,
        embed_url: data.embed_url,
        thumbnail_url: data.thumbnail_url,
        content_url: data.content_url,
        is_start_here: data.is_start_here,
        ...(data.mark_checked ? { last_checked_at: new Date().toISOString(), last_checked: new Date().toISOString().slice(0, 10) } : {}),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const { error: pErr } = await sb.from("content_resource_private").upsert({ resource_id: data.id, rights_notes: data.rights_notes }, { onConflict: "resource_id" });
    if (pErr) throw new Error(pErr.message);
    if (data.content_html !== undefined) {
      const res = data.content_html.trim()
        ? await sb.from("content_resource_bodies").upsert({ resource_id: data.id, content_html: data.content_html }, { onConflict: "resource_id" })
        : await sb.from("content_resource_bodies").delete().eq("resource_id", data.id);
      if (res.error) throw new Error(res.error.message);
    }
    return { ok: true };
  });
