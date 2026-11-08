import { useEffect, useRef, useState } from "react";

import { useAccount } from "@/lib/account";
import { themeDescription, themeName } from "@/lib/content-labels";
import { useI18n } from "@/lib/i18n";
import { THEMES } from "@/lib/themes";

export function ThemePicker() {
  const { theme, setTheme } = useAccount();
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0]!;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary/50"
      >
        <span className="flex overflow-hidden rounded-full border border-border">
          {current.swatch.map((c) => (
            <span
              key={c}
              className="size-3"
              style={{ backgroundColor: c }}
              aria-hidden="true"
            />
          ))}
        </span>
        <span className="hidden sm:inline">{themeName(lang, current.id, current.label)}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-popover p-2 shadow-xl"
        >
          <p className="eyebrow px-2 py-1 text-muted-foreground">{t("theme.choose")}</p>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setTheme(t.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent ${
                t.id === theme ? "bg-accent" : ""
              }`}
            >
              <span className="flex shrink-0 overflow-hidden rounded-full border border-border">
                {t.swatch.map((c) => (
                  <span
                    key={c}
                    className="size-4"
                    style={{ backgroundColor: c }}
                    aria-hidden="true"
                  />
                ))}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-popover-foreground">
                  {themeName(lang, t.id, t.label)}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {themeDescription(lang, t.id, t.description)}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
