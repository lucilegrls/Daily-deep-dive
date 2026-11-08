import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { AppHeader } from "@/components/AppHeader";
import { TopicSheet } from "@/components/TopicSheet";
import { categoryName } from "@/lib/content-labels";
import { useI18n } from "@/lib/i18n";
import { useSavedTopics } from "@/hooks/use-saved-topics";
import { getTopic } from "@/lib/content.functions";
import { useOpenTopic } from "@/lib/use-open-topic";
import { readerCopy } from "@/lib/reader-copy";
import { useEffect } from "react";
import { topicTitle } from "@/lib/topic-titles";
import { topicContext } from "@/lib/topic-copy";
import { readerUI } from "@/lib/reader-ui";

export const Route = createFileRoute("/topic/$slug")({
  loader: async ({ params }) => {
    const topic = await getTopic({ data: { slug: params.slug } });
    if (!topic) throw notFound();
    return topic;
  },
  head: ({ loaderData }) => {
    const title = loaderData
      ? `${loaderData.title} — Curiosity, Sourced`
      : "Curiosity, Sourced — Topic";
    const description = loaderData
      ? readerCopy(loaderData.context).slice(0, 200)
      : "Explore ideas, mechanisms and their books, papers, videos and articles.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: TopicPage,
});

function TopicPage() {
  const topic = Route.useLoaderData();
  const { lang } = useI18n();
  const title = topicTitle(lang, topic);
  useEffect(() => {
    const documentTitle = `${title} — Curiosity, Sourced`;
    document.title = documentTitle;
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", documentTitle);
  }, [title]);
  const { toggle, isSaved } = useSavedTopics();
  const { openId, openTopic, closeTopic, topic: nested, loading, retry } = useOpenTopic();

  return (
    <div className="paper-grain min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <p className="eyebrow text-muted-foreground">{categoryName(lang, topic.category)}</p>
        <h1 className="mt-3 font-display text-4xl leading-tight font-semibold text-balance text-foreground">
          {title}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          {topicContext(lang, topic)}
        </p>
        <div className="rule-diamond my-8" aria-hidden="true" />
        <button
          type="button"
          onClick={() => openTopic(topic.id)}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {readerUI(lang, "Open the library")}
        </button>
        <p className="mt-6 text-sm text-muted-foreground">
          <Link to="/" className="underline underline-offset-4">
            {readerUI(lang, "Back to the feed")}
          </Link>
        </p>
      </main>

      <TopicSheet
        topic={nested}
        open={openId !== null}
        loading={loading}
        saved={nested ? isSaved(nested.id) : false}
        onClose={closeTopic}
        onToggleSave={toggle}
        onOpenTopic={openTopic}
        onRetry={retry}
      />
    </div>
  );
}
