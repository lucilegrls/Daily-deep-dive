import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getResearchPilot, runResearchPilotStep } from "@/lib/research-pilot.functions";

export function ResearchPilotPanel() {
  const qc = useQueryClient();
  const get = useServerFn(getResearchPilot);
  const step = useServerFn(runResearchPilotStep);
  const { data } = useQuery({ queryKey: ["research-pilot"], queryFn: () => get(), retry: false });
  const mut = useMutation({ mutationFn: () => step(), onSettled: () => void qc.invalidateQueries({ queryKey: ["research-pilot"] }) });
  if (!data?.pilot) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const p = data.pilot;
  const stopped = p.state !== "ready" && p.state !== "running";
  return (
    <div className="space-y-4 text-sm text-foreground">
      <p className="text-muted-foreground">
        Free keyless web-research pilot (preview only). No account, no billing, no AI, no scheduler. Evidence only: nothing here approves, rejects or changes a published source.
      </p>
      <p>
        State: <strong>{p.state}</strong>{p.stop_reason ? ` (${p.stop_reason})` : ""} · calls {p.calls_attempted}/{p.call_cap} (incl. {p.external_smoke_calls} owner smoke tests) · searches {p.searches_used}/{p.search_cap} · extractions {p.extracts_used}/{p.extract_cap}
      </p>
      <p>Pilot topics (fixed order): {p.topic_ids.join(", ") || "not selected yet"}</p>
      <button className="rounded-full border border-border bg-card px-4 py-2 disabled:opacity-50" disabled={mut.isPending || stopped} onClick={() => mut.mutate()}>
        Run next step (one provider call)
      </button>
      {mut.data ? <p role="status" className="text-muted-foreground">{mut.data.action}{mut.data.topicId ? ` · #${mut.data.topicId}` : ""}{mut.data.detail ? ` · ${mut.data.detail}` : ""}{mut.data.stopped ? ` · stopped: ${mut.data.stopped}` : ""}</p> : null}
      {mut.isError ? <p className="text-destructive">Could not run. Try again.</p> : null}
      <ul className="space-y-3">
        {data.topics.map((t) => {
          const c = data.candidates.filter((x) => x.topic_id === t.topic_id);
          const e = data.evidence.filter((x) => x.topic_id === t.topic_id);
          return (
            <li key={t.topic_id} className="rounded-lg border border-border p-3">
              <p>#{t.topic_id} · {t.status}{t.note ? ` · ${t.note}` : ""}</p>
              {c.map((x) => {
                const ev = e.find((y) => y.url === x.url);
                return (
                  <div key={x.id} className="mt-2 text-xs">
                    <p className="break-all">{x.url} · {x.authority}{x.existing_resource_id ? " · already in library" : ""}</p>
                    {ev ? (
                      <p className="text-muted-foreground">
                        Machine-extracted text: {ev.outcome}{ev.truncated ? ` (stored ${ev.stored_chars} of ${ev.original_chars} chars)` : ev.stored_chars ? ` (${ev.stored_chars} chars)` : ""}{ev.failure_reason ? ` · ${ev.failure_reason}` : ""}
                        {ev.excerpt ? <span className="mt-1 block whitespace-pre-wrap">{ev.excerpt}</span> : null}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground">Still unverified: {x.blocked_checks.join("; ")}</p>
                  </div>
                );
              })}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
