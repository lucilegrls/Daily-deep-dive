import { useEffect, useRef, useState } from "react";

import { LANGUAGES, useI18n } from "@/lib/i18n";

export function LanguagePicker() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("lang.choose")}
        className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary/50"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.7 2.5 15 0 18M12 3c-2.5 2.7-2.5 15 0 18" />
        </svg>
        <span>{current.native}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute end-0 z-50 mt-2 w-52 rounded-xl border border-border bg-popover p-2 shadow-xl"
        >
          <p className="eyebrow px-2 py-1 text-muted-foreground">
            {t("lang.choose")}
          </p>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitem"
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-start transition-colors hover:bg-accent ${
                l.code === lang ? "bg-accent" : ""
              }`}
            >
              <span className="text-sm font-medium text-popover-foreground">
                {l.native}
              </span>
              <span className="text-xs text-muted-foreground">{l.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
