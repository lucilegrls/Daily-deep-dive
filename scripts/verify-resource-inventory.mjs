import dns from "node:dns/promises";
import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = path.join(ROOT, "src/data/french-public-copy/snapshot.json");
const OUTPUT_DIR = path.join(ROOT, "verification-results");
const CHECKER_VERSION = "curiosity-resource-checker/1.0.0";
const CONCURRENCY = 4;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 65_536;
const USER_AGENT = "Curiosity-Sourced-Link-Checker/1.0 (+technical health only)";

function blockedIpv4(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  const [a, b, c] = p;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c <= 2) || (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113);
}

function blockedIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) return blockedIpv4(ip);
  if (family !== 6) return true;
  const v = ip.toLowerCase().split("%")[0];
  if (v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") ||
      /^fe[89ab]/.test(v) || v.startsWith("ff") || v.startsWith("2001:db8:")) return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? blockedIpv4(mapped[1]) : false;
}

function normalizedUrl(raw) {
  const u = new URL(raw);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw new Error("unsupported_or_credentialed_url");
  if (u.port && !['80', '443'].includes(u.port)) throw new Error("unsupported_port");
  if (!u.hostname || u.hostname === 'localhost' || /\.(localhost|local|internal|lan|home|arpa)$/i.test(u.hostname)) throw new Error("blocked_host");
  u.hash = "";
  return u.toString();
}

async function publicAddress(hostname) {
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((x) => blockedIp(x.address))) throw new Error("private_or_unresolved_destination");
  return addresses[0];
}

function singleRequest(url, method, address) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const transport = u.protocol === "https:" ? https : http;
    const started = Date.now();
    let bytes = 0;
    const req = transport.request(u, {
      method,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/pdf,application/json;q=0.9,*/*;q=0.5",
        ...(method === "GET" ? { range: `bytes=0-${MAX_BODY_BYTES - 1}` } : {}),
      },
      lookup: (_hostname, options, callback) => {
        if (options?.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      },
      servername: u.hostname,
    }, (res) => {
      res.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) req.destroy(new Error("response_too_large"));
      });
      res.on("end", () => resolve({
        status: res.statusCode ?? null,
        headers: res.headers,
        response_time_ms: Date.now() - started,
        bytes_read: bytes,
      }));
    });
    req.setTimeout(TIMEOUT_MS, () => req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })));
    req.on("error", reject);
    req.end();
  });
}

async function requestHop(url, method = "HEAD") {
  const u = new URL(url);
  const address = await publicAddress(u.hostname);
  let response = await singleRequest(url, method, address);
  // A large number of publishers and bot-protection layers reject HEAD while
  // allowing a bounded GET. Retest those responses before classifying access.
  if (method === "HEAD" && [401, 403, 405, 429, 501].includes(response.status)) {
    response = await singleRequest(url, "GET", address);
  }
  return response;
}

function embedFromHeaders(headers, kind) {
  if (kind !== "videos") return "not_applicable";
  const xfo = String(headers["x-frame-options"] ?? "").toLowerCase();
  const csp = String(headers["content-security-policy"] ?? "").toLowerCase();
  if (xfo.includes("deny") || xfo.includes("sameorigin") || /frame-ancestors\s+['"]?none/.test(csp)) return "restricted";
  return "unknown";
}

function classify(status, error, redirected, embedStatus) {
  if (error) return error === "unsupported_or_credentialed_url" || error === "unsupported_port" || error === "blocked_host" || error === "private_or_unresolved_destination" ? "needs_review" : "temporarily_unavailable";
  if (status === 410) return "removed";
  if ([401, 403].includes(status)) return "restricted";
  if (status === 402) return "paywalled";
  if ([408, 429, 500, 502, 503, 504].includes(status)) return "temporarily_unavailable";
  if (status === 404) return "broken";
  if (status >= 400) return "needs_review";
  if (embedStatus === "restricted") return "embed_unavailable";
  return redirected ? "redirected" : "healthy";
}

async function checkUrl(raw, kind) {
  const checkedAt = new Date().toISOString();
  let current;
  try { current = normalizedUrl(raw); }
  catch (e) {
    return { original_url: raw, checked_at: checkedAt, technical_status: "needs_review", embed_status: "unknown", failure_reason: e.message, checker_version: CHECKER_VERSION };
  }
  const normalized = current;
  const chain = [];
  let totalMs = 0;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const response = await requestHop(current);
      totalMs += response.response_time_ms;
      const location = response.headers.location;
      if (response.status >= 300 && response.status < 400 && location) {
        if (hop === MAX_REDIRECTS) throw new Error("redirect_loop_or_limit");
        const next = normalizedUrl(new URL(location, current).toString());
        chain.push({ from: current, status: response.status, to: next });
        current = next;
        continue;
      }
      let embedStatus = embedFromHeaders(response.headers, kind);
      let youtubeOembed = null;
      const youtube = kind === "videos" && /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(new URL(normalized).hostname);
      if (youtube) {
        const oembedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(normalized)}`;
        const oe = await requestHop(oembedUrl, "GET");
        youtubeOembed = oe.status;
        embedStatus = oe.status === 200 ? "available" : [401, 403].includes(oe.status) ? "restricted" : oe.status === 404 ? "unavailable" : "unknown";
      }
      const technicalStatus = classify(response.status, null, chain.length > 0, embedStatus);
      return {
        original_url: raw,
        normalized_url: normalized,
        checked_at: checkedAt,
        status_code: response.status,
        redirect_chain: chain,
        final_url: current,
        source_domain: new URL(current).hostname.toLowerCase(),
        response_time_ms: totalMs,
        content_type: response.headers["content-type"] ?? null,
        content_length: response.headers["content-length"] ?? null,
        technical_status: technicalStatus,
        embed_status: embedStatus,
        auth_required: [401, 403].includes(response.status),
        paywall_detected: response.status === 402,
        destination_changed: new URL(normalized).hostname !== new URL(current).hostname,
        failure_reason: technicalStatus === "healthy" || technicalStatus === "redirected" ? null : `http_${response.status}`,
        youtube_oembed_status: youtubeOembed,
        checker_version: CHECKER_VERSION,
      };
    }
  } catch (e) {
    return {
      original_url: raw,
      normalized_url: normalized,
      checked_at: checkedAt,
      redirect_chain: chain,
      final_url: current,
      source_domain: (() => { try { return new URL(current).hostname.toLowerCase(); } catch { return null; } })(),
      response_time_ms: totalMs || null,
      technical_status: classify(null, e.message, chain.length > 0, "unknown"),
      embed_status: "unknown",
      failure_reason: e.code === "ETIMEDOUT" ? "timeout" : e.message,
      checker_version: CHECKER_VERSION,
    };
  }
}

async function mapConcurrent(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
      if ((i + 1) % 50 === 0) process.stderr.write(`checked ${i + 1}/${items.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

const snapshot = JSON.parse(await fs.readFile(INPUT, "utf8"));
const retryPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
const prior = retryPath ? JSON.parse(await fs.readFile(retryPath, "utf8")) : null;
const retryStatuses = process.argv[3] === "failures"
  ? new Set(["temporarily_unavailable", "broken", "needs_review", "removed"])
  : new Set(["restricted", "temporarily_unavailable", "embed_unavailable", "broken", "needs_review", "removed"]);
const candidateResources = prior
  ? prior.resources.filter((r) => retryStatuses.has(r.check.technical_status))
  : snapshot.resources;
const unique = [...new Map(candidateResources.map((r) => [r.url, { url: r.url, kind: r.kind }])).values()];
await fs.mkdir(OUTPUT_DIR, { recursive: true });
const startedAt = new Date().toISOString();
const uniqueResults = await mapConcurrent(unique, CONCURRENCY, (r) => checkUrl(r.url, r.kind));
const byUrl = new Map(uniqueResults.map((r) => [r.original_url, r]));
const priorById = new Map((prior?.resources ?? []).map((r) => [r.id, r.check]));
const failureStatuses = new Set(["temporarily_unavailable", "broken", "needs_review", "removed"]);
const resources = snapshot.resources.map((r) => {
  const previous = priorById.get(r.id);
  const fresh = byUrl.get(r.url);
  if (!fresh) return { ...r, check: previous };
  const failed = failureStatuses.has(fresh.technical_status);
  const priorFailed = previous && failureStatuses.has(previous.technical_status);
  const consecutive = failed ? (priorFailed ? (previous.consecutive_failures ?? 1) : 0) + 1 : 0;
  let technicalStatus = fresh.technical_status;
  if (technicalStatus === "temporarily_unavailable" && consecutive >= 3) technicalStatus = "broken";
  else if (technicalStatus === "temporarily_unavailable" && consecutive >= 2) technicalStatus = "needs_review";
  return { ...r, check: { ...fresh, technical_status: technicalStatus, consecutive_failures: consecutive } };
});
const counts = {};
const embedCounts = {};
for (const r of resources) {
  counts[r.check.technical_status] = (counts[r.check.technical_status] ?? 0) + 1;
  embedCounts[r.check.embed_status] = (embedCounts[r.check.embed_status] ?? 0) + 1;
}
const report = {
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  checker_version: CHECKER_VERSION,
  inventory: { topics: snapshot.topics.length, resources: resources.length, unique_urls: new Set(snapshot.resources.map((r) => r.url)).size, checked_this_run: unique.length, source_captured_at: snapshot.capturedAt },
  counts,
  embed_counts: embedCounts,
  resources,
};
const stamp = report.finished_at.slice(0, 10);
const jsonPath = path.join(OUTPUT_DIR, `${stamp}-resource-verification.json`);
await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
const attention = resources.filter((r) => !["healthy", "redirected"].includes(r.check.technical_status));
const md = [
  `# Resource verification — ${stamp}`,
  "",
  `Audited ${resources.length} resources (${new Set(snapshot.resources.map((resource) => resource.url)).size} unique URLs) across ${snapshot.topics.length} topics; this pass rechecked ${unique.length} URLs.`,
  "",
  ...Object.entries(counts).sort().map(([k, v]) => `- ${k}: ${v}`),
  "",
  `## Requires attention (${attention.length})`,
  "",
  ...attention.map((r) => `- [${r.title}](${r.url}) — topic ${r.topic_id}; ${r.kind}; ${r.check.technical_status}; ${r.check.failure_reason ?? "no reason"}`),
  "",
  "> These are technical observations only. They are not source reviews or claim verification.",
].join("\n");
const mdPath = path.join(OUTPUT_DIR, `${stamp}-resource-verification.md`);
await fs.writeFile(mdPath, md);
console.log(JSON.stringify({ jsonPath, mdPath, ...report.inventory, counts, embed_counts: embedCounts, attention: attention.length }));
