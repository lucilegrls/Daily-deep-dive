import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { lookupConcept } from "@/lib/viewer.functions";
import { webSearchProvider } from "@/lib/web-search";
import { useI18n } from "@/lib/i18n";
import { topicTitle } from "@/lib/topic-titles";
import { readerUI } from "@/lib/reader-ui";

type Action = "define" | "simple" | "why" | "topics" | "sources" | "web";

/**
 * Selection tools on Deep Dive-controlled text only (elements marked
 * data-concept-scope). Cross-origin pages and video players are never read.
 */
export function ConceptToolbar({ topicId, onOpenTopic }: { topicId: number; onOpenTopic?: ((id: number) => void) | undefined }) {
  const { lang } = useI18n();
  const scopeRef = useRef<HTMLSpanElement>(null);
  const [sel, setSel] = useState<{ term: string; x: number; y: number } | null>(null);
  const [action, setAction] = useState<{ term: string; kind: Action } | null>(null);
  const [noteState, setNoteState] = useState<string | null>(null);

  useEffect(() => {
    const onUp = () => {
      window.setTimeout(() => {
        const s = window.getSelection();
        const text = s?.toString().replace(/\s+/g, " ").trim() ?? "";
        if (!s || s.rangeCount === 0 || text.length < 2 || text.length > 80) return setSel(null);
        const node = s.getRangeAt(0).commonAncestorContainer;
        const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
        if (!el?.closest("[data-concept-scope]") || !scopeRef.current?.closest("[role=dialog]")?.contains(el)) return setSel(null);
        const rect = s.getRangeAt(0).getBoundingClientRect();
        setSel({ term: text, x: Math.min(Math.max(rect.left + rect.width / 2, 160), window.innerWidth - 160), y: Math.max(rect.top - 8, 56) });
        setNoteState(null);
      }, 0);
    };
    document.addEventListener("mouseup", onUp);
    document.addEventListener("keyup", onUp);
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("keyup", onUp);
      document.removeEventListener("touchend", onUp);
    };
  }, []);

  const saveToNotes = async (term: string) => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return setNoteState(readerUI(lang, "Sign in to save notes."));
    const { data: row } = await supabase.from("topic_notes").select("body").eq("user_id", uid).eq("topic_id", topicId).maybeSingle();
    const body = `${row?.body ? `${row.body}\n` : ""}• ${term}`.slice(0, 10000);
    const { error } = await supabase.from("topic_notes").upsert({ user_id: uid, topic_id: topicId, body }, { onConflict: "user_id,topic_id" });
    setNoteState(error ? readerUI(lang, "Could not save the note.") : readerUI(lang, "Added to your private note (reopen the topic to see it)."));
  };

  const buttons: [Action | "note", string][] = [
    ["define", readerUI(lang, "Define")], ["simple", readerUI(lang, "Explain simply")], ["why", readerUI(lang, "Why it matters")],
    ["topics", readerUI(lang, "Related Curiosity, Sourced topics")], ["sources", readerUI(lang, "Search sources")], ["web", readerUI(lang, "Search the wider web")], ["note", readerUI(lang, "Save to notes")],
  ];

  return (
    <>
      <span ref={scopeRef} hidden />
      {sel ? (
        <div role="toolbar" aria-label={`${readerUI(lang, "Tools for")} “${sel.term}”`} style={{ left: sel.x, top: sel.y }} className="fixed z-[90] flex max-w-[94vw] -translate-x-1/2 -translate-y-full flex-wrap gap-1 rounded-xl border border-border bg-card p-1.5 text-xs shadow-lg">
          {buttons.map(([k, label]) => (
            <button key={k} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => (k === "note" ? void saveToNotes(sel.term) : setAction({ term: sel.term, kind: k }))} className="min-h-9 rounded-lg px-2 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring">
              {label}
            </button>
          ))}
          {noteState ? <p role="status" className="w-full px-2 pb-1 italic text-muted-foreground">{noteState}</p> : null}
        </div>
      ) : null}
      {action ? <ConceptPanel term={action.term} kind={action.kind} onClose={() => setAction(null)} onOpenTopic={onOpenTopic} /> : null}
    </>
  );
}

function ConceptPanel({ term, kind, onClose, onOpenTopic }: { term: string; kind: Action; onClose: () => void; onOpenTopic?: ((id: number) => void) | undefined }) {
  const { lang } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const webHost = useRef<HTMLDivElement>(null);
  const provider = webSearchProvider();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["concept", term.toLowerCase()],
    queryFn: ({ signal }) => lookupConcept({ data: { term }, signal }),
    staleTime: 10 * 60_000,
    enabled: kind !== "web",
  });

  useEffect(() => ref.current?.focus(), [kind]);
  useEffect(() => {
    if (kind !== "web" || !provider.inline || !provider.mount || !webHost.current) return;
    return provider.mount(webHost.current, term);
  }, [kind, term, provider]);

  const g = data?.glossary;
  const noGlossary = <p className="italic text-muted-foreground">{readerUI(lang, "No definition is available yet. Explore related topics and sources below.")}</p>;

  return (
    <div ref={ref} tabIndex={-1} role="region" aria-label={`${readerUI(lang, "About")} “${term}”`} onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), onClose())} className="no-scrollbar fixed inset-x-2 bottom-2 z-[90] max-h-[60dvh] overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-2xl focus:outline-none sm:inset-x-auto sm:right-4 sm:w-[26rem]">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-lg font-semibold">“{term}”</p>
        <button type="button" onClick={onClose} aria-label={readerUI(lang, "Close concept panel")} className="min-h-9 min-w-9 rounded-full border border-border">×</button>
      </div>
      <div className="mt-3 space-y-3 text-sm leading-relaxed">
        {kind === "web" ? (
          provider.inline ? <div ref={webHost} /> : (
            <p>{readerUI(lang, "Curiosity, Sourced searches its own topics and sources first. For the wider web,")} <a className="underline" href={provider.externalUrl(term)} target="_blank" rel="noopener noreferrer">{readerUI(lang, "open a web search in a new tab ↗")}</a>.</p>
          )
        ) : isLoading ? (
          <div role="status" className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-3 animate-pulse rounded bg-muted" />)}</div>
        ) : isError || !data ? (
          <p role="alert">{readerUI(lang, "Could not look this up right now.")}</p>
        ) : (
          <>
            {kind === "define" ? (g ? <p>{g.definition}</p> : noGlossary) : null}
            {kind === "simple" ? (g?.simpleExplanation ? <p>{g.simpleExplanation}</p> : g ? <p>{g.definition}</p> : noGlossary) : null}
            {kind === "why" ? (g?.whyItMatters ? <p>{g.whyItMatters}</p> : noGlossary) : null}
            {kind !== "sources" ? (
              <div>
                <p className="eyebrow text-muted-foreground">{readerUI(lang, "Related Curiosity, Sourced topics")}</p>
                {data.topics.length ? (
                  <ul className="mt-1 space-y-1">{data.topics.map((t) => <li key={t.id}><button type="button" className="text-left underline" onClick={() => { onClose(); onOpenTopic?.(t.id); }}>{topicTitle(lang, t)}</button></li>)}</ul>
                ) : <p className="italic text-muted-foreground">{readerUI(lang, "No matching topic.")}</p>}
              </div>
            ) : null}
            {kind === "sources" || kind === "topics" ? (
              <div>
                <p className="eyebrow text-muted-foreground">{readerUI(lang, "Sources")}</p>
                {data.sources.length ? (
                  <ul className="mt-1 space-y-1">{data.sources.map((s) => <li key={s.id}><a className="underline" href={s.url} title={s.title} target="_blank" rel="noopener noreferrer">{s.title} ↗</a></li>)}</ul>
                ) : <p className="italic text-muted-foreground">{readerUI(lang, "No matching source.")}</p>}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
