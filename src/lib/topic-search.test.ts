import { describe, expect, it } from "vitest";

import { rankTopicMatches, searchTokens, topicSearchScore } from "./topic-search";
import { categoryVariants, normalizeCategory } from "./content-labels";

const topic = (title: string, context: string, tags: string[] = []) => ({
  id: Math.random(),
  slug: title,
  title,
  category: "Science & technology",
  context,
  tags,
});

describe("topic search", () => {
  it("matches whole words instead of substrings inside unrelated words", () => {
    expect(
      topicSearchScore(topic("Extreme heat", "The environment is changing."), "iron"),
    ).toBeNull();
    expect(
      topicSearchScore(topic("Iron absorption", "How the mineral moves."), "iron"),
    ).toBeGreaterThan(0);
  });

  it("ranks title and tag matches ahead of context-only matches", () => {
    const context = topic("Nutrition basics", "Iron supports many body systems.");
    const tagged = topic("Mineral absorption", "A practical guide.", ["iron"]);
    const titled = topic("Iron and the body", "A practical guide.");
    expect(rankTopicMatches([context, tagged, titled], "iron")).toEqual([
      titled,
      tagged,
      context,
    ]);
  });

  it("normalizes Unicode words and removes duplicate query terms", () => {
    expect(searchTokens("  MÉMOIRE, mémoire!  ")).toEqual(["mémoire"]);
  });

  it("normalizes legacy category spellings without losing filter coverage", () => {
    expect(normalizeCategory("Science & Technology")).toBe("Science & technology");
    expect(categoryVariants("Finance & economics")).toContain(
      "Economics & personal finance",
    );
  });
});
