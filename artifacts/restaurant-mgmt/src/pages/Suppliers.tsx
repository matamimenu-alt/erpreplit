import { useState } from "react";
import { useListSuppliers } from "@workspace/api-client-react";
import { useSupplierMutations } from "@/hooks/use-suppliers";
import { PageHeader } from "@/components/ui/PageHeader";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Building2, Phone, Mail, User } from "lucide-react";

const supplierSchema = z.object({
  name: z.string().min(1, "Required"),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
});
type FormValues = z.infer<typeof supplierSchema>;

export default function Suppliers() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: suppliers, isLoading } = useListSuppliers();
  const { createSupplier, removeSupplier } = useSupplierMutations();

  const form = useForm<FormValues>({ resolver: zodResolver(supplierSchema) });

  return (
    <div>
      <PageHeader 
        title="Supplier Directory" 
        description="Manage vendors and contact information."
        action={
          <button 
            onClick={() => setIsDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <p>Loading...</p>
        ) : suppliers?.map((s) => (
          <div key={s.id} className="bg-card rounded-2xl p-6 shadow-sm border hover:shadow-md transition-shadow relative group">
            <button 
              onClick={() => removeSupplier.mutate({ id: s.id })}
              className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-1">{s.name}</h3>
            
            <div className="space-y-2 mt-4 text-sm text-slate-600">
              {s.contactPerson && (
                <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-400" /> {s.contactPerson}</div>
              )}
              {s.phone && (
                <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /> {s.phone}</div>
              )}
              {s.email && (
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" /> {s.email}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Add Supplier</h2>
            </div>
            <form onSubmit={form.handleSubmit((d) => createSupplier.mutate({ data: d }, { onSuccess: () => { setIsDialogOpen(false); form.reset(); } }))} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Company Name *</label>
                <input {...form.register("name")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contact Person</label>
                <input {...form.register("contactPerson")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input {...form.register("phone")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input {...form.register("email")} className="w-full px-3 py-2 border rounded-xl outline-none focus:border-primary" />
              </div>
              
              <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                <button type="button" onClick={() => setIsDialogOpen(false)} className="px-4 py-2 font-medium">Cancel</button>
                <button type="submit" disabled={createSupplier.isPending} className="px-6 py-2 bg-primary text-white rounded-xl shadow-md">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
