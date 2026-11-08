import translations from "@/data/french-public-copy/translations.json";
import guards from "@/data/french-public-copy/guards.json";
import type { LanguageCode } from "@/lib/i18n";
import { readerCopy, readerPublication } from "@/lib/reader-copy";

type Field = "titles" | "descriptions" | "limitations" | "publications" | "takeaways";
interface SourceIdentity { id?: string; url: string; title: string }
interface TopicIdentity { id: number; slug?: string; title: string }
const maps = Object.fromEntries(Object.entries(translations).map(([field, rows]) =>
  [field, new Map(rows.map((row) => [row.en, row.fr]))],
)) as Record<Field, Map<string, string>>;
const sources = new Map(guards.resources.map((r) => [r.id, r]));
const topics = new Map(guards.topics.map((t) => [t.id, t]));

function original(field: Field, value: string | null | undefined): string {
  return field === "titles" ? value ?? "" : field === "publications" ? readerPublication(value) : readerCopy(value);
}

/** Finite display translations; unknown/changed sources always retain their original copy. */
export function sourceCopy(lang: LanguageCode, source: SourceIdentity, field: Exclude<Field, "takeaways">, value: string | null | undefined): string {
  const en = original(field, value);
  const row = source.id ? sources.get(source.id) : undefined;
  if (lang !== "fr" || !row || row.url !== source.url || row.title !== source.title) return en;
  const expected = field === "titles" ? row.title : field === "descriptions" ? row.description : field === "limitations" ? row.limitation : row.publication;
  if (original(field, expected) !== en) return en;
  return maps[field].get(en) ?? en;
}

export function takeawayCopy(lang: LanguageCode, topic: TopicIdentity, value: string): string {
  const en = readerCopy(value);
  const row = topics.get(topic.id);
  if (lang !== "fr" || !row || row.title !== topic.title || (topic.slug !== undefined && row.slug !== topic.slug) || !row.takeaways.includes(en)) return en;
  return maps.takeaways.get(en) ?? en;
}