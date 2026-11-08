import { describe, expect, it } from "vitest";
import reviewed from "@/data/french-topic-summaries.json";
import { topicContext } from "./topic-copy";
import { readerCopy } from "./reader-copy";

const topicFor = (row: (typeof reviewed.topics)[number]) => Object.freeze({
  id: row.id, slug: row.slug, title: row.title_en, context: row.context_en,
});

describe("source-bound reviewed French summaries", () => {
  it("covers all 331 stable IDs and slugs exactly once", () => {
    expect(reviewed.count).toBe(331);
    expect(reviewed.topics.map((row) => row.id).sort((a, b) => a - b)).toEqual(Array.from({ length: 331 }, (_, i) => i + 1));
    expect(new Set(reviewed.topics.map((row) => row.slug)).size).toBe(331);
  });
  it("resolves every supplied summary exactly and preserves English and canonical objects", () => {
    for (const row of reviewed.topics) {
      const topic = topicFor(row);
      expect(topicContext("fr", topic)).toBe(row.context_fr);
      expect(topicContext("en", topic)).toBe(readerCopy(row.context_en));
      expect(topic.context).toBe(row.context_en);
      expect(topic.title).toBe(row.title_en);
    }
  });
  it("falls back independently for unknown ID, wrong slug, changed title or changed context", () => {
    const row = reviewed.topics[0];
    if (!row) throw new Error("Missing reviewed topic");
    const original = topicFor(row);
    for (const changed of [
      { ...original, id: 332 },
      { ...original, slug: "different-topic" },
      { ...original, title: "Changed title" },
      { ...original, context: "New scientific findings." },
    ]) expect(topicContext("fr", changed)).toBe(readerCopy(changed.context));
  });
  it("includes the newest topic 331 and switches without mutating it", () => {
    const row = reviewed.topics.find((item) => item.id === 331);
    if (!row) throw new Error("Missing topic 331");
    expect(row.slug).toBe("growing-the-future-how-living-bacteria-could-revolutionize-technology");
    const topic = topicFor(row);
    expect(topicContext("fr", topic)).toBe(row.context_fr);
    expect(topicContext("en", topic)).toBe(row.context_en);
    expect(topicContext("fr", topic)).toBe(row.context_fr);
  });
});