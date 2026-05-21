/**
 * Expense Categories Manager
 *
 * Full CRUD on `expense_categories` with required Fixed/Variable nature.
 * Used as the "Categories" tab inside Expenses Management.
 *
 * Why nature is required:
 *   The P&L report groups operating expenses by nature (Fixed vs Variable).
 *   Aggregate categories (level 0/1) carry nature=null and CANNOT receive
 *   transactions — the backend enforces this.
 *
 * All user-facing strings flow through t(); displayed category names use
 * pickName() so the right language (name / nameAr) is shown automatically.
 */
import { useMemo, useState } from "react";
import {
  useListExpenseCategories,
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
} from "@workspace/api-client-react";
import type { ExpenseCategory } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { Plus, Pencil, Trash2, X, Check, AlertTriangle, Lock } from "lucide-react";

type Nature = "fixed" | "variable";

function NatureBadge({ nature }: { nature: string | null | undefined }) {
  const { t } = useLanguage();
  if (nature === "fixed") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">{t("categories.nature.fixed")}</span>;
  }
  if (nature === "variable") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">{t("categories.nature.variable")}</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200"><Lock className="w-3 h-3" />{t("categories.nature.aggregate")}</span>;
}

function CategoryEditor({
  initial,
  parents,
  mode,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: { name: string; nameAr: string; parentCode: string; nature: Nature };
  parents: ExpenseCategory[];
  mode: "create" | "edit";
  onSave: (v: { name: string; nameAr: string; parentCode: string; nature: Nature }) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const { t, pickName } = useLanguage();
  const [name,       setName]       = useState(initial.name);
  const [nameAr,     setNameAr]     = useState(initial.nameAr);
  const [parentCode, setParentCode] = useState(initial.parentCode);
  const [nature,     setNature]     = useState<Nature>(initial.nature);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim() || !nameAr.trim()) { setError(t("categories.errors.namesRequired")); return; }
    if (mode === "create" && !parentCode) { setError(t("categories.errors.parentRequired")); return; }
    onSave({ name: name.trim(), nameAr: nameAr.trim(), parentCode, nature });
  };

  return (
    <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-700">{t("common.nameEn")}</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-lg" placeholder={t("categories.placeholders.name")} />
        </div>
        <div dir="rtl">
          <label className="text-xs font-medium text-slate-700">{t("common.nameAr")}</label>
          <input value={nameAr} onChange={e => setNameAr(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-lg" placeholder={t("categories.placeholders.nameAr")} />
        </div>
        {mode === "create" ? (
          <div>
            <label className="text-xs font-medium text-slate-700">{t("categories.parent")}</label>
            <select value={parentCode} onChange={e => setParentCode(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="">{t("categories.pickParent")}</option>
              {parents.map(p => (
                <option key={p.code} value={p.code}>{p.code} · {pickName(p)}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium text-slate-500">{t("categories.parentLocked")}</label>
            <div className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-500 font-mono">{parentCode}</div>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-slate-700">{t("categories.costType")}</label>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setNature("fixed")}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border-2 transition-colors ${nature === "fixed" ? "border-blue-500 bg-blue-50 text-blue-800 font-medium" : "border-slate-200 bg-white text-slate-600"}`}
              data-testid="nature-fixed"
            >{t("categories.nature.fixed")}</button>
            <button
              type="button"
              onClick={() => setNature("variable")}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border-2 transition-colors ${nature === "variable" ? "border-amber-500 bg-amber-50 text-amber-800 font-medium" : "border-slate-200 bg-white text-slate-600"}`}
              data-testid="nature-variable"
            >{t("categories.nature.variable")}</button>
          </div>
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5">
          <X className="w-4 h-4" /> {t("common.cancel")}
        </button>
        <button onClick={submit} disabled={isSaving} className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5">
          <Check className="w-4 h-4" /> {isSaving ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </div>
  );
}

export default function ExpenseCategoriesManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t, pickName } = useLanguage();
  const { data: categories = [] } = useListExpenseCategories<ExpenseCategory[]>({});

  const [adding, setAdding]   = useState(false);
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);

  // Possible parents = level 0 (root "5") + level 1 (5-1..5-8) + level 2 (custom nesting allowed but generally we want users to nest under main categories)
  const parents = useMemo(
    () => categories.filter(c => c.level <= 1).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  // Show ALL leaves grouped by parent, sorted
  const grouped = useMemo(() => {
    const byParent = new Map<string, ExpenseCategory[]>();
    for (const c of categories) {
      if (c.level < 2) continue; // skip aggregate nodes in the listing
      const key = c.parentCode ?? "";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(c);
    }
    const headers = parents.filter(p => p.level === 1);
    return headers.map(h => ({
      header: h,
      children: (byParent.get(h.code) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  }, [categories, parents]);

  const createMutation = useCreateExpenseCategory({
    mutation: {
      onSuccess: () => {
        toast({ title: t("categories.toast.created") });
        qc.invalidateQueries({ queryKey: ["/api/expense-categories"] });
        setAdding(false);
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
        toast({ title: t("categories.toast.createFailed"), description: msg?.message ?? msg?.error ?? "Unknown error", variant: "destructive" });
      },
    },
  });
  const updateMutation = useUpdateExpenseCategory({
    mutation: {
      onSuccess: () => {
        toast({ title: t("categories.toast.updated") });
        qc.invalidateQueries({ queryKey: ["/api/expense-categories"] });
        setEditing(null);
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
        toast({ title: t("categories.toast.updateFailed"), description: msg?.message ?? msg?.error ?? "Unknown error", variant: "destructive" });
      },
    },
  });
  const deleteMutation = useDeleteExpenseCategory({
    mutation: {
      onSuccess: () => {
        toast({ title: t("categories.toast.removed") });
        qc.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
        toast({ title: t("categories.toast.deleteFailed"), description: msg?.message ?? msg?.error ?? t("categories.toast.deleteFallback"), variant: "destructive" });
      },
    },
  });

  const handleDelete = (c: ExpenseCategory) => {
    if (!confirm(t("categories.confirmDelete", { name: pickName(c), code: c.code }))) return;
    deleteMutation.mutate({ code: c.code });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{t("categories.title")}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{t("categories.subtitle")}</p>
        </div>
        {!adding && !editing && (
          <button
            onClick={() => setAdding(true)}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5"
            data-testid="add-category"
          >
            <Plus className="w-4 h-4" /> {t("categories.add")}
          </button>
        )}
      </div>

      {adding && (
        <CategoryEditor
          initial={{ name: "", nameAr: "", parentCode: "5-1", nature: "variable" }}
          parents={parents}
          mode="create"
          isSaving={createMutation.isPending}
          onCancel={() => setAdding(false)}
          onSave={(v) => createMutation.mutate({ data: v })}
        />
      )}

      <div className="space-y-3">
        {grouped.map(({ header, children }) => (
          <div key={header.code} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-mono text-xs text-slate-500 me-2">{header.code}</span>
                <span className="font-semibold text-slate-800">{pickName(header)}</span>
              </div>
              <span className="text-xs text-slate-500">{children.length} {children.length === 1 ? t("common.item") : t("common.items")}</span>
            </div>
            {children.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-400 italic">{t("categories.noSubcategories")}</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {children.map(c => (
                  <li key={c.code} className="px-4 py-2.5">
                    {editing?.code === c.code ? (
                      <CategoryEditor
                        initial={{ name: c.name, nameAr: c.nameAr, parentCode: c.parentCode ?? header.code, nature: (c.nature === "fixed" || c.nature === "variable") ? c.nature : "variable" }}
                        parents={parents}
                        mode="edit"
                        isSaving={updateMutation.isPending}
                        onCancel={() => setEditing(null)}
                        onSave={(v) => updateMutation.mutate({ code: c.code, data: { name: v.name, nameAr: v.nameAr, nature: v.nature } })}
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400 w-12">{c.code}</span>
                          <span className="text-sm font-medium text-slate-800 truncate">{pickName(c)}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <NatureBadge nature={c.nature} />
                          <button onClick={() => setEditing(c)} className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100" aria-label={t("common.edit")}><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(c)} className="p-1.5 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50" aria-label={t("common.delete")}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
