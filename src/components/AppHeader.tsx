import { Link } from "@tanstack/react-router";

import { LanguagePicker } from "@/components/LanguagePicker";
import { ThemePicker } from "@/components/ThemePicker";
import { useAccount } from "@/lib/account";
import { useI18n } from "@/lib/i18n";

export function AppHeader() {
  const { session, profile } = useAccount();
  const { t } = useI18n();

  return (
    <div className="relative z-40 w-full max-w-full overflow-x-clip border-b border-border/70 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-3 py-3 sm:justify-start sm:px-6">
        <Link to="/" className="shrink-0 font-display text-lg font-semibold text-foreground">
          Daily Deep Dive
        </Link>

        {session ? (
          <nav className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
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
          </nav>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <LanguagePicker />

          <ThemePicker />

          {session ? (
            <div className="flex items-center gap-2">
              <Link
                to="/account"
                aria-label={t("nav.account", {
                  name: profile?.display_name ?? t("nav.reader"),
                })}
                className="group flex min-h-11 items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 transition-colors hover:border-gold/70"
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
              className="flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t("nav.signIn")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
