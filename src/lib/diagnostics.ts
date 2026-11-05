/**
 * Low-volume, structured, production-safe diagnostics.
 * Never pass tokens, passwords, note bodies, emails or other personal text.
 * `expected` events (fallbacks such as a blocked embed) are logged at info level
 * so they stay distinguishable from real application errors.
 * See docs/OBSERVABILITY.md for categories, retention and alert thresholds.
 */
type Area = "auth" | "database" | "resource_load" | "source_check" | "viewer" | "account" | "api";

const SENSITIVE = /(token|password|secret|authorization|cookie|email|body|note|key|jwt|bearer|session|phone|address|name)|(^|_)ip($|_)/i;
// Value-level scrubbing: even under an innocent field name, never emit these.
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const JWTISH = /\beyJ[\w-]+\.[\w-]+\.[\w-]+|\bsb_(publishable|secret)_[\w-]+|\b[A-Za-z0-9_-]{40,}\b/g;

function scrub(v: string) {
  return v.replace(EMAIL, "[email]").replace(JWTISH, "[redacted]").slice(0, 200);
}

function clean(fields: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (SENSITIVE.test(k)) continue;
    if (typeof v === "string") out[k] = scrub(v);
    else if (typeof v === "number" || typeof v === "boolean" || v == null) out[k] = v;
  }
  return out;
}

// Collapse repeats: the same area/event/code is emitted at most once per window.
const DEDUPE_MS = 30_000;
const recent = new Map<string, number>();

export function logEvent(area: Area, event: string, fields: Record<string, unknown> = {}, level: "info" | "warn" | "error" = "info") {
  const c = clean(fields);
  const sig = `${area}|${event}|${level}|${String(c["code"] ?? "")}|${String(c["status"] ?? "")}`;
  const now = Date.now();
  const last = recent.get(sig);
  if (last !== undefined && now - last < DEDUPE_MS) return;
  recent.set(sig, now);
  if (recent.size > 200) for (const [k, t] of recent) if (now - t >= DEDUPE_MS) recent.delete(k);
  const line = JSON.stringify({ t: new Date(now).toISOString(), area, event, level, ...c });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/** Test-only: forget dedupe history. */
export function _resetDiagnostics() {
  recent.clear();
}

/** Human-readable message that never leaks backend details. */
export function safeMessage(area: Area, event: string, err: unknown, fallback = "Something went wrong. Please try again.") {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : undefined;
  logEvent(area, event, { code }, "error");
  return fallback;
}
