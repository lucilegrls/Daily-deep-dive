/**
 * Transient failures worth an automatic retry: network drops and HTTP 408/429/502/503/504.
 * Everything else (4xx, validation, authorisation, unknown) is surfaced immediately.
 */
export const TRANSIENT_STATUSES = new Set([408, 429, 502, 503, 504]);
const NETWORK = /failed to fetch|fetch failed|networkerror|network request failed|load failed|ECONNRESET|ECONNREFUSED|socket hang up/i;
const STATUS_IN_MESSAGE = /\b(?:status(?: code)?|HTTP)\s*:?\s*(\d{3})\b/i;
export const MAX_RETRIES = 2;

export function errorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const e = error as { status?: unknown; statusCode?: unknown; message?: unknown };
  for (const v of [e.status, e.statusCode]) if (typeof v === "number") return v;
  if (typeof e.message === "string") {
    const m = STATUS_IN_MESSAGE.exec(e.message);
    if (m) return Number(m[1]);
  }
  return null;
}

export function isTransientError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error && error.name === "TimeoutError") return false;
  const status = errorStatus(error);
  if (status !== null) return TRANSIENT_STATUSES.has(status);
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return NETWORK.test(message);
}

/** React Query `retry` for reads only: at most two retries, transient failures only. */
export function retryTransient(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_RETRIES && isTransientError(error);
}

/** Bounded exponential backoff: 500 ms, 1 s, capped at 4 s. */
export function retryDelay(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 4000);
}

/** Retries an idempotent read. Never use for mutations. */
export async function retryRead<T>(
  fn: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!retryTransient(attempt, error)) throw error;
      await sleep(retryDelay(attempt));
    }
  }
}

export const CLIENT_TIMEOUT_MS = 12_000;

/** Rejects with a TimeoutError if the call has not settled in time, so a hung request becomes a visible error. */
export function withTimeout<T>(promise: Promise<T>, ms = CLIENT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new DOMException("The request timed out.", "TimeoutError")), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
