import { describe, expect, it, vi } from "vitest";

import { isProbeableUrl } from "./link-safety";
import { isTransientError, retryDelay, retryRead, retryTransient, withTimeout } from "./retry";

describe("retryTransient", () => {
  it("retries only network errors and 408/429/502/503/504, at most twice", () => {
    expect(isTransientError(new TypeError("Failed to fetch"))).toBe(true);
    for (const status of [408, 429, 502, 503, 504]) expect(isTransientError({ status })).toBe(true);
    expect(isTransientError(new Error("HTTP 503"))).toBe(true);
    const gateway = Object.assign(new Error("bad gateway"), { status: 502 });
    expect(retryTransient(0, gateway)).toBe(true);
    expect(retryTransient(1, gateway)).toBe(true);
    expect(retryTransient(2, gateway)).toBe(false);
  });
  it("does not retry permanent, validation, auth or timeout errors", () => {
    for (const status of [400, 401, 403, 404, 409, 422, 500]) expect(isTransientError({ status })).toBe(false);
    expect(isTransientError(new Error("permission denied for table"))).toBe(false);
    expect(isTransientError(new Error("Forbidden"))).toBe(false);
    expect(isTransientError(new Error("Could not find the table in the schema cache"))).toBe(false);
    expect(isTransientError(new DOMException("t", "TimeoutError"))).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });
  it("bounds the backoff", () => {
    expect([0, 1, 2, 3, 9].map(retryDelay)).toEqual([500, 1000, 2000, 4000, 4000]);
  });
});

describe("retryRead (deterministic)", () => {
  const noSleep = async () => {};
  it("recovers after a network crash", async () => {
    let calls = 0;
    const r = await retryRead(async () => { if (++calls < 3) throw new TypeError("fetch failed"); return "ok"; }, noSleep);
    expect(r).toBe("ok"); expect(calls).toBe(3);
  });
  it("gives up after two retries of a network crash", async () => {
    let calls = 0;
    await expect(retryRead(async () => { calls++; throw new TypeError("Failed to fetch"); }, noSleep)).rejects.toThrow();
    expect(calls).toBe(3);
  });
  it("503 then success", async () => {
    let calls = 0; const waits: number[] = [];
    const r = await retryRead(async () => { if (++calls === 1) throw Object.assign(new Error("unavailable"), { status: 503 }); return 42; }, async (ms) => { waits.push(ms); });
    expect(r).toBe(42); expect(calls).toBe(2); expect(waits).toEqual([500]);
  });
  it("401 is not retried", async () => {
    let calls = 0;
    await expect(retryRead(async () => { calls++; throw Object.assign(new Error("Unauthorized"), { status: 401 }); }, noSleep)).rejects.toThrow("Unauthorized");
    expect(calls).toBe(1);
  });
  it("a final timeout is surfaced without waiting again", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const p = retryRead(() => { calls++; return withTimeout(new Promise(() => {}), 12_000); }, noSleep);
    const assertion = expect(p).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(12_000);
    await assertion; expect(calls).toBe(1);
    vi.useRealTimers();
  });
});

describe("isProbeableUrl (SSRF guard)", () => {
  it("allows public http(s) hosts", () => {
    expect(isProbeableUrl("https://www.nature.com/articles/x")).toBe(true);
    expect(isProbeableUrl("http://example.org/")).toBe(true);
  });
  it.each([
    "ftp://example.org/",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://localhost/",
    "http://127.0.0.1/",
    "http://10.0.0.5/",
    "http://172.20.1.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://100.64.0.1/",
    "http://0.0.0.0/",
    "http://[::1]/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://2130706433/",
    "http://0x7f.0.0.1/",
    "http://printer.local/",
    "http://metadata.internal/",
    "https://user:pass@example.org/",
    "https://example.org:8080/",
    "http://intranet/",
  ])("blocks %s", (url) => {
    expect(isProbeableUrl(url)).toBe(false);
  });
});

describe("probeLink when disabled", () => {
  it("never calls fetch", async () => {
    const { probeLink, LINK_PROBE_ENABLED } = await import("./link-safety");
    let calls = 0;
    const spy = (async () => { calls++; return new Response(null); }) as typeof fetch;
    const r = await probeLink("https://example.org/", { enabled: LINK_PROBE_ENABLED, fetchImpl: spy });
    expect(LINK_PROBE_ENABLED).toBe(false);
    expect(r.outcome).toBe("disabled");
    expect(calls).toBe(0);
  });
  it("re-validates redirects when enabled (unit only)", async () => {
    const { probeLink } = await import("./link-safety");
    const spy = (async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } })) as typeof fetch;
    const r = await probeLink("https://example.org/", { enabled: true, fetchImpl: spy });
    expect(r.outcome).toBe("blocked");
  });
});

describe("withTimeout", () => {
  it("rejects a never-settling call after the budget", async () => {
    vi.useFakeTimers();
    const { withTimeout } = await import("./retry");
    const p = withTimeout(new Promise(() => {}), 12_000);
    const check = expect(p).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(12_000);
    await check;
    vi.useRealTimers();
  });
});
