import { describe, expect, it } from "vitest";
import { batchImportSchema, candidateFields, importRowId, normalizedImportUrl, parseImportFile, sourceImportSchema } from "./resource-import";

const row = { topic_id: 331, kind: "articles", title: "Study", url: "https://www.nature.com/articles/study" };
describe("candidate batch import", () => {
  it("never accepts supplied approval", () => {
    const approved = sourceImportSchema.parse({ ...row, review_status: "approved", needs_review: false });
    expect({ ...approved, ...candidateFields() }).toMatchObject({ review_status: "candidate", topic_fit_status: "unreviewed", credibility_status: "unreviewed", needs_review: true });
  });
  it("treats trailing slash URLs as duplicates for the same topic", () => {
    expect(normalizedImportUrl(row.url + "/")).toBe(normalizedImportUrl(row.url));
    expect(normalizedImportUrl(row.url + "?x=1")).not.toBe(normalizedImportUrl(row.url));
  });
  it("rejects missing exact topic ID rather than guessing", () => {
    expect(sourceImportSchema.safeParse({ ...row, topic_id: undefined }).success).toBe(false);
  });
  it("rejects Wikipedia and credential/private URLs", () => {
    for (const url of ["https://en.wikipedia.org/wiki/Study", "http://127.0.0.1/", "https://user:pass@nature.com/"]) expect(sourceImportSchema.safeParse({ ...row, url }).success).toBe(false);
  });
  it("preserves supplied research evidence", () => {
    expect(sourceImportSchema.parse({ ...row, transcript_check: "not checked" })["transcript_check"]).toBe("not checked");
  });
  it("limits each request to 20 records", () => {
    expect(batchImportSchema.safeParse({ fingerprint: "a".repeat(64), offset: 0, rows: Array(21).fill(row) }).success).toBe(false);
  });
  it("accepts the manifest or a plain array", () => {
    expect(parseImportFile(JSON.stringify({ resources: [row] }))).toEqual([row]);
    expect(parseImportFile(JSON.stringify([row]))).toEqual([row]);
  });
  it("identifies retries deterministically without sharing identities across users", async () => {
    const id = await importRowId("owner", "hash", 1);
    expect(await importRowId("owner", "hash", 1)).toBe(id);
    expect(await importRowId("reader", "hash", 1)).not.toBe(id);
    expect(await importRowId("owner", "hash", 2)).not.toBe(id);
  });
});