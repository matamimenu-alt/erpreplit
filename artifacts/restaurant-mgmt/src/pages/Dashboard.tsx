import { useState } from "react";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatSAR, formatMonth } from "@/lib/format";
import { useLanguage } from "@/i18n/LanguageContext";
import { 
  TrendingUp, 
  Wallet, 
  Receipt, 
  ShoppingBag, 
  Users,
  Building
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

export default function Dashboard() {
  const [month, setMonth] = useState("");
  const { data: summary, isLoading } = useGetDashboardSummary(month ? { month } : undefined);
  const { t } = useLanguage();

  if (isLoading) {
    return <div className="flex h-[50vh] items-center justify-center">{t("dashboard.loading")}</div>;
  }

  const kpis = [
    { 
      label: t("dashboard.kpi.netProfit"),
      value: summary?.netProfit, 
      icon: Wallet,
      color: summary && summary.netProfit >= 0 ? "text-emerald-600 bg-emerald-100" : "text-rose-600 bg-rose-100"
    },
    { 
      label: t("dashboard.kpi.totalSales"),
      value: summary?.totalSales, 
      icon: TrendingUp,
      color: "text-blue-600 bg-blue-100"
    },
    { 
      label: t("dashboard.kpi.effectivePurchases"),
      value: summary?.effectivePurchases ?? summary?.totalPurchases, 
      icon: ShoppingBag,
      color: "text-orange-600 bg-orange-100"
    },
    { 
      label: t("dashboard.kpi.vatPayable"),
      value: summary?.vatPayable, 
      icon: Receipt,
      color: "text-purple-600 bg-purple-100"
    },
  ];

  const salesBreakdown = [
    { name: t("dashboard.charts.netSales"),  value: summary?.totalNetSales || summary?.totalFoodSales || 0 },
    { name: t("dashboard.charts.outputVat"), value: summary?.vatPayable || 0 },
  ];

  const expensesBreakdown = [
    { name: t("dashboard.charts.purchases"),     value: summary?.effectivePurchases ?? summary?.totalPurchases ?? 0 },
    { name: t("dashboard.charts.salaries"),      value: summary?.totalSalaries || 0 },
    { name: t("dashboard.charts.fixedExpenses"), value: summary?.totalFixedExpenses || 0 },
    { name: t("dashboard.charts.vatPayable"),    value: Math.max(0, summary?.vatPayable || 0) },
  ];

  const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6'];

  return (
    <div>
      <PageHeader 
        title={t("pages.dashboardTitle")}
        description={t("dashboard.overviewFor", { month: formatMonth(month) })}
        action={
          <div className="flex gap-2 items-center">
            <input 
              type="month" 
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="no-print px-4 py-2 border rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
            <PrintButton />
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-card rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{kpi.label}</p>
                <h3 className="text-2xl font-bold text-slate-900">{formatSAR(kpi.value)}</h3>
              </div>
              <div className={`p-3 rounded-xl ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Expenses Breakdown Chart */}
        <div className="lg:col-span-2 bg-card rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">{t("dashboard.charts.costDistribution")}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expensesBreakdown} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" tickFormatter={(val) => `SAR ${val / 1000}k`} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={110} />
                <Tooltip 
                  formatter={(value: number) => formatSAR(value)}
                  cursor={{fill: '#F1F5F9'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#2563EB" radius={[0, 4, 4, 0]}>
                  {expensesBreakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales Mix */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">{t("dashboard.charts.salesMix")}</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={salesBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#2563EB" />
                  <Cell fill="#10B981" />
                </Pie>
                <Tooltip formatter={(value: number) => formatSAR(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-600"></div>
              <span className="text-sm text-slate-600">{t("dashboard.charts.food")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-sm text-slate-600">{t("dashboard.charts.beverage")}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Secondary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="bg-slate-100 p-4 rounded-xl text-slate-600">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <p className="text-slate-500 font-medium">{t("dashboard.kpi.totalSalaries")}</p>
            <p className="text-2xl font-bold text-slate-900">{formatSAR(summary?.totalSalaries)}</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="bg-slate-100 p-4 rounded-xl text-slate-600">
            <Building className="w-8 h-8" />
          </div>
          <div>
            <p className="text-slate-500 font-medium">{t("dashboard.kpi.fixedMonthly")}</p>
            <p className="text-2xl font-bold text-slate-900">{formatSAR(summary?.totalFixedExpenses)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
