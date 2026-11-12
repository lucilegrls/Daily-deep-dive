import { describe, expect, it } from "vitest";

import { categoryName, normalizeCategory } from "@/lib/content-labels";

describe("catalogue category normalization", () => {
  it("collapses the legacy Science & Technology spelling", () => {
    expect(normalizeCategory("Science & Technology")).toBe("Science & technology");
    expect(normalizeCategory("Science & technology")).toBe("Science & technology");
    expect(categoryName("fr", "Science & Technology")).toBe("Sciences & technologie");
  });
});
