import { useState, useEffect } from "react";
import { useGetInventory, useUpsertInventory } from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatSAR } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { Warehouse, Save, Info } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetInventoryQueryKey, getGetPLReportQueryKey } from "@workspace/api-client-react";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function Inventory() {
  const [month, setMonth] = useState(currentMonth());
  const [food, setFood] = useState("");
  const [beverage, setBeverage] = useState("");
  const [general, setGeneral] = useState("");
  const [notes, setNotes] = useState("");

  const queryClient = useQueryClient();

  const { data: inv, isLoading } = useGetInventory({ month });

  // Populate form fields when data loads for the selected month
  useEffect(() => {
    if (inv) {
      setFood(inv.foodInventory > 0 ? String(inv.foodInventory) : "");
      setBeverage(inv.beverageInventory > 0 ? String(inv.beverageInventory) : "");
      setGeneral(inv.generalInventory > 0 ? String(inv.generalInventory) : "");
      setNotes(inv.notes ?? "");
    } else {
      setFood(""); setBeverage(""); setGeneral(""); setNotes("");
    }
  }, [inv, month]);

  const upsert = useUpsertInventory();

  const foodVal = parseFloat(food) || 0;
  const bevVal = parseFloat(beverage) || 0;
  const genVal = parseFloat(general) || 0;
  const totalAdj = foodVal + bevVal + genVal;

  function handleSave() {
    upsert.mutate(
      {
        data: {
          month,
          foodInventory: foodVal,
          beverageInventory: bevVal,
          generalInventory: genVal,
          notes: notes || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey({ month }) });
          queryClient.invalidateQueries({ queryKey: getGetPLReportQueryKey() });
          toast({ title: "Inventory saved", description: `Closing inventory for ${month} saved — P&L updated.` });
          setLoaded(month);
        },
        onError: () => toast({ title: "Error", description: "Failed to save inventory.", variant: "destructive" }),
      }
    );
  }

  const hasData = inv && inv.id > 0;

  return (
    <div>
      <PageHeader
        title="Closing Inventory"
        description="Enter the value of unsold stock at month-end to adjust your actual Cost of Sales."
      />

      {/* Info Banner */}
      <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-blue-800 text-sm">
        <Info className="w-5 h-5 mt-0.5 shrink-0" />
        <div>
          <strong>How it works:</strong> The closing inventory value is <em>subtracted</em> from your monthly purchases to calculate the actual Cost of Goods Sold (COGS).<br />
          <span className="opacity-75">Actual COGS = Purchases − Closing Inventory → Higher inventory = Lower COGS = Better Gross Profit</span>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Month Selector */}
        <div className="bg-card rounded-2xl p-5 border shadow-sm">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Select Month</label>
          <input
            type="month"
            value={month}
            onChange={e => { setMonth(e.target.value); setLoaded(null); }}
            className="px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 w-48"
          />
          {hasData && (
            <span className="ml-3 text-xs text-emerald-600 font-semibold">✓ Inventory record exists for this month</span>
          )}
        </div>

        {/* Inventory Inputs */}
        {isLoading ? (
          <div className="text-slate-400 text-sm p-4">Loading...</div>
        ) : (
          <div className="bg-card rounded-2xl p-5 border shadow-sm space-y-5">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-primary" />
              Closing Inventory Values — {month}
            </h2>

            {/* Food Inventory */}
            <div>
              <label className="block text-sm font-semibold text-orange-700 mb-1">
                Food Closing Inventory (SAR)
                <span className="text-[11px] font-normal text-slate-500 ml-2">خضار / لحوم / أسماك / بهارات / ألبان</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">SAR</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={food}
                  onChange={e => setFood(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-3 py-2 border rounded-xl text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>
              {foodVal > 0 && <p className="text-xs text-orange-600 mt-1">Reduces Food COGS by <strong>{formatSAR(foodVal)}</strong></p>}
            </div>

            {/* Beverage Inventory */}
            <div>
              <label className="block text-sm font-semibold text-blue-700 mb-1">
                Beverage Closing Inventory (SAR)
                <span className="text-[11px] font-normal text-slate-500 ml-2">قهوة / مشروبات / بهارات المشروبات</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">SAR</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={beverage}
                  onChange={e => setBeverage(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              {bevVal > 0 && <p className="text-xs text-blue-600 mt-1">Reduces Beverage COGS by <strong>{formatSAR(bevVal)}</strong></p>}
            </div>

            {/* General Inventory */}
            <div>
              <label className="block text-sm font-semibold text-amber-700 mb-1">
                General / Other Closing Inventory (SAR)
                <span className="text-[11px] font-normal text-slate-500 ml-2">مستهلكات / مستلزمات مطبخ / تنظيف</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">SAR</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={general}
                  onChange={e => setGeneral(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-3 py-2 border rounded-xl text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              {genVal > 0 && <p className="text-xs text-amber-600 mt-1">Reduces General COGS by <strong>{formatSAR(genVal)}</strong></p>}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Stock counted on 30th of month, includes walk-in fridge items..."
                className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-primary resize-none"
              />
            </div>

            {/* Summary */}
            {totalAdj > 0 && (
              <div className="grid grid-cols-3 gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
                <div className="text-center">
                  <p className="text-xs text-slate-500 font-medium">Food Adj.</p>
                  <p className="font-bold text-orange-700">−{formatSAR(foodVal)}</p>
                </div>
                <div className="text-center border-x border-emerald-200">
                  <p className="text-xs text-slate-500 font-medium">Beverage Adj.</p>
                  <p className="font-bold text-blue-700">−{formatSAR(bevVal)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 font-medium">General Adj.</p>
                  <p className="font-bold text-amber-700">−{formatSAR(genVal)}</p>
                </div>
                <div className="col-span-3 border-t border-emerald-200 pt-3 text-center">
                  <p className="text-xs text-slate-500 font-medium">Total COGS Reduction</p>
                  <p className="text-xl font-extrabold text-emerald-700">−{formatSAR(totalAdj)}</p>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end border-t">
              <button
                onClick={handleSave}
                disabled={upsert.isPending}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {upsert.isPending ? "Saving..." : "Save Inventory"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
