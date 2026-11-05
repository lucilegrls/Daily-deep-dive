import { describe, expect, it } from "vitest";

import {
  DEFAULT_FEED_MIX,
  DRAFT_TTL_MS,
  isFeedMix,
  parseDraft,
} from "./onboarding";
import { THEME_IDS, isTheme } from "./themes";


const now = 1_700_000_000_000;

function draft(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    v: 1,
    interests: ["Biology", "Economics", "History"],
    feedMix: "focused",
    theme: "inky",
    savedAt: now - 1000,
    ...extra,
  });
}

describe("onboarding draft", () => {
  it("reads a fresh draft", () => {
    const parsed = parseDraft(draft(), now);
    expect(parsed?.interests).toEqual(["Biology", "Economics", "History"]);
    expect(parsed?.feedMix).toBe("focused");
    expect(parsed?.theme).toBe("inky");
  });

  it("rejects an expired draft", () => {
    expect(parseDraft(draft({ savedAt: now - DRAFT_TTL_MS - 1 }), now)).toBeNull();
  });

  it("rejects unknown versions, junk and empty choices", () => {
    expect(parseDraft(draft({ v: 2 }), now)).toBeNull();
    expect(parseDraft("not json", now)).toBeNull();
    expect(parseDraft(null, now)).toBeNull();
    expect(parseDraft(draft({ interests: [] }), now)).toBeNull();
  });

  it("falls back to the balanced mix when the value is unknown", () => {
    expect(parseDraft(draft({ feedMix: "wild" }), now)?.feedMix).toBe(
      DEFAULT_FEED_MIX,
    );
  });

  it("drops duplicate and non-string interests", () => {
    const parsed = parseDraft(
      draft({ interests: ["Biology", "Biology", 42, "Law"] }),
      now,
    );
    expect(parsed?.interests).toEqual(["Biology", "Law"]);
  });

  it("carries no account data", () => {
    const parsed = parseDraft(
      draft({ email: "a@b.c", password: "hunter2", token: "x" }),
      now,
    );
    expect(Object.keys(parsed ?? {}).sort()).toEqual([
      "feedMix",
      "interests",
      "savedAt",
      "theme",
      "v",
    ]);
  });

  it("validates feed mixes", () => {
    expect(isFeedMix("balanced")).toBe(true);
    expect(isFeedMix("chaotic")).toBe(false);
  });

  it("keeps every one of the seven real looks", () => {
    for (const id of THEME_IDS) {
      expect(parseDraft(draft({ theme: id }), now)?.theme).toBe(id);
    }
    expect(THEME_IDS).toHaveLength(7);
  });

  it("drops an unknown look instead of carrying it to the account", () => {
    expect(parseDraft(draft({ theme: "neon-casino" }), now)?.theme).toBe("");
    expect(parseDraft(draft({ theme: 7 }), now)?.theme).toBe("");
    expect(parseDraft(draft({ theme: null }), now)?.theme).toBe("");
  });

  it("recognises only the seven look ids", () => {
    expect(isTheme("romantic")).toBe(true);
    expect(isTheme("academia")).toBe(true);
    expect(isTheme("ROMANTIC")).toBe(false);
    expect(isTheme("")).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});

