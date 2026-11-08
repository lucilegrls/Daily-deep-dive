import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DICTIONARIES, type TranslationKey } from "./translations";

export const LANGUAGES = [
  { code: "en", label: "English", native: "English", dir: "ltr" },
  { code: "fr", label: "French", native: "Français", dir: "ltr" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as LanguageCode[];

export const STORAGE_KEY = "daily-deep-dive:lang";

export function isLanguage(value: unknown): value is LanguageCode {
  return (
    typeof value === "string" && LANGUAGE_CODES.includes(value as LanguageCode)
  );
}

export function dirFor(_code: LanguageCode): "ltr" {
  return "ltr";
}

/** Best guess from the browser, used only to pre-select the first-visit card. */
export function detectLanguage(candidates: readonly string[]): LanguageCode {
  for (const raw of candidates) {
    const base = raw.toLowerCase().split("-")[0];
    if (isLanguage(base)) return base;
  }
  return "en";
}

/** Existing choices stay chosen; retired/invalid choices migrate rather than trapping the reader. */
export function resolveLanguagePreference(stored: unknown, candidates: readonly string[]) {
  return {
    lang: isLanguage(stored) ? stored : detectLanguage(candidates),
    chosen: stored !== null && stored !== undefined,
  };
}

type Vars = Record<string, string | number>;

export function translate(
  lang: LanguageCode,
  key: TranslationKey,
  vars?: Vars,
): string {
  const table = DICTIONARIES[lang] ?? DICTIONARIES.en;
  const raw = table[key] ?? DICTIONARIES.en[key] ?? String(key);
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

type I18nValue = {
  lang: LanguageCode;
  dir: "ltr" | "rtl";
  /** False until the reader (or this browser) has made an explicit choice. */
  chosen: boolean;
  /** True once the stored preference has been read on the client. */
  ready: boolean;
  setLang: (code: LanguageCode, remember?: boolean) => void;
  t: (key: TranslationKey, vars?: Vars) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Server and first paint always render English, then the stored preference
  // is applied on the client — this keeps hydration stable.
  const [lang, setLangState] = useState<LanguageCode>("en");
  const [chosen, setChosen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    const preference = resolveLanguagePreference(stored, navigator.languages ?? [navigator.language]);
    setLangState(preference.lang);
    setChosen(preference.chosen);
    if (preference.chosen && stored !== preference.lang) {
      try { window.localStorage.setItem(STORAGE_KEY, preference.lang); } catch { /* visit-only fallback */ }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", dirFor(lang));
  }, [lang]);

  const setLang = useCallback((code: LanguageCode, remember = true) => {
    const safeCode = isLanguage(code) ? code : "en";
    setLangState(safeCode);
    if (remember) {
      setChosen(true);
      try {
        window.localStorage.setItem(STORAGE_KEY, safeCode);
      } catch {
        /* private mode: the choice simply lasts for this visit */
      }
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir: dirFor(lang),
      chosen,
      ready,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang, chosen, ready, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * A page rendered outside the provider (or during a hot reload that briefly
 * remounts it) falls back to English wording rather than blanking the screen.
 */
const FALLBACK: I18nValue = {
  lang: "en",
  dir: "ltr",
  chosen: false,
  ready: false,
  setLang: () => {},
  t: (key, vars) => translate("en", key, vars),
};

export function useI18n(): I18nValue {
  return useContext(I18nContext) ?? FALLBACK;
}
