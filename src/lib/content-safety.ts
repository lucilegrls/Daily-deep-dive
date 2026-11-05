/**
 * Source-safety rules, mirrored from the database.
 *
 * The database enforces the same rule with `public.is_safe_source_url`, so an
 * unsafe link cannot enter through an import even if this check is bypassed.
 * Both sides normalise the host the same way: lower-cased, userinfo and port
 * removed, IPv6 brackets stripped, trailing root dots removed. Without that,
 * `https://en.wikipedia.org./wiki/Iron` slips past a naive suffix test.
 */

const BLOCKED_HOSTS = [
  "wikipedia.org",
  "wikimedia.org",
  "wikiwand.com",
  "wikibooks.org",
  "wikisource.org",
  "wikiquote.org",
  "wikidata.org",
  "wiktionary.org",
  "dbpedia.org",
];

/** Normalised hostname, or null when the URL has no usable http(s) host. */
export function normalizeHost(url: string | undefined | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;

  let host: string;
  try {
    host = new URL(trimmed).hostname;
  } catch {
    // Fall back to manual parsing so odd-but-parseable authorities still fail
    // closed rather than throwing.
    const authority = trimmed
      .replace(/^https?:\/\//i, "")
      .split(/[/?#]/)[0]
      ?.replace(/^.*@/, "");
    if (!authority) return null;
    host = authority.replace(/:\d+$/, "");
  }

  host = host
    .trim()
    .toLowerCase()
    .replace(/[[\]]/g, "")
    .replace(/\.+$/, "");

  if (host === "" || /\s/.test(host)) return null;
  return host;
}

export function isSafeSourceUrl(url: string | undefined | null): boolean {
  const host = normalizeHost(url);
  if (!host) return false;
  return !BLOCKED_HOSTS.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`),
  );
}

export function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "topic"
  );
}
