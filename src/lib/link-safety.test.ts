import { describe, expect, it } from "vitest";

import { isProbeableUrl, LINK_PROBE_ENABLED, probeLink } from "./link-safety";

const resp = (status: number, headers: Record<string, string> = {}) => new Response(null, { status, headers });

describe("link checker boundaries", () => {
  it("stays switched off in this runtime", () => expect(LINK_PROBE_ENABLED).toBe(false));
  it.each(["http://169.254.169.254/", "http://metadata.google.internal/", "https://en.wikipedia.org/wiki/X", "https://en.wikipedia.org./wiki/X", "http://[::1]/", "https://a:b@example.org/"])(
    "rejects %s", (u) => expect(isProbeableUrl(u)).toBe(false));
  it("revalidates every redirect hop", async () => {
    const seen: string[] = [];
    const f = (async (u: string) => { seen.push(u); return seen.length === 1 ? resp(301, { location: "https://ok.example.org/b" }) : resp(302, { location: "http://10.0.0.1/" }); }) as unknown as typeof fetch;
    const r = await probeLink("https://example.org/a", { enabled: true, fetchImpl: f });
    expect(r.outcome).toBe("blocked"); expect(seen).toHaveLength(2);
  });
  it("caps redirects", async () => {
    let n = 0;
    const f = (async () => resp(302, { location: `https://example.org/${++n}` })) as unknown as typeof fetch;
    expect((await probeLink("https://example.org/", { enabled: true, fetchImpl: f })).outcome).toBe("error");
    expect(n).toBeLessThanOrEqual(6);
  });
  it("falls back to a one-byte GET and never reads the body", async () => {
    const calls: { method: string | undefined; range: string | null }[] = [];
    const f = (async (_u: string, init: RequestInit) => { calls.push({ method: init.method, range: new Headers(init.headers).get("range") }); return calls.length === 1 ? resp(405) : resp(206); }) as unknown as typeof fetch;
    const r = await probeLink("https://example.org/book.pdf", { enabled: true, fetchImpl: f });
    expect(r.outcome).toBe("ok"); expect(calls[1]).toEqual({ method: "GET", range: "bytes=0-0" });
  });
  it("reports timeouts without raw errors", async () => {
    const f = (async () => { throw new DOMException("x", "TimeoutError"); }) as unknown as typeof fetch;
    expect(await probeLink("https://example.org/", { enabled: true, fetchImpl: f })).toMatchObject({ outcome: "error", detail: "Timed out" });
  });
  it("hints login/paywall without approving", async () => {
    const f = (async () => resp(401)) as unknown as typeof fetch;
    expect(await probeLink("https://example.org/", { enabled: true, fetchImpl: f })).toMatchObject({ outcome: "blocked", access_level: "login" });
  });
});
