import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/lib/account";
import { useI18n } from "@/lib/i18n";
import { recordUxEvent, uxJourney } from "@/lib/ux-analytics";

interface Row {
  display_name: string;
  reads: number;
  place: number;
  is_me: boolean;
}

interface Mine {
  place: number;
  reads: number;
}

export const Route = createFileRoute("/leaderboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reading community beta — Daily Deep Dive" },
      {
        name: "description",
        content:
          "An optional beta view of community reading activity.",
      },
      { property: "og:title", content: "Reading community beta" },
      {
        property: "og:description",
        content:
          "An optional beta view of community reading activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Leaderboard,
});

function Leaderboard() {
  const { session, streak, profile } = useAccount();
  const profileName = profile?.display_name ?? null;
  const { t } = useI18n();
  const [period, setPeriod] = useState<"week" | "all">("week");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [mine, setMine] = useState<Mine | null>(null);
  const [journeyId] = useState(() => uxJourney("reading_community"));

  useEffect(() => {
    recordUxEvent({
      journeyId,
      surface: "reading_community",
      event: "community_viewed",
      variant: "week",
    });
  }, [journeyId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    const timer = window.setTimeout(() => {
      if (!active) return;
      active = false;
      setFailed(true);
      setLoading(false);
    }, 12_000);
    setRows([]);
    setMine(null);
    // Public snapshot: place, public name and total only. "You" comes from a
    // separate own-only lookup, never from other readers' identifiers.
    Promise.all([
      supabase
        .from("leaderboard_snapshot")
        .select("place, display_name, reads")
        .eq("period", period)
        .order("place")
        .order("display_name")
        .limit(50),
      session
        ? supabase.rpc("my_leaderboard_place", { _period: period })
        : Promise.resolve({ data: [], error: null }),
    ]).then(([board, me]) => {
      if (!active) return;
      window.clearTimeout(timer);
      if (board.error) {
        setFailed(true);
      } else {
        const own = ((me.data ?? []) as Mine[])[0] ?? null;
        const myName = profileName;
        let marked = false;
        setMine(own);
        setRows(
          (board.data ?? []).map((r) => {
            const isMe = !marked && !!own && r.place === own.place && r.reads === own.reads && r.display_name === myName;
            if (isMe) marked = true;
            return { ...r, is_me: isMe };
          }),
        );
      }
      setLoading(false);
    });
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [period, attempt, session?.user.id, profileName]);


  return (
    <div className="paper-grain min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <p className="eyebrow text-center text-muted-foreground">
          {t("lb.eyebrow")}
        </p>
        <h1 className="mt-3 text-center font-display text-4xl font-semibold text-foreground">
          {t("lb.title")}
        </h1>
        <div
          className="rule-diamond ornamental mx-auto mt-6 max-w-xs"
          aria-hidden="true"
        />

        <div className="mt-8 flex justify-center gap-2">
          {(["week", "all"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPeriod(p);
                recordUxEvent({
                  journeyId,
                  surface: "reading_community",
                  event: "period_changed",
                  variant: p,
                });
              }}
              aria-pressed={period === p}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                period === p
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "week" ? t("lb.week") : t("lb.all")}
            </button>
          ))}
        </div>

        {session ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("lb.streak", {
              days: t(
                streak.current === 1 ? "nav.streakDay" : "nav.streakDays",
                { count: streak.current },
              ),
              best: streak.best,
              total: streak.total,
            })}
            {mine ? t("lb.place", { place: mine.place }) : ""}
          </p>
        ) : (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/auth" className="underline underline-offset-4">
              {t("lb.guestLink")}
            </Link>
            {t("lb.guestAfter")}
          </p>
        )}

        <ol className="mt-10 divide-y divide-border/60">
          {loading ? (
            <p className="py-16 text-center text-muted-foreground italic">
              {t("lb.loading")}
            </p>
          ) : failed ? (
            <div className="py-16 text-center">
              <p className="text-muted-foreground italic">{t("feed.errorFeed")}</p>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="mt-4 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground"
              >
                {t("feed.retry")}
              </button>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground italic">
              {t("lb.empty")}
            </p>
          ) : (
            rows.map((row) => (
              <li
                key={`${row.place}-${row.display_name}`}
                className={`flex items-center gap-4 py-4 ${
                  row.is_me ? "font-medium" : ""
                }`}
              >
                <span className="w-8 shrink-0 font-display text-xl text-gold">
                  {row.place}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {row.display_name}
                  {row.is_me ? t("lb.you") : ""}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {t(Number(row.reads) === 1 ? "lb.read" : "lb.reads", {
                    count: row.reads,
                  })}
                </span>
              </li>
            ))
          )}
        </ol>
      </main>
    </div>
  );
}
