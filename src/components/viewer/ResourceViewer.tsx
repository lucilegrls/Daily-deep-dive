import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConceptToolbar } from "@/components/viewer/ConceptToolbar";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/lib/account";
import { useI18n } from "@/lib/i18n";
import { classifyWriteError, type WriteFailure } from "@/lib/write-outcome";
import { retryDelay, retryTransient, withTimeout } from "@/lib/retry";
import { getResourceBody, getTopicViewer, type ViewerResource } from "@/lib/viewer.functions";
import { mediaUrl, playerFor, resolveSource, SECTION_LABEL, SECTION_ORDER, type SectionKey } from "@/lib/viewer-media";
import { sourceCopy } from "@/lib/french-public-copy";
import { topicTitle } from "@/lib/topic-titles";
import { readerUI, readerGroup } from "@/lib/reader-ui";

const PdfViewer = lazy(() => import("@/components/viewer/PdfViewer"));

interface Props {
  topicId: number;
  resourceUrl: string;
  onClose: () => void;
  onOpenTopic?: ((id: number) => void) | undefined;
}

/** Individual source layer; the original Topic Sheet stays mounted underneath. */
export default function ResourceViewer({ topicId, resourceUrl, onClose, onOpenTopic }: Props) {
  const { session } = useAccount();
  const userId = session?.user.id ?? null;
  const opener = useRef<HTMLElement | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["viewer", topicId],
    queryFn: ({ signal }) => withTimeout(getTopicViewer({ data: { id: topicId }, signal })),
    retry: retryTransient, retryDelay, staleTime: 5 * 60_000,
  });
  const items = useMemo(() => (data?.resources ?? []).filter((r) => resolveSource(r).mode !== "link_only").sort((a, b) => Number(b.isStartHere) - Number(a.isStartHere) || SECTION_ORDER.indexOf(a.kind as SectionKey) - SECTION_ORDER.indexOf(b.kind as SectionKey)), [data]);
  const [selectedUrl, setSelectedUrl] = useState(resourceUrl);
  const index = items.findIndex((r) => r.url === selectedUrl);
  const active = items[index];
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const { t, lang } = useI18n();
  const [progressError, setProgressError] = useState<WriteFailure | false>(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setSelectedUrl(resourceUrl); }, [resourceUrl, topicId]);
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [selectedUrl]);
  useEffect(() => {
    if (!userId || !items.length) return;
    let live = true;
    void supabase.from("resource_progress").select("resource_id, completed_at").eq("user_id", userId).in("resource_id", items.map((r) => r.id)).then(({ data: rows, error }) => {
      if (!live) return;
      setProgressError(error ? classifyWriteError(error) : false);
      setCompleted(new Set((rows ?? []).filter((r) => r.completed_at).map((r) => r.resource_id)));
    });
    return () => { live = false; };
  }, [userId, items]);
  const complete = async () => {
    if (!userId || !active || saving) return;
    setSaving(true);
    const id = active.id;
    const done = completed.has(id);
    let error: unknown = null;
    try {
      ({ error } = await withTimeout(Promise.resolve(supabase.from("resource_progress").upsert({ user_id: userId, resource_id: id, completed_at: done ? null : new Date().toISOString() }, { onConflict: "user_id,resource_id" }))));
    } catch (e) { error = e; }
    setSaving(false);
    setProgressError(error ? classifyWriteError(error) : false);
    if (!error) setCompleted((prev) => { const next = new Set(prev); if (done) next.delete(id); else next.add(id); return next; });
  };
  const go = (delta: number) => { const next = items[index + delta]; if (next) setSelectedUrl(next.url); };
  return (
    <Dialog.Root open onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-foreground/30 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; e.preventDefault(); mainRef.current?.focus({ preventScroll: true }); }}
          onCloseAutoFocus={(e) => { e.preventDefault(); opener.current?.focus({ preventScroll: true }); }}
          onKeyDown={(e) => {
            const el = e.target as HTMLElement;
            if (el.closest("input, textarea, select, [contenteditable=true]")) return;
            if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); go(1); }
            if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
          }}
          className="letter-sheet fixed top-1/2 left-1/2 z-[80] flex max-h-[88dvh] w-[min(94vw,52rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border text-foreground shadow-xl focus:outline-none"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
            <div className="min-w-0"><span className="eyebrow text-muted-foreground">Curiosity, Sourced</span><Dialog.Title className="font-display text-base font-semibold">{data ? topicTitle(lang, data) : readerUI(lang, "Reading")}</Dialog.Title></div>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label={readerUI(lang, "Close source and return to topic")}><X /></Button></Dialog.Close>
          </header>
          <div ref={mainRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-7" tabIndex={0} aria-label={readerUI(lang, "Source content")}>
            {isLoading ? <div role="status" aria-label={readerUI(lang, "Loading source")} className="space-y-4"><div className="aspect-video animate-pulse rounded-lg bg-muted" /><div className="h-4 animate-pulse bg-muted" /></div> : isError ? <div role="alert"><p>{readerUI(lang, "This source could not be loaded.")}</p><Button variant="outline" onClick={() => void refetch()}>{readerUI(lang, "Try again")}</Button></div> : active ? <ResourcePane key={active.id} resource={active} signedIn={!!userId} /> : <p role="status">{readerUI(lang, "This source is no longer available.")}</p>}
          </div>
          {active ? <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-4 py-3">
            <Button variant="outline" size="icon" aria-label={readerUI(lang, "Previous source")} disabled={index <= 0} onClick={() => go(-1)}><ArrowLeft /></Button>
            <Button variant="outline" size="icon" aria-label={readerUI(lang, "Next source")} disabled={index >= items.length - 1} onClick={() => go(1)}><ArrowRight /></Button>
            {userId ? <Button variant="outline" disabled={saving} aria-pressed={completed.has(active.id)} onClick={() => void complete()}><Check />{completed.has(active.id) ? readerUI(lang, "Finished") : readerUI(lang, "Mark as finished")}</Button> : null}
            {progressError ? <p role="status" className="text-xs text-destructive">{progressError === "session" ? <>{t("err.session")} <a href="/auth" className="underline">{t("err.signIn")}</a></> : progressError === "network" ? t("err.network") : progressError === "limited" ? t("err.rateLimited") : t("err.progress")}</p> : null}
          </footer> : null}
          {data ? <ConceptToolbar topicId={topicId} onOpenTopic={(id) => { onClose(); onOpenTopic?.(id); }} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Attribution({ r }: { r: ViewerResource }) {
  const { lang } = useI18n();
  const meta = [r.creator, r.publisher, sourceCopy(lang, r, "publications", r.publication), r.duration].filter(Boolean).join(" · ");
  const description = sourceCopy(lang, r, "descriptions", r.description);
  return (
    <div className="mb-5">
      <p className="eyebrow text-muted-foreground">{lang === "fr" ? readerGroup(lang, r.kind) : SECTION_LABEL[r.kind as SectionKey] ?? r.kind}{r.isStartHere ? ` · ${readerUI(lang, "Start here")}` : ""}</p>
      <h3 className="mt-1 font-display text-2xl leading-snug font-semibold text-balance" title={r.title}>{sourceCopy(lang, r, "titles", r.title)}</h3>
      {meta ? <p className="mt-1 text-sm italic text-muted-foreground">{meta}</p> : null}
      {description ? <p data-concept-scope className="mt-3 leading-relaxed text-foreground/85">{description}</p> : null}
    </div>
  );
}

function OpenOriginal({ url }: { url: string }) {
  const { lang } = useI18n();
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-5 text-sm hover:text-primary">
      {readerUI(lang, "Open original source ↗")}
    </a>
  );
}

async function reportFailure(resourceId: string, reason: string) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  await supabase.from("resource_embed_failures").insert({ resource_id: resourceId, reason: reason.slice(0, 200) });
}

function ResourcePane({ resource: r, signedIn }: { resource: ViewerResource; signedIn: boolean }) {
  const { lang } = useI18n();
  const resolution = resolveSource(r);
  const mode = resolution.mode;
  const [failed, setFailed] = useState(false);
  const fail = useCallback((reason: string) => {
    setFailed(true);
    if (signedIn) void reportFailure(r.id, reason);
  }, [signedIn, r.id]);
  const bodyFail = useCallback(() => fail("internal body failed to load"), [fail]);
  const embedFail = useCallback(() => fail("external embed failed or was blocked"), [fail]);
  const pdfFail = useCallback(() => fail("pdf failed to load"), [fail]);

  if (failed || mode === "link_only") {
    return (
      <article>
        <Attribution r={r} />
        <p role="status" className="mb-3 text-sm italic text-muted-foreground">{failed ? readerUI(lang, "This could not be shown inside Curiosity, Sourced. You can still read it at the source.") : resolution.reason}</p>
        <OpenOriginal url={r.url} />
      </article>
    );
  }
  return (
    <article>
      <Attribution r={r} />
      {mode === "video" ? <><VideoFacade r={r} /><Button variant="outline" className="mt-3" onClick={embedFail}>{readerUI(lang, "Player unavailable? Show original link")}</Button></> : null}
      {mode === "internal_reader" ? <InternalReader id={r.id} onFail={bodyFail} /> : null}
      {mode === "embedded_external" ? <ExternalEmbed r={r} onFail={embedFail} /> : null}
      {mode === "remote_pdf" && resolution.url ? <RemotePdf resourceId={r.id} url={resolution.url} /> : null}
      {mode === "provider" && resolution.url ? <RemoteDisplay url={resolution.url} title={r.title} pdf={false} onFail={embedFail} /> : null}
      {mode === "pdf" && r.contentUrl ? (
        <Suspense fallback={<div role="status" className="h-96 animate-pulse rounded-xl bg-muted" />}>
          <PdfViewer resourceId={r.id} url={r.contentUrl} onFail={pdfFail} />
        </Suspense>
      ) : null}
      {mode === "audio" && r.contentUrl ? <audio controls preload="none" src={r.contentUrl} className="w-full" /> : null}
      <div className="mt-5"><OpenOriginal url={r.url} /></div>
    </article>
  );
}

/** Thumbnail first; the official player mounts only after Play. Unmounts with the pane. */
function VideoFacade({ r }: { r: ViewerResource }) {
  const { lang } = useI18n();
  const player = playerFor(r.url, r.embeddingStatus === "approved" ? r.embedUrl : null);
  const [playing, setPlaying] = useState(false);
  if (!player) return null;
  const thumb = mediaUrl(r.thumbnailUrl)?.href ?? player.thumbnail;
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-muted" data-video-slot>
      {playing ? (
        <iframe
          src={player.src}
          title={`${readerUI(lang, "Video")}: ${sourceCopy(lang, r, "titles", r.title)}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <Button variant="ghost" type="button" onClick={() => setPlaying(true)} aria-label={`${readerUI(lang, "Play video")}: ${sourceCopy(lang, r, "titles", r.title)}`} className="group absolute inset-0 flex size-full cursor-pointer items-center justify-center p-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring">
          {thumb ? <img src={thumb} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" /> : null}
          <span className="relative flex size-16 items-center justify-center rounded-full bg-background/90 text-2xl text-foreground shadow-lg transition-transform group-hover:scale-105">▶</span>
        </Button>
      )}
    </div>
  );
}

/** Browser-only publisher read; no copy, proxy, rights promotion or account progress write. */
function RemotePdf({ resourceId, url }: { resourceId: string; url: string }) {
  const { lang } = useI18n();
  const [opened, setOpened] = useState(false);
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);
  if (failed) return <p role="alert" className="text-sm text-muted-foreground">{readerUI(lang, "This PDF could not be read inside Curiosity, Sourced. It may be unavailable or the publisher may block in-app access. Open the original source below.")}</p>;
  return opened ? <Suspense fallback={<p role="status">{readerUI(lang, "Loading PDF reader…")}</p>}><PdfViewer resourceId={resourceId} url={url} onFail={fail} persistProgress={false} /></Suspense> : <Button variant="outline" onClick={() => setOpened(true)}>{readerUI(lang, "Read original PDF here")}</Button>;
}

/** Publisher-hosted content loaded only on request; never fetched or copied by our server. */
function RemoteDisplay({ url, title, pdf, onFail }: { url: string; title: string; pdf: boolean; onFail: () => void }) {
  const { lang } = useI18n();
  const [opened, setOpened] = useState(false);
  return <div className="space-y-3">
    <p className="text-sm italic text-muted-foreground">{pdf ? readerUI(lang, "The original hosted PDF opens here using your browser. Some mobile browsers or publishers cannot display it inside the app.") : readerUI(lang, "The provider controls this preview and its availability. It may offer only a sample.")}</p>
    {opened ? <>
      <Button variant="outline" onClick={onFail}>{readerUI(lang, "Blank or blocked? Show original link")}</Button>
      <iframe src={url} title={`${pdf ? "PDF" : readerUI(lang, "Preview")}: ${title}`} onError={onFail} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox" allow="encrypted-media; fullscreen" allowFullScreen className="h-[65dvh] w-full rounded-lg border border-border bg-card" />
    </> : <Button variant="outline" onClick={() => setOpened(true)}>{pdf ? readerUI(lang, "Read original PDF here") : readerUI(lang, "Open provider preview")}</Button>}
  </div>;
}

function InternalReader({ id, onFail }: { id: string; onFail: () => void }) {
  const { lang } = useI18n();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["resource-body", id],
    queryFn: ({ signal }) => withTimeout(getResourceBody({ data: { id }, signal })),
    retry: retryTransient,
    staleTime: 30 * 60_000,
  });
  const html = useMemo(
    () => (data ? DOMPurify.sanitize(data, { FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input"], FORBID_ATTR: ["style", "srcset"], ALLOW_DATA_ATTR: false }) : ""),
    [data],
  );
  useEffect(() => {
    if (isError || (!isLoading && !data)) onFail();
  }, [isError, isLoading, data, onFail]);
  if (isLoading) return <div role="status" aria-label={readerUI(lang, "Loading text")} className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-4 animate-pulse rounded bg-muted" />)}</div>;
  return <div data-concept-scope className="prose-reader leading-relaxed [&_a]:underline [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_img]:h-auto [&_img]:max-w-full [&_p]:mt-3" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Only for embeds an editor has checked. A load timeout falls back to the link. */
function ExternalEmbed({ r, onFail }: { r: ViewerResource; onFail: () => void }) {
  const { lang } = useI18n();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (loaded) return;
    const t = window.setTimeout(onFail, 15_000);
    return () => window.clearTimeout(t);
  }, [loaded, onFail]);
  return (
    <div className="relative h-[70dvh] overflow-hidden rounded-xl border border-border bg-card">
      {!loaded ? <div role="status" className="absolute inset-0 flex items-center justify-center text-sm italic text-muted-foreground">{readerUI(lang, "Loading the original page…")}</div> : null}
      <Button variant="outline" className="absolute bottom-3 left-3 z-10" onClick={onFail}>{readerUI(lang, "Page blank or blocked? Show source link")}</Button>
      <iframe
        src={r.embedUrl ?? r.url}
        title={`${readerUI(lang, "Original page")}: ${r.title}`}
        onLoad={() => setLoaded(true)}
        onError={onFail}
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        loading="lazy"
        className="relative size-full border-0"
      />
    </div>
  );
}
