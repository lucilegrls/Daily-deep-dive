import { describe, expect, it, vi } from "vitest";

import { dedupKey, isResearchUrl } from "./research-url";
import { runPilotStep } from "./research-pilot.server";
import { keylessExtract, keylessSearch, TAVILY_EXTRACT, TAVILY_SEARCH } from "./tavily-keyless.server";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("research URL validation", () => {
  it.each([
    "http://example.edu/a", "https://user:pw@example.edu/", "https://127.0.0.1/", "https://10.0.0.1/x",
    "https://[::1]/", "https://localhost/", "https://foo.internal/", "https://en.wikipedia.org/wiki/X",
    "https://en.wikipedia.org./wiki/X", "https://www.wikiwand.com/en/X", "ftp://example.edu/", "javascript:alert(1)",
  ])("rejects %s", (u) => expect(isResearchUrl(u)).toBe(false));
  it("accepts public https and respects domain boundaries", () => {
    expect(isResearchUrl("https://elmi.cornell.edu/pages/people")).toBe(true);
    expect(isResearchUrl("https://notwikipedia.org/x")).toBe(true);
  });
  it("dedup strips fragment and tracking but keeps identifying params", () => {
    expect(dedupKey("https://A.edu/p?id=7&utm_source=x#sec")).toBe("https://a.edu/p?id=7");
    expect(dedupKey("https://a.edu/p?id=7")).not.toBe(dedupKey("https://a.edu/p?id=8"));
  });
});

describe("keyless adapter", () => {
  it("uses fixed endpoint, keyless header, no Authorization, never a key", async () => {
    process.env["TAVILY_API_KEY"] = "tvly-SECRET";
    const f = vi.fn(async () => json({ request_id: "r1", results: [{ url: "https://a.edu/x", title: "T", content: "c", score: 0.5 }] }));
    const r = await keylessSearch(f, "q".repeat(900), 99);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TAVILY_SEARCH);
    const h = init.headers as Record<string, string>;
    expect(h["X-Tavily-Access-Mode"]).toBe("keyless");
    expect(h["Authorization"]).toBeUndefined();
    expect(String(init.body)).not.toContain("tvly-SECRET");
    const body = JSON.parse(String(init.body));
    expect(body.query.length).toBeLessThan(400);
    expect(body.max_results).toBe(6);
    expect(r.ok && r.requestId).toBe("r1");
    delete process.env["TAVILY_API_KEY"];
  });
  it.each([429, 402, 403])("flags %s as quota stop", async (s) => {
    const r = await keylessSearch(async () => json({}, s), "q", 2);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.quota).toBe(true);
  });
  it("network failure is not quota and nothing is logged", async () => {
    const log = vi.spyOn(console, "log"); const err = vi.spyOn(console, "error");
    const r = await keylessExtract(async () => { throw new TypeError("fetch failed"); }, ["https://a.edu/"]);
    expect(!r.ok && r.reason).toBe("network_error");
    expect(log).not.toHaveBeenCalled(); expect(err).not.toHaveBeenCalled();
  });
  it("refuses more than 5 URLs per extraction without calling", async () => {
    const f = vi.fn();
    const r = await keylessExtract(f, Array.from({ length: 6 }, (_, i) => `https://a.edu/${i}`));
    expect(r.ok).toBe(false); expect(f).not.toHaveBeenCalled();
  });
});

/** In-memory stand-in for the database, enforcing the same caps as reserve_research_call. */
function fakeDb(caps = { call: 40, search: 20, extract: 20 }) {
  const pilot = { state: "ready", calls: 2, searches: 1, extracts: 1, inFlight: false };
  const tables: Record<string, Record<string, unknown>[]> = {
    research_pilot_topics: [{ topic_id: 1, position: 1, status: "pending" }, { topic_id: 2, position: 2, status: "pending" }],
    research_candidates: [], research_evidence: [],
    content_topics: [{ id: 1, title: "Topic one" }, { id: 2, title: "Topic two" }],
    content_resources: [{ id: "res-1", topic_id: 1, url: "https://a.edu/x#frag" }],
  };
  const resourceWrites: string[] = [];
  const q = (name: string) => {
    let rows = tables[name] ?? [];
    const filters: [string, unknown][] = [];
    const run = () => rows.filter((r) => filters.every(([k, v]) => r[k] === v));
    const b: Record<string, unknown> = {
      select: () => b, order: () => b,
      eq: (k: string, v: unknown) => { filters.push([k, v]); return b; },
      single: async () => ({ data: name === "research_pilot" ? pilot : run()[0] }),
      update: (patch: Record<string, unknown>) => { if (name === "content_resources") resourceWrites.push("update"); return { eq: async (k: string, v: unknown) => { rows.filter((r) => r[k] === v).forEach((r) => Object.assign(r, patch)); return {}; } }; },
      upsert: async (input: Record<string, unknown>[]) => {
        if (name === "content_resources") resourceWrites.push("upsert");
        for (const x of input) if (!rows.some((r) => r["topic_id"] === x["topic_id"] && r["dedup_key"] === x["dedup_key"])) rows.push({ id: `${name}-${rows.length}`, ...x });
        return {};
      },
      then: (res: (v: unknown) => void) => res({ data: run() }),
    };
    if (name === "research_pilot") rows = [pilot as never];
    return b;
  };
  let nextId = 1;
  const db = {
    from: q,
    rpc: async (fn: string, a: Record<string, unknown>) => {
      if (fn === "init_research_pilot" || fn === "complete_research_pilot") { if (fn === "complete_research_pilot") pilot.state = "complete"; return { data: [1, 2] }; }
      if (fn === "reserve_research_call") {
        if (pilot.state.startsWith("stopped")) return { error: { message: "pilot_stopped" } };
        if (pilot.inFlight) return { error: { message: "busy" } };
        const k = a["_kind"];
        if (pilot.calls >= caps.call || (k === "search" && pilot.searches >= caps.search) || (k === "extract" && pilot.extracts >= caps.extract)) return { error: { message: "budget_exhausted" } };
        pilot.calls++; if (k === "search") pilot.searches++; else pilot.extracts++;
        pilot.inFlight = true; return { data: nextId++ };
      }
      if (fn === "finish_research_call") { pilot.inFlight = false; if (a["_status"] === "quota") pilot.state = "stopped_quota"; return {}; }
      return {};
    },
  };
  return { db, pilot, tables, resourceWrites };
}

const searchBody = { request_id: "s", results: [
  { url: "https://a.edu/x", title: "A", content: "c", score: 0.9 },
  { url: "https://en.wikipedia.org/wiki/T", title: "W", content: "c", score: 0.99 },
  { url: "https://www.youtube.com/watch?v=1", title: "V", content: "c", score: 0.8 },
  { url: "https://b.org/y#top", title: "B", content: "c", score: 0.7 },
] };

describe("pilot pipeline (mocked provider)", () => {
  it("search → extract with partial results, reuses existing resource, never writes content_resources", async () => {
    const { db, tables, pilot, resourceWrites } = fakeDb();
    const fetcher = vi.fn(async (u: string) => u === TAVILY_SEARCH ? json(searchBody)
      : json({ request_id: "e", results: [{ url: "https://a.edu/x", raw_content: "x".repeat(25_000) }], failed_results: [{ url: "https://b.org/y", error: "blocked" }] }));
    expect((await runPilotStep(db, fetcher)).action).toBe("searched");
    const c = tables["research_candidates"]!;
    expect(c.map((x) => x["host"])).toEqual(["a.edu", "www.youtube.com", "b.org"]);
    expect(c[0]!["existing_resource_id"]).toBe("res-1");
    expect(c.find((x) => x["host"] === "www.youtube.com")!["selected_for_extract"]).toBe(false);
    expect((await runPilotStep(db, fetcher)).action).toBe("extracted");
    const e = tables["research_evidence"]!;
    const a = e.find((x) => x["url"] === "https://a.edu/x")!;
    expect(a["outcome"]).toBe("truncated"); expect(a["stored_chars"]).toBe(20_000); expect(a["original_chars"]).toBe(25_000);
    expect(a["inspected_method"]).toBe("machine_extracted_text");
    expect(e.find((x) => x["url"] === "https://b.org/y")!["outcome"]).toBe("failed");
    expect(pilot.calls).toBe(4);
    expect(resourceWrites).toEqual([]);
    // no metadata promotion: every candidate still lists unverified checks
    for (const x of c) expect((x["blocked_checks"] as string[]).length).toBeGreaterThanOrEqual(4);
  });
  it("stops on 429 and makes no further calls", async () => {
    const { db, pilot } = fakeDb();
    const fetcher = vi.fn(async () => json({}, 429));
    expect((await runPilotStep(db, fetcher)).stopped).toBe("quota_429");
    expect(pilot.state).toBe("stopped_quota");
    await runPilotStep(db, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("respects the global call cap before any provider call", async () => {
    const { db } = fakeDb({ call: 2, search: 20, extract: 20 });
    const fetcher = vi.fn();
    expect((await runPilotStep(db, fetcher)).stopped).toBe("budget_exhausted");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("single in-flight: a concurrent step is refused while one is reserved", async () => {
    const { db, pilot } = fakeDb();
    pilot.inFlight = true;
    const fetcher = vi.fn();
    expect((await runPilotStep(db, fetcher)).stopped).toBe("busy");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("resume is idempotent: re-running extraction for stored evidence makes no call", async () => {
    const { db, tables } = fakeDb();
    tables["research_pilot_topics"]![0]!["status"] = "searched";
    tables["research_candidates"]!.push({ id: "c1", topic_id: 1, url: "https://a.edu/x", dedup_key: "https://a.edu/x", selected_for_extract: true });
    tables["research_evidence"]!.push({ topic_id: 1, dedup_key: "https://a.edu/x" });
    const fetcher = vi.fn();
    expect((await runPilotStep(db, fetcher)).detail).toContain("resume");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
