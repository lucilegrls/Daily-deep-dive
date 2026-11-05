import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { friendlyError } from "@/lib/friendly-error";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useId, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { listInterestLanes } from "@/lib/content.functions";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/translations";
import {
  SUGGESTION_DETAILS_MAX,
  SUGGESTION_TITLE_MAX,
  SUGGESTION_TITLE_MIN,
  listMySuggestions,
  submitSuggestion,
  suggestionStatusLabel,
} from "@/lib/suggestions.functions";

export const Route = createFileRoute("/_authenticated/suggest-topic")({
  head: () => ({
    meta: [
      { title: "Suggest a topic — Daily Deep Dive" },
      {
        name: "description",
        content:
          "Send the editors a question or subject you would like to understand, and follow what happens to it.",
      },
      { property: "og:title", content: "Suggest a topic — Daily Deep Dive" },
      {
        property: "og:description",
        content: "The reader suggestion box for the Daily Deep Dive library.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuggestTopic,
});

function SuggestTopic() {
  const titleId = useId();
  const detailsId = useId();
  const laneId = useId();
  const helpId = useId();
  const { t, lang } = useI18n();

  const queryClient = useQueryClient();
  const lanesFn = useServerFn(listInterestLanes);
  const mineFn = useServerFn(listMySuggestions);
  const submitFn = useServerFn(submitSuggestion);

  const lanes = useQuery({
    queryKey: ["interest-lanes"],
    queryFn: () => lanesFn(),
    retry: false,
  });
  const mine = useQuery({
    queryKey: ["my-suggestions"],
    queryFn: () => mineFn(),
    retry: false,
  });

  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [lane, setLane] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: (data: { title: string; details: string; lane_slug: string }) =>
      submitFn({ data }),
    onSuccess: () => {
      setTitle("");
      setDetails("");
      setLane("");
      void queryClient.invalidateQueries({ queryKey: ["my-suggestions"] });
    },
  });

  const trimmed = title.trim();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (
      trimmed.length < SUGGESTION_TITLE_MIN ||
      trimmed.length > SUGGESTION_TITLE_MAX
    ) {
      setLocalError(
        t("sg.tooShort", {
          min: SUGGESTION_TITLE_MIN,
          max: SUGGESTION_TITLE_MAX,
        }),
      );
      return;
    }
    if (details.length > SUGGESTION_DETAILS_MAX) {
      setLocalError(t("sg.tooLong", { max: SUGGESTION_DETAILS_MAX }));
      return;
    }
    submit.mutate({ title: trimmed, details, lane_slug: lane });
  }

  const laneLabelFor = (slug: string | null) =>
    slug
      ? ((lanes.data ?? []).find((l) => l.slug === slug)?.label ?? slug)
      : null;

  const statusLabel = (status: string) => {
    const key = `sg.status.${status}` as TranslationKey;
    const translated = t(key);
    return translated === key ? suggestionStatusLabel(status) : translated;
  };

  return (
    <div className="paper-grain min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="eyebrow text-muted-foreground">{t("sg.eyebrow")}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">
          {t("sg.title")}
        </h1>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          {t("sg.intro")}
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5 rounded-2xl border border-border bg-card/70 p-5 shadow-sm sm:p-7"
        >
          <div>
            <label
              htmlFor={titleId}
              className="block text-sm font-medium text-foreground"
            >
              {t("sg.titleLabel")}
            </label>
            <input
              id={titleId}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={SUGGESTION_TITLE_MIN}
              maxLength={SUGGESTION_TITLE_MAX}
              aria-describedby={helpId}
              placeholder={t("sg.titlePlaceholder")}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none"
            />
            <p id={helpId} className="mt-1.5 text-xs text-muted-foreground">
              {t("sg.count", {
                min: SUGGESTION_TITLE_MIN,
                max: SUGGESTION_TITLE_MAX,
                n: trimmed.length,
              })}
            </p>
          </div>

          <div>
            <label
              htmlFor={detailsId}
              className="block text-sm font-medium text-foreground"
            >
              {t("sg.detailsLabel")}{" "}
              <span className="text-muted-foreground">{t("sg.optional")}</span>
            </label>
            <textarea
              id={detailsId}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={SUGGESTION_DETAILS_MAX}
              rows={5}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {details.length}/{SUGGESTION_DETAILS_MAX}
            </p>
          </div>

          <div>
            <label
              htmlFor={laneId}
              className="block text-sm font-medium text-foreground"
            >
              {t("sg.laneLabel")}{" "}
              <span className="text-muted-foreground">{t("sg.optional")}</span>
            </label>
            <select
              id={laneId}
              value={lane}
              onChange={(e) => setLane(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none"
            >
              <option value="">{t("sg.laneNone")}</option>
              {(lanes.data ?? []).map((l) => (
                <option key={l.slug} value={l.slug}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submit.isPending}
              className="min-h-11 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submit.isPending ? t("sg.sending") : t("sg.send")}
            </button>
            {submit.isSuccess ? (
              <p role="status" className="text-sm text-muted-foreground">
                {t("sg.sent")}
              </p>
            ) : null}
          </div>

          {localError || submit.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {localError ??
                (submit.error instanceof Error
                  ? friendlyError(submit.error, undefined, t)
                  : t("sg.errorSend"))}
            </p>
          ) : null}
        </form>

        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold text-foreground">
            {t("sg.mine")}
          </h2>
          {mine.isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground italic">
              {t("sg.mineLoading")}
            </p>
          ) : mine.isError ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("sg.mineError")}
            </p>
          ) : (mine.data ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground italic">
              {t("sg.mineEmpty")}
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {(mine.data ?? []).map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-border bg-card/70 p-4"
                >
                  <p className="font-display text-base text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("sg.sentOn", {
                      date: new Date(item.created_at).toLocaleDateString(lang, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }),
                    })}
                    {laneLabelFor(item.lane_slug)
                      ? ` · ${laneLabelFor(item.lane_slug)}`
                      : ""}
                  </p>
                  <p className="mt-2 inline-flex rounded-full border border-gold/60 bg-accent px-3 py-1 text-xs text-accent-foreground">
                    {statusLabel(item.status)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
