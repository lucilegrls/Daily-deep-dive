import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAccount } from "@/lib/account";
import {
  categoryName,
  feedMixDescription,
  feedMixName,
  laneDescription,
  laneName,
  themeDescription,
  themeName,
} from "@/lib/content-labels";
import { useI18n } from "@/lib/i18n";
import { listInterestLanes, listTopics } from "@/lib/content.functions";
import { toLaneSelection } from "@/lib/interests";
import {
  DEFAULT_FEED_MIX,
  FEED_MIXES,
  MIN_INTERESTS,
  clearDraft,
  readDraft,
  writeDraft,
  type FeedMix,
} from "@/lib/onboarding";
import { DEFAULT_THEME, THEMES, isTheme } from "@/lib/themes";
import type { TranslationKey } from "@/lib/translations";
import { finishUxJourney, recordUxEvent, uxJourney } from "@/lib/ux-analytics";

const STEP_KEYS: TranslationKey[] = [
  "ob.stepSubjects",
  "ob.stepFeel",
  "ob.stepRoom",
  "ob.stepPreview",
];

export function OnboardingWizard({ mode }: { mode: "signup" | "edit" }) {
  const {
    session,
    profile,
    interests,
    feedMix: savedMix,
    theme,
    previewTheme,
    applyOnboarding,
  } = useAccount();
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [mix, setMix] = useState<FeedMix>(DEFAULT_FEED_MIX);
  // The look the account had when the edit opened. Captured only when the
  // profile hydrates (below) — on a fresh browser the profile arrives after
  // the first render, so reading `theme` here would catch the wrong look.
  const [startTheme, setStartTheme] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [journeyId] = useState(() => uxJourney("onboarding"));
  const stepStartedAt = useRef(Date.now());


  const { data: lanes = [], isLoading: loadingLanes } = useQuery({
    queryKey: ["interest-lanes"],
    queryFn: () => listInterestLanes(),
    staleTime: 10 * 60_000,
  });

  // Start from what the reader already has: their account in edit mode,
  // otherwise any draft they left behind in this browser. Subjects saved as
  // older category names are shown as the subject they belong to; nothing is
  // rewritten unless the reader saves.
  useEffect(() => {
    if (hydrated || lanes.length === 0) return;
    if (mode === "edit") {
      if (!profile) return;
      setPicked(toLaneSelection(lanes, interests));
      setMix(savedMix);
      // The account's saved look is the source of truth for Cancel — never
      // the browser's current theme, and never overwritten by previews.
      setStartTheme(isTheme(profile.theme) ? profile.theme : DEFAULT_THEME);
      setHydrated(true);
      return;
    }
    const draft = readDraft();
    if (draft) {
      setPicked(toLaneSelection(lanes, draft.interests));
      setMix(draft.feedMix);
    }
    setHydrated(true);
  }, [hydrated, mode, profile, interests, savedMix, lanes]);

  // Keep the hand-off draft current while signing up.
  useEffect(() => {
    if (mode !== "signup" || !hydrated || picked.length === 0) return;
    writeDraft({ interests: picked, feedMix: mix, theme });
  }, [mode, hydrated, picked, mix, theme]);

  useEffect(() => {
    stepStartedAt.current = Date.now();
    recordUxEvent({
      journeyId,
      surface: "onboarding",
      event: "step_viewed",
      variant: mode,
      step,
    });
  }, [journeyId, mode, step]);


  const previewEnabled = step === 3 && picked.length > 0;
  const { data: preview } = useQuery({
    queryKey: ["onboarding-preview", picked.join(","), mix],
    enabled: previewEnabled,
    queryFn: () =>
      listTopics({
        data: { interests: picked, feedMix: mix, limit: 3, offset: 0, seed: 1 },
      }),
  });

  const canContinue = useMemo(() => {
    if (step === 0) return picked.length >= MIN_INTERESTS;
    return true;
  }, [step, picked]);

  const toggle = (category: string) => {
    setError(null);
    setPicked((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  const next = () => {
    if (!canContinue) {
      setError(t("ob.errMin", { min: MIN_INTERESTS }));
      return;
    }
    recordUxEvent({
      journeyId,
      surface: "onboarding",
      event: "step_completed",
      variant: mode,
      step,
      elapsedMs: Date.now() - stepStartedAt.current,
    });
    setError(null);
    setStep((s) => Math.min(s + 1, STEP_KEYS.length - 1));
  };

  const back = () => {
    setError(null);
    if (step === 0) {
      // Leaving the edit without saving discards any previewed look.
      if (mode === "edit") restoreOriginalTheme();
      recordUxEvent({
        journeyId,
        surface: "onboarding",
        event: "journey_skipped",
        variant: mode,
        step,
        elapsedMs: Date.now() - stepStartedAt.current,
      });
      finishUxJourney("onboarding");
      void navigate({ to: "/" });
      return;
    }
    recordUxEvent({
      journeyId,
      surface: "onboarding",
      event: "step_back",
      variant: mode,
      step,
      elapsedMs: Date.now() - stepStartedAt.current,
    });
    setStep((s) => s - 1);
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    const result = await applyOnboarding({
      interests: picked,
      feedMix: mix,
      theme,
      force: mode === "edit",
    });
    setBusy(false);
    if (!result.ok) {
      setError(
        result.reason === "too_few_interests"
          ? t("ob.errMinSave", { min: MIN_INTERESTS })
          : t("ob.errSave"),
      );
      if (result.reason === "too_few_interests") setStep(0);
      return;
    }
    recordUxEvent({
      journeyId,
      surface: "onboarding",
      event: "step_completed",
      variant: mode,
      step: 3,
      elapsedMs: Date.now() - stepStartedAt.current,
    });
    recordUxEvent({
      journeyId,
      surface: "onboarding",
      event: "journey_completed",
      variant: mode,
      step: 3,
    });
    finishUxJourney("onboarding");
    void navigate({ to: "/" });
  };

  // Leaving an edit only puts the look back the way the account had it —
  // nothing was written to the account while previewing.
  const restoreOriginalTheme = () => {
    const original =
      startTheme ?? (isTheme(profile?.theme) ? profile.theme : DEFAULT_THEME);
    previewTheme(original);
  };

  const cancelEdit = () => {
    recordUxEvent({
      journeyId,
      surface: "onboarding",
      event: "journey_skipped",
      variant: mode,
      step,
    });
    finishUxJourney("onboarding");
    restoreOriginalTheme();
    void navigate({ to: "/" });
  };


  const goToAccount = () => {
    writeDraft({ interests: picked, feedMix: mix, theme });
    recordUxEvent({
      journeyId,
      surface: "onboarding",
      event: "step_completed",
      variant: mode,
      step: 3,
      elapsedMs: Date.now() - stepStartedAt.current,
    });
    recordUxEvent({
      journeyId,
      surface: "onboarding",
      event: "journey_completed",
      variant: mode,
      step: 3,
    });
    finishUxJourney("onboarding");
    void navigate({ to: "/auth" });
  };

  return (
    <div className="paper-grain min-h-screen bg-background px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-2xl">
        <p className="eyebrow text-center text-muted-foreground">
          {mode === "edit" ? t("ob.titleEdit") : t("ob.titleSignup")}
        </p>

        <p className="mt-4 text-center text-sm font-medium text-foreground">
          {t("ob.stepOf", { n: step + 1, total: STEP_KEYS.length })}
          <span aria-hidden="true"> · </span>
          <span>{t(STEP_KEYS[step] ?? "ob.stepSubjects")}</span>
        </p>

        <ol
          aria-label={t("ob.stepOf", { n: step + 1, total: STEP_KEYS.length })}
          className="mx-auto mt-3 flex max-w-sm gap-2"
        >
          {STEP_KEYS.map((key, i) => (
            <li key={key} className="flex-1">
              <span className="sr-only">
                {t(key)}
                {i === step ? t("ob.currentStep") : ""}
              </span>
              <span
                aria-hidden="true"
                className={`block h-1 rounded-full transition-colors motion-reduce:transition-none ${
                  i <= step ? "bg-primary" : "bg-border"
                }`}
              />
            </li>
          ))}
        </ol>

        <div className="letter-sheet mt-8 rounded-2xl px-5 py-8 sm:px-9 sm:py-10">
          {step === 0 ? (
            <fieldset>
              <legend className="w-full text-center font-display text-3xl font-semibold text-foreground">
                {t("ob.q1")}
              </legend>
              <p className="mx-auto mt-4 max-w-md text-center text-sm leading-relaxed text-muted-foreground">
                {t("ob.q1hint", { min: MIN_INTERESTS })}
              </p>
              {loadingLanes ? (
                <p className="mt-8 text-center text-muted-foreground italic">
                  {t("ob.loadingLanes")}
                </p>
              ) : (
                <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
                  {lanes.map((lane) => {
                    const active = picked.includes(lane.slug);
                    return (
                      <button
                        key={lane.slug}
                        type="button"
                        onClick={() => toggle(lane.slug)}
                        aria-pressed={active}
                        className={`min-h-12 rounded-xl border px-4 py-3 text-left text-[0.95rem] transition-colors motion-reduce:transition-none ${
                          active
                            ? "border-primary bg-accent text-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="font-display text-base text-foreground">
                            {laneName(lang, lane.slug, lane.label)}
                          </span>
                          <span
                            aria-hidden="true"
                            className={`size-2.5 shrink-0 rotate-45 border ${
                              active
                                ? "border-primary bg-primary"
                                : "border-border"
                            }`}
                          />
                        </span>
                        <span className="mt-1 block text-sm">
                          {laneDescription(lang, lane.slug, lane.description)}
                        </span>
                        {/* Individual topic titles are discovered in the
                            library itself, not listed during registration. */}

                        {lane.publishedCount === 0 ? (
                          <span className="mt-1.5 block text-xs text-muted-foreground italic">
                            {t("ob.beingWritten")}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-5 text-center text-sm text-muted-foreground">
                {t("ob.chosen", { count: picked.length })}
              </p>
            </fieldset>
          ) : null}

          {step === 1 ? (
            <div role="radiogroup" aria-labelledby="mix-heading">
              <h2
                id="mix-heading"
                className="text-center font-display text-3xl font-semibold text-foreground"
              >
                {t("ob.q2")}
              </h2>
              <div className="mt-7 space-y-3">
                {FEED_MIXES.map((option) => {
                  const active = option.id === mix;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setMix(option.id)}
                      className={`block w-full rounded-xl border px-5 py-4 text-left transition-colors motion-reduce:transition-none ${
                        active
                          ? "border-primary bg-accent"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <span className="flex items-baseline gap-2 font-display text-lg font-medium text-foreground">
                        {feedMixName(lang, option.id, option.label)}
                        {option.recommended ? (
                          <span className="eyebrow text-muted-foreground">
                            {t("ob.recommended")}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {feedMixDescription(
                          lang,
                          option.id,
                          option.description,
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div role="radiogroup" aria-labelledby="room-heading">
              <h2
                id="room-heading"
                className="text-center font-display text-3xl font-semibold text-foreground"
              >
                {t("ob.q3")}
              </h2>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {t("ob.q3hint")}
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={t.id === theme}
                    onClick={() => previewTheme(t.id)}
                    className={`rounded-xl border p-4 text-left transition-colors motion-reduce:transition-none ${
                      t.id === theme
                        ? "border-primary bg-accent"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <span className="flex overflow-hidden rounded-full border border-border">
                      {t.swatch.map((c) => (
                        <span
                          key={c}
                          className="h-5 flex-1"
                          style={{ backgroundColor: c }}
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                    <span className="mt-3 block font-display text-base font-medium text-foreground">
                      {themeName(lang, t.id, t.label)}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {themeDescription(lang, t.id, t.description)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <h2 className="text-center font-display text-3xl font-semibold text-foreground">
                {t("ob.q4")}
              </h2>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {t("ob.q4hint")}
              </p>
              <ul className="mt-7 space-y-3">
                {(preview?.items ?? []).map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-border bg-card px-5 py-4"
                  >
                    <p className="eyebrow text-muted-foreground">
                      {categoryName(lang, item.category)}
                    </p>
                    <p className="mt-1 font-display text-lg text-foreground">
                      {item.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {item.context}
                    </p>
                  </li>
                ))}
                {preview && preview.items.length === 0 ? (
                  <li className="text-center text-sm text-muted-foreground italic">
                    {t("ob.previewEmpty")}
                  </li>
                ) : null}
              </ul>

              {mode === "signup" && !session ? (
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={goToAccount}
                    className="min-h-12 w-full rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    {t("ob.createAccount")}
                  </button>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {t("ob.draftNote")}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t("ob.already")}{" "}
                    <Link
                      to="/auth"
                      className="text-foreground underline underline-offset-4"
                    >
                      {t("ob.signIn")}
                    </Link>
                  </p>
                </div>
              ) : (
                <div className="mt-8 space-y-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void finish()}
                    className="min-h-12 w-full rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {busy
                      ? t("ob.saving")
                      : mode === "edit"
                        ? t("ob.saveFeed")
                        : t("ob.enterFeed")}
                  </button>
                  {mode === "edit" ? (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="min-h-12 w-full rounded-full border border-border bg-card px-5 text-sm text-muted-foreground"
                    >
                      {t("ob.cancel")}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          <p aria-live="polite" className="mt-6 min-h-5 text-center text-sm text-destructive">
            {error}
          </p>

          <div className="mt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={back}
              className="min-h-11 rounded-full border border-border bg-card px-5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {step === 0
                ? mode === "edit"
                  ? t("ob.cancel")
                  : t("ob.notNow")
                : t("ob.back")}
            </button>
            {step < STEP_KEYS.length - 1 ? (
              <button
                type="button"
                onClick={next}
                className="min-h-11 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                {t("ob.continue")}
              </button>
            ) : (
              <span />
            )}
          </div>
        </div>

        {mode === "signup" ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => {
                recordUxEvent({
                  journeyId,
                  surface: "onboarding",
                  event: "journey_skipped",
                  variant: mode,
                  step,
                });
                finishUxJourney("onboarding");
                clearDraft();
                void navigate({ to: "/" });
              }}
              className="underline underline-offset-4"
            >
              {t("ob.browseInstead")}
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
