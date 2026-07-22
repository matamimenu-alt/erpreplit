import { Link } from "wouter";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  BarChart3, Building2, Wallet, PieChart,
  Truck, Scale, FileBarChart,
} from "lucide-react";

const REPORT_CARDS = [
  { key: "salesComparison",    href: "/reports/sales-comparison",    icon: BarChart3, color: "bg-blue-50 border-blue-200 text-blue-700" },
  { key: "restaurantPerf",     href: "/reports/restaurant-performance", icon: Building2, color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  { key: "financialReport",    href: "/reports/financial",           icon: Wallet,    color: "bg-purple-50 border-purple-200 text-purple-700" },
  { key: "consolidatedReport", href: "/reports/consolidated",       icon: PieChart,  color: "bg-amber-50 border-amber-200 text-amber-700" },
  { key: "supplierReport",     href: "/reports/supplier-purchases",  icon: Truck,     color: "bg-rose-50 border-rose-200 text-rose-700" },
  { key: "priceComparison",    href: "/reports/price-comparison",    icon: Scale,     color: "bg-cyan-50 border-cyan-200 text-cyan-700" },
  { key: "plReport",           href: "/reports/pl",                  icon: FileBarChart, color: "bg-slate-50 border-slate-200 text-slate-700" },
];

export default function ReportsHub() {
  const { t } = useLanguage();

  return (
    <div>
      <PageHeader
        title={t("reportsHub.title")}
        description={t("reportsHub.description")}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {REPORT_CARDS.map(card => (
          <Link key={card.key} href={card.href}>
            <div className={`rounded-2xl border-2 p-6 transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer ${card.color}`}>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-white/60 shadow-sm">
                  <card.icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg mb-1">{t(`reportsHub.cards.${card.key}.title`)}</h3>
                  <p className="text-sm opacity-70 leading-relaxed">{t(`reportsHub.cards.${card.key}.desc`)}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
