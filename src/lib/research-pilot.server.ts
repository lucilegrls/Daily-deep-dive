/**
 * Evidence-only 10-topic research pilot (Tavily keyless). One provider call per
 * step, budget reserved atomically in the database first. Never touches
 * content_resources: it only writes research_candidates / research_evidence.
 * No AI calls. Discovery signals (score, snippet, title) are never evidence.
 */
import { authorityTier, dedupKey, isResearchUrl, isYouTube } from "@/lib/research-url";
import { keylessExtract, keylessSearch, type Fetcher } from "@/lib/tavily-keyless.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const MAX_URLS_PER_TOPIC = 6;
export const MAX_URLS_PER_EXTRACT = 5;
export const MAX_TEXT = 20_000;
export const MAX_EXCERPT = 600;

/** Checks this pilot can never pass by itself; a reviewer must decide them from the stored text. */
export const ALWAYS_BLOCKED = [
  "topic_fit_and_depth: needs reviewer reading of extracted text",
  "source_date: not verified (search dates are discovery hints only)",
  "provenance/creator: not verified",
  "no_wikipedia_research: not established by absence of a word",
];
export const YOUTUBE_BLOCKED = "video: not inspected (no watched video, transcript, upload date or description bibliography check)";

export function buildQuery(title: string): string {
  return `${title.replace(/\s+/g, " ").trim()} research university institution primary source`.slice(0, 399);
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type StepResult = { action: string; topicId?: number; stopped?: string; detail?: string };

async function reserve(db: Db, kind: "search" | "extract", topic: number | null, purpose: "pilot" | "smoke", n: number) {
  const { data, error } = await db.rpc("reserve_research_call", { _kind: kind, _topic: topic, _purpose: purpose, _url_count: n });
  if (error) return { id: null as number | null, reason: String(error.message ?? "reserve_failed") };
  return { id: data as number, reason: null };
}

async function finish(db: Db, id: number, status: string, http: number | null, rid: string | null) {
  await db.rpc("finish_research_call", { _id: id, _status: status, _http: http, _request_id: rid });
}

export async function runPilotStep(db: Db, fetcher: Fetcher): Promise<StepResult> {
  const init = await db.rpc("init_research_pilot");
  if (init.error) return { action: "error", detail: "Could not initialise pilot." };
  const { data: p } = await db.from("research_pilot").select("state").eq("id", 1).single();
  if (!p || p.state.startsWith("stopped") || p.state === "complete") return { action: "none", stopped: p?.state ?? "unknown" };

  const { data: topics } = await db.from("research_pilot_topics").select("topic_id, status, position").order("position");
  const next = (topics ?? []).find((t: { status: string }) => t.status === "pending" || t.status === "searched");
  if (!next) {
    await db.rpc("complete_research_pilot");
    return { action: "complete" };
  }
  return next.status === "pending" ? searchStep(db, fetcher, next.topic_id) : extractStep(db, fetcher, next.topic_id);
}

async function searchStep(db: Db, fetcher: Fetcher, topicId: number): Promise<StepResult> {
  const { data: topic } = await db.from("content_topics").select("id, title").eq("id", topicId).single();
  if (!topic) return { action: "error", topicId, detail: "topic not found" };
  const query = buildQuery(topic.title);
  const r = await reserve(db, "search", topicId, "pilot", 0);
  if (r.id === null) return { action: "stopped", topicId, stopped: r.reason ?? "reserve_failed" };
  const res = await keylessSearch(fetcher, query, MAX_URLS_PER_TOPIC);
  if (!res.ok) {
    await finish(db, r.id, res.quota ? "quota" : "failed", res.status, null);
    if (res.quota) return { action: "stopped", topicId, stopped: `quota_${res.status}` };
    await db.from("research_pilot_topics").update({ status: "blocked", query, note: `search failed: ${res.reason}`, updated_at: new Date().toISOString() }).eq("topic_id", topicId);
    return { action: "search_failed", topicId, detail: res.reason };
  }
  await finish(db, r.id, "ok", res.status, res.requestId);

  const { data: existing } = await db.from("content_resources").select("id, url").eq("topic_id", topicId);
  const existingByKey = new Map<string, string>();
  for (const e of existing ?? []) if (isResearchUrl(e.url)) existingByKey.set(dedupKey(e.url), e.id);

  const seen = new Set<string>();
  const rows = [];
  for (const h of res.data) {
    if (!isResearchUrl(h.url)) continue;
    const key = dedupKey(h.url);
    if (seen.has(key)) continue;
    seen.add(key);
    const host = new URL(h.url).hostname.toLowerCase();
    const yt = isYouTube(host);
    rows.push({
      topic_id: topicId, url: h.url.split("#")[0], dedup_key: key, host,
      title: h.title || null, snippet: h.content.slice(0, 500) || null, search_score: h.score,
      authority: authorityTier(host), existing_resource_id: existingByKey.get(key) ?? null,
      search_call_id: r.id, selected_for_extract: false,
      blocked_checks: yt ? [...ALWAYS_BLOCKED, YOUTUBE_BLOCKED] : ALWAYS_BLOCKED,
    });
    if (rows.length >= MAX_URLS_PER_TOPIC) break;
  }
  const rank = { institution: 0, publisher: 1, other: 2 } as const;
  const pick = rows.filter((x) => !isYouTube(x.host)).sort((a, b) => rank[a.authority] - rank[b.authority]).slice(0, MAX_URLS_PER_EXTRACT);
  for (const x of pick) x.selected_for_extract = true;
  if (rows.length) await db.from("research_candidates").upsert(rows, { onConflict: "topic_id,dedup_key", ignoreDuplicates: true });
  await db.from("research_pilot_topics").update({
    status: pick.length ? "searched" : "done", query,
    note: pick.length ? null : "no extractable candidate URLs", updated_at: new Date().toISOString(),
  }).eq("topic_id", topicId);
  return { action: "searched", topicId, detail: `${rows.length} candidates, ${pick.length} selected` };
}

async function extractStep(db: Db, fetcher: Fetcher, topicId: number): Promise<StepResult> {
  const [{ data: cands }, { data: done }] = await Promise.all([
    db.from("research_candidates").select("id, url, dedup_key").eq("topic_id", topicId).eq("selected_for_extract", true),
    db.from("research_evidence").select("dedup_key").eq("topic_id", topicId),
  ]);
  const have = new Set((done ?? []).map((d: { dedup_key: string }) => d.dedup_key));
  const todo = (cands ?? []).filter((c: { dedup_key: string }) => !have.has(c.dedup_key)).slice(0, MAX_URLS_PER_EXTRACT);
  if (!todo.length) {
    await db.from("research_pilot_topics").update({ status: "done", updated_at: new Date().toISOString() }).eq("topic_id", topicId);
    return { action: "extracted", topicId, detail: "already complete (resume)" };
  }
  const r = await reserve(db, "extract", topicId, "pilot", todo.length);
  if (r.id === null) return { action: "stopped", topicId, stopped: r.reason ?? "reserve_failed" };
  const res = await keylessExtract(fetcher, todo.map((c: { url: string }) => c.url));
  if (!res.ok) {
    await finish(db, r.id, res.quota ? "quota" : "failed", res.status, null);
    if (res.quota) return { action: "stopped", topicId, stopped: `quota_${res.status}` };
    await db.from("research_pilot_topics").update({ status: "blocked", note: `extract failed: ${res.reason}`, updated_at: new Date().toISOString() }).eq("topic_id", topicId);
    return { action: "extract_failed", topicId, detail: res.reason };
  }
  const byKey = new Map<string, string>();
  for (const x of res.data.results) if (isResearchUrl(x.url)) byKey.set(dedupKey(x.url), x.raw_content);
  const failed = new Map<string, string>();
  for (const f of res.data.failed) if (isResearchUrl(f.url)) failed.set(dedupKey(f.url), f.error);
  const now = new Date().toISOString();
  const rows = [];
  for (const c of todo as { id: string; url: string; dedup_key: string }[]) {
    const text = byKey.get(c.dedup_key);
    const base = { topic_id: topicId, candidate_id: c.id, url: c.url, dedup_key: c.dedup_key, provider_request_id: res.requestId, extract_call_id: r.id, retrieved_at: now, inspected_method: "machine_extracted_text" };
    if (text === undefined || text.trim() === "") {
      rows.push({ ...base, outcome: "failed", truncated: false, failure_reason: failed.get(c.dedup_key) ?? (text === "" ? "empty text returned" : "not returned by provider") });
      continue;
    }
    const stored = text.slice(0, MAX_TEXT);
    const truncated = text.length > MAX_TEXT;
    rows.push({
      ...base, returned_url: c.url, outcome: truncated ? "truncated" : text.length < 300 ? "partial" : "full",
      text_content: stored, excerpt: stored.slice(0, MAX_EXCERPT), original_chars: text.length, stored_chars: stored.length,
      truncated, content_hash: await sha256(text),
    });
  }
  await db.from("research_evidence").upsert(rows, { onConflict: "topic_id,dedup_key", ignoreDuplicates: true });
  await finish(db, r.id, res.data.failed.length || rows.some((x) => x.outcome === "failed") ? "partial" : "ok", res.status, res.requestId);
  await db.from("research_pilot_topics").update({ status: "done", updated_at: now }).eq("topic_id", topicId);
  return { action: "extracted", topicId, detail: `${rows.length} URLs` };
}

/** One real keyless search through the adapter, counted against the budget. */
export async function runSmokeSearch(db: Db, fetcher: Fetcher) {
  await db.rpc("init_research_pilot");
  const r = await reserve(db, "search", null, "smoke", 0);
  if (r.id === null) return { ok: false, detail: r.reason };
  const res = await keylessSearch(fetcher, "engineered living materials Cornell university research", 2);
  await finish(db, r.id, res.ok ? "ok" : res.quota ? "quota" : "failed", res.status, res.ok ? res.requestId : null);
  return res.ok ? { ok: true, detail: `${res.data.length} results` } : { ok: false, detail: res.reason };
}
