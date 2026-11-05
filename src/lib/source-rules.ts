/**
 * Formal source rules. Pure and deterministic. Every rule is tri-state:
 * "met", "missing" (explicit evidence shows it fails) or "unknown" (not
 * checked / not checkable yet). Unknown is NEVER treated as failure.
 *
 * Evidence is read only from stored fields and `verification.checks`
 * (written by a human or a future content inspector); this module never
 * writes or infers it from titles.
 *
 * Outcomes:
 * - rejected: a hard rule is explicitly broken, or ≥2 formal rules are explicitly missing,
 *   or exactly one is missing without an explicit, recorded exception reason.
 * - blocked: anything else with ≥1 unknown rule (unverified, not a failure).
 * - exceptional: exactly one missing rule, no unknowns, explicit `checks.exceptionReason`.
 * - passing: every rule explicitly met.
 */
export type Outcome = "passing" | "exceptional" | "blocked" | "rejected";
export type RuleState = "met" | "missing" | "unknown";

export interface Checks {
  descriptionCitations?: boolean; // video description cites research sources
  researchWikipedia?: boolean; // linked bibliography uses Wikipedia as research (image credits don't count)
  imageCreditWikipedia?: boolean; // recorded but deliberately NOT a violation
  topicFit?: boolean;
  depth?: boolean;
  contentCategory?: "educational" | "music" | "motivational" | "generic_ai_explainer";
  archival?: boolean;
  /** Original recording date of archival footage, from recorded evidence. */
  recordingDate?: string;
  /**
   * Evidenced source date. `basis` labels what the date is:
   * "original_upload" (confirmed first upload), "platform_publication"
   * (e.g. YouTube API publishedAt — publication, not necessarily original
   * upload), or "publication" (a reading's own publication date).
   */
  sourceDate?: { value: string; basis: "original_upload" | "platform_publication" | "publication"; evidence?: string };
  /** Creator/publisher identity confirmed from the source itself. Creator text alone is not provenance. */
  provenanceVerified?: boolean;
  /** Reading access recorded from evidence (e.g. "open", "paywalled", "library"). */
  access?: string;
  jurisdictionRelevant?: boolean;
  jurisdiction?: string;
  exceptionReason?: string;
}

export interface RuleInput {
  kind: string;
  url: string;
  title?: string | null;
  creator: string | null;
  author: string | null;
  publication: string | null;
  source: string | null;
  /** App visibility timestamp. NEVER used as source age. */
  published_at?: string | null;
  /** Column default is "unknown"; not evidence. Ignored by the rules. */
  access_level?: string | null;
  verification: unknown;
}

/** Owner-supplied channel identities. Exact, case-insensitive match on the creator field only. */
export const EXCLUDED_CREATORS = ["privileged few", "cut", "zoeunlimited"];
const BLOCKED_HOSTS = /(^|\.)wikipedia\.org$|(^|\.)wikiwand\.com$/i;
const EXCLUDED_CATEGORIES = new Set(["music", "motivational", "generic_ai_explainer"]);

const norm = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export function isExcludedCreator(r: Pick<RuleInput, "creator" | "author" | "source">) {
  return [r.creator, r.author, r.source].some((v) => v && EXCLUDED_CREATORS.includes(norm(v)));
}

function readChecks(v: unknown): Checks {
  const c = (v as { checks?: unknown } | null)?.checks;
  return c && typeof c === "object" ? (c as Checks) : {};
}
function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
const ymd = (d: Date) => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();

/** Calendar cutoff two years before `now` (UTC). Feb 29 falls back to Feb 28 in non-leap years. */
export function twoYearCutoff(now: Date) {
  const y = now.getUTCFullYear() - 2;
  const m = now.getUTCMonth() + 1;
  let d = now.getUTCDate();
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  if (m === 2 && d === 29 && !leap) d = 28;
  return y * 10000 + m * 100 + d;
}

/** met = inside [now − 2 calendar years, today]; missing = older or in the future; unknown = no evidenced date. */
export function windowState(date: Date | null, now: Date): RuleState {
  if (!date) return "unknown";
  const v = ymd(date);
  if (v > ymd(now)) return "missing";
  return v >= twoYearCutoff(now) ? "met" : "missing";
}

const bool = (v: boolean | undefined, okWhen = true): RuleState =>
  v === undefined ? "unknown" : v === okWhen ? "met" : "missing";

/** Human label for an evidenced date basis. */
export function dateBasisLabel(basis: NonNullable<Checks["sourceDate"]>["basis"]) {
  return basis === "original_upload" ? "original upload date"
    : basis === "platform_publication" ? "platform publication date (may not be the original upload)"
      : "publication date";
}

export function evaluateSource(r: RuleInput, opts: { duplicateProduction?: boolean; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const checks = readChecks(r.verification);
  const rules: Record<string, RuleState> = {};
  const hard: string[] = [];

  let host = "";
  try {
    const u = new URL(r.url);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    host = u.hostname;
  } catch {
    hard.push("valid_url");
  }
  if (host && BLOCKED_HOSTS.test(host)) hard.push("no_wikipedia");
  if (isExcludedCreator(r)) hard.push("creator_excluded");
  if (checks.researchWikipedia === true) hard.push("no_wikipedia_research");
  if ((r.kind === "videos" || r.kind === "video") && checks.contentCategory && EXCLUDED_CATEGORIES.has(checks.contentCategory)) {
    hard.push(`excluded_${checks.contentCategory}`);
  }

  rules["provenance"] = bool(checks.provenanceVerified);
  rules["research_not_wikipedia"] = checks.researchWikipedia === false ? "met" : checks.researchWikipedia ? "missing" : "unknown";
  rules["topic_fit"] = bool(checks.topicFit);
  rules["depth"] = bool(checks.depth);
  rules["not_duplicate_production"] = opts.duplicateProduction === undefined ? "unknown" : opts.duplicateProduction ? "missing" : "met";

  if ((r.kind === "videos" || r.kind === "video")) {
    // Only an explicitly evidenced source date counts; catalogue fields and the app timestamp do not.
    const sd = checks.sourceDate;
    const upload = sd && sd.basis !== "publication" ? parseDate(sd.value) : null;
    rules["video_within_two_years"] = windowState(upload, now);
    rules["description_cites_research"] = bool(checks.descriptionCitations);
    rules["content_category"] = checks.contentCategory ? (EXCLUDED_CATEGORIES.has(checks.contentCategory) ? "missing" : "met") : "unknown";
    rules["archival_recording_date"] =
      checks.archival === undefined ? "unknown"
        : !checks.archival ? "met"
          : windowState(parseDate(checks.recordingDate), now);
  } else {
    // Older foundational readings are allowed: the date must be evidenced and not in the future.
    const sd = checks.sourceDate;
    const pub = sd && sd.basis === "publication" ? parseDate(sd.value) : null;
    rules["reading_date"] = !pub ? "unknown" : ymd(pub) > ymd(now) ? "missing" : "met";
    rules["reading_access"] = norm(checks.access) ? "met" : "unknown";
    rules["reading_jurisdiction"] =
      checks.jurisdictionRelevant === undefined ? "unknown"
        : !checks.jurisdictionRelevant || norm(checks.jurisdiction) ? "met" : "missing";
  }

  const missing = Object.keys(rules).filter((k) => rules[k] === "missing");
  const unknown = Object.keys(rules).filter((k) => rules[k] === "unknown");
  const reason = checks.exceptionReason?.trim() || null;
  let outcome: Outcome;
  if (hard.length || missing.length >= 2) outcome = "rejected";
  else if (unknown.length) outcome = "blocked";
  else if (missing.length === 1) outcome = reason ? "exceptional" : "rejected";
  else outcome = "passing";
  return { outcome, hard, missing, unknown, rules, reason: outcome === "exceptional" ? reason : null };
}

/** Same production for one topic: same YouTube id / normalized URL, or same creator + title. */
export function productionKey(r: { url: string; creator: string | null; title?: string | null }) {
  try {
    const u = new URL(r.url);
    const yt = u.hostname.includes("youtu") ? (u.searchParams.get("v") ?? u.pathname.split("/").pop()) : null;
    if (yt) return `yt:${yt}`;
    return `url:${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return `ct:${norm(r.creator)}|${norm(r.title)}`;
  }
}
