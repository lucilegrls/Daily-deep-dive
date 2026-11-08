import { describe, expect, it } from "vitest";
import reviewed from "@/data/french-topic-titles.json";
import { topicTitle } from "./topic-titles";

describe("reviewed French title coverage", () => {
  it("covers exactly the 331 published IDs once with distinct canonical slugs", () => {
    expect(reviewed.count).toBe(331);
    expect(reviewed.topics.map((row) => row.id).sort((a, b) => a - b)).toEqual(Array.from({ length: 331 }, (_, i) => i + 1));
    expect(new Set(reviewed.topics.map((row) => row.slug)).size).toBe(331);
  });
  it("resolves every supplied title without modifying canonical fields", () => {
    for (const row of reviewed.topics) {
      const topic = Object.freeze({ id: row.id, slug: row.slug, title: row.title_en, category: row.category });
      expect(row.title_fr.trim().length).toBeGreaterThan(0);
      expect(topicTitle("fr", topic)).toBe(row.title_fr);
      expect(topicTitle("en", topic)).toBe(row.title_en);
      expect(topic.title).toBe(row.title_en);
      expect(topic.category).toBe(row.category);
    }
  });
  it("uses the reviewed French title for Iron and Scaling Laws", () => {
    expect(topicTitle("fr", { id: 1, title: "Iron: Why intake and absorption differ" })).toBe("Fer : pourquoi les apports et l’absorption diffèrent");
    expect(topicTitle("fr", { id: 6, title: "Scaling laws: Patterns and limits" })).toBe("Lois d’échelle : régularités et limites");
  });
  it("falls back for new topics or mismatched canonical slugs", () => {
    expect(topicTitle("fr", { id: 332, slug: "new-topic", title: "New topic" })).toBe("New topic");
    expect(topicTitle("fr", { id: 1, slug: "different-topic", title: "Changed topic" })).toBe("Changed topic");
  });
  it("switches already loaded titles both ways without changing the object", () => {
    const topic = { id: 6, title: "Scaling laws: Patterns and limits" };
    expect(topicTitle("en", topic)).toBe("Scaling laws: Patterns and limits");
    expect(topicTitle("fr", topic)).toBe("Lois d’échelle : régularités et limites");
    expect(topicTitle("en", topic)).toBe("Scaling laws: Patterns and limits");
  });
});