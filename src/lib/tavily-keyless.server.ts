/**
 * Tavily KEYLESS adapter. Fixed HTTPS endpoints, no API key, no Authorization
 * header, no endpoint override, 20 s timeout, no retries. Response bodies and
 * headers are never logged. Returned text is untrusted data.
 */
export const TAVILY_SEARCH = "https://api.tavily.com/search" as const;
export const TAVILY_EXTRACT = "https://api.tavily.com/extract" as const;
export const PROVIDER_TIMEOUT_MS = 20_000;

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export type ProviderResult<T> =
  | { ok: true; status: number; requestId: string | null; data: T }
  | { ok: false; status: number | null; quota: boolean; reason: string };

export interface SearchHit { url: string; title: string; content: string; score: number | null }
export interface ExtractOut { results: { url: string; raw_content: string }[]; failed: { url: string; error: string }[] }

const QUOTA = new Set([402, 403, 429, 432, 433]);

async function call(fetcher: Fetcher, endpoint: typeof TAVILY_SEARCH | typeof TAVILY_EXTRACT, body: object): Promise<ProviderResult<unknown>> {
  let res: Response;
  try {
    res = await fetcher(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tavily-Access-Mode": "keyless" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      redirect: "error",
    });
  } catch (e) {
    return { ok: false, status: null, quota: false, reason: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network_error" };
  }
  if (!res.ok) return { ok: false, status: res.status, quota: QUOTA.has(res.status), reason: `http_${res.status}` };
  let json: unknown;
  try { json = await res.json(); } catch { return { ok: false, status: res.status, quota: false, reason: "invalid_json" }; }
  const rid = (json as { request_id?: unknown })?.request_id;
  return { ok: true, status: res.status, requestId: typeof rid === "string" ? rid.slice(0, 120) : null, data: json };
}

export async function keylessSearch(fetcher: Fetcher, query: string, maxResults: number): Promise<ProviderResult<SearchHit[]>> {
  const q = query.slice(0, 399);
  const r = await call(fetcher, TAVILY_SEARCH, { query: q, max_results: Math.min(Math.max(maxResults, 1), 6), search_depth: "basic", include_answer: false, include_raw_content: false });
  if (!r.ok) return r;
  const raw = (r.data as { results?: unknown }).results;
  const hits: SearchHit[] = Array.isArray(raw)
    ? raw.flatMap((h) => {
        const o = h as Record<string, unknown>;
        return typeof o["url"] === "string"
          ? [{ url: o["url"], title: String(o["title"] ?? "").slice(0, 300), content: String(o["content"] ?? "").slice(0, 500), score: typeof o["score"] === "number" ? o["score"] : null }]
          : [];
      })
    : [];
  return { ...r, data: hits };
}

export async function keylessExtract(fetcher: Fetcher, urls: string[]): Promise<ProviderResult<ExtractOut>> {
  if (urls.length < 1 || urls.length > 5) return { ok: false, status: null, quota: false, reason: "url_limit" };
  const r = await call(fetcher, TAVILY_EXTRACT, { urls, extract_depth: "basic", format: "text", timeout: 15 });
  if (!r.ok) return r;
  const d = r.data as { results?: unknown; failed_results?: unknown };
  const results = Array.isArray(d.results)
    ? d.results.flatMap((x) => { const o = x as Record<string, unknown>; return typeof o["url"] === "string" ? [{ url: o["url"], raw_content: typeof o["raw_content"] === "string" ? o["raw_content"] : "" }] : []; })
    : [];
  const failed = Array.isArray(d.failed_results)
    ? d.failed_results.flatMap((x) => { const o = x as Record<string, unknown>; return typeof o["url"] === "string" ? [{ url: o["url"], error: String(o["error"] ?? "failed").slice(0, 200) }] : []; })
    : [];
  return { ...r, data: { results, failed } };
}
