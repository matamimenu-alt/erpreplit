export const PURCHASE_CATEGORIES = [
  { value: "cost-food",       label: "Cost of Sale – Food",         badge: "bg-orange-100 text-orange-800",  section: "cogs" },
  { value: "cost-beverage",   label: "Cost of Sale – Beverage",     badge: "bg-blue-100 text-blue-800",      section: "cogs" },
  { value: "cost-general",    label: "Cost of Sale – General",      badge: "bg-amber-100 text-amber-800",    section: "cogs" },
  { value: "fuel-energy",     label: "Fuel & Energy",               badge: "bg-yellow-100 text-yellow-800",  section: "opex" },
  { value: "maintenance",     label: "Maintenance and Repair",      badge: "bg-purple-100 text-purple-800",  section: "opex" },
  { value: "it-communication",label: "IT & Communication",          badge: "bg-cyan-100 text-cyan-800",      section: "opex" },
  { value: "marketing",       label: "Marketing and Advertising",   badge: "bg-pink-100 text-pink-800",      section: "opex" },
  { value: "others",          label: "Others Expenses",             badge: "bg-slate-100 text-slate-700",    section: "opex" },
] as const;

export type PurchaseCategoryValue = (typeof PURCHASE_CATEGORIES)[number]["value"];

export function getCategoryMeta(value: string) {
  return PURCHASE_CATEGORIES.find((c) => c.value === value) ?? {
    value,
    label: value,
    badge: "bg-slate-100 text-slate-700",
    section: "opex",
  };
}
