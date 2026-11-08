import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { writeFailureKey } from "@/lib/write-outcome";
import { retryDelay, retryTransient, withTimeout } from "@/lib/retry";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { TopicRow } from "@/components/TopicRow";
import { TopicSheet } from "@/components/TopicSheet";
import { useSavedTopics } from "@/hooks/use-saved-topics";
import { useAccount } from "@/lib/account";
import {
  getTopicsByIds,
  listCategories,
  listTopics,
  type TopicSummary,
} from "@/lib/content.functions";
import { categoryName, gatewayNoun, laneName } from "@/lib/content-labels";
import { useI18n } from "@/lib/i18n";
import { useOpenTopic } from "@/lib/use-open-topic";

const PAGE_SIZE = 12;

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { view?: "saved" } =>
    search["view"] === "saved" ? { view: "saved" } : {},
  head: () => ({
    meta: [
      { title: "Curiosity, Sourced — Understand how things actually work" },
      {
        name: "description",
        content:
          "Scroll a curated library of deep-dive topics. Open an envelope for the mechanism, what is well supported, what is still contested, and the books, papers, videos and articles to go further.",
      },
      {
        property: "og:title",
        content: "Curiosity, Sourced — Understand how things actually work",
      },
      {
        property: "og:description",
        content:
          "A scrollable library of deep dives, each with its sources listed and dated. Free to browse, no account needed. Never Wikipedia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // First page for the default guest view, rendered on the server so the
  // page shows real topics even before (or without) hydration. Bounded: a slow
  // or failing backend returns null after 8 s and the client query takes over.
  loader: async (): Promise<{
    initial: Awaited<ReturnType<typeof listTopics>> | null;
    initialCategories: string[] | null;
    seed: number;
  }> => {
    const seed = Math.floor(Date.now() / 86_400_000);
    const initialCategories = await withTimeout(listCategories(), 8_000).catch((error) => {
      console.error("initial categories load failed", error);
      return null;
    });
    try {
      const initial = await withTimeout(
        listTopics({
          data: { query: "", category: null, interests: [], readIds: [], feedMix: "balanced", seed, limit: PAGE_SIZE, offset: 0 },
        }),
        8_000,
      );
      return { initial, initialCategories, seed };
    } catch (error) {
      console.error("initial feed load failed", error);
      return { initial: null, initialCategories, seed };
    }
  },
  component: Index,
});

function Index() {
  const { view } = Route.useSearch();
  const { t, lang } = useI18n();
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>(
    view === "saved" ? "saved" : "all",
  );
  const {
    saved,
    toggle,
    isSaved,
    status: savedStatus,
    retry: retrySaved,
    writeError: saveWriteError,
    clearWriteError,
    pendingGuestCount,
    importGuestSaves,
  } = useSavedTopics();
  const { session, interests, readTopicIds, feedMix, theme } = useAccount();
  const { openId, openTopic, closeTopic, topic, loading, retry } = useOpenTopic();
  const showingSaved = activeFilter === "saved";
  // Seeded by the UTC day on the server: identical for SSR and hydration.
  const { initial, initialCategories, seed } = Route.useLoaderData();

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(rawQuery), 250);
    return () => window.clearTimeout(id);
  }, [rawQuery]);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories(),
    initialData: initialCategories ?? undefined,
    staleTime: 10 * 60_000,
  });

  // Personalisation is part of the query key: the server decides the order for
  // the whole bank, and pages are appended in that order without reshuffling.
  const interestKey = interests.join(",");
  const readKey = readTopicIds.join(",");

  const queryClient = useQueryClient();
  const feed = useInfiniteQuery({
    queryKey: ["topics", query, activeFilter, interestKey, readKey, feedMix, seed],
    enabled: !showingSaved,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      withTimeout(listTopics({
        data: {
          query,
          category: activeFilter,
          interests,
          readIds: readTopicIds,
          feedMix,
          seed,
          limit: PAGE_SIZE,
          offset: pageParam,
        },
      })),

    retry: retryTransient,
    retryDelay,
    // Server-rendered first page stands in until the personalised page arrives.
    placeholderData: (previous) =>
      previous ??
      (initial && !query && activeFilter === "all"
        ? { pages: [initial], pageParams: [0] }
        : undefined),
    getNextPageParam: (lastPage) => {
      const next = lastPage.offset + lastPage.limit;
      return next < lastPage.total ? next : undefined;
    },
  });

  const savedQuery = useQuery({
    queryKey: ["saved-topics", saved.join(","), query, activeFilter],
    enabled: showingSaved,
    queryFn: () =>
      withTimeout(getTopicsByIds({ data: { ids: saved, query, category: activeFilter } })),
    retry: retryTransient,
    retryDelay,
  });

  const items: TopicSummary[] = useMemo(() => {
    if (showingSaved) return savedQuery.data ?? [];
    return (feed.data?.pages ?? []).flatMap((page) => page.items);
  }, [showingSaved, savedQuery.data, feed.data]);

  const total = showingSaved ? items.length : (feed.data?.pages?.[0]?.total ?? 0);
  const isLoading = showingSaved
    ? savedStatus === "loading" || savedQuery.isLoading
    : feed.isLoading;
  const error = showingSaved
    ? (savedQuery.error ?? (savedStatus === "error" ? new Error("saved") : null))
    : feed.error;
  const retryActive = () => {
    if (showingSaved) {
      retrySaved();
      void savedQuery.refetch();
    } else if (!feed.data) {
      // Nothing loaded yet: restart from a clean loading state.
      void queryClient.resetQueries({ queryKey: ["topics"], exact: false });
    } else {
      void feed.refetch();
    }
  };

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((entry) => entry.isIntersecting) &&
          feed.hasNextPage &&
          !feed.isPlaceholderData &&
          !feed.isFetchingNextPage &&
          !feed.isFetchNextPageError
        ) {
          void feed.fetchNextPage();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [feed]);

  const surprise = () => {
    if (items.length === 0) return;
    const pick = items[Math.floor(Math.random() * items.length)];
    if (pick) openTopic(pick.id);
  };

  return (
    <div className="paper-grain min-h-screen bg-background">
      <AppHeader />
      <header
        className={`mx-auto max-w-3xl px-6 ${
          session ? "pt-10 pb-6" : "pt-16 pb-10 sm:pt-20"
        }`}
      >
        <div className="hero-plaque text-center">
        <img
          src="/maximalist-clip.png"
          alt=""
          aria-hidden="true"
          className="plaque-deco plaque-deco-clip"
        />
        <img
          src="/maximalist-stamp.png"
          alt=""
          aria-hidden="true"
          className="plaque-deco plaque-deco-stamp"
        />
        <img
          src="/maximalist-star.png"
          alt=""
          aria-hidden="true"
          className="plaque-deco plaque-deco-star"
        />
        <p className="eyebrow text-muted-foreground">
          {t("home.eyebrow")}
        </p>
        <h1
          className={`mt-4 font-display font-semibold tracking-tight text-balance text-foreground ${
            session ? "text-4xl" : "text-5xl sm:text-6xl"
          }`}
        >
          {session ? "Curiosity, Sourced" : t("home.titleGuest")}
        </h1>
        <div
          className="rule-diamond ornamental mx-auto mt-8 max-w-xs"
          aria-hidden="true"
        />
        {session ? (
          <>
            <p className="mx-auto mt-6 max-w-xl leading-relaxed text-muted-foreground">
              {t("home.introMember", { object: gatewayNoun(lang, theme, "one") })}
            </p>
            {interests.length > 0 ? (
              <p className="mt-5 text-sm text-muted-foreground italic">
                {t("home.leaning", {
                  subjects: interests
                    .slice(0, 3)
                    .map((v) => laneName(lang, v, v))
                    .join(", "),
                })}
                {interests.length > 3 ? t("home.andMore") : ""} —{" "}
                <Link to="/welcome" className="underline underline-offset-4">
                  {t("home.tuneLink")}
                </Link>
              </p>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground italic">
                <Link to="/welcome" className="underline underline-offset-4">
                  {t("home.pickSubjects")}
                </Link>
                {t("home.pickSubjectsAfter")}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
              {t("home.introGuest", { objects: gatewayNoun(lang, theme, "bare") })}
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/start"
                className="flex min-h-12 w-full max-w-xs items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto"
              >
                {t("home.build")}
              </Link>
              <a
                href="#library"
                className="flex min-h-12 w-full max-w-xs items-center justify-center rounded-full border border-gold/60 bg-accent px-6 text-sm font-medium text-accent-foreground transition-colors hover:border-gold sm:w-auto"
              >
                {t("home.browse")}
              </a>
            </div>
            <p className="mt-5 text-sm text-muted-foreground italic">
              {t("home.noAccountBefore")}
              <Link to="/auth" className="underline underline-offset-4">
                {t("nav.signIn")}
              </Link>
              {t("home.noAccountAfter")}
            </p>
          </>
        )}
        </div>
      </header>


      <div
        id="library"
        className="sticky top-0 z-30 scroll-mt-0 border-y border-border/70 bg-background/85 backdrop-blur-md"
      >

        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <label className="relative flex-1">
              <span className="sr-only">{t("feed.searchLabel")}</span>
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
                placeholder={t("feed.searchPlaceholder")}
                className="w-full rounded-full border border-input bg-card py-2.5 pr-4 pl-10 text-[0.95rem] text-foreground placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={surprise}
              className="flex shrink-0 items-center gap-2 rounded-full border border-gold/60 bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:border-gold hover:bg-gold/25"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
                <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" />
                <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" />
                <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" />
                <circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" />
              </svg>
              {t("feed.surprise")}
            </button>
          </div>

          <nav
            aria-label={t("feed.filterLabel")}
            className="scroll-fade-x flex gap-2 overflow-x-auto pb-1 pr-10"
          >
            <FilterChip
              label={t("feed.all")}
              active={activeFilter === "all"}
              onClick={() => setActiveFilter("all")}
            />
            <FilterChip
              label={t("feed.saved", { count: saved.length })}
              active={activeFilter === "saved"}
              onClick={() => setActiveFilter("saved")}
            />
            {categories.map((category) => (
              <FilterChip
                key={category}
                label={categoryName(lang, category)}
                active={activeFilter === category}
                onClick={() => setActiveFilter(category)}
              />
            ))}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {showingSaved && pendingGuestCount > 0 ? (
          <div className="mb-8 rounded-xl border border-gold/50 bg-accent/40 px-4 py-3 text-sm text-foreground">
            {pendingGuestCount === 1
              ? t("feed.guestSavesOne", { count: pendingGuestCount })
              : t("feed.guestSaves", { count: pendingGuestCount })}
            <button
              type="button"
              onClick={() => void importGuestSaves()}
              className="ml-2 rounded-full border border-gold/60 bg-card px-3 py-1 text-xs font-medium"
            >
              {t("feed.guestImport")}
            </button>
          </div>
        ) : null}

        {error && items.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg text-muted-foreground italic">
              {showingSaved ? t("feed.errorSaved") : t("feed.errorFeed")}
            </p>
            <button
              type="button"
              onClick={retryActive}
              className="mt-4 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground"
            >
              {t("feed.retry")}
            </button>
          </div>
        ) : isLoading ? (
          <p className="py-20 text-center text-lg text-muted-foreground italic">
            {t("feed.loading")}
          </p>
        ) : items.length === 0 ? (
          <p className="py-20 text-center text-lg text-muted-foreground italic">
            {activeFilter === "saved"
              ? t("feed.emptySaved")
              : t("feed.emptySearch")}
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {items.map((item, index) => (
              <div key={item.id} className="py-8 first:pt-0 sm:py-10">
                <TopicRow
                  topic={item}
                  index={index}
                  saved={isSaved(item.id)}
                  onOpen={(t) => openTopic(t.id)}
                  onToggleSave={toggle}
                />
              </div>
            ))}
          </div>
        )}

        <div ref={sentinelRef} aria-hidden="true" className="h-px" />

        {!showingSaved && feed.isFetchNextPageError ? (
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground italic">{t("feed.errorFeed")}</p>
            <button
              type="button"
              onClick={() => void feed.fetchNextPage()}
              className="mt-3 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground"
            >
              {t("feed.retry")}
            </button>
          </div>
        ) : feed.isFetchingNextPage ? (
          <p className="mt-12 text-center text-sm text-muted-foreground italic">
            {t("feed.loadingMore")}
          </p>
        ) : items.length > 0 && !feed.hasNextPage ? (
          <p className="mt-12 text-center text-sm text-muted-foreground italic">
            {t("feed.end")}
          </p>
        ) : null}
      </main>

      <footer className="border-t border-border/70 py-8">
        {!isLoading && !error ? (
          <p className="px-6 text-center text-sm text-muted-foreground">
            {t("feed.footerCount", {
              topics: total,
              subjects: categories.length,
            })}
          </p>
        ) : null}
      </footer>

      {saveWriteError ? (
        <div role="alert" className="fixed bottom-4 left-1/2 z-[90] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground shadow-lg">
          <span>{t("err.saveTopic")} {t(writeFailureKey(saveWriteError))}</span>
          {saveWriteError === "session" ? <a href="/auth" className="underline underline-offset-2">{t("err.signIn")}</a> : null}
          <button type="button" onClick={clearWriteError} className="underline underline-offset-2">{t("err.dismiss")}</button>
        </div>
      ) : null}
      <TopicSheet
        topic={topic}
        open={openId !== null}
        loading={loading}
        saved={topic ? isSaved(topic.id) : false}
        onClose={closeTopic}
        onToggleSave={toggle}
        onOpenTopic={openTopic}
        onRetry={retry}
      />
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
