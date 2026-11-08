import { describe, expect, it } from "vitest";
import {
  classifyTechnicalObservation,
  editorialReviewDueAt,
  nextTechnicalCheckAt,
  persistentStatus,
} from "./resource-health";

describe("technical resource health", () => {
  it.each([
    [{ statusCode: 200 }, "healthy"],
    [{ statusCode: 301, redirected: true }, "redirected"],
    [{ statusCode: 404 }, "broken"],
    [{ statusCode: 410 }, "removed"],
    [{ statusCode: 403 }, "restricted"],
    [{ statusCode: 429 }, "temporarily_unavailable"],
    [{ networkError: "timeout" as const }, "temporarily_unavailable"],
    [{ networkError: "redirect_loop" as const }, "needs_review"],
    [{ statusCode: 200, embedStatus: "unavailable" as const }, "embed_unavailable"],
    [{ statusCode: 302, redirected: true, suspiciousRedirect: true }, "needs_review"],
  ])("classifies %o as %s", (observation, expected) => {
    expect(classifyTechnicalObservation(observation)).toBe(expected);
  });

  it("does not call one transient failure broken", () => {
    expect(persistentStatus("temporarily_unavailable", 1)).toBe("temporarily_unavailable");
    expect(persistentStatus("temporarily_unavailable", 2)).toBe("needs_review");
    expect(persistentStatus("temporarily_unavailable", 3)).toBe("broken");
  });

  it("backs off transient failures and checks high-risk sources sooner", () => {
    const now = new Date("2026-10-27T00:00:00Z");
    expect(nextTechnicalCheckAt(now, "healthy", 0, "standard").toISOString()).toBe("2026-11-26T00:00:00.000Z");
    expect(nextTechnicalCheckAt(now, "healthy", 0, "high").toISOString()).toBe("2026-11-03T00:00:00.000Z");
    expect(nextTechnicalCheckAt(now, "temporarily_unavailable", 3, "standard").toISOString()).toBe("2026-11-04T00:00:00.000Z");
  });

  it("keeps editorial review cadence separate", () => {
    expect(editorialReviewDueAt(new Date("2026-10-27T00:00:00Z"), "high").toISOString()).toBe("2027-01-25T00:00:00.000Z");
  });
});
