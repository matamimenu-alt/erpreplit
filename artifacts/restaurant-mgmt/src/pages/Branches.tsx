import { useState } from "react";
import {
  Building2, Plus, Pencil, Archive, RefreshCw, Trash2, X, Check,
  MapPin, Phone, Hash, Tag, Globe, ChevronDown, Search, AlertCircle,
  Store, Crown
} from "lucide-react";
import {
  useListRestaurants,
  useCreateRestaurant,
  useUpdateRestaurant,
  useSetRestaurantStatus,
  useDeleteRestaurant,
} from "@workspace/api-client-react";
import type { Restaurant, CreateRestaurant } from "@workspace/api-client-react";

type Status = "active" | "inactive" | "archived";

const STATUS_BADGE: Record<Status, string> = {
  active:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  inactive: "bg-amber-100 text-amber-700 border-amber-200",
  archived: "bg-slate-100 text-slate-500 border-slate-200",
};
const STATUS_LABEL: Record<Status, string> = {
  active:   "Active — نشط",
  inactive: "Inactive — غير نشط",
  archived: "Archived — مؤرشف",
};

const CITIES = ["Riyadh", "Jeddah", "Dammam", "Mecca", "Medina", "Khobar", "Taif", "Tabuk", "Other"];

const EMPTY_FORM: CreateRestaurant = {
  name: "", nameAr: "", brandName: "", branchCode: "",
  city: "", address: "", phone: "", taxNumber: "", status: "active",
};

function BranchModal({
  initial,
  onClose,
  onSave,
  isPending,
}: {
  initial?: Restaurant;
  onClose: () => void;
  onSave: (data: CreateRestaurant) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<CreateRestaurant>(
    initial
      ? {
          name: initial.name, nameAr: initial.nameAr ?? "",
          brandName: initial.brandName ?? "", branchCode: initial.branchCode ?? "",
          city: initial.city ?? "", address: initial.address ?? "",
          phone: initial.phone ?? "", taxNumber: initial.taxNumber ?? "",
          status: (initial.status as Status) ?? "active",
        }
      : { ...EMPTY_FORM }
  );
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateRestaurant, string>>>({});

  function validate() {
    const e: typeof errors = {};
    if (!form.name?.trim()) e.name = "Branch name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (step === 1 && !validate()) return;
    setStep(s => Math.min(s + 1, 3));
  }

  function handleSubmit() {
    if (!validate()) return;
    onSave(form);
  }

  const field = (label: string, key: keyof CreateRestaurant, placeholder: string, required = false, icon?: React.ReactNode) => (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
        {label}{required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
        <input
          value={(form[key] as string) ?? ""}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          className={`w-full ${icon ? "pl-9" : "px-3"} py-2 border rounded-xl outline-none focus:border-primary text-sm bg-white ${errors[key] ? "border-rose-400" : "border-slate-200"}`}
        />
      </div>
      {errors[key] && <p className="text-xs text-rose-600 mt-0.5">{errors[key]}</p>}
    </div>
  );

  const steps = ["Basic Info", "Location & Contact", "Financial Settings"];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {initial ? "Edit Branch" : "New Branch / فرع جديد"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Branch Setup Wizard</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        {/* Step indicators */}
        <div className="px-6 pt-4 pb-0">
          <div className="flex items-center gap-0">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step > i + 1 ? "bg-emerald-500 text-white" :
                    step === i + 1 ? "bg-primary text-white shadow-lg shadow-primary/30" :
                    "bg-slate-100 text-slate-400"
                  }`}>
                    {step > i + 1 ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${step === i + 1 ? "text-slate-700" : "text-slate-400"}`}>{s}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 transition-colors ${step > i + 1 ? "bg-emerald-400" : "bg-slate-200"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-slate-600">
                Step 1: Enter the branch's basic information — الخطوة الأولى: المعلومات الأساسية
              </div>
              {field("Branch Name (English) *", "name", "e.g. Asad Al-Hamra – Main Branch", true)}
              {field("Branch Name (Arabic) — الاسم بالعربية", "nameAr", "مثال: أسد الحمراء - الفرع الرئيسي")}
              {field("Brand Name — اسم العلامة التجارية", "brandName", "e.g. Asad Al-Hamra", false, <Tag className="w-3.5 h-3.5" />)}
              {field("Branch Code — كود الفرع", "branchCode", "e.g. AAH-01", false, <Hash className="w-3.5 h-3.5" />)}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</label>
                <select
                  value={form.status ?? "active"}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-primary bg-white text-sm"
                >
                  <option value="active">Active — نشط</option>
                  <option value="inactive">Inactive — غير نشط</option>
                  <option value="archived">Archived — مؤرشف</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-slate-600">
                Step 2: Location & contact details — الخطوة الثانية: الموقع وبيانات التواصل
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">City — المدينة</label>
                <select
                  value={form.city ?? ""}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-primary bg-white text-sm"
                >
                  <option value="">— Select City —</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {field("Address — العنوان", "address", "Street, District, Postal Code", false, <MapPin className="w-3.5 h-3.5" />)}
              {field("Phone Number — رقم الهاتف", "phone", "+966 5X XXX XXXX", false, <Phone className="w-3.5 h-3.5" />)}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-slate-600">
                Step 3: Financial & tax settings — الخطوة الثالثة: الإعدادات المالية والضريبية
              </div>
              {field("VAT / Tax Number — الرقم الضريبي", "taxNumber", "e.g. 3100000000000003", false, <Globe className="w-3.5 h-3.5" />)}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-600">Auto-generated on creation:</p>
                <ul className="text-xs text-slate-500 space-y-1">
                  <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Default expense categories</li>
                  <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Sales categories (Food & Beverage)</li>
                  <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Inventory structure</li>
                  <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> VAT 15% setting (Saudi ZATCA)</li>
                  <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Included in consolidated reports</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl"
          >
            {step > 1 ? "← Back" : "Cancel"}
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90"
            >
              Next Step →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm disabled:opacity-60 flex items-center gap-2"
            >
              {isPending ? "Saving..." : <><Check className="w-4 h-4" />{initial ? "Save Changes" : "Create Branch"}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status as Status) in STATUS_BADGE ? status as Status : "active";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_BADGE[s]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s === "active" ? "bg-emerald-500" : s === "inactive" ? "bg-amber-500" : "bg-slate-400"}`} />
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

export default function Branches() {
  const { data: restaurants = [], refetch } = useListRestaurants({ includeArchived: "true" } as Parameters<typeof useListRestaurants>[0]);
  const createMut   = useCreateRestaurant();
  const updateMut   = useUpdateRestaurant();
  const statusMut   = useSetRestaurantStatus();
  const deleteMut   = useDeleteRestaurant();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Restaurant | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | Status>("all");
  const [confirmAction, setConfirmAction] = useState<{ type: "archive" | "restore" | "delete"; branch: Restaurant } | null>(null);

  const filtered = (restaurants as Restaurant[]).filter(r => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.brandName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.city ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  function handleSave(data: CreateRestaurant) {
    if (editTarget) {
      updateMut.mutate(
        { id: editTarget.id, data },
        { onSuccess: () => { setEditTarget(null); setShowModal(false); refetch(); } }
      );
    } else {
      createMut.mutate(
        { data },
        { onSuccess: () => { setShowModal(false); refetch(); } }
      );
    }
  }

  function handleStatusChange(r: Restaurant, status: Status) {
    statusMut.mutate(
      { id: r.id, data: { status } },
      { onSuccess: () => refetch() }
    );
  }

  function handleConfirmedAction() {
    if (!confirmAction) return;
    if (confirmAction.type === "archive") {
      handleStatusChange(confirmAction.branch, "archived");
    } else if (confirmAction.type === "restore") {
      handleStatusChange(confirmAction.branch, "active");
    } else if (confirmAction.type === "delete") {
      deleteMut.mutate(
        { id: confirmAction.branch.id },
        { onSuccess: () => refetch() }
      );
    }
    setConfirmAction(null);
  }

  const counts = {
    active:   (restaurants as Restaurant[]).filter(r => r.status === "active").length,
    inactive: (restaurants as Restaurant[]).filter(r => r.status === "inactive").length,
    archived: (restaurants as Restaurant[]).filter(r => r.status === "archived").length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-primary" />
            Branch Management
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">إدارة الفروع والمطاعم — Manage all branches and restaurant locations</p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowModal(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm shadow-lg shadow-primary/25"
        >
          <Plus className="w-4 h-4" /> New Branch
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Branches", count: counts.active, color: "emerald", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
          { label: "Inactive Branches", count: counts.inactive, color: "amber", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
          { label: "Archived Branches", count: counts.archived, color: "slate", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-600" },
        ].map(c => (
          <div key={c.label} className={`${c.bg} ${c.border} border rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${c.text}`}>{c.count}</p>
            <p className={`text-xs font-medium ${c.text} mt-0.5`}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search branches by name, brand, or city..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-primary text-sm bg-white"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
          className="px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-primary bg-white text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Branch Cards Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No branches found</p>
          <p className="text-sm">Try adjusting your filters or add a new branch</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(r => (
            <div
              key={r.id}
              className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow ${r.status === "archived" ? "opacity-70" : ""}`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    r.status === "active" ? "bg-primary/10" :
                    r.status === "inactive" ? "bg-amber-100" : "bg-slate-100"
                  }`}>
                    <Store className={`w-5 h-5 ${r.status === "active" ? "text-primary" : r.status === "inactive" ? "text-amber-600" : "text-slate-400"}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm leading-tight">{r.name}</h3>
                    {r.nameAr && <p className="text-xs text-slate-400 font-arabic">{r.nameAr}</p>}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>

              {/* Card Details */}
              <div className="space-y-1.5 mb-4">
                {r.brandName && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="font-medium">{r.brandName}</span>
                  </div>
                )}
                {r.branchCode && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Hash className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-mono">{r.branchCode}</span>
                  </div>
                )}
                {r.city && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{r.city}{r.address ? ` — ${r.address}` : ""}</span>
                  </div>
                )}
                {r.phone && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span dir="ltr">{r.phone}</span>
                  </div>
                )}
                {r.taxNumber && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Globe className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-mono">{r.taxNumber}</span>
                  </div>
                )}
              </div>

              {/* Card Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => { setEditTarget(r); setShowModal(true); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                {r.status !== "archived" ? (
                  <button
                    onClick={() => setConfirmAction({ type: "archive", branch: r })}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50 rounded-lg border border-amber-200"
                  >
                    <Archive className="w-3 h-3" /> Archive
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmAction({ type: "restore", branch: r })}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg border border-emerald-200"
                  >
                    <RefreshCw className="w-3 h-3" /> Restore
                  </button>
                )}
                <button
                  onClick={() => setConfirmAction({ type: "delete", branch: r })}
                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg border border-rose-200"
                  title="Delete (archive)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Status Quick-Change */}
              {r.status !== "archived" && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleStatusChange(r, "active")}
                    className={`flex-1 py-1 text-[10px] font-semibold rounded-lg transition-colors ${r.status === "active" ? "bg-emerald-100 text-emerald-700" : "text-slate-400 hover:bg-slate-100"}`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => handleStatusChange(r, "inactive")}
                    className={`flex-1 py-1 text-[10px] font-semibold rounded-lg transition-colors ${r.status === "inactive" ? "bg-amber-100 text-amber-700" : "text-slate-400 hover:bg-slate-100"}`}
                  >
                    Inactive
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Branch Modal */}
      {showModal && (
        <BranchModal
          initial={editTarget ?? undefined}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSave={handleSave}
          isPending={createMut.isPending || updateMut.isPending}
        />
      )}

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                confirmAction.type === "delete" ? "bg-rose-100" : confirmAction.type === "archive" ? "bg-amber-100" : "bg-emerald-100"
              }`}>
                {confirmAction.type === "delete" ? <Trash2 className="w-5 h-5 text-rose-600" /> :
                 confirmAction.type === "archive" ? <Archive className="w-5 h-5 text-amber-600" /> :
                 <RefreshCw className="w-5 h-5 text-emerald-600" />}
              </div>
              <div>
                <h3 className="font-bold text-slate-800">
                  {confirmAction.type === "archive" ? "Archive Branch?" :
                   confirmAction.type === "restore" ? "Restore Branch?" : "Delete Branch?"}
                </h3>
                <p className="text-xs text-slate-500">{confirmAction.branch.name}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              {confirmAction.type === "archive"
                ? "The branch will be archived and hidden from operational views. All financial data is preserved."
                : confirmAction.type === "restore"
                ? "The branch will be restored to active status."
                : "This will archive the branch (soft delete). All financial history is permanently preserved."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="flex-1 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancel
              </button>
              <button
                onClick={handleConfirmedAction}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl text-white ${
                  confirmAction.type === "delete" ? "bg-rose-600 hover:bg-rose-700" :
                  confirmAction.type === "archive" ? "bg-amber-500 hover:bg-amber-600" :
                  "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {confirmAction.type === "archive" ? "Archive" : confirmAction.type === "restore" ? "Restore" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
