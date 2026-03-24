import { useState } from "react";
import { useGetVatReport } from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatSAR, formatMonth } from "@/lib/format";
import { Calculator, ShieldCheck } from "lucide-react";

export default function VatReport() {
  const [month, setMonth] = useState("");
  const { data: report, isLoading } = useGetVatReport(month ? { month } : undefined);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader 
        title="ZATCA VAT Report" 
        description="Automated 15% VAT calculation for tax filing."
        action={
          <input 
            type="month" 
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-4 py-2 border rounded-xl shadow-sm focus:ring-primary/20 outline-none"
          />
        }
      />

      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Calculator className="w-48 h-48" />
        </div>
        
        <div className="relative z-10">
          <p className="text-blue-100 font-medium tracking-wide uppercase text-sm mb-2">NET VAT PAYABLE FOR {formatMonth(month).toUpperCase()}</p>
          <h2 className="text-5xl font-display font-bold">
            {isLoading ? "..." : formatSAR(report?.vatPayable)}
          </h2>
          <div className="mt-8 flex items-center gap-2 bg-white/20 w-fit px-4 py-2 rounded-lg backdrop-blur-md">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-sm font-medium">Compliant with Saudi ZATCA Regulations (15%)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl p-6 border shadow-sm">
          <h3 className="text-lg font-bold border-b pb-4 mb-4">Output VAT (From Sales)</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-slate-600">
              <span>Total Sales (Incl. VAT)</span>
              <span className="font-medium">{formatSAR(report?.totalSales)}</span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold text-slate-900 bg-slate-50 p-3 rounded-lg">
              <span>Output VAT Collected</span>
              <span className="text-emerald-600">{formatSAR(report?.outputVat)}</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-6 border shadow-sm">
          <h3 className="text-lg font-bold border-b pb-4 mb-4">Input VAT (From Purchases)</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-slate-600">
              <span>Total Purchases (Pre-VAT)</span>
              <span className="font-medium">{formatSAR(report?.totalPurchases)}</span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold text-slate-900 bg-slate-50 p-3 rounded-lg">
              <span>Input VAT Paid</span>
              <span className="text-rose-600">{formatSAR(report?.inputVat)}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 text-center text-sm text-slate-500">
        Formula: <span className="font-mono bg-slate-100 px-2 py-1 rounded">VAT Payable = Output VAT - Input VAT</span>
      </div>
    </div>
  );
}
