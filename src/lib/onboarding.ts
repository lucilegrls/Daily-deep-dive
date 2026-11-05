/**
 * Onboarding preferences shared by the guided journey, the account provider
 * and the feed query.
 *
 * The browser draft holds ONLY non-sensitive choices (canonical category
 * values, feed mix, theme) plus a version and timestamp. Never an email,
 * password, token or anything else belonging to an account.
 */

import { isTheme } from "@/lib/themes";

export type FeedMix = "focused" | "balanced" | "exploratory";


export const FEED_MIXES: {
  id: FeedMix;
  label: string;
  description: string;
  recommended?: boolean;
}[] = [
  {
    id: "focused",
    label: "Focused",
    description: "Mostly the subjects you chose, with the odd detour.",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Your subjects, with regular discoveries mixed in.",
    recommended: true,
  },
  {
    id: "exploratory",
    label: "Exploratory",
    description: "Half your subjects, half things you never asked for.",
  },
];

export const DEFAULT_FEED_MIX: FeedMix = "balanced";
export const MIN_INTERESTS = 3;

export function isFeedMix(value: unknown): value is FeedMix {
  return value === "focused" || value === "balanced" || value === "exploratory";
}

export interface OnboardingDraft {
  v: 1;
  interests: string[];
  feedMix: FeedMix;
  theme: string;
  savedAt: number;
}

export const DRAFT_KEY = "daily-deep-dive:onboarding-draft";
/** Drafts are a hand-off across one sign-up, not a stored preference. */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export function parseDraft(
  raw: string | null,
  now: number = Date.now(),
): OnboardingDraft | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const d = parsed as Record<string, unknown>;
  if (d["v"] !== 1) return null;
  const savedAt = Number(d["savedAt"]);
  if (!Number.isFinite(savedAt) || now - savedAt > DRAFT_TTL_MS) return null;
  const interests = Array.isArray(d["interests"])
    ? [
        ...new Set(
          d["interests"].filter(
            (s): s is string => typeof s === "string" && s.length > 0,
          ),
        ),
      ].slice(0, 30)
    : [];
  if (interests.length === 0) return null;
  return {
    v: 1,
    interests,
    // An unknown theme id is dropped, never carried into the account: an
    // empty string means "keep whatever the profile already has".
    theme: isTheme(d["theme"]) ? (d["theme"] as string) : "",
    feedMix: isFeedMix(d["feedMix"]) ? d["feedMix"] : DEFAULT_FEED_MIX,
    savedAt,
  };

}

export function readDraft(): OnboardingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    return parseDraft(window.localStorage.getItem(DRAFT_KEY));
  } catch {
    return null;
  }
}

export function writeDraft(
  draft: Omit<OnboardingDraft, "v" | "savedAt">,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ v: 1, ...draft, savedAt: Date.now() }),
    );
  } catch {
    // storage unavailable — the reader can simply choose again
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
