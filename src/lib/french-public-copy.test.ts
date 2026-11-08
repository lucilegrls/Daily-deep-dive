import { describe, expect, it } from "vitest";
import snapshot from "@/data/french-public-copy/snapshot.json";
import translations from "@/data/french-public-copy/translations.json";
import { sourceCopy, takeawayCopy } from "./french-public-copy";
import { readerCopy, readerPublication } from "./reader-copy";

describe("complete finite French public copy", () => {
  it("covers 1300 sources, 331 topics and every inventory string without duplicates", () => {
    expect(snapshot.resources).toHaveLength(1300);
    expect(snapshot.topics).toHaveLength(331);
    expect(new Set(snapshot.resources.map(r => r.url)).size).toBe(1253);
    expect(translations.titles).toHaveLength(1256);
    expect(translations.descriptions).toHaveLength(1033);
    expect(translations.publications).toHaveLength(496);
    expect(translations.takeaways).toHaveLength(1022);
    for (const [field, rows] of Object.entries(translations)) {
      expect(new Set(rows.map(r => r.en)).size, field).toBe(rows.length);
      for (const r of rows) {
        expect(r.en.trim(), field).not.toBe("");
        expect(r.fr.trim(), `${field}: ${r.en}`).not.toBe("");
      }
    }
  });
  it("resolves every public resource field exactly while preserving English and frozen catalogue rows", () => {
    const fields = [["titles", "title"], ["descriptions", "description"], ["limitations", "limitation"], ["publications", "publication"]] as const;
    for (const row of snapshot.resources) {
      const resource = Object.freeze({ ...row });
      for (const [field, key] of fields) {
        const clean = field === "titles" ? row[key] : field === "publications" ? readerPublication(row[key]) : readerCopy(row[key]);
        const expected = translations[field].find(r => r.en === clean)?.fr;
        if (clean) expect(expected, `${row.id} ${field}`).toBeDefined();
        expect(sourceCopy("fr", resource, field, row[key])).toBe(expected ?? clean);
        expect(sourceCopy("en", resource, field, row[key])).toBe(clean);
        expect(resource[key]).toBe(row[key]);
      }
    }
  });
  it("resolves all takeaways, leaving original topics intact", () => {
    for (const row of snapshot.topics) {
      const topic = Object.freeze({ ...row });
      for (const value of row.takeaways) {
        const expected = translations.takeaways.find(r => r.en === readerCopy(value))?.fr;
        expect(expected, `${row.id}: ${value}`).toBeDefined();
        expect(takeawayCopy("fr", topic, value)).toBe(expected);
        expect(takeawayCopy("en", topic, value)).toBe(readerCopy(value));
      }
      expect(topic.takeaways).toEqual(row.takeaways);
    }
  });
  it("falls back for changed identity, URL, title, text or unknown rows", () => {
    const r = snapshot.resources[0];
    const t = snapshot.topics[0];
    if (!r || !t) throw Error("Missing snapshot");
    for (const changed of [{...r,id:"new"},{...r,url:r.url+"&changed=1"},{...r,title:"New title"}]) {
      expect(sourceCopy("fr", changed, "titles", changed.title)).toBe(changed.title);
      expect(sourceCopy("fr", changed, "descriptions", r.description)).toBe(readerCopy(r.description));
    }
    expect(sourceCopy("fr",r,"descriptions","New findings.")).toBe("New findings.");
    const value=t.takeaways[0];
    if (!value) throw Error("Missing takeaway");
    for (const changed of [{...t,id:999},{...t,slug:"changed"},{...t,title:"Changed"}]) expect(takeawayCopy("fr",changed,value)).toBe(readerCopy(value));
    expect(takeawayCopy("fr",t,"New findings.")).toBe("New findings.");
  });
  it("keeps source facts and genuine caveats, without turning card translations into translated media", () => {
    const peer = translations.limitations.find(r=>r.en==="Peer-review status is not implied.");
    expect(peer?.fr).toBe("Le statut d’évaluation par les pairs n’est pas présumé.");
    expect(translations.limitations.find(r=>r.en==="Full text access may vary.")?.fr).toBe("Accès intégral variable.");
    expect(translations.descriptions.find(r=>r.en.includes("actual course recording dates Fall 2018"))?.fr).toContain("automne 2018");
    expect(translations.publications.find(r=>r.en==="YouTube · 2014-09-24")?.fr).toBe("YouTube · 2014-09-24");
    expect(translations.takeaways.find(r=>r.en.includes("Heme and non-heme iron"))?.fr).toContain("fer héminique et non héminique");
  });
});