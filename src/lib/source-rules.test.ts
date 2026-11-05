import { describe, expect, it } from "vitest";

import { dateBasisLabel, evaluateSource, isExcludedCreator, productionKey, type RuleInput } from "./source-rules";

const now = new Date("2026-10-20T00:00:00Z");
const allChecks = { topicFit: true, depth: true, researchWikipedia: false, jurisdictionRelevant: false, provenanceVerified: true };
const reading: RuleInput = {
  kind: "articles", url: "https://www.nature.com/x", creator: null, author: "A. Author",
  publication: "Nature", source: null, published_at: "2026-10-18T09:00:00Z", access_level: "open",
  verification: { checks: { ...allChecks, access: "open", sourceDate: { value: "1998-01-01", basis: "publication" as const } } },
};
const video: RuleInput = {
  kind: "videos", url: "https://www.youtube.com/watch?v=abc", creator: "HHMI BioInteractive", author: null,
  publication: null, source: null, published_at: "2026-10-18T09:00:00Z", access_level: "open",
  verification: { checks: { ...allChecks, sourceDate: { value: "2025-06-01", basis: "original_upload" as const }, descriptionCitations: true, contentCategory: "educational", archival: false } },
};
const opt = { now, duplicateProduction: false };

describe("excluded creators", () => {
  it("matches the exact channel identity, case-insensitive", () => {
    expect(isExcludedCreator({ creator: "CUT", author: null, source: null })).toBe(true);
    expect(isExcludedCreator({ creator: "zoeunlimited", author: null, source: null })).toBe(true);
    expect(isExcludedCreator({ creator: "Privileged Few", author: null, source: null })).toBe(true);
  });
  it("does not reject creators merely containing the word", () => {
    expect(isExcludedCreator({ creator: "Cut the Knot", author: null, source: null })).toBe(false);
    expect(evaluateSource({ ...video, title: "How to cut DNA" }, opt).outcome).toBe("passing");
  });
});

describe("evaluateSource", () => {
  it("an older foundational reading with full evidence passes", () => {
    expect(evaluateSource(reading, opt).outcome).toBe("passing");
  });
  it("missing evidence is blocked, never rejected", () => {
    const r = evaluateSource({ ...reading, verification: { reviewLevel: "Owner-approved visibility" } }, { now });
    expect(r.outcome).toBe("blocked");
    expect(r.missing).toEqual([]);
  });
  it("Wikipedia as research is rejected, as an image credit is not", () => {
    expect(evaluateSource({ ...video, verification: { checks: { ...(video.verification as { checks: object }).checks, researchWikipedia: true } } }, opt).outcome).toBe("rejected");
    expect(evaluateSource({ ...video, verification: { checks: { ...(video.verification as { checks: object }).checks, imageCreditWikipedia: true } } }, opt).outcome).toBe("passing");
  });
  it("video over two years old without a reason is rejected, with an explicit reason is exceptional", () => {
    const base = (video.verification as { checks: object }).checks;
    const old = { ...video, verification: { checks: { ...base, sourceDate: { value: "2022-01-01", basis: "original_upload" } } } };
    expect(evaluateSource(old, opt).outcome).toBe("rejected");
    const checks = { ...old.verification.checks, exceptionReason: "Only lab footage of this mechanism" };
    expect(evaluateSource({ ...old, verification: { checks } }, opt).outcome).toBe("exceptional");
  });
  it("archival recording date: unknown when absent, missing when stale, met inside the window", () => {
    const checks = { ...(video.verification as { checks: object }).checks, archival: true };
    expect(evaluateSource({ ...video, verification: { checks } }, opt).unknown).toContain("archival_recording_date");
    expect(evaluateSource({ ...video, verification: { checks: { ...checks, recordingDate: "1990-05-01" } } }, opt).missing).toContain("archival_recording_date");
    expect(evaluateSource({ ...video, verification: { checks: { ...checks, recordingDate: "2025-01-10" } } }, opt).outcome).toBe("passing");
  });
  it("music/motivational content is excluded only with content evidence", () => {
    const checks = { ...(video.verification as { checks: object }).checks, contentCategory: "motivational" };
    expect(evaluateSource({ ...video, verification: { checks } }, opt).outcome).toBe("rejected");
  });
  it("a duplicate production counts as a missing rule", () => {
    expect(evaluateSource(video, { now, duplicateProduction: true }).missing).toEqual(["not_duplicate_production"]);
  });
  it("a jurisdiction-relevant reading needs its jurisdiction", () => {
    const checks = { ...allChecks, jurisdictionRelevant: true };
    expect(evaluateSource({ ...reading, verification: { checks } }, opt).missing).toEqual(["reading_jurisdiction"]);
  });
  it("same YouTube video is the same production", () => {
    expect(productionKey({ url: "https://youtu.be/abc", creator: null })).toBe(productionKey({ url: "https://www.youtube.com/watch?v=abc", creator: "x" }));
  });
});

describe("source dates (regressions)", () => {
  const base = (video.verification as { checks: Record<string, unknown> }).checks;
  const withDate = (sourceDate: unknown, extra: object = {}) => ({ ...video, verification: { checks: { ...base, sourceDate, ...extra } } });

  it("old upload + new app visibility timestamp is still old", () => {
    const r = evaluateSource({ ...withDate({ value: "2019-03-01", basis: "original_upload" }), published_at: "2026-10-18T09:00:00Z" }, opt);
    expect(r.rules["video_within_two_years"]).toBe("missing");
  });
  it("app timestamp alone never proves a date", () => {
    const r = evaluateSource({ ...withDate(undefined), published_at: "2026-10-18T09:00:00Z" }, opt);
    expect(r.rules["video_within_two_years"]).toBe("unknown");
    const rd = evaluateSource({ ...reading, verification: { checks: { ...allChecks, access: "open" } } }, opt);
    expect(rd.rules["reading_date"]).toBe("unknown");
  });
  it("old default catalogue metadata is not evidence", () => {
    const r = evaluateSource({ ...withDate(undefined), verification: { catalogueUploadDate: "2025-09-01", checks: { ...base, sourceDate: undefined } } }, opt);
    expect(r.rules["video_within_two_years"]).toBe("unknown");
    const rd = evaluateSource({ ...reading, access_level: "open", verification: { checks: { ...allChecks, sourceDate: { value: "2001-01-01", basis: "publication" } } } }, opt);
    expect(rd.rules["reading_access"]).toBe("unknown");
  });
  it("future dates are rejected", () => {
    expect(evaluateSource(withDate({ value: "2027-01-01", basis: "original_upload" }), opt).rules["video_within_two_years"]).toBe("missing");
    expect(evaluateSource(withDate(base["sourceDate"], { archival: true, recordingDate: "2026-12-01" }), opt).rules["archival_recording_date"]).toBe("missing");
    const rd = evaluateSource({ ...reading, verification: { checks: { ...allChecks, access: "open", sourceDate: { value: "2030-01-01", basis: "publication" } } } }, opt);
    expect(rd.rules["reading_date"]).toBe("missing");
  });
  it("YouTube publishedAt counts as platform publication and is labelled as such", () => {
    expect(evaluateSource(withDate({ value: "2025-06-01", basis: "platform_publication" }), opt).rules["video_within_two_years"]).toBe("met");
    expect(dateBasisLabel("platform_publication")).toMatch(/may not be the original upload/);
  });
  it("creator text alone is not verified provenance", () => {
    const r = evaluateSource({ ...video, verification: { checks: { ...base, provenanceVerified: undefined } } }, opt);
    expect(r.rules["provenance"]).toBe("unknown");
    expect(r.outcome).toBe("blocked");
  });
  it("calendar two-year window, including leap-day boundary", () => {
    const d = (value: string, at: string) =>
      evaluateSource(withDate({ value, basis: "original_upload" }), { now: new Date(at), duplicateProduction: false }).rules["video_within_two_years"];
    expect(d("2024-10-20", "2026-10-20T12:00:00Z")).toBe("met");
    expect(d("2024-10-19", "2026-10-20T12:00:00Z")).toBe("missing");
    expect(d("2026-02-28", "2028-02-29T12:00:00Z")).toBe("met");
    expect(d("2026-02-27", "2028-02-29T12:00:00Z")).toBe("missing");
    expect(d("2024-02-29", "2026-02-28T12:00:00Z")).toBe("met");
    expect(d("2024-02-27", "2026-02-28T12:00:00Z")).toBe("missing");
  });
});
