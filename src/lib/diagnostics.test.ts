import { beforeEach, describe, expect, it, vi } from "vitest";

import { _resetDiagnostics, logEvent, safeMessage } from "./diagnostics";

describe("diagnostics", () => {
  beforeEach(() => _resetDiagnostics());
  it("drops sensitive fields and truncates text", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logEvent("auth", "x", { token: "abc", email: "a@b.c", note_body: "secret", display_name: "Lucile", status: 401, long: "y".repeat(500) });
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line.token).toBeUndefined();
    expect(line.email).toBeUndefined();
    expect(line.note_body).toBeUndefined();
    expect(line.display_name).toBeUndefined();
    expect(line.status).toBe(401);
    expect(line.long.length).toBeLessThanOrEqual(200);
    spy.mockRestore();
  });
  it("scrubs emails and token-like values hidden in innocent fields", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logEvent("api", "y", { detail: "user a.b@example.com sent eyJhbGc.eyJzdWIi.sig and sb_secret_abc123" });
    const out = spy.mock.calls[0]![0] as string;
    expect(out).not.toMatch(/example\.com|eyJhbGc|sb_secret/);
    spy.mockRestore();
  });
  it("collapses duplicate events within the window", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 50; i++) logEvent("database", "loop", { code: "500" }, "error");
    logEvent("database", "loop", { code: "42501" }, "error");
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
  it("never returns raw backend errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(safeMessage("database", "q", { code: "42501", message: "permission denied for table x" })).not.toMatch(/permission|table/);
    spy.mockRestore();
  });
});
