import { Link } from "@tanstack/react-router";
import waxSeal from "@/assets/brand-wax-seal-fountain.png";

import { LanguagePicker } from "@/components/LanguagePicker";
import { ThemePicker } from "@/components/ThemePicker";
import { useAccount } from "@/lib/account";
import { useI18n } from "@/lib/i18n";

export function AppHeader() {
  const { session, profile, streak } = useAccount();
  const { t } = useI18n();

  return (
    <div className="relative z-40 w-full max-w-full overflow-x-clip border-b border-border/70 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-3 py-3 sm:justify-start sm:px-6">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 font-display text-lg font-semibold text-foreground"
        >
          <img src={waxSeal} alt="" aria-hidden="true" width={36} height={36} className="size-9 shrink-0 object-contain" />
          Curiosity, Sourced
        </Link>

        <nav className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
          <Link
            to="/leaderboard"
            className="text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            {t("nav.ranking")}
          </Link>
          {session ? (
            <>
              <Link
                to="/welcome"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("nav.tune")}
              </Link>
              <Link
                to="/suggest-topic"
                className="text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                {t("nav.suggest")}
              </Link>
            </>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {session ? (
            <span
              title={t("nav.streakBest", { count: streak.best })}
              className="flex items-center gap-1.5 rounded-full border border-gold/60 bg-accent px-3 py-1.5 text-sm text-accent-foreground"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              >
                <path d="M12 3c1.5 3 4.5 4.2 4.5 8a4.5 4.5 0 0 1-9 0c0-1.6.7-2.6 1.6-3.6C10 9.5 11.4 8 12 3Z" />
                <path d="M12 21a6 6 0 0 0 6-6" />
              </svg>
              {streak.current === 1
                ? t("nav.streakDay", { count: streak.current })
                : t("nav.streakDays", { count: streak.current })}
            </span>
          ) : null}

          <LanguagePicker />

          <ThemePicker />

          {session ? (
            <div className="flex items-center gap-2">
              <Link
                to="/account"
                aria-label={t("nav.account", {
                  name: profile?.display_name ?? t("nav.reader"),
                })}
                className="group flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 transition-colors hover:border-gold/70"
              >
                <span
                  aria-hidden="true"
                  className="flex size-7 items-center justify-center rounded-full border border-gold/60 bg-accent font-display text-xs font-semibold text-accent-foreground"
                >
                  {(profile?.display_name ?? "R").trim().charAt(0).toUpperCase() ||
                    "R"}
                </span>
                <span className="hidden text-sm text-muted-foreground transition-colors group-hover:text-foreground sm:inline">
                  {profile?.display_name ?? t("nav.reader")}
                </span>
              </Link>
            </div>
          ) : (
            <Link
              to="/auth"
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t("nav.signIn")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
