import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { useAccount } from "@/lib/account";
import { themeDescription, themeName } from "@/lib/content-labels";
import { useI18n } from "@/lib/i18n";
import { THEMES } from "@/lib/themes";

export function ThemePicker() {
  const { theme, setTheme } = useAccount();
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
      const selected = THEMES.findIndex((item) => item.id === theme);
      itemRefs.current[selected]?.focus();
    }
  }, [open, theme]);

  const moveFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    if (!items.length) return;
    const currentIndex = items.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    let next = currentIndex;
    if (event.key === "ArrowDown") next = (currentIndex + 1) % items.length;
    else if (event.key === "ArrowUp")
      next =
        currentIndex < 0
          ? items.length - 1
          : (currentIndex - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    items[next]?.focus();
  };

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0]!;

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("theme.choose")}
        className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm text-foreground transition-colors hover:border-primary/50"
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
        <span className="hidden sm:inline">
          {themeName(lang, current.id, current.label)}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={t("theme.choose")}
          onKeyDown={moveFocus}
          className="absolute end-0 z-50 mt-2 w-64 rounded-xl border border-border bg-popover p-2 shadow-xl"
        >
          <p className="eyebrow px-2 py-1 text-muted-foreground">
            {t("theme.choose")}
          </p>
          {THEMES.map((t) => (
            <button
              ref={(node) => {
                itemRefs.current[THEMES.indexOf(t)] = node;
              }}
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={t.id === theme}
              onClick={() => {
                setTheme(t.id);
                setOpen(false);
              }}
              className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-start transition-colors hover:bg-accent ${
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
