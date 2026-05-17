import { useState } from "react";
import {
  LayoutGrid, TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Users, Building2, Trophy, AlertTriangle, ChevronRight, Store,
  ArrowUpRight, ArrowDownRight, Filter, Calendar, BarChart3, Crown
} from "lucide-react";
import { useGetGroupSummary, useListRestaurants } from "@workspace/api-client-react";
import type { BranchKpi } from "@workspace/api-client-react";

function formatSAR(v: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function KpiCard({
  label, value, sub, icon: Icon, color, trend,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className={`bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${trend === "up" ? "text-emerald-600" : trend === "down" ? "text-rose-500" : "text-slate-400"}`}>
            {trend === "up" ? <ArrowUpRight className="w-3.5 h-3.5" /> : trend === "down" ? <ArrowDownRight className="w-3.5 h-3.5" /> : null}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800 leading-none mb-1">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function BranchRow({ branch, rank }: { branch: BranchKpi; rank: number }) {
  const profitMargin = branch.revenue > 0 ? (branch.profit / branch.revenue) * 100 : 0;
  const isProfit = branch.profit >= 0;

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
            rank === 1 ? "bg-amber-100 text-amber-700" :
            rank === 2 ? "bg-slate-100 text-slate-600" :
            rank === 3 ? "bg-orange-100 text-orange-600" :
            "bg-slate-50 text-slate-400"
          }`}>
            {rank === 1 ? <Trophy className="w-3.5 h-3.5" /> : rank}
          </span>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{branch.restaurantName}</p>
            <p className="text-xs text-slate-400">{branch.brandName}{branch.city ? ` · ${branch.city}` : ""}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-slate-700 text-right">{formatSAR(branch.revenue)}</td>
      <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatSAR(branch.purchases)}</td>
      <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatSAR(branch.salaries)}</td>
      <td className="px-4 py-3 text-right">
        <span className={`font-bold text-sm ${isProfit ? "text-emerald-600" : "text-rose-600"}`}>
          {formatSAR(branch.profit)}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isProfit ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}`}>
          {profitMargin.toFixed(1)}%
        </span>
      </td>
    </tr>
  );
}

export default function GroupDashboard() {
  const today = new Date();
  const [month, setMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterCity, setFilterCity] = useState("all");

  const { data: summary, isLoading } = useGetGroupSummary({ month });
  const { data: restaurants = [] } = useListRestaurants({ includeArchived: "false" } as Parameters<typeof useListRestaurants>[0]);

  const branches = (summary?.branches ?? []) as BranchKpi[];

  const brands = Array.from(new Set(branches.map(b => b.brandName).filter(Boolean)));
  const cities = Array.from(new Set(branches.map(b => b.city).filter(Boolean)));

  const filtered = branches.filter(b => {
    const matchBrand = filterBrand === "all" || b.brandName === filterBrand;
    const matchCity  = filterCity === "all"  || b.city === filterCity;
    return matchBrand && matchCity;
  });

  const sortedByProfit = [...filtered].sort((a, b) => b.profit - a.profit);

  const filteredRevenue  = filtered.reduce((s, b) => s + b.revenue, 0);
  const filteredExpenses = filtered.reduce((s, b) => s + b.purchases + b.salaries + b.fixedExpenses + b.vatPayable, 0);
  const filteredProfit   = filtered.reduce((s, b) => s + b.profit, 0);
  const isGroupProfit    = filteredProfit >= 0;

  const best  = sortedByProfit[0] ?? null;
  const worst = sortedByProfit[sortedByProfit.length - 1] ?? null;

  const activeBranches = (restaurants as { status: string }[]).filter(r => r.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <LayoutGrid className="w-7 h-7 text-primary" />
            Group Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            لوحة تحكم المجموعة — Consolidated view across all branches · {activeBranches} active branches
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="text-sm outline-none bg-transparent text-slate-700 font-medium"
            />
          </div>
          {brands.length > 1 && (
            <select
              value={filterBrand}
              onChange={e => setFilterBrand(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none bg-white text-slate-700"
            >
              <option value="all">All Brands</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          {cities.length > 1 && (
            <select
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none bg-white text-slate-700"
            >
              <option value="all">All Cities</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border h-28 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : (
        <>
          {/* Group KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Group Revenue"
              value={formatSAR(filteredRevenue)}
              sub="إجمالي إيرادات المجموعة"
              icon={DollarSign}
              color="bg-emerald-100 text-emerald-600"
              trend={filteredRevenue > 0 ? "up" : "neutral"}
            />
            <KpiCard
              label="Total Group Expenses"
              value={formatSAR(filteredExpenses)}
              sub="إجمالي مصاريف المجموعة"
              icon={ShoppingCart}
              color="bg-rose-100 text-rose-600"
              trend="neutral"
            />
            <KpiCard
              label="Net Group Profit"
              value={formatSAR(filteredProfit)}
              sub={`${filteredRevenue > 0 ? ((filteredProfit / filteredRevenue) * 100).toFixed(1) : "0.0"}% margin`}
              icon={isGroupProfit ? TrendingUp : TrendingDown}
              color={isGroupProfit ? "bg-primary/10 text-primary" : "bg-rose-100 text-rose-600"}
              trend={isGroupProfit ? "up" : "down"}
            />
            <KpiCard
              label="Active Branches"
              value={String(filtered.length)}
              sub={`of ${branches.length} total`}
              icon={Building2}
              color="bg-blue-100 text-blue-600"
              trend="neutral"
            />
          </div>

          {/* Best & Worst Branch */}
          {(best || worst) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {best && (
                <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Best Performing Branch</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <Store className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{best.restaurantName}</p>
                        <p className="text-xs text-slate-500">{best.brandName}{best.city ? ` · ${best.city}` : ""}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-emerald-600">{formatSAR(best.profit)}</p>
                      <p className="text-xs text-slate-400">profit</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                    <div><p className="font-bold text-slate-700">{formatSAR(best.revenue)}</p><p className="text-slate-400">Revenue</p></div>
                    <div><p className="font-bold text-slate-700">{formatSAR(best.purchases)}</p><p className="text-slate-400">Purchases</p></div>
                    <div><p className="font-bold text-emerald-600">{best.revenue > 0 ? ((best.profit / best.revenue) * 100).toFixed(1) : "0.0"}%</p><p className="text-slate-400">Margin</p></div>
                  </div>
                </div>
              )}

              {worst && worst.restaurantId !== best?.restaurantId && (
                <div className="bg-white border border-rose-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-semibold text-rose-600 uppercase tracking-wide">Needs Attention</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                        <Store className="w-5 h-5 text-rose-500" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{worst.restaurantName}</p>
                        <p className="text-xs text-slate-500">{worst.brandName}{worst.city ? ` · ${worst.city}` : ""}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${worst.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatSAR(worst.profit)}</p>
                      <p className="text-xs text-slate-400">profit</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                    <div><p className="font-bold text-slate-700">{formatSAR(worst.revenue)}</p><p className="text-slate-400">Revenue</p></div>
                    <div><p className="font-bold text-slate-700">{formatSAR(worst.purchases)}</p><p className="text-slate-400">Purchases</p></div>
                    <div><p className={`font-bold ${worst.revenue > 0 ? ((worst.profit / worst.revenue) * 100) >= 0 ? "text-emerald-600" : "text-rose-600" : "text-slate-400"}`}>{worst.revenue > 0 ? ((worst.profit / worst.revenue) * 100).toFixed(1) : "0.0"}%</p><p className="text-slate-400">Margin</p></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Branch Performance Table */}
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-slate-800">Branch Performance Ranking</h2>
              </div>
              <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">{filtered.length} branches</span>
            </div>

            {sortedByProfit.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="font-medium">No data for this period</p>
                <p className="text-sm">Enter sales and expenses data for branches to see the comparison</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-b bg-slate-50/50">
                      <th className="px-4 py-3 text-left">Branch</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                      <th className="px-4 py-3 text-right">Purchases</th>
                      <th className="px-4 py-3 text-right">Salaries</th>
                      <th className="px-4 py-3 text-right">Net Profit</th>
                      <th className="px-4 py-3 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedByProfit.map((b, i) => (
                      <BranchRow key={b.restaurantId} branch={b} rank={i + 1} />
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                    <tr>
                      <td className="px-4 py-3 font-bold text-slate-700 text-sm">Group Total</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700 text-sm">{formatSAR(filteredRevenue)}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-600 text-sm">{formatSAR(filtered.reduce((s, b) => s + b.purchases, 0))}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-600 text-sm">{formatSAR(filtered.reduce((s, b) => s + b.salaries, 0))}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold text-sm ${isGroupProfit ? "text-emerald-600" : "text-rose-600"}`}>{formatSAR(filteredProfit)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isGroupProfit ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}`}>
                          {filteredRevenue > 0 ? ((filteredProfit / filteredRevenue) * 100).toFixed(1) : "0.0"}%
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* No data notice */}
          {sortedByProfit.length === 0 && branches.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-700 text-sm">No financial data for {month}</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Enter sales records and expense data for your branches in the Sales, Purchases, and Expenses pages to see the consolidated group view.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
