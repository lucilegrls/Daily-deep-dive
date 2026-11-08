import reviewed from "@/data/french-topic-summaries.json";
import type { LanguageCode } from "@/lib/i18n";
import { readerCopy } from "@/lib/reader-copy";

interface SummaryTopic { id: number; slug?: string; title: string; context: string }
const summaries = new Map(reviewed.topics.map((row) => [row.id, row]));

/** Reviewed source-bound display copy; never changes canonical query objects. */
export function topicContext(lang: LanguageCode, topic: SummaryTopic): string {
  const row = summaries.get(topic.id);
  if (lang !== "fr" || !row || (topic.slug !== undefined && row.slug !== topic.slug) || row.title_en !== topic.title || row.context_en !== topic.context) return readerCopy(topic.context);
  // Supplied, reviewed French is already reader copy; preserve abbreviations exactly.
  return row.context_fr;
}
