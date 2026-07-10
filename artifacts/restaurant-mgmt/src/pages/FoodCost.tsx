import { useState, useMemo, useCallback, memo } from "react";
import {
  useListDishes, useGetDishPricing, useGetPricingConfig, useUpdatePricingConfig,
  useCreateDish, useUpdateDish, useDeleteDish, useListPurchaseProducts,
  getListDishesQueryKey, getGetDishPricingQueryKey, getGetPricingConfigQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLanguage } from "@/i18n/LanguageContext";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatSAR } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import {
  UtensilsCrossed, Plus, Trash2, Pencil, Settings2, TrendingUp,
  ChefHat, Package, AlertCircle, CheckCircle2, BarChart3, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";

const DISH_CATEGORIES = ["Main Course", "Starter", "Salad", "Sandwich", "Grill", "Beverage", "Dessert", "Sides", "Other"];

type IngredientRow = { ingredientName: string; unit: string; quantityPerDish: number };

type DishForm = {
  name: string;
  category: string;
  wastePercentage: number;
  targetFoodCostPct: number;
  notes: string;
  ingredients: IngredientRow[];
};

const EMPTY_FORM: DishForm = {
  name: "",
  category: "Main Course",
  wastePercentage: 8,
  targetFoodCostPct: 25,
  notes: "",
  ingredients: [],
};

function pct(v: number) {
  return `${v.toFixed(1)}%`;
}

function colorForMargin(margin: number) {
  if (margin >= 60) return "text-green-600";
  if (margin >= 40) return "text-yellow-600";
  return "text-red-600";
}

function colorForFoodCost(fc: number) {
  if (fc <= 25) return "text-green-600";
  if (fc <= 35) return "text-yellow-600";
  return "text-red-600";
}

const IngredientEditor = memo(function IngredientEditor({
  ingredients,
  products,
  onChange,
}: {
  ingredients: IngredientRow[];
  products: string[];
  onChange: (rows: IngredientRow[]) => void;
}) {
  const addRow = () => onChange([...ingredients, { ingredientName: "", unit: "kg", quantityPerDish: 1 }]);
  const removeRow = (i: number) => onChange(ingredients.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof IngredientRow, value: string | number) => {
    const rows = ingredients.map((r, idx) => idx === i ? { ...r, [field]: value } : r);
    onChange(rows);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <Label className="text-sm font-semibold">Ingredients</Label>
        <Button type="button" size="sm" variant="outline" onClick={addRow}>
          <Plus className="h-3 w-3 mr-1" /> Add Ingredient
        </Button>
      </div>
      {ingredients.length === 0 && (
        <p className="text-sm text-muted-foreground py-2 text-center border rounded-lg">
          No ingredients yet. Add at least one to calculate food cost.
        </p>
      )}
      {ingredients.map((ing, i) => (
        <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
          <div className="col-span-5">
            <Input
              list={`products-list-${i}`}
              value={ing.ingredientName}
              onChange={e => updateRow(i, "ingredientName", e.target.value)}
              placeholder="Ingredient name..."
              className="h-8 text-sm"
            />
            <datalist id={`products-list-${i}`}>
              {products.map(p => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div className="col-span-3">
            <Select value={ing.unit} onValueChange={v => updateRow(i, "unit", v)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["kg", "g", "liter", "ml", "unit", "piece", "box", "carton", "bottle", "can", "pack", "sack", "bag"].map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-3">
            <Input
              type="number"
              value={ing.quantityPerDish}
              onChange={e => updateRow(i, "quantityPerDish", parseFloat(e.target.value) || 0)}
              placeholder="Qty"
              step="0.001"
              min="0"
              className="h-8 text-sm"
            />
          </div>
          <div className="col-span-1 flex justify-end">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => removeRow(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
      {ingredients.length > 0 && (
        <div className="grid grid-cols-12 gap-1.5 px-0.5">
          <div className="col-span-5 text-xs text-muted-foreground font-medium">Name (type or pick from purchases)</div>
          <div className="col-span-3 text-xs text-muted-foreground font-medium">Unit</div>
          <div className="col-span-3 text-xs text-muted-foreground font-medium">Qty per dish</div>
        </div>
      )}
    </div>
  );
});

function DishModal({
  open,
  onClose,
  initial,
  products,
  onSave,
  title,
}: {
  open: boolean;
  onClose: () => void;
  initial: DishForm;
  products: string[];
  onSave: (form: DishForm) => Promise<void>;
  title: string;
}) {
  const [form, setForm] = useState<DishForm>(initial);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Dish name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const setField = <K extends keyof DishForm>(k: K, v: DishForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Dish Name *</Label>
              <Input value={form.name} onChange={e => setField("name", e.target.value)} placeholder="e.g. Grilled Chicken" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setField("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISH_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Waste Percentage (%)</Label>
              <Input
                type="number" min="0" max="50" step="0.5"
                value={form.wastePercentage}
                onChange={e => setField("wastePercentage", parseFloat(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">Typical range: 5–15%</p>
            </div>
            <div className="space-y-1.5">
              <Label>Target Food Cost (%)</Label>
              <Input
                type="number" min="1" max="80" step="0.5"
                value={form.targetFoodCostPct}
                onChange={e => setField("targetFoodCostPct", parseFloat(e.target.value) || 25)}
              />
              <p className="text-xs text-muted-foreground">Industry standard: 25–35%</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => setField("notes", e.target.value)} placeholder="Optional notes..." />
          </div>
          <Separator />
          <IngredientEditor
            ingredients={form.ingredients}
            products={products}
            onChange={rows => setField("ingredients", rows)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Dish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FoodCost() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const { data: dishes = [] } = useListDishes();
  const { data: pricing } = useGetDishPricing();
  const { data: config } = useGetPricingConfig();
  const { data: products = [] } = useListPurchaseProducts();

  const createDish = useCreateDish();
  const updateDish = useUpdateDish();
  const deleteDish = useDeleteDish();
  const updateConfig = useUpdatePricingConfig();

  const [showDishModal, setShowDishModal] = useState(false);
  const [editingDish, setEditingDish] = useState<(typeof dishes)[0] | null>(null);
  const [configDraft, setConfigDraft] = useState<{ monthlyOrders: number; deliveryCostPerOrder: number; deliveryCommissionPct: number } | null>(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  // Profit simulator state
  const [simDishId, setSimDishId] = useState<number | null>(null);
  const [simTargetFC, setSimTargetFC] = useState(25);
  const [simWaste, setSimWaste] = useState(8);

  const invalidateAll = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: getListDishesQueryKey() });
    await qc.invalidateQueries({ queryKey: getGetDishPricingQueryKey() });
  }, [qc]);

  const handleCreate = async (form: DishForm) => {
    await createDish.mutateAsync({ data: form });
    await invalidateAll();
    toast({ title: "Dish created successfully." });
  };

  const handleUpdate = async (form: DishForm) => {
    if (!editingDish) return;
    await updateDish.mutateAsync({ id: editingDish.id, data: form });
    await invalidateAll();
    toast({ title: "Dish updated successfully." });
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await deleteDish.mutateAsync({ id });
    await invalidateAll();
    toast({ title: "Dish deleted." });
  };

  const handleSaveConfig = async () => {
    if (!configDraft) return;
    await updateConfig.mutateAsync({ data: configDraft });
    await qc.invalidateQueries({ queryKey: getGetPricingConfigQueryKey() });
    await qc.invalidateQueries({ queryKey: getGetDishPricingQueryKey() });
    setShowConfigPanel(false);
    toast({ title: "Settings saved." });
  };

  const editForm = useMemo((): DishForm => {
    if (!editingDish) return EMPTY_FORM;
    return {
      name: editingDish.name,
      category: editingDish.category,
      wastePercentage: editingDish.wastePercentage,
      targetFoodCostPct: editingDish.targetFoodCostPct,
      notes: editingDish.notes ?? "",
      ingredients: editingDish.ingredients ?? [],
    };
  }, [editingDish]);

  // Profit simulator calculation
  const simDish = pricing?.dishes.find(d => d.id === simDishId);
  const simResult = useMemo(() => {
    if (!simDish || !pricing) return null;
    const fc = simDish.pricing.fixedCostAllocation;
    const dc = simDish.pricing.deliveryCostAllocation;
    const ingCost = simDish.pricing.ingredientCost;
    const wasteCost = ingCost * (simWaste / 100);
    const totalIng = ingCost + wasteCost;
    const finalCost = totalIng + fc + dc;
    const dineInPrice = simTargetFC > 0 ? finalCost / (simTargetFC / 100) : 0;
    const deliveryPrice = simTargetFC > 0 && pricing.config.deliveryCommissionPct < 100
      ? dineInPrice / (1 - pricing.config.deliveryCommissionPct / 100)
      : dineInPrice;
    const foodCostPct = dineInPrice > 0 ? (finalCost / dineInPrice) * 100 : 0;
    const margin = 100 - foodCostPct;

    function psych(p: number) {
      if (p <= 0) return 0;
      const base = Math.ceil(p);
      const c = base - 0.1;
      return +(c >= p ? c : base + 0.9).toFixed(2);
    }

    return {
      wasteCost: +wasteCost.toFixed(2),
      totalIngredientCost: +totalIng.toFixed(2),
      finalCost: +finalCost.toFixed(2),
      dineInPrice: +dineInPrice.toFixed(2),
      deliveryPrice: +deliveryPrice.toFixed(2),
      psychDineIn: psych(dineInPrice),
      psychDelivery: psych(deliveryPrice),
      foodCostPct: +foodCostPct.toFixed(2),
      margin: +margin.toFixed(2),
    };
  }, [simDish, simTargetFC, simWaste, pricing]);

  const fixedCostSummary = pricing?.fixedCostSummary;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title={t("pages.foodCostPageTitle")}
          description={t("pages.foodCostDesc")}
        />
        <div className="flex gap-2 items-center">
          <Button variant="outline" size="sm" className="no-print" onClick={() => {
            setConfigDraft(config ? { ...config } : { monthlyOrders: 1000, deliveryCostPerOrder: 7, deliveryCommissionPct: 25 });
            setShowConfigPanel(true);
          }}>
            <Settings2 className="h-4 w-4 mr-2" /> Settings
          </Button>
          <PrintButton />
        </div>
      </div>

      {/* Settings Panel */}
      {showConfigPanel && configDraft && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> Pricing Engine Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <Label>Estimated Monthly Orders</Label>
                <Input
                  type="number" min="1"
                  value={configDraft.monthlyOrders}
                  onChange={e => setConfigDraft(d => d ? { ...d, monthlyOrders: +e.target.value || 1000 } : d)}
                />
                <p className="text-xs text-muted-foreground">Used to allocate fixed costs per dish</p>
              </div>
              <div className="space-y-1.5">
                <Label>Delivery Cost per Order (SAR)</Label>
                <Input
                  type="number" min="0" step="0.5"
                  value={configDraft.deliveryCostPerOrder}
                  onChange={e => setConfigDraft(d => d ? { ...d, deliveryCostPerOrder: +e.target.value || 7 } : d)}
                />
                <p className="text-xs text-muted-foreground">Average delivery logistics cost</p>
              </div>
              <div className="space-y-1.5">
                <Label>Delivery App Commission (%)</Label>
                <Input
                  type="number" min="0" max="50" step="0.5"
                  value={configDraft.deliveryCommissionPct}
                  onChange={e => setConfigDraft(d => d ? { ...d, deliveryCommissionPct: +e.target.value || 25 } : d)}
                />
                <p className="text-xs text-muted-foreground">HungerStation / Jahez / Noon commission</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={handleSaveConfig}>Save Settings</Button>
              <Button size="sm" variant="outline" onClick={() => setShowConfigPanel(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fixed Cost Summary Bar */}
      {fixedCostSummary && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Monthly Fixed Expenses</p>
            <p className="text-lg font-semibold">{formatSAR(fixedCostSummary.totalExpenses)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Monthly Salaries</p>
            <p className="text-lg font-semibold">{formatSAR(fixedCostSummary.totalSalaries)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Fixed Costs</p>
            <p className="text-lg font-semibold text-orange-600">{formatSAR(fixedCostSummary.totalFixedCosts)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Fixed Cost / Dish</p>
            <p className="text-lg font-semibold text-blue-600">{formatSAR(fixedCostSummary.fixedCostPerDish)}</p>
            <p className="text-xs text-muted-foreground">{config?.monthlyOrders?.toLocaleString()} orders/mo</p>
          </Card>
        </div>
      )}

      <Tabs defaultValue="dishes">
        <TabsList>
          <TabsTrigger value="dishes">
            <ChefHat className="h-4 w-4 mr-2" /> Dishes ({dishes.length})
          </TabsTrigger>
          <TabsTrigger value="pricing">
            <BarChart3 className="h-4 w-4 mr-2" /> Pricing Analysis
          </TabsTrigger>
          <TabsTrigger value="simulator">
            <Zap className="h-4 w-4 mr-2" /> Profit Simulator
          </TabsTrigger>
        </TabsList>

        {/* ───── DISHES TAB ───── */}
        <TabsContent value="dishes" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowDishModal(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Dish
            </Button>
          </div>

          {dishes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
              <ChefHat className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No dishes yet</p>
              <p className="text-sm mt-1">Add your first dish to start calculating food costs</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dishes.map(dish => {
                const priceDish = pricing?.dishes.find(d => d.id === dish.id);
                return (
                  <Card key={dish.id} className="relative">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{dish.name}</CardTitle>
                          <Badge variant="secondary" className="mt-1 text-xs">{dish.category}</Badge>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingDish(dish); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(dish.id, dish.name)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Ingredients: </span>
                          <span className="font-medium">{dish.ingredients?.length ?? 0}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Waste: </span>
                          <span className="font-medium">{dish.wastePercentage}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Target FC: </span>
                          <span className="font-medium">{dish.targetFoodCostPct}%</span>
                        </div>
                        {priceDish && (
                          <div>
                            <span className="text-muted-foreground">Margin: </span>
                            <span className={`font-semibold ${colorForMargin(priceDish.pricing.profitMarginPct)}`}>
                              {priceDish.pricing.profitMarginPct.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                      {priceDish && (
                        <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-1 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Dine-in Price</p>
                            <p className="font-semibold text-green-700">{formatSAR(priceDish.pricing.psychologicalDineInPrice)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Delivery Price</p>
                            <p className="font-semibold text-blue-700">{formatSAR(priceDish.pricing.psychologicalDeliveryPrice)}</p>
                          </div>
                        </div>
                      )}
                      {priceDish && priceDish.ingredients.some(i => !i.found) && (
                        <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>Some ingredients have no purchase price</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ───── PRICING ANALYSIS TAB ───── */}
        <TabsContent value="pricing" className="mt-4">
          {!pricing || pricing.dishes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No dishes to analyze</p>
              <p className="text-sm mt-1">Add dishes in the Dishes tab first</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-semibold">Dish</th>
                      <th className="text-right px-3 py-3 font-semibold whitespace-nowrap">Ingredient Cost</th>
                      <th className="text-right px-3 py-3 font-semibold">Waste</th>
                      <th className="text-right px-3 py-3 font-semibold whitespace-nowrap">Fixed Cost</th>
                      <th className="text-right px-3 py-3 font-semibold whitespace-nowrap">Delivery Cost</th>
                      <th className="text-right px-3 py-3 font-semibold whitespace-nowrap">Total Cost</th>
                      <th className="text-right px-3 py-3 font-semibold whitespace-nowrap">Dine-in Price</th>
                      <th className="text-right px-3 py-3 font-semibold whitespace-nowrap">Delivery Price</th>
                      <th className="text-right px-3 py-3 font-semibold whitespace-nowrap">Food Cost %</th>
                      <th className="text-right px-3 py-3 font-semibold whitespace-nowrap">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricing.dishes.map((dish, i) => (
                      <tr key={dish.id} className={i % 2 === 0 ? "bg-white" : "bg-muted/10"}>
                        <td className="px-4 py-3">
                          <div>
                            <span className="font-medium">{dish.name}</span>
                            <Badge variant="outline" className="ml-2 text-xs">{dish.category}</Badge>
                            {dish.ingredients.some(ing => !ing.found) && (
                              <span title="Some ingredients have no purchase price" className="ml-1">
                                <AlertCircle className="inline h-3.5 w-3.5 text-amber-500" />
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {dish.ingredients.length} ingredients · Waste {dish.wastePercentage}% · Target FC {dish.targetFoodCostPct}%
                          </div>
                        </td>
                        <td className="text-right px-3 py-3 font-mono">{formatSAR(dish.pricing.ingredientCost)}</td>
                        <td className="text-right px-3 py-3 font-mono text-amber-600">{formatSAR(dish.pricing.wasteCost)}</td>
                        <td className="text-right px-3 py-3 font-mono text-orange-600">{formatSAR(dish.pricing.fixedCostAllocation)}</td>
                        <td className="text-right px-3 py-3 font-mono text-purple-600">{formatSAR(dish.pricing.deliveryCostAllocation)}</td>
                        <td className="text-right px-3 py-3 font-mono font-semibold">{formatSAR(dish.pricing.finalDishCost)}</td>
                        <td className="text-right px-3 py-3">
                          <div className="font-semibold text-green-700">{formatSAR(dish.pricing.psychologicalDineInPrice)}</div>
                          <div className="text-xs text-muted-foreground">(calc: {formatSAR(dish.pricing.suggestedDineInPrice)})</div>
                        </td>
                        <td className="text-right px-3 py-3">
                          <div className="font-semibold text-blue-700">{formatSAR(dish.pricing.psychologicalDeliveryPrice)}</div>
                          <div className="text-xs text-muted-foreground">(calc: {formatSAR(dish.pricing.deliveryAppPrice)})</div>
                        </td>
                        <td className={`text-right px-3 py-3 font-semibold ${colorForFoodCost(dish.pricing.foodCostPct)}`}>
                          {pct(dish.pricing.foodCostPct)}
                        </td>
                        <td className={`text-right px-3 py-3 font-semibold ${colorForMargin(dish.pricing.profitMarginPct)}`}>
                          {pct(dish.pricing.profitMarginPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Ingredient breakdown (expandable per dish) */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Ingredient Detail</h3>
                {pricing.dishes.map(dish => (
                  <Card key={dish.id} className="overflow-hidden">
                    <div className="px-4 py-3 bg-muted/20 border-b flex items-center justify-between">
                      <div className="font-semibold">{dish.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Ingredient cost: {formatSAR(dish.pricing.ingredientCost)}
                      </div>
                    </div>
                    {dish.ingredients.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-muted-foreground">No ingredients added</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-xs text-muted-foreground">
                              <th className="text-left px-4 py-2">Ingredient</th>
                              <th className="text-right px-3 py-2">Qty</th>
                              <th className="text-left px-2 py-2">Unit</th>
                              <th className="text-right px-3 py-2">Unit Price</th>
                              <th className="text-right px-3 py-2">Cost</th>
                              <th className="text-center px-2 py-2">In Purchases</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dish.ingredients.map((ing, j) => (
                              <tr key={ing.id} className={j % 2 === 0 ? "" : "bg-muted/10"}>
                                <td className="px-4 py-2 font-medium">{ing.ingredientName}</td>
                                <td className="text-right px-3 py-2">{ing.quantityPerDish}</td>
                                <td className="px-2 py-2 text-muted-foreground">{ing.unit}</td>
                                <td className="text-right px-3 py-2 font-mono">{formatSAR(ing.unitPrice)}</td>
                                <td className="text-right px-3 py-2 font-mono font-medium">{formatSAR(ing.cost)}</td>
                                <td className="text-center px-2 py-2">
                                  {ing.found
                                    ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                                    : <AlertCircle className="h-4 w-4 text-amber-500 mx-auto" />
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ───── PROFIT SIMULATOR TAB ───── */}
        <TabsContent value="simulator" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Controls */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" /> Adjust Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Select Dish</Label>
                  <Select
                    value={simDishId ? String(simDishId) : ""}
                    onValueChange={v => {
                      const d = pricing?.dishes.find(x => x.id === +v);
                      setSimDishId(+v);
                      if (d) { setSimTargetFC(d.targetFoodCostPct); setSimWaste(d.wastePercentage); }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a dish..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(pricing?.dishes ?? []).map(d => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Target Food Cost %</Label>
                    <span className="text-sm font-semibold text-blue-600">{simTargetFC}%</span>
                  </div>
                  <Slider
                    value={[simTargetFC]}
                    onValueChange={([v]) => setSimTargetFC(v)}
                    min={10} max={60} step={0.5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>10% (High margin)</span>
                    <span>60% (Low margin)</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Waste Percentage</Label>
                    <span className="text-sm font-semibold text-amber-600">{simWaste}%</span>
                  </div>
                  <Slider
                    value={[simWaste]}
                    onValueChange={([v]) => setSimWaste(v)}
                    min={0} max={30} step={0.5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>30%</span>
                  </div>
                </div>

                {simDish && (
                  <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fixed Cost Allocation</span>
                      <span className="font-mono">{formatSAR(simDish.pricing.fixedCostAllocation)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery Cost</span>
                      <span className="font-mono">{formatSAR(simDish.pricing.deliveryCostAllocation)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ingredient Cost</span>
                      <span className="font-mono">{formatSAR(simDish.pricing.ingredientCost)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Results */}
            <div className="space-y-4">
              {!simDishId || !simResult ? (
                <div className="flex items-center justify-center h-full border-2 border-dashed rounded-xl text-muted-foreground">
                  <div className="text-center py-12">
                    <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>Select a dish to simulate pricing</p>
                  </div>
                </div>
              ) : (
                <>
                  <Card className="border-green-200 bg-green-50/40">
                    <CardContent className="pt-4">
                      <p className="text-sm font-semibold text-green-800 mb-3">Dine-in Pricing</p>
                      <div className="flex items-end gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Suggested</p>
                          <p className="text-3xl font-bold text-green-700">{formatSAR(simResult.dineInPrice)}</p>
                        </div>
                        <div className="pb-1">
                          <p className="text-xs text-muted-foreground">Psychological</p>
                          <p className="text-2xl font-bold text-green-600">{formatSAR(simResult.psychDineIn)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-blue-200 bg-blue-50/40">
                    <CardContent className="pt-4">
                      <p className="text-sm font-semibold text-blue-800 mb-3">
                        Delivery App Price ({pricing?.config.deliveryCommissionPct}% commission)
                      </p>
                      <div className="flex items-end gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Suggested</p>
                          <p className="text-3xl font-bold text-blue-700">{formatSAR(simResult.deliveryPrice)}</p>
                        </div>
                        <div className="pb-1">
                          <p className="text-xs text-muted-foreground">Psychological</p>
                          <p className="text-2xl font-bold text-blue-600">{formatSAR(simResult.psychDelivery)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 gap-3">
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Total Dish Cost</p>
                      <p className="text-xl font-bold">{formatSAR(simResult.finalCost)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ing: {formatSAR(simResult.totalIngredientCost)} · Waste: {formatSAR(simResult.wasteCost)}
                      </p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Profit Margin</p>
                      <p className={`text-xl font-bold ${colorForMargin(simResult.margin)}`}>{pct(simResult.margin)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Food Cost: <span className={colorForFoodCost(simResult.foodCostPct)}>{pct(simResult.foodCostPct)}</span>
                      </p>
                    </Card>
                  </div>

                  {/* Comparison with original */}
                  {simDish && (
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm font-semibold mb-3">Comparison: Original vs Simulated</p>
                        <div className="space-y-2 text-sm">
                          {[
                            { label: "Dine-in Price", orig: simDish.pricing.psychologicalDineInPrice, sim: simResult.psychDineIn },
                            { label: "Delivery Price", orig: simDish.pricing.psychologicalDeliveryPrice, sim: simResult.psychDelivery },
                            { label: "Food Cost %", orig: simDish.pricing.foodCostPct, sim: simResult.foodCostPct, pct: true },
                            { label: "Margin %", orig: simDish.pricing.profitMarginPct, sim: simResult.margin, pct: true },
                          ].map(row => (
                            <div key={row.label} className="flex items-center justify-between">
                              <span className="text-muted-foreground">{row.label}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground line-through text-xs">
                                  {row.pct ? pct(row.orig) : formatSAR(row.orig)}
                                </span>
                                <span className="font-semibold">
                                  {row.pct ? pct(row.sim) : formatSAR(row.sim)}
                                </span>
                                <span className={`text-xs ${row.sim > row.orig ? "text-green-600" : row.sim < row.orig ? "text-red-600" : "text-muted-foreground"}`}>
                                  {row.sim > row.orig ? "▲" : row.sim < row.orig ? "▼" : "—"}
                                  {row.pct
                                    ? ` ${Math.abs(row.sim - row.orig).toFixed(1)}pp`
                                    : ` ${formatSAR(Math.abs(row.sim - row.orig))}`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Dish Modal */}
      <DishModal
        open={showDishModal}
        onClose={() => setShowDishModal(false)}
        initial={EMPTY_FORM}
        products={products}
        onSave={handleCreate}
        title="Add New Dish"
      />

      {/* Edit Dish Modal */}
      {editingDish && (
        <DishModal
          open={!!editingDish}
          onClose={() => setEditingDish(null)}
          initial={editForm}
          products={products}
          onSave={handleUpdate}
          title={`Edit: ${editingDish.name}`}
        />
      )}
    </div>
  );
}
