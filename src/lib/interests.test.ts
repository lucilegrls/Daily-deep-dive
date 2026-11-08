import { describe, expect, it } from "vitest";

import {
  expandInterests,
  hasEnoughInterests,
  laneLabel,
  toLaneSelection,
  validInterests,
  type InterestLane,
} from "./interests";

const lanes: InterestLane[] = [
  {
    slug: "body-health-nutrition",
    label: "Body, health & nutrition",
    description: "",
    examples: ["iron"],
    categories: ["Biochemistry & biology", "Health & nutrition"],
    publishedCount: 24,
  },
  {
    slug: "learning-focus",
    label: "Learning & focus",
    description: "",
    examples: [],
    categories: ["Learning & study", "Productivity & focus"],
    publishedCount: 7,
  },
  {
    slug: "law-tax-offshore",
    label: "Law, tax & offshore",
    description: "",
    examples: [],
    categories: ["Law"],
    publishedCount: 6,
  },
  {
    slug: "southeast-asia-food-travel",
    label: "Southeast Asia, food & travel",
    description: "",
    examples: [],
    categories: [],
    publishedCount: 0,
  },
];

const categories = [
  "Biochemistry & biology",
  "Health & nutrition",
  "Law",
  "Learning & study",
  "Productivity & focus",
  "Politics & institutions",
];

describe("interest catalogue", () => {
  it("maps a lane to the library categories it covers", () => {
    expect(expandInterests(lanes, ["learning-focus"], categories)).toEqual([
      "Learning & study",
      "Productivity & focus",
    ]);
  });

  it("keeps a legacy category value working", () => {
    expect(
      expandInterests(lanes, ["Politics & institutions"], categories),
    ).toEqual(["Politics & institutions"]);
  });

  it("ignores values that are neither a lane nor a real category", () => {
    expect(expandInterests(lanes, ["not-a-lane"], categories)).toEqual([]);
    expect(validInterests(lanes, ["not-a-lane", "law-tax-offshore"], categories)).toEqual([
      "law-tax-offshore",
    ]);
  });

  it("accepts a lane with no published topics yet", () => {
    expect(
      validInterests(lanes, ["southeast-asia-food-travel"], categories),
    ).toEqual(["southeast-asia-food-travel"]);
    expect(expandInterests(lanes, ["southeast-asia-food-travel"], categories)).toEqual(
      [],
    );
  });

  it("requires three distinct valid choices", () => {
    expect(hasEnoughInterests(lanes, ["learning-focus", "law-tax-offshore"], categories)).toBe(
      false,
    );
    expect(
      hasEnoughInterests(
        lanes,
        ["learning-focus", "learning-focus", "law-tax-offshore"],
        categories,
      ),
    ).toBe(false);
    expect(
      hasEnoughInterests(
        lanes,
        ["learning-focus", "law-tax-offshore", "Politics & institutions"],
        categories,
      ),
    ).toBe(true);
  });

  it("preselects lanes for a reader whose saved subjects are legacy categories", () => {
    expect(
      toLaneSelection(lanes, ["Law", "Biochemistry & biology", "learning-focus"]),
    ).toEqual(["law-tax-offshore", "body-health-nutrition", "learning-focus"]);
  });

  it("shows the friendly label, falling back to the saved value", () => {
    expect(laneLabel(lanes, "law-tax-offshore")).toBe("Law, tax & offshore");
    expect(laneLabel(lanes, "Politics & institutions")).toBe(
      "Politics & institutions",
    );
  });
});
