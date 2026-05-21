/**
 * Expenses Management — unified module replacing "Fixed Expenses" + "Expense Ledger".
 *
 * Tabs:
 *   • Recurring Items   → fixed_cost_templates + monthly overrides (Fixed nature)
 *   • Transactions      → expense_transactions (one-off entries, any nature)
 *   • Categories Audit  → category mapping + reconciliation (from /api/diagnostics/reporting)
 *
 * Both data sources flow into the same downstream consumers:
 *   - lib/vat-engine.ts  → Output/Input VAT (single source of truth)
 *   - reports.ts /pl     → VAT-exclusive net profit (VAT excluded — see rule #1, #8)
 *   - dashboard.ts       → unified totals
 */
import { useState } from "react";
import { useLocation } from "wouter";
import Expenses from "@/pages/Expenses";
import ExpenseLedger from "@/pages/ExpenseLedger";
import { Calendar, Receipt, ScrollText } from "lucide-react";

type Tab = "recurring" | "transactions";

// Deep-link preservation: legacy /expense-ledger bookmarks must land on the
// Transactions tab; /expenses (old Fixed Expenses) and /expenses-management
// land on Recurring Items.
function initialTabFromPath(path: string): Tab {
  if (path.startsWith("/expense-ledger")) return "transactions";
  return "recurring";
}

const TABS: Array<{ id: Tab; label: string; arabic: string; icon: typeof Calendar; hint: string }> = [
  { id: "recurring",    label: "Recurring Items",   arabic: "المصروفات المتكررة", icon: Calendar,
    hint: "Fixed monthly definitions (rent, utilities, salaries, subscriptions, …) with per-month overrides." },
  { id: "transactions", label: "Transactions",      arabic: "حركات المصروفات",    icon: Receipt,
    hint: "One-off operating-expense entries (cleaning, marketing, gov fees, services, …). Auto-generated rows from recurring items appear here too." },
];

export default function ExpensesManagement() {
  const [location] = useLocation();
  const [tab, setTab] = useState<Tab>(() => initialTabFromPath(location));

  return (
    <div className="space-y-4">
      {/* Module header */}
      <div className="bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-slate-900 text-white p-2.5 flex-shrink-0">
            <ScrollText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-slate-900">Expenses Management</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              إدارة المصروفات الموحّدة — الثابتة والمتغيرة في مكان واحد. كل بند يدعم نوع الضريبة
              (شامل / غير شامل / معفى) ويرتبط مباشرةً بشجرة الحسابات.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              VAT is reported separately in the Zakat &amp; VAT module — it never affects Net Profit.
            </p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 " +
                  (active
                    ? "bg-white text-slate-900 border-slate-900"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60 border-transparent")
                }
                data-testid={`tab-${t.id}`}
              >
                <Icon className="w-4 h-4" />
                <div className="flex flex-col items-center leading-tight">
                  <span>{t.label}</span>
                  <span className="text-[10px] text-slate-500 font-normal">{t.arabic}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="px-5 py-2 text-xs text-slate-500 border-b border-slate-100 bg-white">
          {TABS.find(t => t.id === tab)?.hint}
        </div>
        <div className="p-4">
          {tab === "recurring"    && <Expenses />}
          {tab === "transactions" && <ExpenseLedger />}
        </div>
      </div>
    </div>
  );
}
