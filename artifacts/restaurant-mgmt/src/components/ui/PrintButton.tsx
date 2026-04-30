import { Printer } from "lucide-react";

interface PrintButtonProps {
  label?: string;
}

export function PrintButton({ label = "Print" }: PrintButtonProps) {
  return (
    <button
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-colors"
    >
      <Printer className="w-4 h-4" />
      {label}
    </button>
  );
}
