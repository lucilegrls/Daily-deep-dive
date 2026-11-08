import { isSafeSourceUrl } from "./content-safety";

export type EmbedType = "video" | "internal_reader" | "embedded_external" | "pdf" | "audio" | "link_only";
export type RightsStatus = "owned" | "licensed" | "public_domain" | "embed_only" | "link_only" | "unknown";
export type EmbeddingStatus = "approved" | "blocked" | "needs_review" | "broken";
export const EMBED_TYPES: EmbedType[] = ["video", "internal_reader", "embedded_external", "pdf", "audio", "link_only"];
export const RIGHTS_STATUSES: RightsStatus[] = ["owned", "licensed", "public_domain", "embed_only", "link_only", "unknown"];
export const EMBEDDING_STATUSES: EmbeddingStatus[] = ["approved", "blocked", "needs_review", "broken"];

/** Browser destinations only. Not a server-side SSRF guard or a licence assertion. */
export function mediaUrl(raw: string | null | undefined): URL | null {
  if (!raw || raw !== raw.trim() || !/^https:\/\//.test(raw) || /[\\\s]/.test(raw) || !isSafeSourceUrl(raw)) return null;
  try {
    const u = new URL(raw);
    const h = u.hostname;
    if (u.username || u.password || u.port || !h.includes(".") || h.endsWith(".") || h.includes(":") || /^[\d.]+$/.test(h) || /(?:^|\.)(?:localhost|local|internal|lan|home|arpa)$/.test(h)) return null;
    return u;
  } catch { return null; }
}
export function canHostFullContent(rights: string | null | undefined): boolean {
  return rights === "owned" || rights === "licensed" || rights === "public_domain";
}
export function youtubeId(raw: string): string | null {
  const u = mediaUrl(raw);
  if (!u) return null;
  let id: string | null = null;
  if (u.hostname === "youtu.be") id = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(u.pathname)?.[1] ?? null;
  else if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(u.hostname)) {
    if (u.pathname === "/watch" && u.searchParams.getAll("v").length === 1) id = u.searchParams.get("v");
    else id = /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/.exec(u.pathname)?.[1] ?? null;
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
export function vimeoId(raw: string): string | null {
  const u = mediaUrl(raw);
  if (!u || !["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(u.hostname)) return null;
  return /^\/(?:video\/)?([1-9]\d{4,11})\/?$/.exec(u.pathname)?.[1] ?? null;
}
export interface PlayerInfo { provider: "youtube" | "vimeo"; src: string; thumbnail: string | null }
export function playerFor(url: string, embedUrl?: string | null): PlayerInfo | null {
  // Source identity wins; a malformed source must never be rescued by an embed URL.
  if (!mediaUrl(url)) return null;
  for (const candidate of [url, embedUrl]) {
    if (!candidate) continue;
    const yt = youtubeId(candidate);
    if (yt) return { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`, thumbnail: `https://i.ytimg.com/vi_webp/${yt}/hqdefault.webp` };
    const vm = vimeoId(candidate);
    if (vm) return { provider: "vimeo", src: `https://player.vimeo.com/video/${vm}?autoplay=1&dnt=1`, thumbnail: null };
  }
  return null;
}
export interface ModeInput {
  embedType: string; rightsStatus: string; embeddingStatus: string; url: string;
  embedUrl?: string | null; contentUrl?: string | null; hasBody?: boolean; kind?: string;
}
export interface SourceResolution {
  mode: EmbedType | "remote_pdf" | "provider";
  url?: string;
  reason?: string;
}
const unavailable = "This source cannot be displayed inside Curiosity, Sourced. Read it on the original site; access may require a subscription or sign-in.";
export function resolveSource(r: ModeInput): SourceResolution {
  const source = mediaUrl(r.url);
  if (!source) return { mode: "link_only", reason: "This address is not supported for in-app display." };
  if (["blocked", "broken"].includes(r.embeddingStatus) || r.rightsStatus === "link_only") return { mode: "link_only", reason: "In-app display is restricted or unavailable for this source. The original link remains available." };
  // Internal text is never replaced by an inferred reader with unknown rights.
  if (r.embedType === "internal_reader") return canHostFullContent(r.rightsStatus) && r.hasBody ? { mode: "internal_reader" } : { mode: "link_only", reason: unavailable };
  if (playerFor(r.url, r.embeddingStatus === "approved" ? r.embedUrl : null)) return { mode: "video" };
  if (r.embedType === "pdf" && canHostFullContent(r.rightsStatus) && r.contentUrl && mediaUrl(r.contentUrl)) return { mode: "pdf", url: r.contentUrl };
  if (r.embedType === "audio" && canHostFullContent(r.rightsStatus) && r.contentUrl && mediaUrl(r.contentUrl)) return { mode: "audio", url: r.contentUrl };
  if (r.embedType === "embedded_external" && r.embeddingStatus === "approved" && mediaUrl(r.embedUrl ?? r.url)) return { mode: "embedded_external", url: r.embedUrl ?? r.url };
  // Display the publisher's file directly in the browser: no copying, proxy or stored full text.
  if (/\.pdf$/i.test(source.pathname)) return { mode: "remote_pdf", url: source.href };
  if (["arxiv.org", "www.arxiv.org"].includes(source.hostname) && (!r.kind || ["papers", "pdfs", "articles"].includes(r.kind))) {
    const id = /^\/(?:abs|pdf)\/((?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v[1-9]\d*)?)(?:\.pdf)?$/.exec(source.pathname)?.[1];
    if (id) return { mode: "remote_pdf", url: `https://arxiv.org/pdf/${id}` };
  }
  if (source.hostname === "open.spotify.com") {
    const item = /^\/(episode|track)\/([A-Za-z0-9]{22})$/.exec(source.pathname);
    if (item) return { mode: "provider", url: `https://open.spotify.com/embed/${item[1]}/${item[2]}` };
  }
  if (["books.google.com", "books.google.fr"].includes(source.hostname) && source.pathname === "/books" && r.kind === "books") {
    const id = source.searchParams.get("id");
    if (id && /^[A-Za-z0-9_-]{6,40}$/.test(id)) return { mode: "provider", url: `https://books.google.com/books?id=${id}&pg=PA1&output=embed` };
  }
  return { mode: "link_only", reason: unavailable };
}
/** Compatibility for editor callers; remote browser displays are separate from hosted content. */
export function resolveMode(r: ModeInput): SourceResolution["mode"] { return resolveSource(r).mode; }
export const SECTION_ORDER = ["videos", "articles", "papers", "books", "pdfs", "podcasts", "tools"] as const;
export type SectionKey = (typeof SECTION_ORDER)[number];
export const SECTION_LABEL: Record<SectionKey, string> = { videos: "Videos", articles: "Articles", papers: "Academic papers", books: "Books", pdfs: "PDFs", podcasts: "Podcasts", tools: "Tools" };
