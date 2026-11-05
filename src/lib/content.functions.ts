import { createServerFn } from "@tanstack/react-start";

import type { Resource, ResourceGroups, Topic } from "@/data/topics";
import { isSafeSourceUrl } from "@/lib/content-safety";
import type { InterestLane } from "@/lib/interests";
import { createPublicServerClient } from "@/lib/supabase-public.server";
import { rankTopicMatches } from "@/lib/topic-search";
import { categoryVariants, normalizeCategory } from "@/lib/content-labels";

export interface TopicSummary {
  id: number;
  slug: string;
  title: string;
  category: string;
  context: string;
  tags: string[];
  lastVerified?: string;
}

export interface TopicPage {
  items: TopicSummary[];
  total: number;
  offset: number;
  limit: number;
}

function emptyGroups(): ResourceGroups {
  return { books: [], papers: [], videos: [], articles: [], pdfs: [], podcasts: [], tools: [] };
}

function numberList(value: unknown, cap: number): number[] {
  return Array.isArray(value)
    ? [...new Set(value.map((n) => Number(n)).filter(Number.isFinite))].slice(
        0,
        cap,
      )
    : [];
}

function stringList(value: unknown, cap: number): string[] {
  return Array.isArray(value)
    ? value
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.slice(0, 80))
        .slice(0, cap)
    : [];
}

/**
 * One page of the feed. The whole order is decided by the database over the
 * entire published bank — preferred subjects mixed roughly three to one with
 * the rest, already-read topics last, jittered by a daily seed. Because the
 * order is a property of the query and not of the pages already loaded,
 * appending a page never reshuffles what the reader is looking at.
 */
export const listTopics = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const input = (data ?? {}) as Record<string, unknown>;
    return {
      query: typeof input["query"] === "string" ? input["query"].slice(0, 120) : "",
      category:
        typeof input["category"] === "string" && input["category"] !== "all"
          ? input["category"]
          : null,
      interests: stringList(input["interests"], 20),
      readIds: numberList(input["readIds"], 500),
      feedMix:
        input["feedMix"] === "focused" || input["feedMix"] === "exploratory"
          ? input["feedMix"]
          : "balanced",
      seed: Number(input["seed"] ?? 0) || 0,
      limit: Math.min(Math.max(Number(input["limit"] ?? 12) || 12, 1), 60),
      // Bounded so a crafted request cannot ask for an arbitrarily deep page.
      offset: Math.min(Math.max(Number(input["offset"] ?? 0) || 0, 0), 20000),
    };
  })
  .handler(async ({ data }): Promise<TopicPage> => {
    const supabase = createPublicServerClient();
    const { data: rows, error } = await supabase.rpc("feed_topics", {
      _query: data.query,
      ...(data.category ? { _category: data.category } : {}),
      _interests: data.interests,
      _read_ids: data.readIds,
      _mix: data.feedMix,
      _seed: data.seed,
      _limit: data.limit,
      _offset: data.offset,
    });


    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const items: TopicSummary[] = list.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      category: row.category,
      context: row.context,
      tags: row.tags ?? [],
      ...(row.last_verified ? { lastVerified: row.last_verified } : {}),
    }));

    return {
      items,
      total: Number(list[0]?.total_count ?? 0),
      offset: data.offset,
      limit: data.limit,
    };
  });

/**
 * The canonical subject catalogue shown at registration. Backed by the
 * `interest_lanes` table, so the choices are not limited to whatever happens
 * to be published today; each lane also reports how many published topics it
 * already covers so the wizard can be honest about a growing library.
 */
export const listInterestLanes = createServerFn({ method: "GET" }).handler(
  async (): Promise<InterestLane[]> => {
    const supabase = createPublicServerClient();
    const [lanes, links, published] = await Promise.all([
      supabase
        .from("interest_lanes")
        .select("slug, label, description, examples, position")
        .eq("active", true)
        .order("position"),
      supabase.from("interest_lane_categories").select("lane_slug, category"),
      supabase.from("content_topics").select("category").eq("status", "published"),
    ]);
    if (lanes.error) throw new Error(lanes.error.message);
    if (links.error) throw new Error(links.error.message);
    if (published.error) throw new Error(published.error.message);

    const counts = new Map<string, number>();
    for (const row of published.data ?? []) {
      counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
    }

    return (lanes.data ?? []).map((lane) => {
      const categories = (links.data ?? [])
        .filter((l) => l.lane_slug === lane.slug)
        .map((l) => l.category);
      return {
        slug: lane.slug,
        label: lane.label,
        description: lane.description,
        examples: lane.examples ?? [],
        categories,
        publishedCount: categories.reduce(
          (sum, c) => sum + (counts.get(c) ?? 0),
          0,
        ),
      };
    });
  },
);

export const listCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    const supabase = createPublicServerClient();
    const { data, error } = await supabase
      .from("content_topics")
      .select("category")
      .eq("status", "published");
    if (error) throw new Error(error.message);
    return [...new Set((data ?? []).map((row) => normalizeCategory(row.category)))].sort(
      (a, b) => a.localeCompare(b),
    );
  },
);

export interface TopicDetail extends Topic {
  slug: string;
  related: { id: number; slug: string; title: string }[];
}

export const getTopic = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const input = (data ?? {}) as Record<string, unknown>;
    return {
      slug: typeof input["slug"] === "string" ? input["slug"] : null,
      id: input["id"] != null ? Number(input["id"]) : null,
    };
  })
  .handler(async ({ data }): Promise<TopicDetail | null> => {
    const supabase = createPublicServerClient();
    let builder = supabase
      .from("content_topics")
      .select(
        "id, slug, title, category, context, takeaways, tags, last_verified, related_ids",
      )
      .eq("status", "published")
      .limit(1);
    builder = data.slug
      ? builder.eq("slug", data.slug)
      : builder.eq("id", data.id ?? -1);

    const { data: rows, error } = await builder;
    if (error) throw new Error(error.message);
    const topic = rows?.[0];
    if (!topic) return null;

    const { data: resources, error: resourceError } = await supabase
      .from("content_resources")
      .select(
        "id, is_start_here, kind, title, url, author, source, publication, creator, duration, description, verification, last_checked, position, embed_type, embedding_status, rights_status, embed_url, content_url",
      )
      .eq("topic_id", topic.id)
      .eq("review_status", "approved")
      .order("is_start_here", { ascending: false })
      .order("kind")
      .order("position");
    if (resourceError) throw new Error(resourceError.message);

    // Only body identifiers visible through the existing public rights policy, never text.
    const bodyIds = (resources ?? []).filter((r) => r.embed_type === "internal_reader" && isSafeSourceUrl(r.url)).map((r) => r.id);
    const bodies = new Set<string>();
    if (bodyIds.length) {
      const { data: bodyRows, error: bodyError } = await supabase.from("content_resource_bodies").select("resource_id").in("resource_id", bodyIds);
      if (bodyError) throw new Error(bodyError.message);
      for (const row of bodyRows ?? []) bodies.add(row.resource_id);
    }

    const ressources = emptyGroups();
    for (const row of resources ?? []) {
      if (!isSafeSourceUrl(row.url)) continue;
      const verification = (row.verification ?? {}) as Record<string, unknown>;
      const resource: Resource = {
        id: row.id,
        isStartHere: row.is_start_here,
        title: row.title,
        url: row.url,
        media: {
          url: row.url, kind: row.kind, embedType: row.embed_type,
          embeddingStatus: row.embedding_status, rightsStatus: row.rights_status,
          embedUrl: row.embed_url, contentUrl: row.content_url, hasBody: bodies.has(row.id),
        },
        ...(row.author ? { author: row.author } : {}),
        ...(row.source ? { source: row.source } : {}),
        ...(row.publication ? { publication: row.publication } : {}),
        ...(row.creator && !row.author ? { author: row.creator } : {}),
        ...(row.description ? { description: row.description } : {}),
        verification: {
          ...(typeof verification["checkedAt"] === "string"
            ? { checkedAt: verification["checkedAt"] }
            : row.last_checked
              ? { checkedAt: row.last_checked }
              : {}),
          ...(typeof verification["reviewLevel"] === "string"
            ? { reviewLevel: verification["reviewLevel"] }
            : {}),
          ...(typeof verification["limitation"] === "string"
            ? { limitation: verification["limitation"] }
            : {}),
        },
      };
      const group = row.kind as keyof ResourceGroups;
      ressources[group]?.push(resource);
    }

    const { data: related } = await supabase
      .from("content_topics")
      .select("id, slug, title")
      .eq("status", "published")
      .eq("category", topic.category)
      .neq("id", topic.id)
      .limit(3);

    return {
      id: topic.id,
      slug: topic.slug,
      title: topic.title,
      category: topic.category,
      context: topic.context,
      takeaways: topic.takeaways ?? [],
      tags: topic.tags ?? [],
      ...(topic.last_verified ? { lastVerified: topic.last_verified } : {}),
      ressources,
      related: related ?? [],
    };
  });

/**
 * The reader's saved topics, honouring the same search box and subject filter
 * as the main feed so the two behave alike. Every id the reader holds is
 * looked up — the list is their own, and it is not silently truncated.
 */
export const getTopicsByIds = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const input = (data ?? {}) as Record<string, unknown>;
    return {
      ids: numberList(input["ids"], 5000),
      query: typeof input["query"] === "string" ? input["query"].slice(0, 120) : "",
      category:
        typeof input["category"] === "string" &&
        input["category"] !== "all" &&
        input["category"] !== "saved"
          ? input["category"]
          : null,
    };
  })
  .handler(async ({ data }): Promise<TopicSummary[]> => {
    if (data.ids.length === 0) return [];
    const supabase = createPublicServerClient();

    let categoriesForFilter: string[] | null = null;
    if (data.category) {
      const { data: laneRows, error: laneError } = await supabase
        .from("interest_lane_categories")
        .select("category")
        .eq("lane_slug", data.category);
      if (laneError) throw new Error(laneError.message);
      categoriesForFilter = (laneRows ?? []).map((row) => row.category);
      if (categoriesForFilter.length === 0) categoriesForFilter = categoryVariants(data.category);
    }

    const rows: TopicSummary[] = [];
    // Chunked so a long saved list cannot blow past URL/statement limits.
    for (let i = 0; i < data.ids.length; i += 200) {
      const chunk = data.ids.slice(i, i + 200);
      let builder = supabase
        .from("content_topics")
        .select("id, slug, title, category, context, tags, last_verified")
        .eq("status", "published")
        .in("id", chunk);
      if (categoriesForFilter) builder = builder.in("category", categoriesForFilter);

      const { data: page, error } = await builder;
      if (error) throw new Error(error.message);
      for (const row of page ?? []) {
        rows.push({
          id: row.id,
          slug: row.slug,
          title: row.title,
          category: row.category,
          context: row.context,
          tags: row.tags ?? [],
          ...(row.last_verified ? { lastVerified: row.last_verified } : {}),
        });
      }
    }

    const filtered = rankTopicMatches(rows, data.query);

    // Most recently saved first, following the order the reader's list is in.
    const rank = new Map(data.ids.map((id, index) => [id, index]));
    return data.query.trim()
      ? filtered
      : filtered.sort(
          (a, b) => (rank.get(b.id) ?? 0) - (rank.get(a.id) ?? 0),
        );
  });
