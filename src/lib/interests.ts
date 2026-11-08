/**
 * Canonical onboarding subjects ("lanes").
 *
 * A lane is a stable slug with a friendly label and the library categories it
 * covers. New saves store slugs; readers who signed up earlier have raw
 * category strings saved, and those keep working everywhere — they are
 * translated for display and for the feed, never silently rewritten.
 */

export interface InterestLane {
  slug: string;
  label: string;
  description: string;
  examples: string[];
  categories: string[];
  /** Published topics already in the library for this lane. */
  publishedCount: number;
}

export const MIN_LANE_CHOICES = 3;

/** Library categories covered by a saved preference list. */
export function expandInterests(
  lanes: InterestLane[],
  values: string[],
  knownCategories: string[] = [],
): string[] {
  const bySlug = new Map(lanes.map((l) => [l.slug, l]));
  const out = new Set<string>();
  for (const value of values) {
    const lane = bySlug.get(value);
    if (lane) {
      for (const c of lane.categories) out.add(c);
    } else if (knownCategories.includes(value)) {
      out.add(value);
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

/** Choices the backend will accept: catalogue slugs or legacy categories. */
export function validInterests(
  lanes: InterestLane[],
  values: string[],
  knownCategories: string[] = [],
): string[] {
  const slugs = new Set(lanes.map((l) => l.slug));
  return [
    ...new Set(
      values.filter((v) => slugs.has(v) || knownCategories.includes(v)),
    ),
  ];
}

export function hasEnoughInterests(
  lanes: InterestLane[],
  values: string[],
  knownCategories: string[] = [],
): boolean {
  return (
    validInterests(lanes, values, knownCategories).length >= MIN_LANE_CHOICES
  );
}

/**
 * What to preselect in the wizard for an existing reader: their saved slugs,
 * plus a lane for each legacy category they saved. Nothing is written until
 * they press save.
 */
export function toLaneSelection(
  lanes: InterestLane[],
  saved: string[],
): string[] {
  const slugs = new Set(lanes.map((l) => l.slug));
  const out: string[] = [];
  for (const value of saved) {
    if (slugs.has(value)) {
      if (!out.includes(value)) out.push(value);
      continue;
    }
    for (const lane of lanes) {
      if (lane.categories.includes(value) && !out.includes(lane.slug)) {
        out.push(lane.slug);
      }
    }
  }
  return out;
}

export function laneLabel(lanes: InterestLane[], value: string): string {
  return lanes.find((l) => l.slug === value)?.label ?? value;
}
