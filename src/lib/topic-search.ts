import type { TopicSummary } from "@/lib/content.functions";

/**
 * Search tokens are whole Unicode words. This deliberately prevents a query
 * such as `iron` from matching `environment`, while still supporting words
 * outside the Latin alphabet.
 */
export function searchTokens(query: string): string[] {
  return [
    ...new Set(
      query
        .normalize("NFKC")
        .toLocaleLowerCase()
        .match(/[\p{L}\p{N}]+/gu) ?? [],
    ),
  ].slice(0, 12);
}

function words(value: string): Set<string> {
  return new Set(searchTokens(value));
}

export function topicSearchScore(
  topic: Pick<TopicSummary, "title" | "category" | "context" | "tags">,
  query: string,
): number | null {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return 0;

  const title = words(topic.title);
  const tags = words(topic.tags.join(" "));
  const category = words(topic.category);
  const context = words(topic.context);
  if (
    tokens.some(
      (token) =>
        !title.has(token) &&
        !tags.has(token) &&
        !category.has(token) &&
        !context.has(token),
    )
  ) {
    return null;
  }

  return tokens.reduce(
    (score, token) =>
      score +
      (title.has(token) ? 100 : 0) +
      (tags.has(token) ? 60 : 0) +
      (category.has(token) ? 30 : 0) +
      (context.has(token) ? 10 : 0),
    0,
  );
}

export function rankTopicMatches<T extends TopicSummary>(
  topics: T[],
  query: string,
): T[] {
  if (searchTokens(query).length === 0) return topics;
  return topics
    .map((topic, index) => ({ topic, index, score: topicSearchScore(topic, query) }))
    .filter(
      (item): item is { topic: T; index: number; score: number } =>
        item.score !== null,
    )
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ topic }) => topic);
}
