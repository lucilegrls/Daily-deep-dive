import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { LANGUAGES, useI18n } from "@/lib/i18n";

export function LanguagePicker() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const selected = LANGUAGES.findIndex((language) => language.code === lang);
      itemRefs.current[selected]?.focus();
    }
  }, [lang, open]);

  const moveFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = current;
    if (event.key === "ArrowDown") next = (current + 1) % items.length;
    else if (event.key === "ArrowUp")
      next =
        current < 0
          ? items.length - 1
          : (current - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    items[next]?.focus();
  };

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("lang.choose")}
        className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm text-foreground transition-colors hover:border-primary/50"
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
        <span className="hidden sm:inline">{current.native}</span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={t("lang.choose")}
          onKeyDown={moveFocus}
          className="absolute end-0 z-50 mt-2 w-52 rounded-xl border border-border bg-popover p-2 shadow-xl"
        >
          <p className="eyebrow px-2 py-1 text-muted-foreground">
            {t("lang.choose")}
          </p>
          {LANGUAGES.map((l) => (
            <button
              ref={(node) => {
                itemRefs.current[LANGUAGES.indexOf(l)] = node;
              }}
              key={l.code}
              type="button"
              role="menuitemradio"
              aria-checked={l.code === lang}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-start transition-colors hover:bg-accent ${
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
