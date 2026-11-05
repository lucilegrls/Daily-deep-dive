import { isSafeSourceUrl } from "./content-safety";
import { isProbeableUrl } from "./link-safety";

/** Hosts that must never become research evidence (domain-boundary match). */
const EXTRA_BLOCKED = ["wikiwand.com", "wikipedia.org"];
const TRACKING = /^(utm_[a-z]+|fbclid|gclid|mc_cid|mc_eid)$/i;

export function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Public HTTPS URL with a hostname (no literal IPs, credentials, local names, Wikipedia). */
export function isResearchUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 2000) return false;
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return false; }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/\.+$/, "");
  if (host.startsWith("[") || /^[0-9.]+$/.test(host) || /^0x/i.test(host)) return false;
  if (EXTRA_BLOCKED.some((d) => hostMatches(host, d))) return false;
  return isSafeSourceUrl(raw) && isProbeableUrl(raw);
}

/** Dedup key: drop fragment and tracking params, keep identifying query params. */
export function dedupKey(raw: string): string {
  const u = new URL(raw.trim());
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/\.+$/, "");
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  let s = u.toString();
  if (u.pathname.length > 1 && s.endsWith("/") && !u.search) s = s.slice(0, -1);
  return s;
}

export function isYouTube(host: string): boolean {
  return ["youtube.com", "youtu.be", "youtube-nocookie.com"].some((d) => hostMatches(host, d));
}

/** Authority tier for ordering discovery hints only. Never evidence of quality. */
export function authorityTier(host: string): "institution" | "publisher" | "other" {
  if (/\.(edu|gov|int|mil)$/.test(host) || /\.(ac|edu|gov)\.[a-z]{2}$/.test(host) || hostMatches(host, "europa.eu")) return "institution";
  if (["nature.com", "science.org", "springer.com", "wiley.com", "cambridge.org", "oup.com", "jstor.org", "who.int", "oecd.org", "un.org", "nih.gov", "plos.org", "cell.com", "royalsocietypublishing.org"].some((d) => hostMatches(host, d))) return "publisher";
  return "other";
}
