import { PageHeader } from "@/components/ui/PageHeader";
import { Download, FileText, PieChart, Users, Building2, TrendingDown } from "lucide-react";

export default function Reports() {
  const reports = [
    { title: "Monthly P&L Statement", desc: "Comprehensive Profit & Loss view.", icon: PieChart },
    { title: "ZATCA VAT Export", desc: "Detailed breakdown for tax filing.", icon: FileText },
    { title: "Employee Cost Analysis", desc: "HR costs distributed by month.", icon: Users },
    { title: "Expense Ledger", desc: "All fixed and variable expenses.", icon: Building2 },
    { title: "Supplier Price Changes", desc: "Historical price trend report.", icon: TrendingDown },
  ];

  return (
    <div>
      <PageHeader 
        title="Financial Reports" 
        description="Export and download detailed PDF/Excel reports."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((r, i) => (
          <div key={i} className="bg-card rounded-2xl p-6 shadow-sm border hover:border-primary/50 transition-colors group cursor-pointer">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
              <r.icon className="w-6 h-6 text-slate-600 group-hover:text-primary transition-colors" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-2">{r.title}</h3>
            <p className="text-slate-500 text-sm mb-6">{r.desc}</p>
            
            <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-primary transition-colors">
              <Download className="w-4 h-4" /> Download Report
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
