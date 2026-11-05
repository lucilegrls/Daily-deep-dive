import { describe, expect, it } from "vitest";

import { isSafeSourceUrl, normalizeHost, slugify } from "./content-safety";

describe("normalizeHost", () => {
  it("lowercases and drops ports, userinfo, brackets and trailing dots", () => {
    expect(normalizeHost("HTTPS://EN.Wikipedia.ORG:443/wiki/Iron")).toBe(
      "en.wikipedia.org",
    );
    expect(normalizeHost("https://user:pass@en.wikipedia.org/wiki/Iron")).toBe(
      "en.wikipedia.org",
    );
    expect(normalizeHost("https://en.wikipedia.org./wiki/Iron")).toBe(
      "en.wikipedia.org",
    );
  });

  it("returns nothing for unusable links", () => {
    expect(normalizeHost("")).toBeNull();
    expect(normalizeHost("   ")).toBeNull();
    expect(normalizeHost("ftp://example.org/file")).toBeNull();
    expect(normalizeHost("javascript:alert(1)")).toBeNull();
    expect(normalizeHost("https://")).toBeNull();
  });
});

describe("isSafeSourceUrl", () => {
  const blocked = [
    "https://en.wikipedia.org/wiki/Iron",
    "https://en.wikipedia.org./wiki/Iron",
    "https://EN.WIKIPEDIA.ORG./wiki/Iron",
    "https://en.m.wikipedia.org../wiki/Iron",
    "https://en.wikipedia.org:8443/wiki/Iron",
    "https://reader@en.wikipedia.org/wiki/Iron",
    "https://fr.wikipedia.org/wiki/Fer",
    "https://www.wikiwand.com/en/Iron",
    "https://commons.wikimedia.org/wiki/File",
    "https://dbpedia.org/page/Iron",
    "ftp://en.wikipedia.org/wiki/Iron",
  ];

  const allowed = [
    "https://www.youtube.com/watch?v=dSmh_KP5j6Y",
    "https://pubmed.ncbi.nlm.nih.gov/12345678/",
    "https://www.nature.com/articles/s41586-024-00001-1",
    "https://ocw.mit.edu/courses/biology/",
    "http://arxiv.org/abs/2401.00001",
    "https://wikipedia.org.example.com/not-really",
    "https://notwikipedia.org/article",
  ];

  it.each(blocked)("refuses %s", (url) => {
    expect(isSafeSourceUrl(url)).toBe(false);
  });

  it.each(allowed)("allows %s", (url) => {
    expect(isSafeSourceUrl(url)).toBe(true);
  });
});

describe("slugify", () => {
  it("makes a stable url fragment", () => {
    expect(slugify("Iron Physiology: Diet & Absorption")).toBe(
      "iron-physiology-diet-absorption",
    );
  });
});
