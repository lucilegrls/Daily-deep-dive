import raw from "./topics.json";
import type { ModeInput } from "@/lib/viewer-media";

export interface Verification {
  checkedAt?: string;
  reviewLevel?: string;
  limitation?: string;
}

export interface Resource {
  id?: string;
  isStartHere?: boolean;
  title: string;
  url: string;
  author?: string;
  source?: string;
  publication?: string;
  description?: string;
  hook?: string;
  verification?: Verification;
  media?: ModeInput;
}

export interface ResourceGroups {
  books: Resource[];
  papers: Resource[];
  videos: Resource[];
  articles: Resource[];
  pdfs?: Resource[];
  podcasts?: Resource[];
  tools?: Resource[];
}

export interface Topic {
  id: number;
  category: string;
  title: string;
  context: string;
  takeaways: string[];
  tags?: string[];
  lastVerified?: string;
  /** Genuine human editorial review only; never populated from a crawler. */
  lastEditorialReviewAt?: string;
  riskLevel?: "standard" | "elevated" | "high";
  ressources: ResourceGroups;
}

const data = raw as unknown as {
  topics: Topic[];
  updated?: string;
};

export const topics: Topic[] = data.topics;
export const libraryUpdated: string = data.updated ?? "";

export const categories: string[] = [
  ...new Set(topics.map((t) => t.category)),
].sort((a, b) => a.localeCompare(b));

export const GROUP_META = [
  { key: "books", label: "Books" },
  { key: "papers", label: "Papers" },
  { key: "videos", label: "Videos" },
  { key: "articles", label: "Articles" },
  { key: "pdfs", label: "PDFs" },
  { key: "podcasts", label: "Podcasts" },
  { key: "tools", label: "Tools" },
] as const;

export type GroupKey = (typeof GROUP_META)[number]["key"];

export function resourceCount(topic: Topic): number {
  return GROUP_META.reduce(
    (sum, g) => sum + (topic.ressources[g.key]?.length ?? 0),
    0,
  );
}

export function resourceMeta(resource: Resource): string {
  return [resource.author, resource.source, resource.publication]
    .filter(Boolean)
    .join(" • ");
}

export function matchesQuery(topic: Topic, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    topic.title,
    topic.context,
    topic.category,
    topic.takeaways.join(" "),
    (topic.tags ?? []).join(" "),
  ]
    .join(" ")
    .toLowerCase();
  return q
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export function relatedTopics(topic: Topic, limit = 3): Topic[] {
  const sameCategory = topics.filter(
    (t) => t.id !== topic.id && t.category === topic.category,
  );
  const others = topics.filter(
    (t) => t.id !== topic.id && t.category !== topic.category,
  );
  return [...sameCategory, ...others].slice(0, limit);
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
