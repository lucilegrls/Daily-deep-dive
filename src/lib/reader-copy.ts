/** Display-only cleanup: stored research and access decisions remain untouched. */
export function readerCopy(value: string | null | undefined): string {
  if (!value) return "";
  // This known import appendix contains workflow notes, not the topical description.
  const topical = value.split(/\bOwner[-\s]approved inclusion\s*[—–:-]/i)[0] ?? "";
  // Internal source-check notes trailing an otherwise useful clause: drop only the
  // note so supplied provenance ("archived upload, not a 2025 recording") survives.
  const trailingNote = /,?\s*not live\b|,\s*but\s+(?:the\s+)?(?:exact\s+|original\s+)?(?:recording|production|event|lecture|talk)\s+dates?\s+(?:not\s+\w+|unstated|unknown|unconfirmed)|,?\s*details need current-law verification/gi;
  const cleaned = topical.replace(trailingNote, "")
    // Remove exact editorial addenda, not dates, scientific citations or the
    // research topic itself (e.g. candidate generation, electoral audits).
    .replace(/,?\s*(?:outside\s+(?:the\s+)?(?:preferred\s+)?(?:date|upload)?\s*window|(?:older than|predates)\s+(?:the\s+)?(?:preferred|recent)\s+(?:date\s+)?window(?:\s+by\s+\d+\s+days)?|not a recent candidate)/gi, "")
    .replace(/\s+and\s+no formal references cited/gi, "")
    .replace(/,?\s*(?:no formal bibliography in description|(?:original upload\/provenance and source description|transcript(?:\/original recording|\/recording|\/provenance)?|recording provenance)\s+(?:are\s+)?(?:unverified|not\s+(?:separately\s+)?checked)|(?:page references\/provenance|specific sections)\s+not\s+(?:independently\s+)?(?:inspected|checked))/gi, "")
    .replace(/;\s*verify claims and coverage through transcript/gi, "")
    .replace(/,?\s*but (?:content could not be substantiated from description|exact comparative-culture sections not inspected)/gi, "")
    .replace(/,?\s*older candidate\b/gi, "older")
    .replace(/\s+(?:but|and)\s*(?=[;,.]|$)/gi, "")
    .replace(/\babstract and citation reviewed\b/gi, "")
    .replace(/\s*Same (?:source|report|statute|guidelines?|guidance|review|CRS resource) (?:also )?(?:reused|also serve|also serves|resource reused|reused|serves)[^.]*\./gi, "");
  const process = /\b(?:owner[-\s]approved|owner(?:’s|'s)? (?:approval|request)|agent[-\s](?:assessed|assessment|verified)|metadata[-\s]only|page[-\s]not[-\s]read|(?:full (?:paper|video|text)|page|transcript) (?:was |has |has been )?not (?:read|reviewed|inspected)|not (?:watched|read) in full|duration not recorded|(?:identity|abstract|title and source|relevant page or abstract|relevant page text|link|topic fit).{0,60}\bchecked|(?:publisher )?(?:abstract(?:\/page)?|publication page|index) (?:reviewed|verified)|confirmed reachable|full underlying study methods not independently appraised|not a full [a-z\s-]{0,30}(?:appraisal|audit|replication)|exhaustive [a-z\s-]{0,20}audit|live[-\s]?link audit|not independently (?:replicated|reproduced|verified|appraised|reviewed|inspected)|(?:editorial approval|verification incomplete|review[-\s]level|recorded limitations|independently (?:rechecked|verified)|catalogue metadata|imported research metadata)|each source.{0,60}what was checked|description has no\b[^.!?]{0,60}\b(?:citations?|references?|bibliography|sources?|links?)|wikipedia mention|no (?:bibliography|references|recording date)\b|(?:recording|production|event|lecture|talk)\s+dates?\s+(?:not\s+\w+|unstated|unknown|unconfirmed)|original\s+date\s+(?:not\s+\w+|unstated|unknown|unconfirmed)|cannot be checked|transcript\s+not\s+(?:independently\s+)?(?:inspected|checked|reviewed)|requires transcript review|source depth unverified)\b/i;
  const additionalProcess = /\b(?:full (?:article|text|treaty and guide) (?:not (?:inspected|appraised)|could not be (?:fetched|retrieved))|no independent (?:appraisal|replication appraisal)|link and (?:authorship|publisher) confirmed|not backed by citations in the description|sources not bibliographed|replaces (?:an? |the )?(?:unverified|lower-confidence|low-confidence)|bibliography in description|description contains no citations|transcript[- ]checked|(?:transcript|recording) (?:and recording provenance )?not checked|rights\/provenance not specified|original production\/recording date|embeds\/rights not assessed|source list.{0,60}unverified)\b/i;
  const result = cleaned.split(/\n+/).map((paragraph) =>
    (paragraph.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? [paragraph])
      .map((sentence) => {
        const kept = sentence.split(/;\s*/).filter((clause) => /[\p{L}\p{N}]/u.test(clause) && !process.test(clause) && !additionalProcess.test(clause)).join("; ").trim();
        // A removed trailing clause takes the sentence's final period with it; restore it.
        if (kept && /[.!?]\s*$/.test(sentence) && !/[.!?]$/.test(kept)) return kept + sentence.trim().slice(-1);
        return kept;
      }).filter(Boolean).join(" ").trim(),
  ).filter(Boolean).join("\n\n").replace(/\.{2,}/g, ".").trim();
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
