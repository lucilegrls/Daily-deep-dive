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
    slug: "health-mind",
    label: "Health, body & mind",
    description: "",
    examples: ["iron"],
    categories: ["Biochemistry & biology", "Health & nutrition"],
    publishedCount: 24,
  },
  {
    slug: "learning-work",
    label: "Learning, focus & work",
    description: "",
    examples: [],
    categories: ["Learning & study", "Productivity & focus"],
    publishedCount: 7,
  },
  {
    slug: "society-culture",
    label: "Society, culture & politics",
    description: "",
    examples: [],
    categories: ["Law"],
    publishedCount: 6,
  },
  {
    slug: "world-travel",
    label: "World, food & travel",
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
    expect(expandInterests(lanes, ["learning-work"], categories)).toEqual([
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
    expect(validInterests(lanes, ["not-a-lane", "society-culture"], categories)).toEqual([
      "society-culture",
    ]);
  });

  it("accepts a lane with no published topics yet", () => {
    expect(
      validInterests(lanes, ["world-travel"], categories),
    ).toEqual(["world-travel"]);
    expect(expandInterests(lanes, ["world-travel"], categories)).toEqual(
      [],
    );
  });

  it("requires three distinct valid choices", () => {
    expect(hasEnoughInterests(lanes, ["learning-work", "society-culture"], categories)).toBe(
      false,
    );
    expect(
      hasEnoughInterests(
        lanes,
        ["learning-work", "learning-work", "society-culture"],
        categories,
      ),
    ).toBe(false);
    expect(
      hasEnoughInterests(
        lanes,
        ["learning-work", "society-culture", "Politics & institutions"],
        categories,
      ),
    ).toBe(true);
  });

  it("preselects lanes for a reader whose saved subjects are legacy categories", () => {
    expect(
      toLaneSelection(lanes, ["Law", "Biochemistry & biology", "learning-focus"]),
    ).toEqual(["society-culture", "health-mind", "learning-work"]);
  });

  it("folds old subject slugs into the new seven-subject taxonomy", () => {
    expect(
      toLaneSelection(lanes, [
        "body-health-nutrition",
        "brain-behavior",
        "southeast-asia-food-travel",
      ]),
    ).toEqual(["health-mind", "world-travel"]);
  });

  it("shows the friendly label, falling back to the saved value", () => {
    expect(laneLabel(lanes, "society-culture")).toBe("Society, culture & politics");
    expect(laneLabel(lanes, "Politics & institutions")).toBe(
      "Politics & institutions",
    );
  });
});
