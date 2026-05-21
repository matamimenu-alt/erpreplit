/**
 * LanguageContext — full bilingual (English / Arabic) support with RTL/LTR switching.
 *
 * Why custom (no i18next):
 *   - Single namespace, ~300 keys → adding i18next + bundles + detector would
 *     more than double the runtime footprint for no functional gain.
 *   - The bundles are typed JSON imports and resolved with a tiny `get-by-path`
 *     helper, so usage stays `t("nav.dashboard")`, just like i18next.
 *
 * Side-effects on language change:
 *   1. <html lang="ar|en">
 *   2. <html dir="rtl|ltr">     ← drives Tailwind `rtl:` variants + native CSS
 *   3. body class `font-ar` when ar → activates Tajawal font
 *   4. localStorage("app_language") persistence  ← survives reloads
 *
 * Bilingual data: `pickName({name, nameAr})` returns the right one per lang.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import en from "./en.json";
import ar from "./ar.json";

export type Lang = "en" | "ar";
type Dict = Record<string, unknown>;
const BUNDLES: Record<Lang, Dict> = { en: en as Dict, ar: ar as Dict };

const STORAGE_KEY = "app_language";

interface LanguageContextValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Pick the right field from a bilingual record (`{name, nameAr}`). */
  pickName: <T extends { name?: string | null; nameAr?: string | null }>(item: T | null | undefined) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  dir: "ltr",
  setLang: () => {},
  t: (k) => k,
  pickName: (item) => item?.name ?? "",
});

function resolve(dict: Dict, key: string): string | undefined {
  const parts = key.split(".");
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "ar" || stored === "en" ? stored : "en";
  });

  const dir: "ltr" | "rtl" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("lang", lang);
    html.setAttribute("dir", dir);
    document.body.classList.toggle("font-ar", lang === "ar");
  }, [lang, dir]);

  const setLang = (next: Lang) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setLangState(next);
  };

  const value = useMemo<LanguageContextValue>(() => {
    const t = (key: string, vars?: Record<string, string | number>): string => {
      // Fall back to English bundle, then to the key itself (so missing keys
      // are visible during development instead of silently rendering "").
      const primary  = resolve(BUNDLES[lang], key);
      const fallback = lang === "en" ? undefined : resolve(BUNDLES.en, key);
      return interpolate(primary ?? fallback ?? key, vars);
    };
    const pickName: LanguageContextValue["pickName"] = (item) => {
      if (!item) return "";
      if (lang === "ar" && item.nameAr) return item.nameAr;
      return item.name ?? item.nameAr ?? "";
    };
    return { lang, dir, setLang, t, pickName };
  }, [lang, dir]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/** Convenience hook — `const t = useT();` returns just the t function. */
export function useT() {
  return useContext(LanguageContext).t;
}
