import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Receipt, 
  ShoppingCart, 
  Users, 
  TrendingDown,
  Building2,
  FileBarChart,
  Calculator,
  UtensilsCrossed,
  Warehouse,
  ChefHat,
  Menu,
  ChevronDown,
  LayoutGrid,
} from "lucide-react";
import { useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

// Each route maps to a translation key under `pages.*`. The label is resolved
// at render time so it follows the active language.
const PAGE_TITLE_KEYS: Record<string, string> = {
  "/":                     "pages.dashboardTitle",
  "/group-dashboard":      "pages.groupDashboardTitle",
  "/branches":             "pages.branchesTitle",
  "/sales":                "pages.salesTitle",
  "/purchases":            "pages.purchasesTitle",
  "/suppliers":            "pages.suppliersTitle",
  "/supplier-prices":      "pages.supplierPricesTitle",
  "/employees":            "pages.employeesTitle",
  "/expenses-management":  "pages.expensesManagementTitle",
  "/expenses":             "pages.expensesManagementTitle",
  "/expense-ledger":       "pages.expensesManagementTitle",
  "/inventory":            "pages.inventoryTitle",
  "/food-cost":            "pages.foodCostTitle",
  "/vat-report":           "pages.vatReportTitle",
  "/reports":              "pages.reportsTitle",
  "/reports/pl":           "pages.reportsTitle",
  "/reports/sales-comparison":       "pages.salesComparisonTitle",
  "/reports/restaurant-performance": "pages.restaurantPerfTitle",
  "/reports/financial":              "pages.financialReportTitle",
  "/reports/consolidated":           "pages.consolidatedTitle",
  "/reports/supplier-purchases":     "pages.supplierReportTitle",
  "/reports/price-comparison":       "pages.priceComparisonTitle",
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Nav items reference translation keys, not literal strings. The `name` is
// resolved per render via t() — never store the rendered string.
const groupNavItems = [
  { key: "nav.groupDashboard", href: "/group-dashboard", icon: LayoutGrid },
  { key: "nav.branches",       href: "/branches",        icon: Building2 },
];

const branchNavItems = [
  { key: "nav.dashboard",           href: "/",                     icon: LayoutDashboard },
  { key: "nav.sales",               href: "/sales",                icon: Receipt },
  { key: "nav.purchases",           href: "/purchases",            icon: ShoppingCart },
  { key: "nav.suppliers",           href: "/suppliers",            icon: Building2 },
  { key: "nav.supplierPrices",      href: "/supplier-prices",      icon: TrendingDown },
  { key: "nav.employees",           href: "/employees",            icon: Users },
  { key: "nav.expensesManagement",  href: "/expenses-management",  icon: FileBarChart },
  { key: "nav.inventory",           href: "/inventory",            icon: Warehouse },
  { key: "nav.foodCost",            href: "/food-cost",            icon: ChefHat },
  { key: "nav.vatReport",           href: "/vat-report",           icon: Calculator },
  { key: "nav.reports",             href: "/reports",              icon: FileBarChart },
];

const STATUS_DOT: Record<string, string> = {
  active:   "bg-emerald-400",
  inactive: "bg-amber-400",
  archived: "bg-slate-400",
};

function RestaurantSelector({ onSelect }: { onSelect?: () => void }) {
  const { restaurants, activeRestaurant, setActiveRestaurantId, isLoading } = useRestaurant();
  const { t, pickName } = useLanguage();
  const [open, setOpen] = useState(false);

  if (isLoading || !activeRestaurant) {
    return (
      <div className="mx-4 mb-3 h-10 bg-sidebar-accent/40 rounded-xl animate-pulse" />
    );
  }

  return (
    <div className="relative mx-4 mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-sidebar-accent/60 hover:bg-sidebar-accent text-sidebar-foreground text-sm font-medium transition-all"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex-shrink-0">
            <UtensilsCrossed className="w-4 h-4 text-primary" />
            <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-sidebar ${STATUS_DOT[(activeRestaurant as { status?: string }).status ?? "active"] ?? "bg-emerald-400"}`} />
          </div>
          <span className="truncate">{pickName(activeRestaurant)}</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 opacity-60 flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full start-0 end-0 mt-1 z-50 bg-sidebar border border-sidebar-border rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-sidebar-border/50">
            <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">{t("nav.activeBranches")}</p>
          </div>
          {restaurants.length === 0 ? (
            <div className="px-3 py-2 text-xs text-sidebar-foreground/50">{t("nav.noActiveBranches")}</div>
          ) : (
            restaurants.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setActiveRestaurantId(r.id);
                  setOpen(false);
                  onSelect?.();
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors text-start",
                  r.id === activeRestaurant.id
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <div className="relative flex-shrink-0">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate">{pickName(r)}</p>
                  {(r as { city?: string }).city && (
                    <p className="text-[10px] opacity-60 truncate">{(r as { city?: string }).city}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function NavSection({ title, items, location, onLinkClick }: {
  title: string;
  items: typeof branchNavItems;
  location: string;
  onLinkClick?: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="mb-2">
      <p className="px-4 py-1 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">{title}</p>
      {items.map((item) => {
        const isActive = location === item.href;
        return (
          <Link 
            key={item.key} 
            href={item.href}
            onClick={onLinkClick}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 mx-1",
              isActive 
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <item.icon className="w-5 h-5" />
            {t(item.key)}
          </Link>
        );
      })}
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { activeRestaurant } = useRestaurant();
  const { t, dir, pickName } = useLanguage();
  const pageTitleKey = PAGE_TITLE_KEYS[location];
  const pageTitle    = pageTitleKey ? t(pageTitleKey) : t("pages.fallback");

  const sidebar = (onLinkClick?: () => void) => (
    <>
      <div className="p-6 pb-4 flex items-center gap-3">
        <div className="bg-primary/20 p-2 rounded-xl text-primary-foreground">
          <UtensilsCrossed className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-display font-bold text-lg leading-tight">{t("app.name")}</h1>
          <p className="text-xs text-sidebar-foreground/60 font-medium">{t("app.tagline")}</p>
        </div>
      </div>

      <LanguageSwitcher variant="sidebar" />
      <RestaurantSelector onSelect={onLinkClick} />

      <nav className="flex-1 px-3 overflow-y-auto py-1 space-y-0.5">
        <NavSection title={t("nav.group")}       items={groupNavItems}  location={location} onLinkClick={onLinkClick} />
        <NavSection title={t("nav.branchOps")}   items={branchNavItems} location={location} onLinkClick={onLinkClick} />
      </nav>
    </>
  );

  // dir is mirrored on <html> already (LanguageContext sets it). Re-applying
  // on the top-level flex container guarantees Tailwind `rtl:` variants &
  // flex direction inheritance even if a descendant overrides dir locally.
  return (
    <div dir={dir} className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar - Desktop. Under RTL the parent flex flips, so the sidebar
          naturally moves to the right side. We only need to flip the border
          side from `border-r` to `border-l`. */}
      <aside className="no-print hidden md:flex flex-col w-64 bg-sidebar text-sidebar-foreground border-e border-sidebar-border shadow-xl z-20">
        {sidebar()}
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="no-print fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Mobile (slides from start side) */}
      <aside className={cn(
        "no-print fixed inset-y-0 start-0 w-64 bg-sidebar text-sidebar-foreground z-50 transform transition-transform duration-300 md:hidden flex flex-col",
        mobileMenuOpen
          ? "translate-x-0"
          : (dir === "rtl" ? "translate-x-full" : "-translate-x-full")
      )}>
        {sidebar(() => setMobileMenuOpen(false))}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="no-print md:hidden bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-primary" />
            <div>
              <span className="font-bold font-display text-slate-800">{t("app.name")}</span>
              {activeRestaurant && (
                <span className="text-xs text-slate-500 ms-2">— {pickName(activeRestaurant)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="mobile" />
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -me-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Scrollable Page Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full max-w-7xl mx-auto">
          {/* Print Document Header */}
          <div className="print-only print-doc-header">
            <div>
              <div className="print-doc-header__title">{t("print.documentTitle", { app: t("app.name"), page: pageTitle })}</div>
              <div className="print-doc-header__sub">
                {activeRestaurant ? pickName(activeRestaurant) : t("print.allRestaurants")}
              </div>
            </div>
            <div className="print-doc-header__meta">
              <div>{t("print.printedOn", { date: new Date().toLocaleDateString(dir === "rtl" ? "ar-SA" : "en-SA", { year: "numeric", month: "long", day: "numeric" }) })}</div>
              <div>{new Date().toLocaleTimeString(dir === "rtl" ? "ar-SA" : "en-SA", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          </div>

          <div className="animate-in fade-in duration-500 slide-in-from-bottom-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
