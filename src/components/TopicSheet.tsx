import * as Dialog from "@radix-ui/react-dialog";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { logEvent } from "@/lib/diagnostics";
import { withTimeout } from "@/lib/retry";
import { classifyWriteError, createSingleFlight, type WriteFailure } from "@/lib/write-outcome";
import articleIcon from "@/assets/article_icon.png";
import bookIcon from "@/assets/book_icon.png";
import paperBottom from "@/assets/paper-bottom.png";
import paperMiddle from "@/assets/paper-middle.png";
import paperTop from "@/assets/paper-top.png";
import videoIcon from "@/assets/video_icon.png";
import {
  GROUP_META,
  type GroupKey,
  type Resource,
} from "@/data/topics";
import { supabase } from "@/integrations/supabase/client";
import { isSafeSourceUrl } from "@/lib/content-safety";
import { categoryName } from "@/lib/content-labels";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/translations";
import type { TopicDetail } from "@/lib/content.functions";
import { useAccount } from "@/lib/account";
import { sourceCopy, takeawayCopy } from "@/lib/french-public-copy";
import { resolveSource } from "@/lib/viewer-media";
import { topicTitle } from "@/lib/topic-titles";
import { topicContext } from "@/lib/topic-copy";
import { readerUI, readerGroup } from "@/lib/reader-ui";

const ResourceViewer = lazy(() => import("@/components/viewer/ResourceViewer"));
const ConceptToolbar = lazy(() => import("@/components/viewer/ConceptToolbar").then((m) => ({ default: m.ConceptToolbar })));

const GROUP_ICONS: Record<GroupKey, string> = {
  books: bookIcon,
  papers: articleIcon,
  videos: videoIcon,
  articles: articleIcon,
  pdfs: bookIcon,
  podcasts: videoIcon,
  tools: articleIcon,
};

interface TopicSheetProps {
  topic: TopicDetail | null;
  open: boolean;
  loading?: boolean;
  saved: boolean;
  onClose: () => void;
  onToggleSave: (id: number) => void;
  onOpenTopic: (id: number) => void;
  onRetry?: () => void;
}

function ResourceItem({ resource, onOpen }: { resource: Resource; onOpen: (url: string) => void }) {
  const { lang } = useI18n();
  const meta = [resource.author, resource.source, sourceCopy(lang, resource, "publications", resource.publication)].filter(Boolean).join(" • ");
  const description = sourceCopy(lang, resource, "descriptions", resource.description);
  const limitation = sourceCopy(lang, resource, "limitations", resource.verification?.limitation);
  const embedded = resolveSource(resource.media ?? { url: resource.url, embedType: "link_only", embeddingStatus: "needs_review", rightsStatus: "unknown" }).mode !== "link_only";
  return (
    <li className="border-b border-foreground/15 py-3 last:border-b-0">
      <a
        href={resource.url}
        title={resource.title}
        target="_blank"
        rel="noopener noreferrer"
        onClick={embedded ? (e) => {
          if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault(); onOpen(resource.url);
        } : undefined}
        onKeyDown={embedded ? (e) => { if (e.key === " " && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) { e.preventDefault(); onOpen(resource.url); } } : undefined}
        className="font-display text-[0.95rem] leading-snug font-medium text-foreground underline decoration-gold decoration-1 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
      >
        {sourceCopy(lang, resource, "titles", resource.title)}
      </a>
      {resource.isStartHere ? <p className="mt-1 text-xs font-medium text-primary">{readerUI(lang, "Start here")}</p> : null}
      {meta ? (
        <p className="mt-1 text-sm text-foreground/75 italic">{meta}</p>
      ) : null}
      {description ? (
        <p className="mt-1 text-sm leading-relaxed text-foreground/75">
          {description}
        </p>
      ) : null}
      {limitation ? (
        <p className="mt-0.5 text-xs text-foreground/70 italic">
          {limitation}
        </p>
      ) : null}
    </li>
  );
}

function BibliographyGroups({ topic, onOpen }: { topic: TopicDetail; onOpen: (url: string) => void }) {
  const { lang } = useI18n();
  const hasAny = GROUP_META.some((group) =>
    (topic.ressources[group.key] ?? []).some((item) => isSafeSourceUrl(item.url)),
  );
  return (
    <>
      {!hasAny ? (
        <p className="mt-4 text-sm italic text-foreground/75">
          {readerUI(lang, "Bibliography in preparation.")}
        </p>
      ) : null}
      {GROUP_META.map((group) => {
        const items = (topic.ressources[group.key] ?? []).filter((item) =>
          isSafeSourceUrl(item.url),
        );
        if (items.length === 0) return null;
        return (
          <section key={group.key}>
            <div className="mt-4 flex items-center gap-2.5">
              <img
                src={GROUP_ICONS[group.key]}
                alt=""
                className="size-5 object-contain"
              />
              <h4 className="font-display text-base font-semibold text-foreground">
                {readerGroup(lang, group.key)}
              </h4>
            </div>
            <ul>
              {items.map((resource) => (
                <ResourceItem key={resource.id ?? resource.url} resource={resource} onOpen={onOpen} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

/**
 * The note belongs to one (reader, topic) pair. The component is keyed by that
 * pair from the outside, and internally it refuses to save anything until the
 * right note has actually loaded — otherwise the previous topic's text could
 * be written onto the new one the moment the reader clicks away.
 */
export function PrivateNote({
  topicId,
  userId,
}: {
  topicId: number;
  userId: string;
}) {
  const { t } = useI18n();
  const [body, setBody] = useState("");
  const [state, setState] = useState<
    "loading" | "idle" | "saving" | "saved" | "error"
  >("loading");
  const loadedRef = useRef(false);
  const lastSavedRef = useRef<string | null>(null);
  const [failure, setFailure] = useState<WriteFailure | null>(null);

  useEffect(() => {
    let active = true;
    loadedRef.current = false;
    setBody("");
    setState("loading");

    void supabase
      .from("topic_notes")
      .select("body")
      .eq("user_id", userId)
      .eq("topic_id", topicId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setFailure(classifyWriteError(error));
          setState("error");
          return;
        }
        setBody(data?.body ?? "");
        lastSavedRef.current = data?.body ?? "";
        loadedRef.current = true;
        setState("idle");
      });

    return () => {
      active = false;
    };
  }, [userId, topicId]);

  const save = async () => {
    if (!loadedRef.current) return;
    const forTopic = topicId;
    const forUser = userId;
    const text = body;
    // Unchanged since the last successful save: nothing to write.
    if (lastSavedRef.current === text && state !== "error") return;
    // One write per note at a time (blur + click cannot double-submit); no auto-retry.
    const result = await noteFlight(`${forUser}:${forTopic}`, async () => {
      setState("saving");
      try {
        const { error } = await withTimeout(
          Promise.resolve(
            supabase
              .from("topic_notes")
              .upsert(
                { user_id: forUser, topic_id: forTopic, body: text },
                { onConflict: "user_id,topic_id" },
              ),
          ),
        );
        return error ? classifyWriteError(error) : ("ok" as const);
      } catch (e) {
        return classifyWriteError(e);
      }
    });
    if (result === null) return; // an identical write is already in flight
    // A slow reply must not relabel a note that has since moved on.
    if (forTopic !== topicId || forUser !== userId) return;
    if (result !== "ok") {
      logEvent("database", "note_save_failed", { kind: result }, "warn");
      setFailure(result);
      setState("error");
    } else {
      lastSavedRef.current = text;
      setFailure(null);
      setState("saved");
    }
  };

  const ready = state !== "loading";

  return (
    <div className="mt-4">
      <label className="eyebrow text-muted-foreground" htmlFor="private-note">
        {t("ts.note")}
      </label>
      <textarea
        id="private-note"
        value={body}
        disabled={!ready}
        onChange={(e) => {
          setBody(e.target.value);
          setState("idle");
        }}
        onBlur={() => void save()}
        rows={3}
        placeholder={t("ts.notePlaceholder")}
        className="mt-2 w-full rounded-lg border border-border bg-card/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none disabled:opacity-50"
      />
      <p role="status" aria-live="polite" className="mt-1 text-xs text-muted-foreground/70 italic">
        {state === "loading"
          ? t("ts.noteLoading")
          : state === "saving"
            ? t("ts.noteSaving")
            : state === "saved"
              ? t("ts.noteSaved")
              : state === "error"
                ? failure === "session"
                  ? t("err.session")
                  : failure === "network"
                    ? t("err.network")
                    : t("ts.noteError")
                : t("ts.noteHint")}
      </p>
      {state === "error" && failure === "session" ? (
        <a href="/auth" className="text-xs underline underline-offset-2">
          {t("err.signIn")}
        </a>
      ) : state === "error" && loadedRef.current ? (
        <button type="button" onClick={() => void save()} className="text-xs underline underline-offset-2">
          {t("feed.retry")}
        </button>
      ) : null}
    </div>
  );
}

const noteFlight = createSingleFlight();

/*
 * The side lace repeats every 105 source rows (of 941 wide) and the bottom
 * lace joins it cleanly only at row 85 of that cycle. Rounding the strip's
 * height to that rhythm means the side scallops always flow into the
 * bottom corners instead of ending mid-motif.
 */
const LACE_W = 941;
const LACE_PERIOD = 105;
const LACE_BOTTOM_PHASE = 85;

function useLaceRhythm(active: boolean) {
  const laceRef = useRef<HTMLDivElement | null>(null);
  const laceContentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let observer: ResizeObserver | null = null;
    const fit = () => {
      const strip = laceRef.current;
      const content = laceContentRef.current;
      if (!strip || !content) return;
      const period = (strip.clientWidth * LACE_PERIOD) / LACE_W;
      if (!period) return;
      const tail = (period * LACE_BOTTOM_PHASE) / LACE_PERIOD;
      const n = Math.max(0, Math.ceil((content.offsetHeight - tail) / period));
      strip.style.height = `${n * period + tail}px`;
    };
    // Radix mounts the content a tick after open; wait for the nodes.
    const attach = () => {
      if (!laceRef.current || !laceContentRef.current) {
        frame = requestAnimationFrame(attach);
        return;
      }
      observer = new ResizeObserver(fit);
      observer.observe(laceRef.current);
      observer.observe(laceContentRef.current);
      fit();
    };
    attach();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [active]);
  return { laceRef, laceContentRef };
}

export function TopicSheet({
  topic,
  open,
  loading = false,
  saved,
  onClose,
  onToggleSave,
  onOpenTopic,
  onRetry,
}: TopicSheetProps) {
  const [resourceUrl, setResourceUrl] = useState<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const feedScrollRef = useRef(0);
  useEffect(() => { setResourceUrl(null); }, [topic?.id, open]);
  const sheetFocus = {
    onOpenAutoFocus: () => { openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; feedScrollRef.current = window.scrollY; },
    onCloseAutoFocus: (e: Event) => { e.preventDefault(); openerRef.current?.focus({ preventScroll: true }); const y = feedScrollRef.current; requestAnimationFrame(() => window.scrollTo(0, y)); },
  };
  const [copied, setCopied] = useState(false);
  const { session, theme } = useAccount();
  const { t, lang } = useI18n();
  const noteUserId = session?.user.id ?? null;
  const romantic = theme === "romantic";
  const { laceRef, laceContentRef } = useLaceRhythm(romantic && open);

  const share = async () => {
    if (!topic) return;
    const url = `${window.location.origin}/topic/${topic.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        {romantic ? (
          <Dialog.Content {...sheetFocus} className="fixed top-1/2 left-1/2 z-50 max-h-[92vh] w-[min(94vw,44rem)] -translate-x-1/2 -translate-y-1/2 no-scrollbar overflow-y-auto overscroll-contain bg-transparent focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 motion-reduce:animate-none">
            {/* One sheet: the existing lace + clip image on top, the lace
                middle strip repeated down the full content height, and the
                lace bottom closing the page. No banner, no inner card. */}
            <img src={paperTop} alt="" className="stationery pointer-events-none block w-full select-none" />
            <div ref={laceRef} className="relative">
              <div
                aria-hidden="true"
                className="stationery pointer-events-none absolute inset-0"
                style={{ backgroundImage: `url(${paperMiddle})`, backgroundRepeat: "repeat-y", backgroundSize: "100% auto" }}
              />
              <div ref={laceContentRef} data-topic-sheet className={`relative px-[17%] pb-4 sm:px-[20%] ${romantic ? "text-justify" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="pt-2">
                    <Dialog.Title className="eyebrow text-blush-foreground">
                {topic ? categoryName(lang, topic.category) : t("ts.opening")}
              </Dialog.Title>
                    {copied ? (
              <p className="mt-2 text-xs text-blush-foreground italic">
                {t("ts.linkCopied")}
              </p>
            ) : null}
                  </div>
                <div className="flex items-center gap-2">
                {topic ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void share()}
                      aria-label={t("ts.copyLink")}
                      className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
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
                        <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 1 0-5-5l-1 1" />
                        <path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 1 0 5 5l1-1" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleSave(topic.id)}
                      aria-pressed={saved}
                      className={`flex size-9 items-center justify-center rounded-full border transition-colors ${
                        saved
                          ? "border-primary/30 bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
                      }`}
                      aria-label={saved ? t("ts.unsave") : t("ts.save")}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="size-4"
                        fill={saved ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      >
                        <path d="M6 3.75h12a.75.75 0 0 1 .75.75v15.4a.4.4 0 0 1-.63.33L12 15.54l-6.12 4.69a.4.4 0 0 1-.63-.33V4.5a.75.75 0 0 1 .75-.75Z" />
                      </svg>
                    </button>
                  </>
                ) : null}
                <Dialog.Close
                  aria-label={t("ts.close")}
                  className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  >
                    <path d="M5 5l14 14M19 5L5 19" />
                  </svg>
                </Dialog.Close>
              </div>
            
                </div>
                <div className="pt-5">
            {!topic ? (
              <div className="py-16 text-center" role="status">
                <p className="text-muted-foreground italic">
                  {loading ? t("ts.loading") : t("ts.failed")}
                </p>
                {!loading && onRetry ? (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-4 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground"
                  >
                    {t("feed.retry")}
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <Dialog.Description asChild>
                  <div>
                    <h2 className="font-display text-left text-3xl leading-tight font-semibold text-balance text-foreground">
                      {topicTitle(lang, topic)}
                    </h2>
                    <p data-concept-scope className="mt-4 text-lg leading-relaxed text-foreground/85">
                      {topicContext(lang, topic)}
                    </p>
                    {topic.lastEditorialReviewAt && topic.riskLevel !== "standard" ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Last reviewed: {new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric" }).format(new Date(topic.lastEditorialReviewAt))}
                      </p>
                    ) : null}
                  </div>
                </Dialog.Description>

                <div className="rule-diamond my-7" aria-hidden="true" />

                <h3 className="eyebrow text-muted-foreground">{t("ts.remember")}</h3>
                <ul className="mt-3 space-y-2.5">
                  {topic.takeaways.map((value) => takeawayCopy(lang, topic, value)).filter(Boolean).map((takeaway) => (
                    <li key={takeaway} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-[0.55em] size-1.5 shrink-0 rotate-45 bg-primary"
                      />
                      <span data-concept-scope className="leading-relaxed text-foreground/85">
                        {takeaway}
                      </span>
                    </li>
                  ))}
                </ul>

                {noteUserId ? (
                  <PrivateNote
                    key={`${noteUserId}:${topic.id}`}
                    topicId={topic.id}
                    userId={noteUserId}
                  />
                ) : null}

                <div className="rule-diamond my-7" aria-hidden="true" />

                <h3 className="eyebrow text-muted-foreground">
                  {t("ts.biblio")}
                </h3>
                {/*
                  The sources sit on a full-bleed themed surface: the lace
                  paper belongs to Romantic only; every other look gets its
                  own material via the .biblio-surface rules in styles.css.
                  Negative margins cancel the sheet's padding so the surface
                  runs edge to edge around all the sources.
                */}
                {romantic ? (
                  <div className="mt-4 space-y-6">
                    <BibliographyGroups topic={topic} onOpen={setResourceUrl} />
                  </div>
                ) : (
                  <div className="biblio-surface mt-6 -mx-6 px-6 py-7 sm:-mx-9 sm:px-9">
                    <div className="space-y-6">
                      <BibliographyGroups topic={topic} onOpen={setResourceUrl} />
                    </div>
                  </div>
                )}

                {topic.related.length > 0 ? (
                  <>
                    <div className="rule-diamond my-7" aria-hidden="true" />
                    <h3 className="eyebrow text-muted-foreground">{t("ts.keepReading")}</h3>
                    <ul className="mt-3 space-y-2">
                      {topic.related.map((rel) => (
                        <li key={rel.id}>
                          <button
                            type="button"
                            onClick={() => onOpenTopic(rel.id)}
                            className="text-left font-display text-[0.95rem] font-medium text-foreground underline decoration-gold/60 decoration-1 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                          >
                            {topicTitle(lang, rel)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

              </>
            )}
                </div>
              </div>
            </div>
            <img src={paperBottom} alt="" className="stationery pointer-events-none block w-full select-none" />
            {topic && !resourceUrl ? <Suspense fallback={null}><ConceptToolbar topicId={topic.id} onOpenTopic={onOpenTopic} /></Suspense> : null}
            {topic && resourceUrl ? <Suspense fallback={null}><ResourceViewer topicId={topic.id} resourceUrl={resourceUrl} onClose={() => setResourceUrl(null)} onOpenTopic={onOpenTopic} /></Suspense> : null}
        </Dialog.Content>
        ) : (
        <Dialog.Content {...sheetFocus} className="letter-sheet fixed top-1/2 left-1/2 z-50 flex max-h-[88vh] w-[min(92vw,42rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
          <div className="border-b border-border/70 bg-blush/40 px-6 py-4 sm:px-9">
            <div className="flex items-center justify-between gap-4">
              <Dialog.Title className="eyebrow text-blush-foreground">
                {topic ? categoryName(lang, topic.category) : t("ts.opening")}
              </Dialog.Title>
              <div className="flex items-center gap-2">
                {topic ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void share()}
                      aria-label={t("ts.copyLink")}
                      className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
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
                        <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 1 0-5-5l-1 1" />
                        <path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 1 0 5 5l1-1" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleSave(topic.id)}
                      aria-pressed={saved}
                      className={`flex size-9 items-center justify-center rounded-full border transition-colors ${
                        saved
                          ? "border-primary/30 bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
                      }`}
                      aria-label={saved ? t("ts.unsave") : t("ts.save")}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="size-4"
                        fill={saved ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      >
                        <path d="M6 3.75h12a.75.75 0 0 1 .75.75v15.4a.4.4 0 0 1-.63.33L12 15.54l-6.12 4.69a.4.4 0 0 1-.63-.33V4.5a.75.75 0 0 1 .75-.75Z" />
                      </svg>
                    </button>
                  </>
                ) : null}
                <Dialog.Close
                  aria-label={t("ts.close")}
                  className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  >
                    <path d="M5 5l14 14M19 5L5 19" />
                  </svg>
                </Dialog.Close>
              </div>
            </div>
            {copied ? (
              <p className="mt-2 text-xs text-blush-foreground italic">
                {t("ts.linkCopied")}
              </p>
            ) : null}
          </div>

          <div data-topic-sheet className="flex-1 overflow-y-auto px-6 py-7 sm:px-9">
            {!topic ? (
              <div className="py-16 text-center" role="status">
                <p className="text-muted-foreground italic">
                  {loading ? t("ts.loading") : t("ts.failed")}
                </p>
                {!loading && onRetry ? (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-4 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground"
                  >
                    {t("feed.retry")}
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <Dialog.Description asChild>
                  <div>
                    <h2 className="font-display text-3xl leading-tight font-semibold text-balance text-foreground">
                      {topicTitle(lang, topic)}
                    </h2>
                    <p data-concept-scope className="mt-4 text-lg leading-relaxed text-foreground/85">
                      {topicContext(lang, topic)}
                    </p>
                    {topic.lastEditorialReviewAt && topic.riskLevel !== "standard" ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Last reviewed: {new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric" }).format(new Date(topic.lastEditorialReviewAt))}
                      </p>
                    ) : null}
                  </div>
                </Dialog.Description>

                <div className="rule-diamond my-7" aria-hidden="true" />

                <h3 className="eyebrow text-muted-foreground">{t("ts.remember")}</h3>
                <ul className="mt-3 space-y-2.5">
                  {topic.takeaways.map((value) => takeawayCopy(lang, topic, value)).filter(Boolean).map((takeaway) => (
                    <li key={takeaway} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-[0.55em] size-1.5 shrink-0 rotate-45 bg-primary"
                      />
                      <span data-concept-scope className="leading-relaxed text-foreground/85">
                        {takeaway}
                      </span>
                    </li>
                  ))}
                </ul>

                {noteUserId ? (
                  <PrivateNote
                    key={`${noteUserId}:${topic.id}`}
                    topicId={topic.id}
                    userId={noteUserId}
                  />
                ) : null}

                <div className="rule-diamond my-7" aria-hidden="true" />

                <h3 className="eyebrow text-muted-foreground">
                  {t("ts.biblio")}
                </h3>
                {/*
                  The sources sit on a full-bleed themed surface: the lace
                  paper belongs to Romantic only; every other look gets its
                  own material via the .biblio-surface rules in styles.css.
                  Negative margins cancel the sheet's padding so the surface
                  runs edge to edge around all the sources.
                */}
                  <div className="biblio-surface mt-6 -mx-6 px-6 py-7 sm:-mx-9 sm:px-9">
                    <div className="space-y-6">
                      <BibliographyGroups topic={topic} onOpen={setResourceUrl} />
                    </div>
                  </div>

                {topic.related.length > 0 ? (
                  <>
                    <div className="rule-diamond my-7" aria-hidden="true" />
                    <h3 className="eyebrow text-muted-foreground">{t("ts.keepReading")}</h3>
                    <ul className="mt-3 space-y-2">
                      {topic.related.map((rel) => (
                        <li key={rel.id}>
                          <button
                            type="button"
                            onClick={() => onOpenTopic(rel.id)}
                            className="text-left font-display text-[0.95rem] font-medium text-foreground underline decoration-gold/60 decoration-1 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                          >
                            {topicTitle(lang, rel)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

              </>
            )}
          </div>
          {topic && !resourceUrl && !romantic ? <Suspense fallback={null}><ConceptToolbar topicId={topic.id} onOpenTopic={onOpenTopic} /></Suspense> : null}
          {topic && resourceUrl && !romantic ? <Suspense fallback={null}><ResourceViewer topicId={topic.id} resourceUrl={resourceUrl} onClose={() => setResourceUrl(null)} onOpenTopic={onOpenTopic} /></Suspense> : null}
        </Dialog.Content>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
