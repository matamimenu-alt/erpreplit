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
  ChevronDown
} from "lucide-react";
import { useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useRestaurant } from "@/contexts/RestaurantContext";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Sales & Revenue", href: "/sales", icon: Receipt },
  { name: "Purchases", href: "/purchases", icon: ShoppingCart },
  { name: "Suppliers", href: "/suppliers", icon: Building2 },
  { name: "Price Comparison", href: "/supplier-prices", icon: TrendingDown },
  { name: "HR & Employees", href: "/employees", icon: Users },
  { name: "Fixed Expenses", href: "/expenses", icon: FileBarChart },
  { name: "Inventory", href: "/inventory", icon: Warehouse },
  { name: "Food Cost & Pricing", href: "/food-cost", icon: ChefHat },
  { name: "ZATCA VAT Report", href: "/vat-report", icon: Calculator },
  { name: "Financial Reports", href: "/reports", icon: FileBarChart },
];

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
          <UtensilsCrossed className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="truncate">{activeRestaurant.name}</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 opacity-60 flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-sidebar border border-sidebar-border rounded-xl shadow-xl overflow-hidden">
          {restaurants.map((r) => (
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
              <UtensilsCrossed className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { activeRestaurant } = useRestaurant();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-xl z-20">
        <div className="p-6 pb-4 flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-xl text-primary-foreground">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight">Gourmet Ledger</h1>
            <p className="text-xs text-sidebar-foreground/60 font-medium">Saudi Arabia</p>
          </div>
        </div>

        <RestaurantSelector />

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto py-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200",
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
        </nav>
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Mobile */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-sidebar text-sidebar-foreground z-50 transform transition-transform duration-300 md:hidden",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 pb-4 flex items-center gap-3 border-b border-sidebar-border/50">
          <UtensilsCrossed className="w-6 h-6 text-primary" />
          <h1 className="font-display font-bold text-lg">Gourmet Ledger</h1>
        </div>
        <div className="pt-3">
          <RestaurantSelector onSelect={() => setMobileMenuOpen(false)} />
        </div>
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl font-medium",
                  isActive ? "bg-primary text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm z-10">
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
          <div className="animate-in fade-in duration-500 slide-in-from-bottom-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
