import { logEvent } from "./diagnostics";
import { errorStatus } from "./retry";
import type { TranslationKey } from "./translations";

/**
 * Turns any thrown value into a short, human sentence. Messages we wrote
 * ourselves pass through; raw database/network/auth details never do.
 * Pass the i18n `t` function to get the reader's language.
 */
const RAW = /violates|permission denied|relation |column |schema cache|syntax|JWT|PGRST|duplicate key|null value|constraint|stack|at \w+ \(|\bSQL\b|Unauthorized:|Forbidden|\[object /i;
const NETWORK = /failed to fetch|fetch failed|networkerror|network request failed|load failed|timed out|TimeoutError/i;

const EN: Record<string, string> = {
  "err.network": "We couldn't reach Curiosity, Sourced. Check your connection and try again.",
  "err.session": "Your session has expired. Please sign in again.",
  "err.permission": "You don't have access to this.",
  "err.duplicate": "That's already been saved.",
  "err.rateLimited": "You've done this many times in a short while. Please wait and try again later.",
};

type T = (key: TranslationKey) => string;

export function friendlyError(err: unknown, fallback?: string, t?: T): string {
  const fb = fallback ?? (t ? t("err.unexpected") : "Something went wrong. Please try again.");
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const name = err instanceof Error ? err.name : "";
  const status = errorStatus(err);
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  let key: TranslationKey | null = null;
  if (offline || NETWORK.test(`${name} ${msg}`)) key = "err.network";
  else if (status === 401 || /unauthori[sz]ed|jwt|session/i.test(msg)) key = "err.session";
  else if (status === 403 || /forbidden|permission denied/i.test(msg)) key = "err.permission";
  else if (/duplicate key|23505/i.test(msg)) key = "err.duplicate";
  else if (/\brate_limited\b/.test(msg)) key = "err.rateLimited";
  if (key) return t ? t(key) : EN[key]!;
  if (msg && msg.length <= 160 && !RAW.test(msg)) return msg;
  logEvent("api", "unexpected_error", { status, kind: name || typeof err }, "error");
  return fb;
}
