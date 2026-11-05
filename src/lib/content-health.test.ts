import { describe, expect, it } from "vitest";

import { healthBanner, type HealthIncident } from "./content-health";

const now = Date.parse("2026-09-26T12:00:00Z");
const base: HealthIncident = {
  metric: "published_topics", status: "open", baseline: 74, threshold: 67, observed: 54,
  lowest_observed: 54, seen_count: 2, opened_at: "2026-09-26T06:00:00Z",
  last_seen_at: "2026-09-26T06:00:00Z", resolved_at: null, resolved_observed: null,
};

describe("healthBanner", () => {
  it("is ok with a recent check and no incident", () => {
    expect(healthBanner([], "2026-09-26T06:00:00Z", now).tone).toBe("ok");
  });
  it("alerts on an open incident", () => {
    const b = healthBanner([base], "2026-09-26T06:00:00Z", now);
    expect(b.tone).toBe("alert");
    expect(b.open).toHaveLength(1);
  });
  it("reports recovery without alerting", () => {
    const b = healthBanner(
      [{ ...base, status: "resolved", resolved_at: "2026-09-26T07:00:00Z", resolved_observed: 74 }],
      "2026-09-26T07:00:00Z", now,
    );
    expect(b.tone).toBe("ok");
    expect(b.recentlyResolved).toHaveLength(1);
  });
  it("flags a stale check when the daily job has not run", () => {
    expect(healthBanner([], "2026-09-24T06:00:00Z", now).tone).toBe("stale");
    expect(healthBanner([], null, now).tone).toBe("stale");
  });
});
