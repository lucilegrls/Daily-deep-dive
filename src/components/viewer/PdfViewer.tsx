import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { readerUI } from "@/lib/reader-ui";
import { pdfPage, pdfScale, PDF_LOAD_TIMEOUT_MS } from "@/lib/pdf-display";

import { supabase } from "@/integrations/supabase/client";

interface Props {
  resourceId: string;
  url: string;
  onFail: () => void;
  persistProgress?: boolean;
}

interface Position {
  page?: number;
  zoom?: number;
  bookmarks?: number[];
}

const localKey = (id: string) => `deep-dive:pdf:${id}`;

/** Browser PDF reader; remote publisher reads are ephemeral, stored files retain rights-gated progress. */
export default function PdfViewer({ resourceId, url, onFail, persistProgress = true }: Props) {
  const { lang } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const [rendered, setRendered] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<number[] | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const restored = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      void task?.destroy();
      onFail();
    }, PDF_LOAD_TIMEOUT_MS);
    void (async () => {
      try {
        // The modern build needs Map.getOrInsertComputed, absent in many current browsers.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const loading = pdfjs.getDocument({ url });
        task = loading;
        const d = await loading.promise;
        if (!cancelled) setDoc(d);
        window.clearTimeout(timeout);
      } catch {
        window.clearTimeout(timeout);
        if (!cancelled) onFail();
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      void task?.destroy();
    };
  }, [url, onFail]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(1, container.clientWidth - 16)));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Restore position: account first, then this device.
  useEffect(() => {
    if (!persistProgress) return;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      let pos: Position = {};
      if (uid) {
        const { data: row } = await supabase.from("resource_progress").select("position").eq("user_id", uid).eq("resource_id", resourceId).maybeSingle();
        pos = (row?.position ?? {}) as Position;
      } else {
        try { pos = JSON.parse(localStorage.getItem(localKey(resourceId)) ?? "{}") as Position; } catch { pos = {}; }
      }
      if (pos.page) setPage(pos.page);
      if (pos.zoom) setZoom(pos.zoom);
      if (Array.isArray(pos.bookmarks)) setBookmarks(pos.bookmarks);
      restored.current = true;
    })();
  }, [resourceId, persistProgress]);

  // Persist position (debounced).
  useEffect(() => {
    if (!persistProgress || !restored.current) return;
    const pos: Position = { page, zoom, bookmarks };
    const t = window.setTimeout(() => {
      if (userId) void supabase.from("resource_progress").upsert({ user_id: userId, resource_id: resourceId, position: pos as never }, { onConflict: "user_id,resource_id" });
      else try { localStorage.setItem(localKey(resourceId), JSON.stringify(pos)); } catch { /* storage blocked */ }
    }, 600);
    return () => window.clearTimeout(t);
  }, [page, zoom, bookmarks, userId, resourceId, persistProgress]);

  useEffect(() => {
    if (!doc || !canvasRef.current) return;
    let cancelled = false;
    let render: { cancel: () => void } | null = null;
    setRendered(false);
    const timeout = window.setTimeout(() => {
      if (!cancelled) { cancelled = true; render?.cancel(); onFail(); }
    }, PDF_LOAD_TIMEOUT_MS);
    void (async () => {
      try {
      const p = await doc.getPage(pdfPage(page, doc.numPages));
      if (cancelled || !canvasRef.current) return;
      const scale = pdfScale(p.getViewport({ scale: 1 }).width, width, zoom);
      const viewport = p.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / (window.devicePixelRatio || 1)}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("PDF canvas unavailable");
      const task = p.render({ canvasContext: ctx, viewport, canvas });
      render = task;
      await task.promise;
      if (!cancelled) setRendered(true);
      } catch { if (!cancelled) onFail(); }
      finally { window.clearTimeout(timeout); }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      render?.cancel();
    };
  }, [doc, page, zoom, width, onFail]);

  const search = async () => {
    if (!doc || query.trim().length < 2) return;
    const needle = query.trim().toLowerCase();
    const found: number[] = [];
    for (let i = 1; i <= doc.numPages && found.length < 50; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      const text = content.items.map((it) => ("str" in it ? it.str : "")).join(" ").toLowerCase();
      if (text.includes(needle)) found.push(i);
    }
    setHits(found);
    if (found[0]) setPage(found[0]);
  };

  const total = doc?.numPages ?? 0;
  const marked = bookmarks.includes(page);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div role="toolbar" aria-label={readerUI(lang, "PDF controls")} className="flex flex-wrap items-center gap-2 border-b border-border p-2 text-sm">
        <Button variant="outline" type="button" aria-label={readerUI(lang, "Previous page")} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="min-h-11 min-w-11 rounded-full border border-border disabled:opacity-40">‹</Button>
        <label className="flex items-center gap-1">
          <span className="sr-only">{readerUI(lang, "Page")}</span>
          <input type="number" min={1} max={total || 1} value={page} onChange={(e) => setPage(pdfPage(Number(e.target.value), total))} className="w-16 rounded border border-border bg-background px-2 py-1" />
          <span className="text-muted-foreground">/ {total || "…"}</span>
        </label>
        <Button variant="outline" type="button" aria-label={readerUI(lang, "Next page")} onClick={() => setPage((p) => Math.min(total || p, p + 1))} disabled={!total || page >= total} className="min-h-11 min-w-11 rounded-full border border-border disabled:opacity-40">›</Button>
        <Button variant="outline" type="button" aria-label={readerUI(lang, "Zoom out")} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(1)))} className="min-h-11 min-w-11 rounded-full border border-border">−</Button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <Button variant="outline" type="button" aria-label={readerUI(lang, "Zoom in")} onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(1)))} className="min-h-11 min-w-11 rounded-full border border-border">+</Button>
        <Button variant="outline" type="button" aria-pressed={marked} onClick={() => setBookmarks((b) => (marked ? b.filter((n) => n !== page) : [...b, page].sort((x, y) => x - y)))} className="min-h-11 rounded-full border border-border px-3">{marked ? readerUI(lang, "★ Bookmarked") : readerUI(lang, "☆ Bookmark")}</Button>
        <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); void search(); }}>
          <label className="sr-only" htmlFor={`pdf-search-${resourceId}`}>{readerUI(lang, "Search in this PDF")}</label>
          <input id={`pdf-search-${resourceId}`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={readerUI(lang, "Search")} className="w-28 rounded border border-border bg-background px-2 py-1" />
          <Button variant="outline" type="submit" className="min-h-11 rounded-full border border-border px-3">{readerUI(lang, "Find")}</Button>
        </form>
      </div>
      {bookmarks.length || hits ? (
        <div className="flex flex-wrap gap-2 border-b border-border p-2 text-xs">
          {bookmarks.map((b) => <Button variant="outline" key={`b${b}`} type="button" onClick={() => setPage(b)} className="rounded-full border border-border px-2 py-1">★ p.{b}</Button>)}
          {hits ? (hits.length ? hits.map((h) => <Button variant="outline" key={`h${h}`} type="button" onClick={() => setPage(h)} className="rounded-full bg-primary/10 px-2 py-1">p.{h}</Button>) : <span className="italic text-muted-foreground">{readerUI(lang, "No text match (scanned PDFs may have no searchable text).")}</span>) : null}
        </div>
      ) : null}
      <div ref={containerRef} className="no-scrollbar max-h-[75dvh] overflow-auto p-2">
        {!rendered ? <p role="status" className="p-4 text-sm text-muted-foreground">{doc ? readerUI(lang, "Rendering PDF page…") : readerUI(lang, "Loading PDF…")}</p> : null}
        <canvas ref={canvasRef} aria-label={`${readerUI(lang, "PDF page")} ${page} ${readerUI(lang, "of")} ${total}`} data-rendered={rendered} data-page-count={total} className="mx-auto block" />
      </div>
    </div>
  );
}
