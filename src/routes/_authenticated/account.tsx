import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AccountDataControls } from "@/components/AccountDataControls";
import { AppHeader } from "@/components/AppHeader";
import { useSavedTopics } from "@/hooks/use-saved-topics";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/lib/account";
import { listInterestLanes } from "@/lib/content.functions";
import {
  feedMixDescription,
  feedMixName,
  laneName,
  themeDescription,
  themeName,
} from "@/lib/content-labels";
import { useI18n } from "@/lib/i18n";
import { FEED_MIXES } from "@/lib/onboarding";
import { THEMES, isTheme } from "@/lib/themes";
import type { TranslationKey } from "@/lib/translations";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Your reading room — Curiosity, Sourced" },
      {
        name: "description",
        content:
          "Your name, subjects, feed style, look and reading history — visible only to you.",
      },
      { property: "og:title", content: "Your reading room — Curiosity, Sourced" },
      {
        property: "og:description",
        content:
          "Your name, subjects, feed style, look and reading history — visible only to you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

type Role = "owner" | "editor" | "reader";

function roleFrom(rows: { role: string }[] | null | undefined): Role {
  const roles = new Set((rows ?? []).map((r) => r.role));
  if (roles.has("owner")) return "owner";
  if (roles.has("editor")) return "editor";
  return "reader";
}

const ROLE_KEYS: Record<Role, TranslationKey> = {
  owner: "ac.role.owner",
  editor: "ac.role.editor",
  reader: "ac.role.reader",
};

function AccountPage() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const {
    session,
    profile,
    interests,
    feedMix,
    readTopicIds,
    streak,
    setDisplayName,
    signOut,
  } = useAccount();
  const { saved, status: savedStatus } = useSavedTopics();
  const userId = session?.user.id ?? null;
  const email = session?.user.email ?? "";

  const [nameDraft, setNameDraft] = useState("");
  const [nameState, setNameState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  useEffect(() => {
    setNameDraft(profile?.display_name ?? "");
  }, [profile?.display_name]);

  const roleQuery = useQuery({
    queryKey: ["my-role", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      if (error) throw new Error(error.message);
      return roleFrom(data);
    },
    staleTime: 5 * 60_000,
  });

  const lanesQuery = useQuery({
    queryKey: ["interest-lanes"],
    queryFn: () => listInterestLanes(),
    staleTime: 10 * 60_000,
  });

  const role: Role = roleQuery.data ?? "reader";
  const canEdit =
    !roleQuery.isError && (role === "owner" || role === "editor");

  // Lane slugs get their friendly labels; older accounts saved raw category
  // names, which are already human-readable and shown as they are.
  const laneLabels = new Map(
    (lanesQuery.data ?? []).map((l) => [
      l.slug,
      laneName(lang, l.slug, l.label),
    ]),
  );
  const interestLabels = interests.map(
    (value) => laneLabels.get(value) ?? laneName(lang, value, value),
  );

  const feedMixInfo =
    FEED_MIXES.find((m) => m.id === feedMix) ?? FEED_MIXES[1]!;
  const themeInfo = THEMES.find(
    (t) => t.id === (isTheme(profile?.theme) ? profile!.theme : ""),
  );

  const saveName = async () => {
    const next = nameDraft.trim();
    if (!next || next === profile?.display_name) return;
    setNameState("saving");
    try {
      await setDisplayName(next);
      setNameState("saved");
      window.setTimeout(() => setNameState("idle"), 2500);
    } catch {
      setNameState("error");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="paper-grain min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 pt-10 pb-16 sm:px-6">
        <p className="eyebrow text-muted-foreground">{t("ac.eyebrow")}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground">
          {t("ac.title")}
        </h1>
        <div
          className="rule-diamond ornamental mx-auto mt-8 max-w-xs"
          aria-hidden="true"
        />

        <section
          aria-labelledby="account-identity"
          className="mt-10 rounded-xl border border-border/70 bg-card p-5 shadow-sm sm:p-6"
        >
          <h2
            id="account-identity"
            className="font-display text-lg font-semibold text-foreground"
          >
            {t("ac.who")}
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label
                htmlFor="display-name"
                className="text-sm text-muted-foreground"
              >
                {t("ac.name")}
              </label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <input
                  id="display-name"
                  type="text"
                  value={nameDraft}
                  onChange={(e) => {
                    setNameDraft(e.target.value);
                    setNameState("idle");
                  }}
                  maxLength={60}
                  className="min-h-11 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => void saveName()}
                  disabled={
                    nameState === "saving" ||
                    !nameDraft.trim() ||
                    nameDraft.trim() === profile?.display_name
                  }
                  className="min-h-11 rounded-full border border-gold/60 bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {nameState === "saving" ? t("ac.saving") : t("ac.saveName")}
                </button>
              </div>
              <p className="mt-1.5 text-sm" aria-live="polite">
                {nameState === "saved" ? (
                  <span className="text-muted-foreground italic">
                    {t("ac.nameSaved")}
                  </span>
                ) : nameState === "error" ? (
                  <span className="text-destructive">{t("ac.nameError")}</span>
                ) : null}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("ac.email")}</p>
              <p className="mt-1 text-sm text-foreground">{email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("ac.type")}</p>
              <p className="mt-1 text-sm text-foreground">
                {roleQuery.isLoading
                  ? "…"
                  : roleQuery.isError
                    ? t("ac.loadFail")
                    : t(ROLE_KEYS[role])}
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="account-taste"
          className="mt-6 rounded-xl border border-border/70 bg-card p-5 shadow-sm sm:p-6"
        >
          <h2
            id="account-taste"
            className="font-display text-lg font-semibold text-foreground"
          >
            {t("ac.shape")}
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("ac.subjects")}
              </p>
              {lanesQuery.isLoading ? (
                <p className="mt-1 text-sm text-muted-foreground italic">
                  {t("ac.subjectsLoading")}
                </p>
              ) : interestLabels.length > 0 ? (
                <>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {interestLabels.map((label) => (
                      <li
                        key={label}
                        className="rounded-full border border-border bg-background px-3 py-1 text-sm text-foreground"
                      >
                        {label}
                      </li>
                    ))}
                  </ul>
                  {lanesQuery.isError ? (
                    <p className="mt-2 text-xs text-muted-foreground italic">
                      {t("ac.labelsStale")}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground italic">
                  {t("ac.subjectsNone")}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("ac.feedStyle")}
              </p>
              <p className="mt-1 text-sm text-foreground">
                {feedMixName(lang, feedMixInfo.id, feedMixInfo.label)} —{" "}
                {feedMixDescription(
                  lang,
                  feedMixInfo.id,
                  feedMixInfo.description,
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("ac.look")}</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-foreground">
                {themeInfo ? (
                  <>
                    <span className="flex gap-1" aria-hidden="true">
                      {themeInfo.swatch.map((colour) => (
                        <span
                          key={colour}
                          className="size-3.5 rounded-full border border-border"
                          style={{ backgroundColor: colour }}
                        />
                      ))}
                    </span>
                    {themeName(lang, themeInfo.id, themeInfo.label)}
                  </>
                ) : (
                  t("ac.lookDefault")
                )}
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="account-journey"
          className="mt-6 rounded-xl border border-border/70 bg-card p-5 shadow-sm sm:p-6"
        >
          <h2
            id="account-journey"
            className="font-display text-lg font-semibold text-foreground"
          >
            {t("ac.journey")}
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              { term: t("ac.currentStreak"), value: t(streak.current === 1 ? "nav.streakDay" : "nav.streakDays", { count: streak.current }) },
              { term: t("ac.bestStreak"), value: t(streak.best === 1 ? "nav.streakDay" : "nav.streakDays", { count: streak.best }) },
              { term: t("ac.totalReads"), value: String(streak.total) },
              { term: t("ac.savedTopics"), value: savedStatus === "loading" ? "…" : savedStatus === "error" ? t("ac.unavailable") : String(saved.length) },
              { term: t("ac.topicsRead"), value: String(readTopicIds.length) },
            ].map(({ term, value }) => (
              <div key={term}>
                <dt className="text-sm text-muted-foreground">{term}</dt>
                <dd className="mt-1 font-display text-xl font-semibold text-foreground">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <nav
          aria-label={t("ac.actions")}
          className="mt-8 flex flex-col gap-3"
        >
          <Link
            to="/welcome"
            className="flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {t("ac.tune")}
          </Link>
          <Link
            to="/suggest-topic"
            className="flex min-h-12 items-center justify-center rounded-full border border-border bg-card px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("ac.suggest")}
          </Link>
          <Link
            to="/"
            search={{ view: "saved" }}
            className="flex min-h-12 items-center justify-center rounded-full border border-gold/60 bg-accent px-6 text-sm font-medium text-accent-foreground transition-colors hover:border-gold"
          >
            {t("ac.browseSaved")}
          </Link>
          {canEdit ? (
            <Link
              to="/editor"
              className="flex min-h-12 items-center justify-center rounded-full border border-border bg-card px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {t("ac.editor")}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex min-h-12 items-center justify-center rounded-full border border-border bg-card px-6 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("ac.signOut")}
          </button>
        </nav>
        <AccountDataControls canEdit={canEdit} />
      </main>
    </div>
  );
}
