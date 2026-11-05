import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { friendlyError } from "@/lib/friendly-error";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { listViewerResources, updateViewerResource, type EditorViewerResource } from "@/lib/viewer-editor.functions";
import { EMBED_TYPES, EMBEDDING_STATUSES, playerFor, resolveMode, RIGHTS_STATUSES } from "@/lib/viewer-media";

import { TopicSheet } from "@/components/TopicSheet";
import { useOpenTopic } from "@/lib/use-open-topic";

const input = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none";

/** Editor-desk controls for how each source shows in the Resource Viewer. Editors only (server-checked). */
export function EditorViewerTools() {
  const [topicInput, setTopicInput] = useState("");
  const [topicId, setTopicId] = useState<number | null>(null);
  const preview = useOpenTopic();
  const list = useServerFn(listViewerResources);
  const { data, isLoading, error } = useQuery({
    queryKey: ["viewer-editor", topicId],
    queryFn: () => list({ data: { topicId } }),
    enabled: topicId !== null,
    retry: false,
  });

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(topicInput); if (Number.isInteger(n) && n > 0) setTopicId(n); }}>
        <label className="sr-only" htmlFor="viewer-topic">Topic number</label>
        <input id="viewer-topic" value={topicInput} onChange={(e) => setTopicInput(e.target.value)} placeholder="Topic number" className={`${input} max-w-40`} />
        <button type="submit" className="rounded-full border border-border bg-card px-4 py-1.5 text-sm">Load sources</button>
        {topicId ? <button type="button" onClick={() => preview.openTopic(topicId)} className="rounded-full border border-border bg-card px-4 py-1.5 text-sm">Preview viewer (approved items only)</button> : null}
      </form>
      {isLoading ? <p role="status" className="text-sm italic text-muted-foreground">Loading…</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{friendlyError(error)}</p> : null}
      {data && topicId ? (
        <>
          <p className="text-sm text-muted-foreground">{data.topic?.title ?? "Unknown topic"} — {data.items.length} source rows</p>
          <ul className="space-y-4">{data.items.map((r) => <ResourceEditor key={r.id} r={r} topicId={topicId} />)}</ul>
        </>
      ) : null}
      <TopicSheet topic={preview.topic} open={preview.openId !== null} loading={preview.loading} saved={false} onClose={preview.closeTopic} onToggleSave={() => undefined} onOpenTopic={preview.openTopic} onRetry={preview.retry} />
    </div>
  );
}

function ResourceEditor({ r, topicId }: { r: EditorViewerResource; topicId: number }) {
  const qc = useQueryClient();
  const save = useServerFn(updateViewerResource);
  const [f, setF] = useState({
    url: r.url, review_status: r.review_status, embed_type: r.embed_type, embedding_status: r.embedding_status,
    rights_status: r.rights_status, embed_url: r.embed_url ?? "", thumbnail_url: r.thumbnail_url ?? "",
    content_url: r.content_url ?? "", is_start_here: r.is_start_here, rights_notes: r.rights_notes ?? "",
  });
  const [body, setBody] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: (extra: { mark_checked?: boolean }) => save({ data: { id: r.id, ...f, ...extra, ...(body !== null ? { content_html: body } : {}) } }),
    onSuccess: () => { setMsg("Saved."); void qc.invalidateQueries({ queryKey: ["viewer-editor", topicId] }); void qc.invalidateQueries({ queryKey: ["viewer", topicId] }); },
    onError: (e) => setMsg(friendlyError(e)),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const loadBody = async () => {
    const { data } = await supabase.from("content_resource_bodies").select("content_html").eq("resource_id", r.id).maybeSingle();
    setBody(data?.content_html ?? "");
  };
  const mode = resolveMode({ embedType: f.embed_type, rightsStatus: f.rights_status, embeddingStatus: f.embedding_status, url: f.url, embedUrl: f.embed_url || null, contentUrl: f.content_url || null, hasBody: r.has_body || !!body });
  const testSrc = f.embed_type === "video" ? playerFor(f.url, f.embed_url || null)?.src.replace("autoplay=1", "autoplay=0") : f.embed_url || f.url;

  return (
    <li className="rounded-xl border border-border bg-card/70 p-4">
      <p className="font-display font-semibold">{r.title}</p>
      <p className="text-xs text-muted-foreground">{r.kind} · reader sees: <strong>{mode}</strong> · last checked {r.last_checked_at ? new Date(r.last_checked_at).toLocaleDateString("en-GB") : "never"}{r.failures ? ` · ${r.failures} embed problem report(s)` : ""}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Labeled label="Source link (replacing keeps history)"><input className={input} value={f.url} onChange={set("url")} /></Labeled>
        <Labeled label="Approval"><select className={input} value={f.review_status} onChange={set("review_status")}>{["candidate", "approved", "rejected"].map((v) => <option key={v}>{v}</option>)}</select></Labeled>
        <Labeled label="Display mode"><select className={input} value={f.embed_type} onChange={set("embed_type")}>{EMBED_TYPES.map((v) => <option key={v}>{v}</option>)}</select></Labeled>
        <Labeled label="Embed status"><select className={input} value={f.embedding_status} onChange={set("embedding_status")}>{EMBEDDING_STATUSES.map((v) => <option key={v}>{v}</option>)}</select></Labeled>
        <Labeled label="Rights status"><select className={input} value={f.rights_status} onChange={set("rights_status")}>{RIGHTS_STATUSES.map((v) => <option key={v}>{v}</option>)}</select></Labeled>
        <Labeled label="Embed link (https)"><input className={input} value={f.embed_url} onChange={set("embed_url")} /></Labeled>
        <Labeled label="Thumbnail link (https)"><input className={input} value={f.thumbnail_url} onChange={set("thumbnail_url")} /></Labeled>
        <Labeled label="Hosted file link — PDF/audio (https)"><input className={input} value={f.content_url} onChange={set("content_url")} /></Labeled>
        <Labeled label="Private rights notes"><textarea className={input} rows={2} value={f.rights_notes} onChange={set("rights_notes")} /></Labeled>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_start_here} onChange={(e) => setF({ ...f, is_start_here: e.target.checked })} /> Start here for this topic</label>
      </div>
      {body !== null ? (
        <Labeled label="In-app text (HTML; shown only with owned/licensed/public-domain rights; sanitised on display)"><textarea className={`${input} mt-2 font-mono`} rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></Labeled>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <button type="button" disabled={m.isPending} onClick={() => m.mutate({})} className="rounded-full bg-primary px-4 py-1.5 text-primary-foreground">Save</button>
        <button type="button" disabled={m.isPending} onClick={() => m.mutate({ mark_checked: true })} className="rounded-full border border-border px-4 py-1.5">Save + mark checked today</button>
        {body === null ? <button type="button" onClick={() => void loadBody()} className="rounded-full border border-border px-4 py-1.5">Edit in-app text</button> : null}
        <button type="button" onClick={() => setTesting((t) => !t)} className="rounded-full border border-border px-4 py-1.5">{testing ? "Close embed test" : "Test embed"}</button>
        <a href={f.url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border px-4 py-1.5">Open original ↗</a>
      </div>
      {msg ? <p role="status" className="mt-2 text-xs italic text-muted-foreground">{msg}</p> : null}
      {testing && testSrc ? (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">If this stays blank or shows a refusal, set Embed status to "blocked" (readers then get the link fallback).</p>
          <iframe src={testSrc} title={`Embed test: ${r.title}`} sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="no-referrer" className="mt-2 h-80 w-full rounded-lg border border-border bg-background" />
        </div>
      ) : null}
    </li>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs text-muted-foreground"><span className="mb-1 block">{label}</span>{children}</label>;
}
