export const PURCHASE_CATEGORY_GROUPS = [
  {
    groupLabel: "Cost of Sale – Food",
    section: "cogs" as const,
    color: "orange",
    badge: "bg-orange-100 text-orange-800",
    categories: [
      { value: "food-vegetables",    label: "Vegetables, Tomatoes & Onions",  labelAr: "خضار وطماطم وبصل" },
      { value: "food-meat",          label: "Meat, Poultry & Eggs",           labelAr: "لحوم وطيور وبيض" },
      { value: "food-seafood",       label: "Fish & Seafood",                 labelAr: "أسماك وبحريات" },
      { value: "food-spices",        label: "Spices & Seasonings",            labelAr: "بهارات وتوابل" },
      { value: "food-dairy",         label: "Dairy Products",                 labelAr: "منتجات الألبان" },
      { value: "food-other",         label: "Other Food Items",               labelAr: "مواد غذائية أخرى" },
    ],
  },
  {
    groupLabel: "Cost of Sale – Beverage",
    section: "cogs" as const,
    color: "blue",
    badge: "bg-blue-100 text-blue-800",
    categories: [
      { value: "bev-coffee",         label: "Fresh Coffee",                   labelAr: "القهوة الطازجة" },
      { value: "bev-spices",         label: "Beverage Spices & Syrups",       labelAr: "التوابل والبهارات" },
      { value: "bev-cold",           label: "Cold Beverages",                 labelAr: "المشروبات الباردة" },
      { value: "bev-hot-materials",  label: "Hot Beverage Materials",         labelAr: "خامات المشروبات الساخنة" },
      { value: "bev-cold-materials", label: "Cold Beverage Materials",        labelAr: "خامات المشروبات الباردة" },
    ],
  },
  {
    groupLabel: "Cost of Sale – General",
    section: "cogs" as const,
    color: "amber",
    badge: "bg-amber-100 text-amber-800",
    categories: [
      { value: "gen-consumables",    label: "Operational Consumables",        labelAr: "المستهلكات التشغيلية" },
      { value: "gen-kitchen",        label: "Kitchen Supplies",               labelAr: "مستلزمات المطبخ" },
      { value: "gen-cleaning",       label: "Cleaning Tools & Supplies",      labelAr: "أدوات التنظيف" },
      { value: "gen-delivery",       label: "Delivery Needs",                 labelAr: "حاجيات التسليم" },
    ],
  },
  {
    groupLabel: "Operating Expenses",
    section: "opex" as const,
    color: "slate",
    badge: "bg-slate-100 text-slate-700",
    categories: [
      { value: "fuel-energy",        label: "Fuel & Energy",                  labelAr: "الوقود والطاقة" },
      { value: "maintenance",        label: "Maintenance and Repair",         labelAr: "الصيانة والإصلاح" },
      { value: "it-communication",   label: "IT & Communication",             labelAr: "تقنية المعلومات والاتصالات" },
      { value: "marketing",          label: "Marketing and Advertising",      labelAr: "التسويق والإعلان" },
      { value: "others",             label: "Others Expenses",                labelAr: "مصاريف أخرى" },
    ],
  },
];

export const PURCHASE_CATEGORIES = PURCHASE_CATEGORY_GROUPS.flatMap(g =>
  g.categories.map(c => ({
    value: c.value,
    label: c.label,
    labelAr: c.labelAr,
    groupLabel: g.groupLabel,
    section: g.section,
    badge: g.badge,
  }))
);

export type PurchaseCategoryValue = string;

export function getCategoryMeta(value: string) {
  const legacyMap: Record<string, string> = {
    "cost-food": "food-other", "food": "food-other",
    "cost-beverage": "bev-cold", "beverage": "bev-cold",
    "cost-general": "gen-consumables", "other": "gen-consumables",
  };
  const v = legacyMap[value] ?? value;
  return PURCHASE_CATEGORIES.find(c => c.value === v) ?? {
    value, label: value, labelAr: value,
    groupLabel: "Other", section: "opex" as const,
    badge: "bg-slate-100 text-slate-700",
  };
}

export function isFoodCost(cat: string) {
  return cat.startsWith("food-") || cat === "cost-food" || cat === "food";
}
export function isBeverageCost(cat: string) {
  return cat.startsWith("bev-") || cat === "cost-beverage" || cat === "beverage";
}
export function isGeneralCogs(cat: string) {
  return cat.startsWith("gen-") || cat === "cost-general" || cat === "other";
}

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  PURCHASE_CATEGORIES.map(c => [c.value, c.label])
);
