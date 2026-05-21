/**
 * LanguageSwitcher — EN / AR toggle.
 *
 * Renders as a segmented 2-button control. Persists via LanguageContext.
 * Lives in the sidebar (desktop) and the mobile header so it's always reachable.
 */
import { Languages } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export function LanguageSwitcher({ variant = "sidebar" }: { variant?: "sidebar" | "mobile" }) {
  const { lang, setLang, t } = useLanguage();
  const isSidebar = variant === "sidebar";

  return (
    <div
      className={
        isSidebar
          ? "mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-sidebar-accent/40 text-sidebar-foreground"
          : "flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-700"
      }
      data-testid="language-switcher"
      title={t("lang.switchTo")}
    >
      <Languages className={isSidebar ? "w-4 h-4 opacity-60" : "w-4 h-4 text-slate-500"} />
      <div className="ms-auto flex items-center gap-1">
        {(["en", "ar"] as const).map((code) => {
          const active = lang === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              className={
                "px-2 py-1 text-xs font-semibold rounded-md transition-colors " +
                (active
                  ? (isSidebar
                      ? "bg-primary text-primary-foreground"
                      : "bg-slate-900 text-white")
                  : (isSidebar
                      ? "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                      : "text-slate-500 hover:text-slate-800"))
              }
              data-testid={`lang-${code}`}
              aria-pressed={active}
              lang={code}
            >
              {t(`lang.short.${code}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
