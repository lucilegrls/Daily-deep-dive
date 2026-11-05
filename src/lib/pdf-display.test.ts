import { describe, expect, it } from "vitest";
import { pdfPage, pdfScale, PDF_LOAD_TIMEOUT_MS } from "./pdf-display";

describe("PDF display bounds", () => {
  it("fits a 612-point page in a 300-pixel mobile reader", () => {
    expect(pdfScale(612, 300, 1)).toBe(300 / 612);
  });
  it("does not enlarge a desktop page unless zoom is requested", () => {
    expect(pdfScale(612, 900, 1)).toBe(1);
    expect(pdfScale(612, 300, 2)).toBe(600 / 612);
  });
  it("clamps requested pages to the actual document", () => {
    expect(pdfPage(99, 23)).toBe(23);
    expect(pdfPage(0, 23)).toBe(1);
  });
  it("bounds loading to twenty seconds", () => {
    expect(PDF_LOAD_TIMEOUT_MS).toBe(20_000);
  });
});