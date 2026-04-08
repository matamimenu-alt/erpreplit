export type CategorySection = "cogs-food" | "cogs-bev" | "cogs-gen" | "opex";

export interface SubCategory {
  value: string;
  label: string;
  labelAr: string;
}

export interface CategoryGroup {
  key: string;
  label: string;
  labelAr: string;
  section: CategorySection;
  color: string;
  badge: string;
  subcategories: SubCategory[];
}

export const PURCHASE_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    key: "food",
    label: "Cost of Sale – Food",
    labelAr: "تكلفة المبيعات – أغذية",
    section: "cogs-food",
    color: "orange",
    badge: "bg-orange-100 text-orange-800",
    subcategories: [
      { value: "food-poultry",    label: "Poultry & Meat",              labelAr: "الدواجن واللحوم" },
      { value: "food-vegetables", label: "Vegetables & Fruits",         labelAr: "الخضروات والفواكه" },
      { value: "food-dairy",      label: "Milk & Dairy",                labelAr: "الحليب والألبان" },
      { value: "food-spices",     label: "Spices & Seasoning",          labelAr: "بهارات وتوابل" },
      { value: "food-products",   label: "Food Products & Desserts",    labelAr: "منتجات غذائية وحلويات" },
      { value: "food-supplies",   label: "Food Supplies & Oils",        labelAr: "مواد غذائية وزيوت" },
    ],
  },
  {
    key: "beverage",
    label: "Cost of Sale – Beverage",
    labelAr: "تكلفة المبيعات – مشروبات",
    section: "cogs-bev",
    color: "blue",
    badge: "bg-blue-100 text-blue-800",
    subcategories: [
      { value: "bev-juices", label: "Juices",         labelAr: "عصائر" },
      { value: "bev-water",  label: "Mineral Water",  labelAr: "مياه معدنية" },
      { value: "bev-soft",   label: "Soft Drinks",    labelAr: "مشروبات غازية" },
    ],
  },
  {
    key: "general",
    label: "Cost of Sale – General",
    labelAr: "تكلفة المبيعات – عام",
    section: "cogs-gen",
    color: "amber",
    badge: "bg-amber-100 text-amber-800",
    subcategories: [
      { value: "gen-cashier",   label: "Cashier Supplies",    labelAr: "مستلزمات الكاشير" },
      { value: "gen-kitchen",   label: "Kitchen Supplies",    labelAr: "مستلزمات المطبخ" },
      { value: "gen-cleaning",  label: "Cleaning Supplies",   labelAr: "مستلزمات التنظيف" },
      { value: "gen-packaging", label: "Packaging & Paper",   labelAr: "التغليف والورقيات" },
    ],
  },
  {
    key: "fuel",
    label: "Fuel & Energy",
    labelAr: "الوقود والطاقة",
    section: "opex",
    color: "red",
    badge: "bg-red-100 text-red-800",
    subcategories: [
      { value: "fuel-vehicle",   label: "Vehicle Fuel",        labelAr: "محروقات سيارات" },
      { value: "fuel-charcoal",  label: "Charcoal",            labelAr: "الفحم" },
      { value: "fuel-gas",       label: "Gas",                 labelAr: "الغاز" },
      { value: "fuel-utilities", label: "Electricity & Water", labelAr: "الكهرباء والماء" },
    ],
  },
  {
    key: "maintenance",
    label: "Maintenance & Repair",
    labelAr: "الصيانة والإصلاح",
    section: "opex",
    color: "violet",
    badge: "bg-violet-100 text-violet-800",
    subcategories: [
      { value: "maint-services",  label: "Maintenance Services",  labelAr: "خدمات صيانة" },
      { value: "maint-materials", label: "Maintenance Materials", labelAr: "مواد صيانة" },
    ],
  },
  {
    key: "it",
    label: "IT & Communication",
    labelAr: "تقنية المعلومات والاتصالات",
    section: "opex",
    color: "cyan",
    badge: "bg-cyan-100 text-cyan-800",
    subcategories: [
      { value: "it-internet", label: "Internet",    labelAr: "الإنترنت" },
      { value: "it-phones",   label: "Telephones",  labelAr: "الاتصالات / تلفونات" },
    ],
  },
  {
    key: "marketing",
    label: "Marketing & Advertising",
    labelAr: "التسويق والإعلانات",
    section: "opex",
    color: "pink",
    badge: "bg-pink-100 text-pink-800",
    subcategories: [
      { value: "mkt-campaigns", label: "Advertising Campaigns",    labelAr: "حملات إعلانية" },
      { value: "mkt-promo",     label: "Promotion / Distribution", labelAr: "ترويج وتوزيع" },
    ],
  },
  {
    key: "others",
    label: "Other Expenses",
    labelAr: "مصاريف أخرى",
    section: "opex",
    color: "slate",
    badge: "bg-slate-100 text-slate-700",
    subcategories: [
      { value: "others-misc", label: "Miscellaneous", labelAr: "متفرقات" },
    ],
  },
];

export const PURCHASE_CATEGORIES = PURCHASE_CATEGORY_GROUPS.flatMap(g =>
  g.subcategories.map(s => ({
    value: s.value,
    label: s.label,
    labelAr: s.labelAr,
    groupKey: g.key,
    groupLabel: g.label,
    groupLabelAr: g.labelAr,
    section: g.section,
    badge: g.badge,
    color: g.color,
  }))
);

const LEGACY_MAP: Record<string, string> = {
  "cost-food":          "food-poultry",
  "food":               "food-poultry",
  "food-meat":          "food-poultry",
  "food-seafood":       "food-supplies",
  "food-other":         "food-supplies",
  "cost-beverage":      "bev-juices",
  "beverage":           "bev-juices",
  "bev-coffee":         "bev-juices",
  "bev-spices":         "bev-juices",
  "bev-cold":           "bev-soft",
  "bev-hot-materials":  "bev-juices",
  "bev-cold-materials": "bev-soft",
  "cost-general":       "gen-kitchen",
  "other":              "gen-kitchen",
  "gen-consumables":    "gen-cashier",
  "gen-delivery":       "gen-packaging",
  "fuel-energy":        "fuel-gas",
  "maintenance":        "maint-services",
  "it-communication":   "it-internet",
  "marketing":          "mkt-campaigns",
  "others":             "others-misc",
};

export function getCategoryMeta(value: string) {
  const resolved = LEGACY_MAP[value] ?? value;
  return PURCHASE_CATEGORIES.find(c => c.value === resolved) ?? {
    value: resolved,
    label: value,
    labelAr: value,
    groupKey: "others",
    groupLabel: "Other",
    groupLabelAr: "أخرى",
    section: "opex" as CategorySection,
    badge: "bg-slate-100 text-slate-700",
    color: "slate",
  };
}

export function getGroupForCategory(value: string): CategoryGroup | undefined {
  const resolved = LEGACY_MAP[value] ?? value;
  return PURCHASE_CATEGORY_GROUPS.find(g => g.subcategories.some(s => s.value === resolved));
}

export function isFoodCost(cat: string) {
  const r = LEGACY_MAP[cat] ?? cat;
  return r.startsWith("food-");
}
export function isBeverageCost(cat: string) {
  const r = LEGACY_MAP[cat] ?? cat;
  return r.startsWith("bev-");
}
export function isGeneralCogs(cat: string) {
  const r = LEGACY_MAP[cat] ?? cat;
  return r.startsWith("gen-");
}
export function isFuelCost(cat: string) {
  const r = LEGACY_MAP[cat] ?? cat;
  return r.startsWith("fuel-");
}
export function isMaintenanceCost(cat: string) {
  const r = LEGACY_MAP[cat] ?? cat;
  return r.startsWith("maint-");
}
export function isItCost(cat: string) {
  const r = LEGACY_MAP[cat] ?? cat;
  return r.startsWith("it-");
}
export function isMarketingCost(cat: string) {
  const r = LEGACY_MAP[cat] ?? cat;
  return r.startsWith("mkt-");
}
export function isOthersCost(cat: string) {
  const r = LEGACY_MAP[cat] ?? cat;
  return r.startsWith("others-") || r === "others";
}

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  PURCHASE_CATEGORIES.map(c => [c.value, c.label])
);
