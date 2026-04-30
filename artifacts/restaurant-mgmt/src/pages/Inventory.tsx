import { useState, useEffect, useMemo } from "react";
import {
  useListStockItems, useListStockMovements, useCreateStockMovement, useDeleteStockMovement,
  useListBranchTransfers, useCreateBranchTransfer, useDeleteBranchTransfer, useGetStockReport,
  useListRestaurants, useGetInventory, useUpsertInventory,
  getListStockItemsQueryKey, getListStockMovementsQueryKey, getGetStockReportQueryKey,
  getListBranchTransfersQueryKey, getGetInventoryQueryKey, getGetPLReportQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatSAR } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { exportToExcel } from "@/lib/export-excel";
import { PURCHASE_CATEGORY_GROUPS, CATEGORY_LABELS } from "@/lib/categories";
import {
  Warehouse, Plus, Trash2, FileSpreadsheet, ArrowLeftRight, BarChart3,
  Package, TrendingDown, RefreshCcw, Search, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const UNITS = ["unit", "kg", "g", "liter", "ml", "piece", "box", "carton", "bottle", "can", "pack", "sack", "bag"];

const MOVEMENT_COLORS: Record<string, string> = {
  purchase: "bg-green-100 text-green-800",
  opening: "bg-blue-100 text-blue-800",
  consumption: "bg-red-100 text-red-800",
  "transfer-in": "bg-teal-100 text-teal-800",
  "transfer-out": "bg-orange-100 text-orange-800",
  adjustment: "bg-purple-100 text-purple-800",
};

const MOVEMENT_LABELS: Record<string, string> = {
  purchase: "Purchase",
  opening: "Opening Balance",
  consumption: "Consumption",
  "transfer-in": "Transfer In",
  "transfer-out": "Transfer Out",
  adjustment: "Adjustment",
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function getCategoryBadge(cat: string) {
  for (const g of PURCHASE_CATEGORY_GROUPS) {
    if (g.subcategories.some(c => c.value === cat)) return g.badge;
  }
  return "bg-gray-100 text-gray-700";
}

function getCategoryLabel(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat;
}

export default function Inventory() {
  const queryClient = useQueryClient();

  // ─── Stock Levels ───────────────────────────────────────────────────
  const [catFilter, setCatFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const { data: stockItems = [], isLoading: loadingItems } = useListStockItems({});

  const filteredItems = useMemo(() => {
    let items = stockItems;
    if (catFilter !== "all") {
      const group = PURCHASE_CATEGORY_GROUPS.find(g => g.color === catFilter);
      if (group) {
        const vals = new Set(group.categories.map(c => c.value));
        items = items.filter(i => vals.has(i.category));
      }
    }
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      items = items.filter(i => i.itemName.toLowerCase().includes(q));
    }
    return items;
  }, [stockItems, catFilter, searchFilter]);

  // ─── Movements ───────────────────────────────────────────────────────
  const [movFilter, setMovFilter] = useState("");
  const [movTypeFilter, setMovTypeFilter] = useState("all");
  const [movDateFrom, setMovDateFrom] = useState("");
  const [movDateTo, setMovDateTo] = useState("");
  const { data: movements = [], isLoading: loadingMovements } = useListStockMovements({});
  const createMovement = useCreateStockMovement();
  const deleteMovement = useDeleteStockMovement();

  const [movForm, setMovForm] = useState({
    itemName: "", category: "", unit: "kg", movementType: "consumption",
    quantity: "", unitPrice: "", movementDate: today(), notes: "",
  });

  const filteredMovements = useMemo(() => {
    let ms = movements;
    if (movTypeFilter !== "all") ms = ms.filter(m => m.movementType === movTypeFilter);
    if (movFilter) ms = ms.filter(m => m.itemName.toLowerCase().includes(movFilter.toLowerCase()));
    if (movDateFrom) ms = ms.filter(m => m.movementDate >= movDateFrom);
    if (movDateTo) ms = ms.filter(m => m.movementDate <= movDateTo);
    return ms;
  }, [movements, movTypeFilter, movFilter, movDateFrom, movDateTo]);

  // Existing items for autocomplete
  const existingItemNames = useMemo(() =>
    [...new Set(stockItems.map(i => i.itemName))].sort(), [stockItems]);

  const handleAddMovement = async () => {
    const { itemName, category, unit, movementType, quantity, unitPrice, movementDate, notes } = movForm;
    if (!itemName || !category || !movementDate || !quantity) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Quantity must be greater than zero", variant: "destructive" }); return;
    }
    // Client-side negative stock check for consumption
    if (movementType === "consumption") {
      const match = stockItems.find(i => i.itemName === itemName && i.category === category);
      if (match && qty > match.currentQuantity + 0.001) {
        toast({
          title: `Insufficient stock`,
          description: `Available: ${match.currentQuantity.toFixed(3)} ${match.unit}, requested: ${qty.toFixed(3)}`,
          variant: "destructive",
        });
        return;
      }
    }
    const price = parseFloat(unitPrice) || 0;
    let finalType = movementType;
    let finalQty = qty;
    if (movementType === "adjustment-decrease") { finalType = "adjustment"; finalQty = -qty; }
    if (movementType === "adjustment-increase") { finalType = "adjustment"; }
    try {
      await createMovement.mutateAsync({
        data: { itemName, category, unit, movementType: finalType, quantity: finalQty, unitPrice: price, movementDate, notes: notes || undefined },
      });
      toast({ title: "Movement recorded successfully" });
      setMovForm(prev => ({ ...prev, itemName: "", quantity: "", unitPrice: "", notes: "" }));
      queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey({}) });
      queryClient.invalidateQueries({ queryKey: getListStockMovementsQueryKey({}) });
      queryClient.invalidateQueries({ queryKey: getGetStockReportQueryKey({ month: currentMonth() }) });
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      const msg = e.data?.error || e.message || "Failed to add movement";
      toast({ title: msg, variant: "destructive" });
    }
  };

  const handleDeleteMovement = async (id: number, type: string) => {
    if (type === "purchase") {
      toast({ title: "Purchase movements are managed via the Purchases page", variant: "destructive" }); return;
    }
    if (type === "transfer-in" || type === "transfer-out") {
      toast({ title: "Transfer movements are managed via the Transfers tab", variant: "destructive" }); return;
    }
    try {
      await deleteMovement.mutateAsync({ id });
      toast({ title: "Movement deleted" });
      queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey({}) });
      queryClient.invalidateQueries({ queryKey: getListStockMovementsQueryKey({}) });
    } catch {
      toast({ title: "Failed to delete movement", variant: "destructive" });
    }
  };

  // ─── Transfers ───────────────────────────────────────────────────────
  const { data: allRestaurants = [] } = useListRestaurants();
  const { data: transfers = [], isLoading: loadingTransfers } = useListBranchTransfers({});
  const createTransfer = useCreateBranchTransfer();
  const deleteTransfer = useDeleteBranchTransfer();

  // Destination type: "branch" = restaurant dropdown, "custom" = free-text location
  const [txDestType, setTxDestType] = useState<"branch" | "custom">("branch");
  const [txForm, setTxForm] = useState({
    fromRestaurantId: "", toRestaurantId: "", customDestination: "", itemName: "", category: "",
    unit: "kg", quantity: "", unitPrice: "", referenceNumber: "", transferDate: today(), notes: "",
  });

  // Auto-fill unit price from WAC when item is selected in transfer form
  useEffect(() => {
    if (txForm.itemName && txForm.category) {
      const match = stockItems.find(i => i.itemName === txForm.itemName && i.category === txForm.category);
      if (match) {
        setTxForm(prev => ({ ...prev, unit: match.unit, unitPrice: match.avgCost.toFixed(2) }));
      }
    }
  }, [txForm.itemName, txForm.category, stockItems]);

  // Available qty for transfer item
  const txAvailableQty = useMemo(() => {
    if (!txForm.itemName || !txForm.category) return null;
    const match = stockItems.find(i => i.itemName === txForm.itemName && i.category === txForm.category);
    return match ? match.currentQuantity : null;
  }, [txForm.itemName, txForm.category, stockItems]);

  const handleAddTransfer = async () => {
    const { fromRestaurantId, toRestaurantId, customDestination, itemName, category, unit, quantity, unitPrice, referenceNumber, transferDate, notes } = txForm;
    if (!fromRestaurantId || !itemName || !category || !quantity || !transferDate) {
      toast({ title: "Please fill all required fields", variant: "destructive" }); return;
    }
    if (txDestType === "branch" && !toRestaurantId) {
      toast({ title: "Please select the destination branch", variant: "destructive" }); return;
    }
    if (txDestType === "custom" && !customDestination.trim()) {
      toast({ title: "Please enter the destination location name", variant: "destructive" }); return;
    }
    if (txDestType === "branch" && fromRestaurantId === toRestaurantId) {
      toast({ title: "Source and destination branch cannot be the same", variant: "destructive" }); return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Quantity must be greater than zero", variant: "destructive" }); return;
    }
    // For internal branch transfers, unit price is required (used in P&L COGS calculation)
    if (txDestType === "branch") {
      const price = parseFloat(unitPrice);
      if (!price || price <= 0) {
        toast({
          title: "Unit price required for branch transfers",
          description: "The cost price is needed to calculate Cost of Sales (COGS) in each branch's P&L. The WAC is auto-filled when you select an item.",
          variant: "destructive",
        });
        return;
      }
    }
    // Client-side negative stock check
    if (txAvailableQty !== null && qty > txAvailableQty + 0.001) {
      toast({
        title: "Insufficient stock",
        description: `Available: ${txAvailableQty.toFixed(3)} ${unit}, requested: ${qty.toFixed(3)}`,
        variant: "destructive",
      });
      return;
    }
    try {
      await createTransfer.mutateAsync({
        data: {
          fromRestaurantId: parseInt(fromRestaurantId),
          toRestaurantId: txDestType === "branch" ? parseInt(toRestaurantId) : undefined,
          destinationName: txDestType === "custom" ? customDestination.trim() : undefined,
          itemName, category, unit, quantity: qty, unitPrice: parseFloat(unitPrice) || 0,
          referenceNumber: referenceNumber || undefined, transferDate, notes: notes || undefined,
        },
      });
      toast({ title: "Transfer created successfully" });
      setTxForm(prev => ({ ...prev, itemName: "", category: "", quantity: "", unitPrice: "", referenceNumber: "", notes: "" }));
      queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey({}) });
      queryClient.invalidateQueries({ queryKey: getListStockMovementsQueryKey({}) });
      queryClient.invalidateQueries({ queryKey: getListBranchTransfersQueryKey({}) });
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      const msg = e.data?.error || e.message || "Failed to create transfer";
      toast({ title: msg, variant: "destructive" });
    }
  };

  const handleDeleteTransfer = async (id: number) => {
    try {
      await deleteTransfer.mutateAsync({ id });
      toast({ title: "Transfer deleted" });
      queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey({}) });
      queryClient.invalidateQueries({ queryKey: getListStockMovementsQueryKey({}) });
      queryClient.invalidateQueries({ queryKey: getListBranchTransfersQueryKey({}) });
    } catch {
      toast({ title: "Failed to delete transfer", variant: "destructive" });
    }
  };

  // ─── Monthly Report ──────────────────────────────────────────────────
  const [reportMonth, setReportMonth] = useState(currentMonth());
  const [reportCat, setReportCat] = useState("all");
  const { data: stockReport, isLoading: loadingReport } = useGetStockReport({ month: reportMonth });

  const reportItems = useMemo(() => {
    if (!stockReport) return [];
    let items = stockReport.items;
    if (reportCat !== "all") {
      const group = PURCHASE_CATEGORY_GROUPS.find(g => g.color === reportCat);
      if (group) {
        const vals = new Set(group.categories.map(c => c.value));
        items = items.filter(i => vals.has(i.category));
      }
    }
    return items;
  }, [stockReport, reportCat]);

  const handleExportStock = () => {
    const rows = filteredItems.map(i => ({
      "Item Name": i.itemName,
      "Category": getCategoryLabel(i.category),
      "Unit": i.unit,
      "Opening Qty": i.openingQuantity,
      "Purchases Qty": i.purchasesQuantity,
      "Consumption Qty": i.consumptionQuantity,
      "Transfer In": i.transferInQuantity,
      "Transfer Out": i.transferOutQuantity,
      "Adjustments": i.adjustmentQuantity,
      "Current Qty": i.currentQuantity,
      "Avg Cost (SAR)": i.avgCost,
      "Value (SAR)": i.currentValue,
    }));
    exportToExcel(rows, `stock-levels-${new Date().toISOString().split("T")[0]}`, "Stock Levels");
  };

  const handleExportReport = () => {
    if (!stockReport) return;
    const rows = reportItems.map(i => ({
      "Item Name": i.itemName,
      "Category": getCategoryLabel(i.category),
      "Unit": i.unit,
      "Opening Qty": i.openingQty,
      "Opening Value (SAR)": i.openingValue,
      "Purchases Qty": i.purchasesQty,
      "Purchases Value (SAR)": i.purchasesValue,
      "Consumption Qty": i.consumptionQty,
      "Consumption Value (SAR)": i.consumptionValue,
      "Transfer In Qty": i.transferInQty,
      "Transfer Out Qty": i.transferOutQty,
      "Adjustment Qty": i.adjustmentQty,
      "Closing Qty": i.closingQty,
      "Closing Value (SAR)": i.closingValue,
    }));
    exportToExcel(rows, `inventory-report-${reportMonth}`, "Monthly Inventory Report");
  };

  // ─── P&L Closing Inventory ───────────────────────────────────────────
  const [plMonth, setPlMonth] = useState(currentMonth());
  const [food, setFood] = useState("");
  const [beverage, setBeverage] = useState("");
  const [general, setGeneral] = useState("");
  const [plNotes, setPlNotes] = useState("");
  const { data: inv } = useGetInventory({ month: plMonth });
  const upsert = useUpsertInventory();

  useEffect(() => {
    if (inv) {
      setFood(inv.foodInventory > 0 ? String(inv.foodInventory) : "");
      setBeverage(inv.beverageInventory > 0 ? String(inv.beverageInventory) : "");
      setGeneral(inv.generalInventory > 0 ? String(inv.generalInventory) : "");
      setPlNotes(inv.notes ?? "");
    } else {
      setFood(""); setBeverage(""); setGeneral(""); setPlNotes("");
    }
  }, [inv, plMonth]);

  const handleSavePL = async () => {
    try {
      await upsert.mutateAsync({
        data: {
          month: plMonth, foodInventory: parseFloat(food) || 0,
          beverageInventory: parseFloat(beverage) || 0,
          generalInventory: parseFloat(general) || 0, notes: plNotes || undefined,
        },
      });
      toast({ title: "Closing inventory saved" });
      queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey({ month: plMonth }) });
      queryClient.invalidateQueries({ queryKey: getGetPLReportQueryKey({ month: plMonth }) });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const closingTotal = (parseFloat(food) || 0) + (parseFloat(beverage) || 0) + (parseFloat(general) || 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Management" description="Track stock levels, movements, and branch transfers" action={<PrintButton />} />

      <Tabs defaultValue="stock-levels">
        <TabsList className="no-print flex flex-wrap gap-1 h-auto mb-4">
          <TabsTrigger value="stock-levels" className="gap-1"><Package className="w-4 h-4" /> Stock Levels</TabsTrigger>
          <TabsTrigger value="movements" className="gap-1"><TrendingDown className="w-4 h-4" /> Movements</TabsTrigger>
          <TabsTrigger value="transfers" className="gap-1"><ArrowLeftRight className="w-4 h-4" /> Transfers</TabsTrigger>
          <TabsTrigger value="report" className="gap-1"><BarChart3 className="w-4 h-4" /> Monthly Report</TabsTrigger>
          <TabsTrigger value="pl-closing" className="gap-1"><RefreshCcw className="w-4 h-4" /> P&L Closing Stock</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: STOCK LEVELS ─────────────────────────────────── */}
        <TabsContent value="stock-levels">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[160px]">
                <Label className="text-xs mb-1 block">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                  <Input className="pl-8" placeholder="Item name..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
                </div>
              </div>
              <div className="min-w-[170px]">
                <Label className="text-xs mb-1 block">Category Group</Label>
                <Select value={catFilter} onValueChange={setCatFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {PURCHASE_CATEGORY_GROUPS.map(g => (
                      <SelectItem key={g.color} value={g.color}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={handleExportStock} className="gap-1">
                <FileSpreadsheet className="w-4 h-4" /> Export Excel
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-2">
              <Card className="p-3">
                <div className="text-xs text-gray-500">Total Items</div>
                <div className="text-2xl font-bold">{filteredItems.length}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-gray-500">Total Stock Value</div>
                <div className="text-lg font-bold text-green-700">{formatSAR(filteredItems.reduce((s, i) => s + i.currentValue, 0))}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-gray-500">Low Stock (≤0)</div>
                <div className="text-2xl font-bold text-red-600">{filteredItems.filter(i => i.currentQuantity <= 0).length}</div>
              </Card>
            </div>

            {loadingItems ? (
              <div className="text-center py-8 text-gray-400">Loading stock data...</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No stock items found. Add purchases or record an opening balance to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="p-3 text-left">Item Name</th>
                      <th className="p-3 text-left">Category</th>
                      <th className="p-3 text-center">Unit</th>
                      <th className="p-3 text-right">Opening</th>
                      <th className="p-3 text-right">Purchases</th>
                      <th className="p-3 text-right">Consumption</th>
                      <th className="p-3 text-right">Transfer In</th>
                      <th className="p-3 text-right">Transfer Out</th>
                      <th className="p-3 text-right">Adjustments</th>
                      <th className="p-3 text-right font-semibold">Current Qty</th>
                      <th className="p-3 text-right">Avg Cost</th>
                      <th className="p-3 text-right">Value (SAR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item, idx) => (
                      <tr key={idx} className={`border-t ${item.currentQuantity <= 0 ? "bg-red-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                        <td className="p-3 font-medium">{item.itemName}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryBadge(item.category)}`}>
                            {getCategoryLabel(item.category)}
                          </span>
                        </td>
                        <td className="p-3 text-center text-gray-500">{item.unit}</td>
                        <td className="p-3 text-right text-gray-600">{item.openingQuantity.toFixed(2)}</td>
                        <td className="p-3 text-right text-green-700 font-medium">{item.purchasesQuantity > 0 ? `+${item.purchasesQuantity.toFixed(2)}` : "—"}</td>
                        <td className="p-3 text-right text-red-600">{item.consumptionQuantity > 0 ? `-${item.consumptionQuantity.toFixed(2)}` : "—"}</td>
                        <td className="p-3 text-right text-teal-600">{item.transferInQuantity > 0 ? `+${item.transferInQuantity.toFixed(2)}` : "—"}</td>
                        <td className="p-3 text-right text-orange-600">{item.transferOutQuantity > 0 ? `-${item.transferOutQuantity.toFixed(2)}` : "—"}</td>
                        <td className="p-3 text-right text-purple-600">{item.adjustmentQuantity !== 0 ? (item.adjustmentQuantity > 0 ? `+${item.adjustmentQuantity.toFixed(2)}` : item.adjustmentQuantity.toFixed(2)) : "—"}</td>
                        <td className={`p-3 text-right font-bold ${item.currentQuantity < 0 ? "text-red-600" : item.currentQuantity === 0 ? "text-gray-400" : "text-gray-900"}`}>
                          {item.currentQuantity.toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-gray-600">{item.avgCost > 0 ? formatSAR(item.avgCost) : "—"}</td>
                        <td className="p-3 text-right font-medium text-blue-700">{formatSAR(item.currentValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-semibold">
                    <tr>
                      <td className="p-3" colSpan={11}>Total Value</td>
                      <td className="p-3 text-right text-blue-700">{formatSAR(filteredItems.reduce((s, i) => s + i.currentValue, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── TAB 2: MOVEMENTS ────────────────────────────────────── */}
        <TabsContent value="movements">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add Movement Form */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> Add Movement</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Movement Type *</Label>
                    <Select value={movForm.movementType} onValueChange={v => setMovForm(p => ({ ...p, movementType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consumption">Consumption / Usage</SelectItem>
                        <SelectItem value="adjustment-increase">Adjustment – Increase (+)</SelectItem>
                        <SelectItem value="adjustment-decrease">Adjustment – Decrease (−)</SelectItem>
                        <SelectItem value="opening">Opening Balance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Item Name *</Label>
                    <Input
                      list="item-suggestions"
                      placeholder="e.g. Chicken Breast"
                      value={movForm.itemName}
                      onChange={e => {
                        const name = e.target.value;
                        setMovForm(p => ({ ...p, itemName: name }));
                        // Auto-fill category and unit from existing stock
                        const match = stockItems.find(i => i.itemName === name);
                        if (match) setMovForm(p => ({ ...p, itemName: name, category: match.category, unit: match.unit }));
                      }}
                    />
                    <datalist id="item-suggestions">
                      {existingItemNames.map(n => <option key={n} value={n} />)}
                    </datalist>
                  </div>
                  <div>
                    <Label className="text-xs">Category *</Label>
                    <Select value={movForm.category} onValueChange={v => setMovForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {PURCHASE_CATEGORY_GROUPS.map(g => (
                          <div key={g.label}>
                            <div className="px-2 pt-2 pb-1 text-xs font-semibold text-gray-500">{g.label}</div>
                            {g.subcategories.map(c => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Unit</Label>
                      <Select value={movForm.unit} onValueChange={v => setMovForm(p => ({ ...p, unit: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Quantity *</Label>
                      <Input type="number" min="0" step="0.001" placeholder="0.000" value={movForm.quantity} onChange={e => setMovForm(p => ({ ...p, quantity: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Unit Price (SAR)</Label>
                    <Input type="number" min="0" step="0.01" placeholder="0.00" value={movForm.unitPrice} onChange={e => setMovForm(p => ({ ...p, unitPrice: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Date *</Label>
                    <Input type="date" value={movForm.movementDate} onChange={e => setMovForm(p => ({ ...p, movementDate: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Input placeholder="Optional notes..." value={movForm.notes} onChange={e => setMovForm(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                  <Button className="w-full" onClick={handleAddMovement} disabled={createMovement.isPending}>
                    <Plus className="w-4 h-4 mr-1" /> {createMovement.isPending ? "Saving..." : "Add Movement"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Movements List */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[130px]">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                    <Input className="pl-8" placeholder="Search item..." value={movFilter} onChange={e => setMovFilter(e.target.value)} />
                  </div>
                </div>
                <Select value={movTypeFilter} onValueChange={setMovTypeFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.entries(MOVEMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="date" className="w-[140px]" placeholder="From" value={movDateFrom} onChange={e => setMovDateFrom(e.target.value)} />
                <Input type="date" className="w-[140px]" placeholder="To" value={movDateTo} onChange={e => setMovDateTo(e.target.value)} />
              </div>

              {loadingMovements ? (
                <div className="text-center py-8 text-gray-400">Loading movements...</div>
              ) : filteredMovements.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No movements found</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="p-2 text-left">Date</th>
                        <th className="p-2 text-left">Type</th>
                        <th className="p-2 text-left">Item</th>
                        <th className="p-2 text-left">Category</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Unit Price</th>
                        <th className="p-2 text-right">Value</th>
                        <th className="p-2 text-left">Notes</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMovements.slice(0, 100).map(m => {
                        const isOut = m.movementType === "consumption" || m.movementType === "transfer-out";
                        const isAdj = m.movementType === "adjustment";
                        const adjNeg = isAdj && m.quantity < 0;
                        return (
                          <tr key={m.id} className="border-t hover:bg-gray-50">
                            <td className="p-2 whitespace-nowrap">{m.movementDate}</td>
                            <td className="p-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MOVEMENT_COLORS[m.movementType] ?? "bg-gray-100 text-gray-700"}`}>
                                {MOVEMENT_LABELS[m.movementType] ?? m.movementType}
                              </span>
                            </td>
                            <td className="p-2 font-medium">{m.itemName}</td>
                            <td className="p-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${getCategoryBadge(m.category)}`}>{getCategoryLabel(m.category)}</span>
                            </td>
                            <td className={`p-2 text-right font-medium ${isOut || adjNeg ? "text-red-600" : "text-green-700"}`}>
                              {isOut ? `−${Math.abs(m.quantity).toFixed(2)}` : adjNeg ? `−${Math.abs(m.quantity).toFixed(2)}` : `+${m.quantity.toFixed(2)}`}
                              <span className="text-gray-400 text-xs ml-1">{m.unit}</span>
                            </td>
                            <td className="p-2 text-right">{m.unitPrice > 0 ? formatSAR(m.unitPrice) : "—"}</td>
                            <td className="p-2 text-right">{m.totalValue > 0 ? formatSAR(Math.abs(m.totalValue)) : "—"}</td>
                            <td className="p-2 text-gray-500 text-xs max-w-[120px] truncate">{m.notes ?? "—"}</td>
                            <td className="p-2">
                              {m.movementType !== "purchase" && m.movementType !== "transfer-in" && m.movementType !== "transfer-out" && (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700"
                                  onClick={() => handleDeleteMovement(m.id, m.movementType)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredMovements.length > 100 && (
                    <div className="p-2 text-center text-xs text-gray-400">Showing 100 of {filteredMovements.length} records — use filters to narrow down</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 3: TRANSFERS ────────────────────────────────────── */}
        <TabsContent value="transfers">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add Transfer Form */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowLeftRight className="w-4 h-4" /> New Transfer</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {/* From Branch */}
                  <div>
                    <Label className="text-xs">From Branch *</Label>
                    <Select value={txForm.fromRestaurantId} onValueChange={v => setTxForm(p => ({ ...p, fromRestaurantId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select source branch" /></SelectTrigger>
                      <SelectContent>{allRestaurants.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  {/* Destination — hybrid: Branch or Custom Location */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">To *</Label>
                      <div className="flex rounded-md border overflow-hidden text-xs">
                        <button
                          type="button"
                          className={`px-2 py-0.5 transition-colors ${txDestType === "branch" ? "bg-amber-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                          onClick={() => setTxDestType("branch")}
                        >Branch</button>
                        <button
                          type="button"
                          className={`px-2 py-0.5 transition-colors ${txDestType === "custom" ? "bg-amber-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                          onClick={() => setTxDestType("custom")}
                        >Location</button>
                      </div>
                    </div>
                    {txDestType === "branch" ? (
                      <Select value={txForm.toRestaurantId} onValueChange={v => setTxForm(p => ({ ...p, toRestaurantId: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select destination branch" /></SelectTrigger>
                        <SelectContent>{allRestaurants.filter(r => String(r.id) !== txForm.fromRestaurantId).map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <>
                        <Input
                          list="tx-dest-suggestions"
                          placeholder="e.g. Kitchen, Warehouse, Bar Storage..."
                          value={txForm.customDestination}
                          onChange={e => setTxForm(p => ({ ...p, customDestination: e.target.value }))}
                        />
                        <datalist id="tx-dest-suggestions">
                          {["Kitchen", "Warehouse", "Cold Storage", "Bar", "Prep Area", "Dry Storage"].map(d => <option key={d} value={d} />)}
                        </datalist>
                      </>
                    )}
                  </div>

                  {/* Item Name */}
                  <div>
                    <Label className="text-xs">Item Name *</Label>
                    <Input list="tx-item-suggestions" placeholder="Search item..." value={txForm.itemName} onChange={e => {
                      const name = e.target.value;
                      const match = stockItems.find(i => i.itemName === name);
                      if (match) setTxForm(p => ({ ...p, itemName: name, category: match.category, unit: match.unit }));
                      else setTxForm(p => ({ ...p, itemName: name }));
                    }} />
                    <datalist id="tx-item-suggestions">{existingItemNames.map(n => <option key={n} value={n} />)}</datalist>
                  </div>

                  {/* Category */}
                  <div>
                    <Label className="text-xs">Category *</Label>
                    <Select value={txForm.category} onValueChange={v => setTxForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {PURCHASE_CATEGORY_GROUPS.map(g => (
                          <div key={g.label}>
                            <div className="px-2 pt-2 pb-1 text-xs font-semibold text-gray-500">{g.label}</div>
                            {g.subcategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Unit + Quantity */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Unit</Label>
                      <Select value={txForm.unit} onValueChange={v => setTxForm(p => ({ ...p, unit: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1">
                        Quantity *
                        {txAvailableQty !== null && (
                          <span className={`text-xs font-normal ${txForm.quantity && parseFloat(txForm.quantity) > txAvailableQty ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                            (avail: {txAvailableQty.toFixed(2)})
                          </span>
                        )}
                      </Label>
                      <Input
                        type="number" min="0" step="0.001" placeholder="0.000"
                        value={txForm.quantity}
                        onChange={e => setTxForm(p => ({ ...p, quantity: e.target.value }))}
                        className={txAvailableQty !== null && txForm.quantity && parseFloat(txForm.quantity) > txAvailableQty ? "border-red-400 focus:ring-red-400" : ""}
                      />
                      {txAvailableQty !== null && txForm.quantity && parseFloat(txForm.quantity) > txAvailableQty && (
                        <p className="text-red-500 text-xs mt-0.5">Exceeds available stock!</p>
                      )}
                    </div>
                  </div>

                  {/* Unit Price — auto-filled from WAC, required for branch transfers */}
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      Unit Price (SAR)
                      {txDestType === "branch" && <span className="text-red-500">*</span>}
                      {txForm.itemName && txForm.category && txForm.unitPrice && (
                        <span className="text-xs text-amber-600 font-normal">(auto-filled from avg cost)</span>
                      )}
                    </Label>
                    <Input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={txForm.unitPrice}
                      onChange={e => setTxForm(p => ({ ...p, unitPrice: e.target.value }))}
                      className={txDestType === "branch" && (!txForm.unitPrice || parseFloat(txForm.unitPrice) <= 0) ? "border-amber-400" : ""}
                    />
                    {txDestType === "branch" && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Required — used to record Cost of Sales in the destination branch's P&amp;L.
                      </p>
                    )}
                    {txForm.unitPrice && txForm.quantity && (
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        Total cost: SAR {(parseFloat(txForm.unitPrice || "0") * parseFloat(txForm.quantity || "0")).toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Date */}
                  <div>
                    <Label className="text-xs">Date *</Label>
                    <Input type="date" value={txForm.transferDate} onChange={e => setTxForm(p => ({ ...p, transferDate: e.target.value }))} />
                  </div>

                  {/* Reference */}
                  <div>
                    <Label className="text-xs">Reference Number</Label>
                    <Input placeholder="e.g. TRF-001" value={txForm.referenceNumber} onChange={e => setTxForm(p => ({ ...p, referenceNumber: e.target.value }))} />
                  </div>

                  {/* Notes */}
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Input placeholder="Optional notes..." value={txForm.notes} onChange={e => setTxForm(p => ({ ...p, notes: e.target.value }))} />
                  </div>

                  <Button className="w-full" onClick={handleAddTransfer} disabled={createTransfer.isPending}>
                    <ArrowLeftRight className="w-4 h-4 mr-1" /> {createTransfer.isPending ? "Processing..." : "Create Transfer"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Transfers List */}
            <div className="lg:col-span-2">
              {loadingTransfers ? (
                <div className="text-center py-8 text-gray-400">Loading transfers...</div>
              ) : transfers.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <ArrowLeftRight className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No transfers recorded yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="p-2 text-left">Date</th>
                        <th className="p-2 text-left">Ref</th>
                        <th className="p-2 text-left">From</th>
                        <th className="p-2 text-left">To</th>
                        <th className="p-2 text-left">Item</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Price</th>
                        <th className="p-2 text-right">Value</th>
                        <th className="p-2 text-left">Notes</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.map(t => {
                        const isBranchTransfer = !!t.toRestaurantId && !t.destinationName;
                        return (
                          <tr key={t.id} className="border-t hover:bg-gray-50">
                            <td className="p-2 whitespace-nowrap">{t.transferDate}</td>
                            <td className="p-2 text-gray-500 text-xs">{t.referenceNumber ?? `#${t.id}`}</td>
                            <td className="p-2">
                              <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-xs">{t.fromRestaurantName}</span>
                            </td>
                            <td className="p-2">
                              <div className="flex flex-col gap-0.5">
                                <span className={`px-2 py-0.5 rounded text-xs w-fit ${isBranchTransfer ? "bg-teal-100 text-teal-800" : "bg-purple-100 text-purple-800"}`}>
                                  {t.toRestaurantName}
                                </span>
                                {isBranchTransfer ? (
                                  <span className="text-xs text-emerald-600 font-medium">✓ Affects P&amp;L</span>
                                ) : (
                                  <span className="text-xs text-gray-400">Free-text location</span>
                                )}
                              </div>
                            </td>
                            <td className="p-2 font-medium">{t.itemName}</td>
                            <td className="p-2 text-right">{t.quantity.toFixed(2)} <span className="text-gray-400 text-xs">{t.unit}</span></td>
                            <td className="p-2 text-right">{t.unitPrice > 0 ? formatSAR(t.unitPrice) : "—"}</td>
                            <td className={`p-2 text-right font-semibold ${isBranchTransfer && t.totalValue > 0 ? "text-rose-700" : ""}`}>{formatSAR(t.totalValue)}</td>
                            <td className="p-2 text-gray-500 text-xs max-w-[100px] truncate">{t.notes ?? "—"}</td>
                            <td className="p-2">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700"
                                onClick={() => handleDeleteTransfer(t.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 4: MONTHLY REPORT ───────────────────────────────── */}
        <TabsContent value="report">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <Label className="text-xs mb-1 block">Month</Label>
                <Input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="w-[160px]" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Category Group</Label>
                <Select value={reportCat} onValueChange={setReportCat}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {PURCHASE_CATEGORY_GROUPS.map(g => <SelectItem key={g.color} value={g.color}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={handleExportReport} disabled={!stockReport} className="gap-1">
                <FileSpreadsheet className="w-4 h-4" /> Export Excel
              </Button>
            </div>

            {stockReport && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="p-3 border-l-4 border-l-blue-500">
                    <div className="text-xs text-gray-500">Opening Stock Value</div>
                    <div className="text-lg font-bold text-blue-700">{formatSAR(stockReport.totalOpeningValue)}</div>
                  </Card>
                  <Card className="p-3 border-l-4 border-l-green-500">
                    <div className="text-xs text-gray-500">Purchases Value</div>
                    <div className="text-lg font-bold text-green-700">{formatSAR(stockReport.totalPurchasesValue)}</div>
                  </Card>
                  <Card className="p-3 border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500">Consumption Value</div>
                    <div className="text-lg font-bold text-red-600">{formatSAR(stockReport.totalConsumptionValue)}</div>
                  </Card>
                  <Card className="p-3 border-l-4 border-l-purple-500">
                    <div className="text-xs text-gray-500">Closing Stock Value</div>
                    <div className="text-lg font-bold text-purple-700">{formatSAR(stockReport.totalClosingValue)}</div>
                  </Card>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <span className="font-semibold">Actual COGS Formula: </span>
                  Opening Stock ({formatSAR(stockReport.totalOpeningValue)}) + Purchases ({formatSAR(stockReport.totalPurchasesValue)}) − Closing Stock ({formatSAR(stockReport.totalClosingValue)}) = <span className="font-bold">{formatSAR(stockReport.totalOpeningValue + stockReport.totalPurchasesValue - stockReport.totalClosingValue)}</span>
                </div>

                {loadingReport ? (
                  <div className="text-center py-8 text-gray-400">Generating report...</div>
                ) : reportItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">No stock data for {reportMonth}</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="p-2 text-left">Item Name</th>
                          <th className="p-2 text-left">Category</th>
                          <th className="p-2 text-center">Unit</th>
                          <th className="p-2 text-right">Opening Qty</th>
                          <th className="p-2 text-right">Opening Value</th>
                          <th className="p-2 text-right">Purchases Qty</th>
                          <th className="p-2 text-right">Purchases Value</th>
                          <th className="p-2 text-right">Consumption</th>
                          <th className="p-2 text-right">Cons. Value</th>
                          <th className="p-2 text-right">Tx In</th>
                          <th className="p-2 text-right">Tx Out</th>
                          <th className="p-2 text-right">Adj.</th>
                          <th className="p-2 text-right font-semibold">Closing Qty</th>
                          <th className="p-2 text-right font-semibold">Closing Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportItems.map((item, idx) => (
                          <tr key={idx} className={`border-t ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                            <td className="p-2 font-medium">{item.itemName}</td>
                            <td className="p-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${getCategoryBadge(item.category)}`}>{getCategoryLabel(item.category)}</span>
                            </td>
                            <td className="p-2 text-center text-gray-500">{item.unit}</td>
                            <td className="p-2 text-right">{item.openingQty.toFixed(2)}</td>
                            <td className="p-2 text-right text-blue-700">{formatSAR(item.openingValue)}</td>
                            <td className="p-2 text-right text-green-700">{item.purchasesQty > 0 ? item.purchasesQty.toFixed(2) : "—"}</td>
                            <td className="p-2 text-right text-green-700">{item.purchasesValue > 0 ? formatSAR(item.purchasesValue) : "—"}</td>
                            <td className="p-2 text-right text-red-600">{item.consumptionQty > 0 ? item.consumptionQty.toFixed(2) : "—"}</td>
                            <td className="p-2 text-right text-red-600">{item.consumptionValue > 0 ? formatSAR(item.consumptionValue) : "—"}</td>
                            <td className="p-2 text-right text-teal-600">{item.transferInQty > 0 ? item.transferInQty.toFixed(2) : "—"}</td>
                            <td className="p-2 text-right text-orange-600">{item.transferOutQty > 0 ? item.transferOutQty.toFixed(2) : "—"}</td>
                            <td className="p-2 text-right text-purple-600">{item.adjustmentQty !== 0 ? (item.adjustmentQty > 0 ? `+${item.adjustmentQty.toFixed(2)}` : item.adjustmentQty.toFixed(2)) : "—"}</td>
                            <td className="p-2 text-right font-semibold">{item.closingQty.toFixed(2)}</td>
                            <td className="p-2 text-right font-semibold text-purple-700">{formatSAR(item.closingValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100 font-semibold">
                        <tr>
                          <td className="p-2" colSpan={4}>Totals</td>
                          <td className="p-2 text-right text-blue-700">{formatSAR(reportItems.reduce((s, i) => s + i.openingValue, 0))}</td>
                          <td className="p-2"></td>
                          <td className="p-2 text-right text-green-700">{formatSAR(reportItems.reduce((s, i) => s + i.purchasesValue, 0))}</td>
                          <td className="p-2"></td>
                          <td className="p-2 text-right text-red-600">{formatSAR(reportItems.reduce((s, i) => s + i.consumptionValue, 0))}</td>
                          <td className="p-2"></td>
                          <td className="p-2"></td>
                          <td className="p-2"></td>
                          <td className="p-2 text-right font-bold">{reportItems.reduce((s, i) => s + i.closingQty, 0).toFixed(2)}</td>
                          <td className="p-2 text-right font-bold text-purple-700">{formatSAR(reportItems.reduce((s, i) => s + i.closingValue, 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}
            {!stockReport && !loadingReport && (
              <div className="text-center py-12 text-gray-400">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Select a month to view the inventory report</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── TAB 5: P&L CLOSING STOCK ────────────────────────────── */}
        <TabsContent value="pl-closing">
          <div className="max-w-lg mx-auto space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">P&L COGS Formula</p>
              <p>Actual COGS = Opening Inventory + Purchases − Closing Inventory</p>
              <p className="mt-1 text-xs text-blue-600">Enter the closing stock value at month-end to adjust COGS in the P&L report.</p>
            </div>
            <div className="flex items-center gap-3">
              <Label className="w-24 text-sm">Month</Label>
              <Input type="month" value={plMonth} onChange={e => setPlMonth(e.target.value)} className="w-48" />
            </div>
            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Label className="w-40 text-sm">Food Closing Stock (SAR)</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={food} onChange={e => setFood(e.target.value)} className="flex-1" />
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-40 text-sm">Beverage Closing Stock (SAR)</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={beverage} onChange={e => setBeverage(e.target.value)} className="flex-1" />
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-40 text-sm">General Closing Stock (SAR)</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={general} onChange={e => setGeneral(e.target.value)} className="flex-1" />
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-40 text-sm">Notes</Label>
                <Input placeholder="Optional notes..." value={plNotes} onChange={e => setPlNotes(e.target.value)} className="flex-1" />
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <span className="text-xs text-gray-500">Total Closing Stock</span>
                  <div className="text-xl font-bold text-purple-700">{formatSAR(closingTotal)}</div>
                </div>
                <Button onClick={handleSavePL} disabled={upsert.isPending}>
                  {upsert.isPending ? "Saving..." : "Save Closing Stock"}
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
