import { isSafeSourceUrl } from "./content-safety";

/**
 * Destination checks for the editor's link-health probe (SSRF guard).
 * Pure functions so they can be unit-tested. Hostnames are checked
 * literally; DNS rebinding to a private address cannot be detected here
 * because the Worker runtime does not expose resolved IPs (documented
 * limitation in docs/BACKEND_RUNBOOK.md).
 */
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".arpa"];

function ipv4Private(host: string): boolean | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return true;
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export function isProbeableUrl(raw: string): boolean {
  if (!isSafeSourceUrl(raw)) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "80" && url.port !== "443") return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || !host.includes(".") && !host.startsWith("[")) return false;
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return false;
  if (host.startsWith("[")) {
    const v6 = host.slice(1, -1);
    if (v6 === "::" || v6 === "::1") return false;
    if (/^(fc|fd|fe8|fe9|fea|feb)/.test(v6)) return false;
    const mapped = v6.match(/^::ffff:(.+)$/);
    if (mapped) return false;
    return true;
  }
  // Numeric forms like 2130706433 or 0x7f.1 are rejected outright.
  if (/^[0-9x.]+$/i.test(host) && ipv4Private(host) === null) return false;
  const priv = ipv4Private(host);
  return priv !== true;
}

export const PROBE_MAX_REDIRECTS = 5;
export const PROBE_TIMEOUT_MS = 9000;

/**
 * Server-side link probing is OFF. The Worker runtime offers neither DNS
 * resolution nor a fetch pinned to a validated IP, so a public hostname that
 * resolves (or rebinds) to an internal address cannot be excluded. String
 * checks alone are not SSRF protection, so no network request is made.
 */
export const LINK_PROBE_ENABLED = false;
export const LINK_PROBE_DISABLED_REASON =
  "Automatic link checking is switched off on the server for safety: the hosting platform cannot guarantee a link will not be redirected to a private address. Earlier reports stay visible; check links by opening them.";

export type LinkOutcome = "ok" | "redirected" | "broken" | "blocked" | "error" | "disabled";
export type AccessHint = "login" | "paywall" | null;
export interface ProbeResult { outcome: LinkOutcome; status_code: number | null; final_url: string | null; detail: string | null; access_level?: AccessHint }

/** Max batch per protected invocation; the runtime allows ~6 outbound requests at once. */
export const PROBE_BATCH_LIMIT = 12;
export const PROBE_CONCURRENCY = 4;

export async function probeLink(
  url: string,
  opts: { enabled: boolean; fetchImpl?: typeof fetch },
): Promise<ProbeResult> {
  if (!opts.enabled) {
    return { outcome: "disabled", status_code: null, final_url: null, detail: LINK_PROBE_DISABLED_REASON };
  }
  if (!isProbeableUrl(url)) {
    return { outcome: "blocked", status_code: null, final_url: null, detail: "Destination not allowed" };
  }
  const doFetch = opts.fetchImpl ?? fetch;
  let current = url;
  try {
    for (let hop = 0; hop <= PROBE_MAX_REDIRECTS; hop++) {
      let res = await doFetch(current, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      void res.body?.cancel().catch(() => {});
      if (res.status === 405 || res.status === 501) {
        // Minimal GET fallback: ask for one byte and never read the body.
        res = await doFetch(current, { method: "GET", redirect: "manual", headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
        void res.body?.cancel().catch(() => {});
      }
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        const next = new URL(location, current).toString();
        if (!isProbeableUrl(next)) return { outcome: "blocked", status_code: res.status, final_url: null, detail: "Redirect to a disallowed destination" };
        current = next;
        continue;
      }
      const moved = current !== url && new URL(current).host !== new URL(url).host;
      const outcome: LinkOutcome = res.status < 400 || res.status === 206 ? (moved ? "redirected" : "ok") : [401, 403, 429].includes(res.status) ? "blocked" : "broken";
      const access_level: AccessHint = res.status === 401 ? "login" : res.status === 402 ? "paywall" : null;
      return { outcome, status_code: res.status, final_url: current !== url ? current : null, detail: null, access_level };
    }
    return { outcome: "error", status_code: null, final_url: null, detail: "Too many redirects" };
  } catch (e) {
    return { outcome: "error", status_code: null, final_url: null, detail: e instanceof Error && e.name === "TimeoutError" ? "Timed out" : "Request failed" };
  }
}
