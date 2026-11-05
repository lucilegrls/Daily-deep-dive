import { errorStatus } from "./retry";
import type { TranslationKey } from "./translations";

/**
 * Classifies a failed reader write (note, save, progress) so the UI can offer
 * the right recovery: sign in again, retry later, or a plain apology.
 * Never inspect or log the payload; only status/code/message shape.
 */
export type WriteFailure = "session" | "network" | "limited" | "failed";

const NETWORK = /failed to fetch|fetch failed|networkerror|network request failed|load failed|timed out|TimeoutError/i;
const SESSION = /jwt|session|unauthori[sz]ed|PGRST301|PGRST302|refresh token/i;

export function classifyWriteError(err: unknown): WriteFailure {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "network";
  const e = (err ?? {}) as { name?: unknown; message?: unknown; code?: unknown };
  const text = `${String(e.name ?? "")} ${String(e.message ?? "")} ${String(e.code ?? "")}`;
  const status = errorStatus(err);
  if (/\brate_limited\b|suggestion_rate_limit/.test(text)) return "limited";
  if (status === 401 || SESSION.test(text)) return "session";
  if (status === 0 || NETWORK.test(text) || (status !== null && [408, 502, 503, 504].includes(status))) return "network";
  return "failed";
}

export function writeFailureKey(kind: WriteFailure): TranslationKey {
  return kind === "session" ? "err.session" : kind === "network" ? "err.network" : kind === "limited" ? "err.rateLimited" : "err.unexpected";
}

/**
 * Runs at most one write per key at a time; a second call for the same key
 * while one is in flight is dropped (returns null), so double clicks or
 * blur+click never send duplicate writes. Never retries.
 */
export function createSingleFlight() {
  const busy = new Set<string>();
  return async function run<T>(key: string, fn: () => Promise<T>): Promise<T | null> {
    if (busy.has(key)) return null;
    busy.add(key);
    try {
      return await fn();
    } finally {
      busy.delete(key);
    }
  };
}
