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
  const { data } = useQuery({ queryKey: ["verification"], queryFn: () => status(), retry: false });
  const mut = useMutation({
    mutationFn: () => run(),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["verification"] }),
  });
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const blockers = data.blockers;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Applies formal rules to stored evidence, 25 sources per run. This is not completed verification: sources lacking evidence stay "blocked / unverified". Rejected sources stay visible until a checked replacement of the same kind is published. Scheduler: {data.cursor?.scheduler_state ?? "unknown"}.
      </p>
      <ul className="space-y-1 text-sm text-destructive">
        {blockers.map((b) => <li key={b}>Blocker: {b}</li>)}
      </ul>
      <p className="text-sm text-foreground">
        {data.checked} of {data.total} sources run through the rules · {data.topicsCovered} topics covered · full passes: {data.cursor?.passes ?? 0}
      </p>
      <ul className="grid gap-1 text-sm text-foreground sm:grid-cols-2">
        {Object.entries(data.counts).map(([k, v]) => <li key={k}>{LABEL[k] ?? k}: {v}</li>)}
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
        {data.gaps.map((g) => <li key={g.resource_id}>Topic #{g.topic_id}: {g.reason} — {g.blocker}</li>)}
      </ul>
      <h3 className="font-display text-base text-foreground">Recent decisions</h3>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {data.recent.map((r, i) => (
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
          onClick={() => { if (window.confirm("Delete this source permanently?")) remove.mutate(); }}
        >
          Delete
        </button>
      </div>
      {save.isError || remove.isError ? <p className="text-xs text-destructive">{(save.error ?? remove.error)?.message}</p> : null}
    </div>
  );
}
