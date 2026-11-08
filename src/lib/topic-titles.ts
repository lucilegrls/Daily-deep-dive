import reviewed from "@/data/french-topic-titles.json";
import type { LanguageCode } from "@/lib/i18n";

export interface TitledTopic {
  id: number;
  slug?: string;
  title: string;
}

const frenchTitles = new Map(reviewed.topics.map((row) => [row.id, row]));

/** Display only: canonical source titles and every other field stay untouched. */
export function topicTitle(lang: LanguageCode, topic: TitledTopic): string {
  if (lang !== "fr") return topic.title;
  const row = frenchTitles.get(topic.id);
  if (!row || (topic.slug !== undefined && row.slug !== topic.slug)) return topic.title;
  return row.title_fr;
}