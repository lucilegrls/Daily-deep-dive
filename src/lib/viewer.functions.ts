import { createServerFn } from "@tanstack/react-start";

import { isSafeSourceUrl } from "@/lib/content-safety";
import { createPublicServerClient } from "@/lib/supabase-public.server";

export interface ViewerResource {
  id: string;
  kind: string;
  title: string;
  url: string;
  creator: string | null;
  publisher: string | null;
  publication: string | null;
  duration: string | null;
  description: string | null;
  embedType: string;
  embeddingStatus: string;
  rightsStatus: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  contentUrl: string | null;
  isStartHere: boolean;
  lastCheckedAt: string | null;
  hasBody: boolean;
}

export interface ViewerTopic {
  id: number;
  slug: string;
  title: string;
  category: string;
  context: string;
  takeaways: string[];
  resources: ViewerResource[];
}

/**
 * Everything the Resource Viewer needs for one topic: approved items only
 * (row-level security enforces it too), metadata only — full stored text is
 * fetched separately, on demand, and only when its rights allow.
 */
export const getTopicViewer = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const id = Number((data as Record<string, unknown> | null)?.["id"]);
    if (!Number.isInteger(id) || id < 1) throw new Error("Invalid topic");
    return { id };
  })
  .handler(async ({ data }): Promise<ViewerTopic | null> => {
    const supabase = createPublicServerClient();
    const { data: topic, error } = await supabase
      .from("content_topics")
      .select("id, slug, title, category, context, takeaways")
      .eq("status", "published")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!topic) return null;

    const { data: rows, error: rErr } = await supabase
      .from("content_resources")
      .select(
        "id, kind, title, url, author, creator, source, publication, duration, description, embed_type, embedding_status, rights_status, embed_url, thumbnail_url, content_url, is_start_here, last_checked_at, last_checked, position",
      )
      .eq("topic_id", topic.id)
      .eq("review_status", "approved")
      .order("position");
    if (rErr) throw new Error(rErr.message);

    const ids = (rows ?? []).map((r) => r.id);
    const bodies = new Set<string>();
    if (ids.length) {
      const { data: b } = await supabase.from("content_resource_bodies").select("resource_id").in("resource_id", ids);
      for (const row of b ?? []) bodies.add(row.resource_id);
    }

    const resources: ViewerResource[] = (rows ?? [])
      .filter((r) => isSafeSourceUrl(r.url))
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        url: r.url,
        creator: r.author ?? r.creator ?? null,
        publisher: r.source ?? null,
        publication: r.publication ?? null,
        duration: r.duration ?? null,
        description: r.description ?? null,
        embedType: r.embed_type,
        embeddingStatus: r.embedding_status,
        rightsStatus: r.rights_status,
        embedUrl: r.embed_url,
        thumbnailUrl: r.thumbnail_url,
        contentUrl: r.content_url,
        isStartHere: r.is_start_here,
        lastCheckedAt: r.last_checked_at ?? r.last_checked ?? null,
        hasBody: bodies.has(r.id),
      }));

    return {
      id: topic.id,
      slug: topic.slug,
      title: topic.title,
      category: topic.category,
      context: topic.context,
      takeaways: topic.takeaways ?? [],
      resources,
    };
  });

/** Full stored text; RLS returns nothing unless rights are owned/licensed/public domain. */
export const getResourceBody = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const id = String((data as Record<string, unknown> | null)?.["id"] ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid resource");
    return { id };
  })
  .handler(async ({ data }): Promise<string | null> => {
    const supabase = createPublicServerClient();
    const { data: row, error } = await supabase
      .from("content_resource_bodies")
      .select("content_html")
      .eq("resource_id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row?.content_html ?? null;
  });

export interface ConceptLookup {
  term: string;
  glossary: { definition: string; simpleExplanation: string | null; whyItMatters: string | null } | null;
  topics: { id: number; slug: string; title: string; category: string }[];
  sources: { id: string; topicId: number; title: string; url: string; kind: string }[];
}

/** Deep Dive's own glossary, topics and approved sources — always before the wider web. */
export const lookupConcept = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const term = String((data as Record<string, unknown> | null)?.["term"] ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    if (term.length < 2) throw new Error("Select a longer word or phrase");
    return { term };
  })
  .handler(async ({ data }): Promise<ConceptLookup> => {
    const supabase = createPublicServerClient();
    const like = `%${data.term.replace(/[%_\\,()]/g, " ")}%`;
    const [g, t, s] = await Promise.all([
      supabase
        .from("concept_glossary")
        .select("definition, simple_explanation, why_it_matters")
        .eq("term", data.term.toLowerCase())
        .maybeSingle(),
      supabase.rpc("search_topics", { _query: data.term, _limit: 6, _offset: 0 }),
      supabase
        .from("content_resources")
        .select("id, topic_id, title, url, kind")
        .eq("review_status", "approved")
        .or(`title.ilike.${like},description.ilike.${like}`)
        .limit(8),
    ]);
    return {
      term: data.term,
      glossary: g.data
        ? {
            definition: g.data.definition,
            simpleExplanation: g.data.simple_explanation,
            whyItMatters: g.data.why_it_matters,
          }
        : null,
      topics: (t.data ?? []).map((r) => ({ id: r.id, slug: r.slug, title: r.title, category: r.category })),
      sources: (s.data ?? [])
        .filter((r) => isSafeSourceUrl(r.url))
        .map((r) => ({ id: r.id, topicId: r.topic_id, title: r.title, url: r.url, kind: r.kind })),
    };
  });
