import { useEffect, useRef, useState } from "react";

import { LANGUAGES, useI18n, type LanguageCode } from "@/lib/i18n";

/** Calm first-visit card: shown only until this browser has a saved choice. */
export function LanguageGate() {
  const { lang, setLang, chosen, ready, t } = useI18n();
  const [pick, setPick] = useState<LanguageCode>(lang);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPick(lang);
  }, [lang]);

  useEffect(() => {
    if (ready && !chosen) cardRef.current?.focus();
  }, [ready, chosen]);

  if (!ready || chosen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/25 px-4 py-6 backdrop-blur-sm sm:items-center">
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-gate-title"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl outline-none"
      >
        <p className="eyebrow text-muted-foreground">Curiosity, Sourced</p>
        <h2
          id="language-gate-title"
          className="mt-2 font-display text-2xl font-semibold text-foreground"
        >
          {t("lang.cardTitle")}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("lang.cardBody")}
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setPick(l.code);
                setLang(l.code, false);
              }}
              aria-pressed={pick === l.code}
              className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start transition-colors ${
                pick === l.code
                  ? "border-primary bg-accent"
                  : "border-border bg-background hover:border-primary/40"
              }`}
            >
              <span className="text-sm font-medium text-foreground">
                {l.native}
              </span>
              <span className="text-xs text-muted-foreground">{l.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setLang(pick)}
          className="mt-5 flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {t("lang.confirm")}
        </button>
        <p className="mt-3 text-center text-xs text-muted-foreground italic">
          {t("lang.remember")}
        </p>
      </div>
    </div>
  );
}
