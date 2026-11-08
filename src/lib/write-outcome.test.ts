import { describe, expect, it, vi } from "vitest";

import { friendlyError } from "./friendly-error";
import { translate, LANGUAGE_CODES } from "./i18n";
import { DICTIONARIES } from "./translations";
import { classifyWriteError, createSingleFlight, writeFailureKey } from "./write-outcome";

describe("classifyWriteError (mocked auth/network responses)", () => {
  it("expired or invalid session", () => {
    expect(classifyWriteError({ code: "PGRST301", message: "JWT expired" })).toBe("session");
    expect(classifyWriteError({ status: 401, message: "x" })).toBe("session");
    expect(classifyWriteError(new Error("Invalid Refresh Token: Refresh Token Not Found"))).toBe("session");
  });
  it("network and gateway failures", () => {
    expect(classifyWriteError(new TypeError("Failed to fetch"))).toBe("network");
    expect(classifyWriteError(new DOMException("t", "TimeoutError"))).toBe("network");
    expect(classifyWriteError({ status: 503, message: "x" })).toBe("network");
  });
  it("rate limits get their own wait-and-retry message, never auto-retried", () => {
    expect(classifyWriteError({ code: "P0001", message: "rate_limited" })).toBe("limited");
    expect(writeFailureKey("limited")).toBe("err.rateLimited");
  });
  it("database failures stay generic", () => {
    expect(classifyWriteError({ code: "23514", message: 'new row violates check constraint "x"' })).toBe("failed");
    expect(writeFailureKey("failed")).toBe("err.unexpected");
  });
});

describe("createSingleFlight", () => {
  it("drops duplicate writes while one is in flight and never retries", async () => {
    const run = createSingleFlight();
    let release!: () => void;
    const fn = vi.fn(() => new Promise<string>((r) => { release = () => r("ok"); }));
    const first = run("note:1", fn);
    const second = await run("note:1", fn);
    expect(second).toBeNull();
    release();
    expect(await first).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    const failing = vi.fn(async () => { throw new Error("boom"); });
    await expect(run("note:1", failing)).rejects.toThrow("boom");
    expect(failing).toHaveBeenCalledTimes(1);
    expect(await run("note:1", async () => "again")).toBe("again");
  });
});

describe("recovery messages in supported languages", () => {
  const keys = ["ts.failed", "feed.retry", "err.network", "err.session", "err.permission", "err.duplicate", "err.unexpected", "err.rateLimited", "err.signIn", "err.dismiss", "err.saveTopic", "err.progress", "ts.noteError"] as const;
  it("every language has its own non-empty wording", () => {
    for (const lang of LANGUAGE_CODES) for (const k of keys) {
      expect(DICTIONARIES[lang][k]?.trim()).toBeTruthy();
      if (lang !== "en" && k !== "err.dismiss") expect(DICTIONARIES[lang][k]).not.toBe(DICTIONARIES.en[k]);
    }
  });
  it("friendlyError uses the reader's language and hides raw errors", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = (k: Parameters<typeof translate>[1]) => translate("fr", k);
    expect(friendlyError(new TypeError("Failed to fetch"), undefined, t)).toBe(DICTIONARIES.fr["err.network"]);
    expect(friendlyError(new Error('relation "x" violates'), undefined, t)).toBe(DICTIONARIES.fr["err.unexpected"]);
  });
});
