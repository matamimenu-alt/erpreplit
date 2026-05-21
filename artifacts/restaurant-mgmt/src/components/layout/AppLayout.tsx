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
  Settings,
  Store,
  Crown,
} from "lucide-react";
import { useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useRestaurant } from "@/contexts/RestaurantContext";

const PAGE_TITLES: Record<string, string> = {
  "/": "Financial Dashboard",
  "/group-dashboard": "Group Dashboard",
  "/branches": "Branch Management",
  "/sales": "Sales & Revenue",
  "/purchases": "Purchases",
  "/suppliers": "Suppliers",
  "/supplier-prices": "Price Comparison",
  "/employees": "HR & Employees",
  "/expenses-management": "Expenses Management",
  "/expenses": "Expenses Management",
  "/expense-ledger": "Expenses Management",
  "/inventory": "Inventory",
  "/food-cost": "Food Cost & Pricing",
  "/vat-report": "Zakat & VAT",
  "/reports": "Financial Reports",
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const groupNavItems = [
  { name: "Group Dashboard", href: "/group-dashboard", icon: LayoutGrid },
  { name: "Branch Management", href: "/branches", icon: Building2 },
];

const branchNavItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Sales & Revenue", href: "/sales", icon: Receipt },
  { name: "Purchases", href: "/purchases", icon: ShoppingCart },
  { name: "Suppliers", href: "/suppliers", icon: Building2 },
  { name: "Price Comparison", href: "/supplier-prices", icon: TrendingDown },
  { name: "HR & Employees", href: "/employees", icon: Users },
  { name: "Expenses Management", href: "/expenses-management", icon: FileBarChart },
  { name: "Inventory", href: "/inventory", icon: Warehouse },
  { name: "Food Cost & Pricing", href: "/food-cost", icon: ChefHat },
  { name: "Zakat & VAT", href: "/vat-report", icon: Calculator },
  { name: "Financial Reports", href: "/reports", icon: FileBarChart },
];

const STATUS_DOT: Record<string, string> = {
  active:   "bg-emerald-400",
  inactive: "bg-amber-400",
  archived: "bg-slate-400",
};

function RestaurantSelector({ onSelect }: { onSelect?: () => void }) {
  const { restaurants, activeRestaurant, setActiveRestaurantId, isLoading } = useRestaurant();
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
          <span className="truncate">{activeRestaurant.name}</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 opacity-60 flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-sidebar border border-sidebar-border rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-sidebar-border/50">
            <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">Active Branches</p>
          </div>
          {restaurants.length === 0 ? (
            <div className="px-3 py-2 text-xs text-sidebar-foreground/50">No active branches</div>
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
                  "w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors text-left",
                  r.id === activeRestaurant.id
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <div className="relative flex-shrink-0">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate">{r.name}</p>
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
  return (
    <div className="mb-2">
      <p className="px-4 py-1 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">{title}</p>
      {items.map((item) => {
        const isActive = location === item.href;
        return (
          <Link 
            key={item.name} 
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
            {item.name}
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
  const pageTitle = PAGE_TITLES[location] ?? "Report";

  const sidebar = (onLinkClick?: () => void) => (
    <>
      <div className="p-6 pb-4 flex items-center gap-3">
        <div className="bg-primary/20 p-2 rounded-xl text-primary-foreground">
          <UtensilsCrossed className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-display font-bold text-lg leading-tight">Gourmet Ledger</h1>
          <p className="text-xs text-sidebar-foreground/60 font-medium">Saudi Arabia · Multi-Branch</p>
        </div>
      </div>

      <RestaurantSelector onSelect={onLinkClick} />

      <nav className="flex-1 px-3 overflow-y-auto py-1 space-y-0.5">
        <NavSection title="Group" items={groupNavItems} location={location} onLinkClick={onLinkClick} />
        <NavSection title="Branch Operations" items={branchNavItems} location={location} onLinkClick={onLinkClick} />
      </nav>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="no-print hidden md:flex flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-xl z-20">
        {sidebar()}
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="no-print fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Mobile */}
      <aside className={cn(
        "no-print fixed inset-y-0 left-0 w-64 bg-sidebar text-sidebar-foreground z-50 transform transition-transform duration-300 md:hidden flex flex-col",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
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
              <span className="font-bold font-display text-slate-800">Gourmet Ledger</span>
              {activeRestaurant && (
                <span className="text-xs text-slate-500 ml-2">— {activeRestaurant.name}</span>
              )}
            </div>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -mr-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Scrollable Page Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full max-w-7xl mx-auto">
          {/* Print Document Header */}
          <div className="print-only print-doc-header">
            <div>
              <div className="print-doc-header__title">Gourmet Ledger — {pageTitle}</div>
              <div className="print-doc-header__sub">
                {activeRestaurant?.name ?? "All Restaurants"}
              </div>
            </div>
            <div className="print-doc-header__meta">
              <div>Printed: {new Date().toLocaleDateString("en-SA", { year: "numeric", month: "long", day: "numeric" })}</div>
              <div>{new Date().toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })}</div>
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
