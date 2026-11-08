import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useState } from "react";

import { deleteResource, editResource, getVerificationStatus, runVerificationNow } from "@/lib/source-verification.functions";

const LABEL: Record<string, string> = {
  passing: "Passing",
  exceptional: "Exceptional (one rule missing, reason noted)",
  blocked: "Blocked / unverified (not a failure)",
  rejected: "Rejected",
};

export function VerificationPanel() {
  const qc = useQueryClient();
  const status = useServerFn(getVerificationStatus);
  const run = useServerFn(runVerificationNow);
  const { data: rawData } = useQuery({ queryKey: ["verification"], queryFn: () => status(), retry: false });
  // The health dashboard folds additive trust tables whose columns are newer
  // than the generated client types; the server function validates the shape.
  const data = rawData as any;
  const mut = useMutation({
    mutationFn: () => run(),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["verification"] }),
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const blockers = data.blockers;
  const health = data.health;
  const filteredQueue = health.queue.filter((row: any) =>
    (statusFilter === "all" || row.technical_status === statusFilter) &&
    (riskFilter === "all" || row.topic?.risk_level === riskFilter));
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/70 p-4">
        <h3 className="font-display text-base text-foreground">Resource health / verification</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Technical link state only. It never means that a source or a claim was editorially reviewed.
        </p>
        {health.queryError ? (
          <p className="mt-2 text-xs text-destructive">Apply migration 0010 to enable the health queue: {health.queryError}</p>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {[
                ["Total resources", health.counts.total],
                ["Healthy", health.counts.healthy],
                ["Needs attention", (health.counts.needs_review ?? 0) + (health.counts.temporarily_unavailable ?? 0)],
                ["Broken / removed", (health.counts.broken ?? 0) + (health.counts.removed ?? 0)],
                ["Redirected", health.counts.redirected],
                ["Restricted / paywalled", (health.counts.restricted ?? 0) + (health.counts.paywalled ?? 0)],
                ["Embed failures", health.counts.embed_failures],
                ["Never checked", health.counts.never_checked],
                ["Stale checks", health.counts.stale],
                ["Editorial review due", health.counts.editorial_review_due],
                ["High-risk overdue", health.counts.high_risk_overdue],
                ["Human source reviews", health.sourceReviews],
                ["Human claim reviews", health.claimReviews],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-border/70 p-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-display text-lg text-foreground">{Number(value ?? 0)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground">
                <option value="all">All technical states</option>
                {["unknown","broken","removed","needs_review","temporarily_unavailable","redirected","restricted","paywalled","embed_unavailable"].map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
              </select>
              <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground">
                <option value="all">All risk levels</option>
                <option value="high">High risk</option>
                <option value="elevated">Elevated</option>
                <option value="standard">Standard</option>
              </select>
            </div>
            <h4 className="mt-4 text-sm font-medium text-foreground">Prioritized exception queue ({filteredQueue.length})</h4>
            <ul className="mt-2 max-h-96 space-y-2 overflow-y-auto text-xs">
              {filteredQueue.map((row: any) => (
                <li key={row.id} className="rounded-lg border border-border/70 p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <a href={row.url} target="_blank" rel="noreferrer" className="font-medium text-foreground underline">{row.title}</a>
                    <span className="text-muted-foreground">{row.topic?.risk_level ?? "standard"} · {row.technical_status}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Topic #{row.topic_id}{row.topic?.title ? ` — ${row.topic.title}` : ""} · {row.kind}
                    {row.consecutive_failures ? ` · ${row.consecutive_failures} consecutive failures` : ""}
                    {row.embed_status && row.embed_status !== "unknown" ? ` · embed ${row.embed_status}` : ""}
                  </p>
                  {row.needs_review_reason ? <p className="mt-1 text-destructive">{row.needs_review_reason}</p> : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Applies formal rules to stored evidence, 25 sources per run. This is not completed verification: sources lacking evidence stay "blocked / unverified". Rejected sources stay visible until a checked replacement of the same kind is published. Scheduler: {String(data.cursor?.scheduler_state ?? "unknown")}.
      </p>
      <ul className="space-y-1 text-sm text-destructive">
        {blockers.map((b: string) => <li key={b}>Blocker: {b}</li>)}
      </ul>
      <p className="text-sm text-foreground">
        {data.checked} of {data.total} sources run through the rules · {data.topicsCovered} topics covered · full passes: {data.cursor?.passes ?? 0}
      </p>
      <ul className="grid gap-1 text-sm text-foreground sm:grid-cols-2">
        {Object.entries(data.counts as Record<string, number>).map(([k, v]) => <li key={k}>{LABEL[k] ?? k}: {v}</li>)}
      </ul>
      <button
        className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground disabled:opacity-50"
        disabled={mut.isPending}
        onClick={() => mut.mutate()}
      >
        Run the next 25 now
      </button>
      {mut.data ? <p role="status" className="text-sm text-muted-foreground">{mut.data.busy ? "A run is already in progress." : `${mut.data.processed} checked.`}</p> : null}
      {mut.isError ? <p className="text-sm text-destructive">Could not run. Try again.</p> : null}
      <h3 className="font-display text-base text-foreground">Rejected, waiting for a replacement ({data.gaps.length})</h3>
      <ul className="space-y-1 text-sm text-foreground">
        {data.gaps.map((g: any) => <li key={g.resource_id}>Topic #{g.topic_id}: {g.reason} — {g.blocker}</li>)}
      </ul>
      <h3 className="font-display text-base text-foreground">Recent decisions</h3>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {data.recent.map((r: any, i: number) => (
          <li key={`${r.resource_id}-${i}`}>
            #{r.topic_id} · {LABEL[r.outcome]} · {r.action}{r.failed_rules.length ? ` · ${r.failed_rules.join(", ")}` : ""} · {r.evidence}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResourceEditDelete({ id, title }: { id: string; title: string }) {
  const qc = useQueryClient();
  const edit = useServerFn(editResource);
  const del = useServerFn(deleteResource);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const done = () => void qc.invalidateQueries({ queryKey: ["editorial-desk"] });
  const save = useMutation({ mutationFn: () => edit({ data: { id, title: value } }), onSuccess: () => { setEditing(false); done(); } });
  const remove = useMutation({ mutationFn: () => del({ data: { id } }), onSuccess: done });
  return (
    <div className="mt-2 space-y-2">
      {editing ? (
        <input value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <button className="rounded-full border border-border px-3 py-1 text-xs text-foreground" disabled={save.isPending} onClick={() => save.mutate()}>Save</button>
        ) : null}
        <button className="rounded-full border border-border px-3 py-1 text-xs text-foreground" onClick={() => setEditing((v) => !v)}>{editing ? "Cancel" : "Edit"}</button>
        <button
          className="rounded-full border border-border px-3 py-1 text-xs text-destructive"
          disabled={remove.isPending}
          onClick={() => { if (window.confirm("Retire this source? Its row and history will be preserved.")) remove.mutate(); }}
        >
          Retire
        </button>
      </div>
      {save.isError || remove.isError ? <p className="text-xs text-destructive">{(save.error ?? remove.error)?.message}</p> : null}
    </div>
  );
}
