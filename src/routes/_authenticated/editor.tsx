import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { friendlyError } from "@/lib/friendly-error";
import { createFileRoute } from "@tanstack/react-router";
import { LINK_PROBE_DISABLED_REASON } from "@/lib/link-safety";
import { HEALTH_METRIC_LABELS, healthBanner } from "@/lib/content-health";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { EditorViewerTools } from "@/components/viewer/EditorViewerTools";
import { VerificationPanel, ResourceEditDelete } from "@/components/VerificationPanel";
import { ResourceImportPanel } from "@/components/ResourceImportPanel";
import { ResearchPilotPanel } from "@/components/ResearchPilotPanel";
import {
  addResource,
  createTopic,
  getEditorialDesk,
  getSourceHealthReport,
  getContentHealth,
  recheckContentHealth,
  previewHealthBaselines,
  applyHealthBaselines,
  listSuggestions,
  reviewResource,
  setSuggestionStatus,
  setTopicStatus,
} from "@/lib/editorial.functions";

export const Route = createFileRoute("/_authenticated/editor")({
  head: () => ({
    meta: [
      { title: "Editor's desk — Curiosity, Sourced" },
      {
        name: "description",
        content:
          "Review drafted topics, approve or reject suggested sources, and follow the daily expansion runs.",
      },
      { property: "og:title", content: "Editor's desk — Curiosity, Sourced" },
      {
        property: "og:description",
        content: "The review queue behind the Curiosity, Sourced library.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditorDesk,
});

function EditorDesk() {
  const desk = useServerFn(getEditorialDesk);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["editorial-desk"],
    queryFn: () => desk(),
    retry: false,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["editorial-desk"] });

  const publish = useMutation({
    mutationFn: useServerFn(setTopicStatus),
    onSuccess: invalidate,
  });
  const create = useMutation({
    mutationFn: useServerFn(createTopic),
    onSuccess: invalidate,
  });
  const addSource = useMutation({
    mutationFn: useServerFn(addResource),
    onSuccess: invalidate,
  });

  const [newTopic, setNewTopic] = useState({ title: "", category: "", context: "" });
  const [source, setSource] = useState({
    topic_id: "",
    kind: "videos",
    title: "",
    url: "",
    creator: "",
    duration: "",
    selection_reason: "",
  });

  if (isLoading) {
    return (
      <Shell>
        <p className="text-muted-foreground italic">Opening the desk…</p>
      </Shell>
    );
  }

  if (error || !data) {
    return (
      <Shell>
        <p className="text-muted-foreground">
          This desk is for editors only. Ask the owner to give your account
          editor rights.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Published topics" value={data.publishedCount} />
        <Stat label="Approved videos" value={data.approvedVideoCount} />
        <Stat label="Waiting for review" value={data.drafts.length} />
      </section>

      <ContentHealth />

      <ResourceImportPanel onComplete={invalidate} />

      <Section title="Drafted topics waiting for review">
        {data.drafts.length === 0 ? (
          <Empty>Nothing waiting. The queue is clear.</Empty>
        ) : (
          <ul className="space-y-3">
            {data.drafts.map((topic) => (
              <li
                key={topic.id}
                className="rounded-lg border border-border bg-card/70 p-4"
              >
                <p className="eyebrow text-muted-foreground">
                  {topic.category} · {topic.status} · from {topic.origin}
                </p>
                <p className="mt-1 font-display text-lg text-foreground">
                  {topic.title}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Action
                    onClick={() =>
                      publish.mutate({ data: { id: topic.id, status: "published" } })
                    }
                  >
                    Publish
                  </Action>
                  <Action
                    onClick={() =>
                      publish.mutate({ data: { id: topic.id, status: "in_review" } })
                    }
                  >
                    Mark in review
                  </Action>
                  <Action
                    onClick={() =>
                      publish.mutate({ data: { id: topic.id, status: "rejected" } })
                    }
                  >
                    Reject
                  </Action>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Suggested sources (no decision required — edit or delete if you wish)">
        {data.candidateResources.length === 0 ? (
          <Empty>No suggested sources right now.</Empty>
        ) : (
          <ul className="space-y-3">
            {data.candidateResources.map((resource) => (
              <li
                key={resource.id}
                className="rounded-lg border border-border bg-card/70 p-4"
              >
                <p className="eyebrow text-muted-foreground">
                  {resource.kind} · topic #{resource.topic_id}
                  {resource.creator ? ` · ${resource.creator}` : ""}
                  {resource.duration ? ` · ${resource.duration}` : ""}
                </p>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block font-display text-base text-foreground underline decoration-gold underline-offset-4"
                >
                  {resource.title}
                </a>
                {resource.selection_reason ? (
                  <p className="mt-1 text-sm text-muted-foreground italic">
                    {resource.selection_reason}
                  </p>
                ) : null}
                <ResourceEditDelete id={resource.id} title={resource.title} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Automatic source verification">
        <VerificationPanel />
      </Section>

      <Section title="Research pilot (10 topics, evidence only)">
        <ResearchPilotPanel />
      </Section>


      <Section title="How sources appear in the viewer">
        <EditorViewerTools />
      </Section>

      <Section title="Add a source to a topic">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field
            placeholder="Topic number"
            value={source.topic_id}
            onChange={(v) => setSource({ ...source, topic_id: v })}
          />
          <select
            value={source.kind}
            onChange={(e) => setSource({ ...source, kind: e.target.value })}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="videos">Video</option>
            <option value="books">Book</option>
            <option value="papers">Paper</option>
            <option value="articles">Article</option>
            <option value="pdfs">PDF</option>
            <option value="podcasts">Podcast</option>
            <option value="tools">Tool</option>
          </select>
          <Field
            placeholder="Title"
            value={source.title}
            onChange={(v) => setSource({ ...source, title: v })}
          />
          <Field
            placeholder="Link (never Wikipedia)"
            value={source.url}
            onChange={(v) => setSource({ ...source, url: v })}
          />
          <Field
            placeholder="Creator"
            value={source.creator}
            onChange={(v) => setSource({ ...source, creator: v })}
          />
          <Field
            placeholder="Length"
            value={source.duration}
            onChange={(v) => setSource({ ...source, duration: v })}
          />
          <Field
            placeholder="Why this one?"
            value={source.selection_reason}
            onChange={(v) => setSource({ ...source, selection_reason: v })}
          />
        </div>
        <Action
          onClick={() =>
            addSource.mutate({
              data: { ...source, topic_id: Number(source.topic_id) },
            })
          }
        >
          Add as a candidate
        </Action>
        {addSource.error ? (
          <p className="mt-2 text-sm text-destructive">
            {friendlyError(addSource.error)}
          </p>
        ) : null}
      </Section>

      <Section title="Start a new topic">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field
            placeholder="Title"
            value={newTopic.title}
            onChange={(v) => setNewTopic({ ...newTopic, title: v })}
          />
          <Field
            placeholder="Subject"
            value={newTopic.category}
            onChange={(v) => setNewTopic({ ...newTopic, category: v })}
          />
        </div>
        <textarea
          value={newTopic.context}
          onChange={(e) => setNewTopic({ ...newTopic, context: e.target.value })}
          placeholder="What is the mechanism, and what is contested?"
          rows={3}
          className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        />
        <Action onClick={() => create.mutate({ data: newTopic })}>
          Create as a draft
        </Action>
        {create.error ? (
          <p className="mt-2 text-sm text-destructive">
            {friendlyError(create.error)}
          </p>
        ) : null}
      </Section>

      <Section title="Expansion runs">
        {data.runs.length === 0 ? (
          <Empty>No run has been recorded yet.</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.runs.map((run) => (
              <li
                key={run.id}
                className="rounded-lg border border-border bg-card/70 p-3 text-muted-foreground"
              >
                <span className="text-foreground">{run.kind}</span> · {run.status} ·{" "}
                {new Date(run.started_at).toLocaleString("en-GB")} · found{" "}
                {run.found_count}, added {run.imported_count}, duplicates{" "}
                {run.duplicate_count}, refused {run.rejected_count}
                {run.shortfall_reason ? (
                  <span className="block italic">{run.shortfall_reason}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <SourceHealth />

      <SuggestionQueue />

      <Section title="Idea backlog">
        <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          {data.backlog.map((item) => (
            <li key={item.id}>
              <span className="text-foreground/80">{item.family}</span> — {item.idea}
            </li>
          ))}
        </ul>
      </Section>
    </Shell>
  );
}

function SourceHealth() {
  const reportFn = useServerFn(getSourceHealthReport);
  const { data, isLoading, error } = useQuery({
    queryKey: ["source-health"],
    queryFn: () => reportFn(),
    retry: false,
  });

  return (
    <Section title="Source health">
      <p className="mb-3 text-xs text-muted-foreground">{LINK_PROBE_DISABLED_REASON}</p>
      {isLoading ? (
        <Empty>Loading the last report…</Empty>
      ) : error ? (
        <Empty>The report could not be loaded just now.</Empty>
      ) : !data?.lastChecked ? (
        <Empty>No check has been run yet.</Empty>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Last check {new Date(data.lastChecked).toLocaleString("en-GB")} · working {data.summary["ok"] ?? 0},
            moved to another site {data.summary["redirected"] ?? 0}, broken {data.summary["broken"] ?? 0}, refused
            automated checks {data.summary["blocked"] ?? 0}, unreachable {data.summary["error"] ?? 0}. A working
            link does not confirm the content is still accurate.
          </p>
          {data.problems.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {data.problems.map((p) => (
                <li key={p.url} className="rounded-lg border border-border bg-card/70 p-3">
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-foreground underline">
                    {p.title || p.url}
                  </a>
                  <span className="block text-xs text-muted-foreground">
                    {p.outcome}
                    {p.status_code ? ` · ${p.status_code}` : ""}
                    {p.final_url ? ` · now ${p.final_url}` : ""}
                    {p.detail ? ` · ${p.detail}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </Section>
  );
}

function SuggestionQueue() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listSuggestions);
  const { data, isLoading, error } = useQuery({
    queryKey: ["reader-suggestions"],
    queryFn: () => listFn(),
    retry: false,
  });
  const update = useMutation({
    mutationFn: useServerFn(setSuggestionStatus),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["reader-suggestions"] }),
  });

  return (
    <Section title="Reader suggestions">
      {isLoading ? (
        <Empty>Opening the suggestion box…</Empty>
      ) : error ? (
        <Empty>Reader suggestions could not be loaded just now.</Empty>
      ) : (data ?? []).length === 0 ? (
        <Empty>No reader suggestions yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-border bg-card/70 p-4"
            >
              <p className="font-display text-base text-foreground">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(item.created_at).toLocaleDateString()} · status:{" "}
                {item.status}
                {item.lane_slug ? ` · ${item.lane_slug}` : ""}
              </p>
              {item.details ? (
                <p className="mt-2 text-sm text-muted-foreground">{item.details}</p>
              ) : null}
              <SuggestionDecision
                status={item.status}
                note={item.editor_note ?? ""}
                onSave={(status, editor_note) =>
                  update.mutate({ data: { id: item.id, status, editor_note } })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function SuggestionDecision({
  status,
  note,
  onSave,
}: {
  status: string;
  note: string;
  onSave: (status: string, note: string) => void;
}) {
  const [nextStatus, setNextStatus] = useState(status);
  const [editorNote, setEditorNote] = useState(note);
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <select
        aria-label="Suggestion status"
        value={nextStatus}
        onChange={(e) => setNextStatus(e.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
      >
        <option value="new">New</option>
        <option value="reviewed">Reviewed</option>
        <option value="planned">Planned</option>
        <option value="declined">Declined</option>
        <option value="published">Handled</option>
      </select>
      <Field
        placeholder="Private editor note"
        value={editorNote}
        onChange={setEditorNote}
      />
      <Action onClick={() => onSave(nextStatus, editorNote)}>Save</Action>
    </div>
  );
}

function ContentHealth() {
  const queryClient = useQueryClient();
  const readFn = useServerFn(getContentHealth);
  const recheckFn = useServerFn(recheckContentHealth);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["content-health"],
    queryFn: () => readFn(),
    retry: false,
  });
  const recheck = useMutation({
    mutationFn: () => recheckFn(),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["content-health"] }),
  });
  const label = (m: string) => HEALTH_METRIC_LABELS[m] ?? m;

  if (isLoading) return <Empty>Checking library health…</Empty>;
  if (error || !data) {
    return (
      <div role="status" className="rounded-xl border border-border bg-card/70 p-4 text-sm text-muted-foreground">
        Library health could not be loaded just now.{" "}
        <Action onClick={() => void refetch()}>Try again</Action>
      </div>
    );
  }
  const banner = healthBanner(data.incidents, data.lastCheck?.checkedAt ?? null);
  const tone =
    banner.tone === "alert"
      ? "border-destructive/60 bg-destructive/10"
      : banner.tone === "stale"
        ? "border-gold/60 bg-accent/40"
        : "border-border bg-card/70";
  return (
    <section aria-labelledby="health-title" role={banner.tone === "alert" ? "alert" : "status"} className={`rounded-xl border p-4 text-sm ${tone}`}>
      <h2 id="health-title" className="font-display text-lg font-semibold text-foreground">
        {banner.tone === "alert"
          ? "Library health: unusual drop"
          : banner.tone === "stale"
            ? "Library health: no recent check"
            : "Library health: normal"}
      </h2>
      {banner.open.length ? (
        <ul className="mt-2 space-y-1 text-foreground">
          {banner.open.map((i) => (
            <li key={i.metric}>
              {label(i.metric)}: {i.observed} (expected at least {i.threshold}, baseline {i.baseline}) · since{" "}
              {new Date(i.opened_at).toLocaleString("en-GB")} · seen {i.seen_count}×
            </li>
          ))}
        </ul>
      ) : null}
      {banner.recentlyResolved.length ? (
        <p className="mt-2 text-muted-foreground">
          Back to normal:{" "}
          {banner.recentlyResolved
            .map((i) => `${label(i.metric)} (${i.resolved_observed ?? "?"}, ${new Date(i.resolved_at ?? "").toLocaleDateString("en-GB")})`)
            .join(" · ")}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        {data.lastCheck
          ? `Last check ${new Date(data.lastCheck.checkedAt).toLocaleString("en-GB")} (${data.lastCheck.source === "editor" ? "from this desk" : "daily automatic check"}): ${Object.entries(data.lastCheck.totals).map(([k, v]) => `${label(k)} ${v}`).join(" · ")}.`
          : "No check recorded yet."}{" "}
        An automatic check runs every day at 06:00 UTC; results appear here — nothing is sent by email.
      </p>
      <Action onClick={() => recheck.mutate()} disabled={recheck.isPending}>
        {recheck.isPending ? "Checking…" : "Check again now"}
      </Action>
      {recheck.isError ? <span className="ml-2 text-xs text-muted-foreground">The check could not run just now.</span> : null}
      <BaselineRebase />
    </section>
  );
}

function BaselineRebase() {
  const queryClient = useQueryClient();
  const previewFn = useServerFn(previewHealthBaselines);
  const applyFn = useServerFn(applyHealthBaselines);
  const [open, setOpen] = useState(false);
  const preview = useQuery({
    queryKey: ["health-baseline-preview"],
    queryFn: () => previewFn(),
    enabled: open,
    staleTime: 0,
    retry: false,
  });
  const apply = useMutation({
    mutationFn: (expected: Record<string, number>) => applyFn({ data: { expected } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["content-health"] });
      void queryClient.invalidateQueries({ queryKey: ["health-baseline-preview"] });
    },
  });
  const label = (m: string) => HEALTH_METRIC_LABELS[m] ?? m;
  if (!open) {
    return <Action onClick={() => setOpen(true)}>Use current counts as reference…</Action>;
  }
  return (
    <div className="mt-3 rounded-lg border border-border bg-card/70 p-3">
      <p className="text-foreground">Preview: use current counts as the new reference</p>
      <p className="text-xs text-muted-foreground">
        Only do this after a planned change. It is never done automatically, and open warnings are kept.
      </p>
      {preview.isLoading ? (
        <Empty>Reading current counts…</Empty>
      ) : preview.error || !preview.data ? (
        <p className="text-xs text-muted-foreground">Counts could not be read. <Action onClick={() => void preview.refetch()}>Try again</Action></p>
      ) : (
        <>
          <table className="mt-2 w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="py-1 font-normal">Count</th><th className="font-normal">Reference now</th><th className="font-normal">Would become</th></tr>
            </thead>
            <tbody className="text-foreground">
              {preview.data.baselines.map((b) => (
                <tr key={b.metric}>
                  <td className="py-1">{label(b.metric)}</td>
                  <td>{b.baseline}</td>
                  <td>{preview.data.current[b.metric] ?? "?"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-2">
            <Action onClick={() => apply.mutate(preview.data.current)} disabled={apply.isPending}>
              {apply.isPending ? "Saving…" : "Apply these references"}
            </Action>
            <Action onClick={() => { setOpen(false); apply.reset(); }}>Cancel</Action>
          </div>
          {apply.data ? (
            <p role="status" className="mt-1 text-xs text-muted-foreground">
              {apply.data.changed
                ? "References updated and logged."
                : apply.data.reason === "already_current"
                  ? "References already match the current counts; nothing changed."
                  : "Counts changed since this preview; nothing was saved. Review the new preview."}
            </p>
          ) : null}
          {apply.isError ? <p className="mt-1 text-xs text-muted-foreground">The references could not be saved.</p> : null}
        </>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper-grain min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl space-y-10 px-6 py-12">
        <div>
          <p className="eyebrow text-muted-foreground">Behind the envelopes</p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-foreground">
            Editor's desk
          </h1>
        </div>
        {children}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card/70 p-4 text-center">
      <p className="font-display text-3xl text-foreground">{value}</p>
      <p className="eyebrow mt-1 text-muted-foreground">{label}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground italic">{children}</p>;
}

function Field({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none"
    />
  );
}

function Action({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-foreground transition-colors hover:border-primary/50 hover:text-primary"
    >
      {children}
    </button>
  );
}
