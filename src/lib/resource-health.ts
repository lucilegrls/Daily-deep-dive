export const TECHNICAL_STATUSES = [
  "healthy",
  "redirected",
  "restricted",
  "paywalled",
  "embed_unavailable",
  "temporarily_unavailable",
  "broken",
  "removed",
  "needs_review",
  "unknown",
] as const;

export type TechnicalStatus = (typeof TECHNICAL_STATUSES)[number];
export type EmbedStatus = "available" | "unavailable" | "restricted" | "unknown" | "not_applicable";
export type RiskLevel = "standard" | "elevated" | "high";

export interface TechnicalObservation {
  statusCode?: number | null;
  networkError?: "timeout" | "tls" | "dns" | "oversized" | "redirect_loop" | "other" | null;
  redirected?: boolean;
  suspiciousRedirect?: boolean;
  loginRequired?: boolean;
  paywall?: boolean;
  removed?: boolean;
  embedStatus?: EmbedStatus;
}

/**
 * Classifies one bounded network observation. Editorial/source/claim review is
 * deliberately absent from this type: a technical observation cannot confer it.
 */
export function classifyTechnicalObservation(o: TechnicalObservation): TechnicalStatus {
  if (o.removed || o.statusCode === 410) return "removed";
  if (o.suspiciousRedirect || o.networkError === "redirect_loop") return "needs_review";
  if (o.loginRequired || o.statusCode === 401 || o.statusCode === 403) return "restricted";
  if (o.paywall || o.statusCode === 402) return "paywalled";
  if (o.statusCode === 429 || o.statusCode === 408 || o.statusCode === 503 || o.networkError) {
    return "temporarily_unavailable";
  }
  if (o.statusCode === 404) return "broken";
  if (o.statusCode != null && o.statusCode >= 400) return "temporarily_unavailable";
  if (o.statusCode != null && o.statusCode >= 200 && o.statusCode < 400) {
    if (o.embedStatus === "unavailable" || o.embedStatus === "restricted") return "embed_unavailable";
    return o.redirected ? "redirected" : "healthy";
  }
  return "unknown";
}

export function persistentStatus(
  observed: TechnicalStatus,
  consecutiveFailures: number,
  brokenAfter = 3,
): TechnicalStatus {
  if (observed !== "temporarily_unavailable") return observed;
  return consecutiveFailures >= brokenAfter ? "broken" : consecutiveFailures >= 2 ? "needs_review" : observed;
}

export function nextTechnicalCheckAt(
  from: Date,
  status: TechnicalStatus,
  failures: number,
  risk: RiskLevel,
): Date {
  const day = 86_400_000;
  let days = risk === "high" ? 7 : risk === "elevated" ? 14 : 30;
  if (["broken", "removed", "needs_review"].includes(status)) days = Math.min(days, 7);
  if (status === "temporarily_unavailable") days = Math.min(days, 2 ** Math.min(Math.max(failures, 0), 5));
  return new Date(from.getTime() + days * day);
}

export function editorialReviewDueAt(from: Date, risk: RiskLevel): Date {
  const days = risk === "high" ? 90 : risk === "elevated" ? 180 : 365;
  return new Date(from.getTime() + days * 86_400_000);
}
