/** Display-only cleanup: stored research and access decisions remain untouched. */
export function readerCopy(value: string | null | undefined): string {
  if (!value) return "";
  // This known import appendix contains workflow notes, not the topical description.
  const topical = value.split(/\bOwner[-\s]approved inclusion\s*[—–:-]/i)[0] ?? "";
  // Internal source-check notes trailing an otherwise useful clause: drop only the
  // note so supplied provenance ("archived upload, not a 2025 recording") survives.
  const trailingNote = /,?\s*not live\b|,\s*but\s+(?:the\s+)?(?:exact\s+|original\s+)?(?:recording|production|event|lecture|talk)\s+dates?\s+(?:not\s+\w+|unstated|unknown|unconfirmed)|,?\s*details need current-law verification/gi;
  const cleaned = topical.replace(trailingNote, "");
  const process = /\b(?:owner[-\s]approved|owner(?:’s|'s)? (?:approval|request)|agent[-\s](?:assessed|assessment|verified)|metadata[-\s]only|page[-\s]not[-\s]read|(?:full (?:paper|video|text)|page|transcript) (?:was |has |has been )?not (?:read|reviewed|inspected)|not (?:watched|read) in full|duration not recorded|(?:identity|abstract|title and source|relevant page or abstract|relevant page text|link|topic fit).{0,60}\bchecked|(?:publisher )?(?:abstract(?:\/page)?|publication page|index) (?:reviewed|verified)|confirmed reachable|full underlying study methods not independently appraised|not a full [a-z\s-]{0,30}(?:appraisal|audit|replication)|exhaustive [a-z\s-]{0,20}audit|live[-\s]?link audit|not independently (?:replicated|reproduced|verified|appraised|reviewed|inspected)|(?:editorial approval|verification incomplete|review[-\s]level|recorded limitations|independently (?:rechecked|verified)|catalogue metadata|imported research metadata)|each source.{0,60}what was checked|description has no\b[^.!?]{0,60}\b(?:citations?|references?|bibliography|sources?|links?)|wikipedia mention|no (?:bibliography|references|recording date)\b|(?:recording|production|event|lecture|talk)\s+dates?\s+(?:not\s+\w+|unstated|unknown|unconfirmed)|original\s+date\s+(?:not\s+\w+|unstated|unknown|unconfirmed)|cannot be checked|transcript\s+not\s+(?:independently\s+)?(?:inspected|checked|reviewed)|requires transcript review|source depth unverified)\b/i;
  const result = cleaned.split(/\n+/).map((paragraph) =>
    (paragraph.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? [paragraph])
      .map((sentence) => {
        const kept = sentence.split(/;\s*/).filter((clause) => /[\p{L}\p{N}]/u.test(clause) && !process.test(clause)).join("; ").trim();
        // A removed trailing clause takes the sentence's final period with it; restore it.
        if (kept && /[.!?]\s*$/.test(sentence) && !/[.!?]$/.test(kept)) return kept + sentence.trim().slice(-1);
        return kept;
      }).filter(Boolean).join(" ").trim(),
  ).filter(Boolean).join("\n\n").trim();
  // Stripping a leading check note must not leave a lowercase sentence start.
  const originalFirst = value.match(/[\p{L}]/u)?.[0];
  if (originalFirst && originalFirst === originalFirst.toUpperCase()) {
    return result.replace(/^\p{Ll}/u, (letter) => letter.toUpperCase());
  }
  return result;
}

/** Keep the supplied date, without import/workflow labels or invented date provenance. */
export function readerPublication(value: string | null | undefined): string {
  return readerCopy(value?.replace(/\bcatalogue\s+(?:upload|publication|date)\s*:\s*/gi, ""));
}
