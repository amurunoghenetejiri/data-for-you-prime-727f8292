import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyBlock, GlassCard, LoadingBlock, PageHead, fmtNaira, logAdminAction } from "./_shared";

const NETWORKS = ["MTN", "Airtel", "Glo", "9mobile"];
const CATEGORIES = ["data", "airtime-discount", "bonus", "promo"];
const LABELS = ["", "Hot Deal", "Limited Offer", "New", "Best Seller"];

type P = any;

export default function AdminProducts() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<P | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("network").order("display_order").order("price");
      if (error) throw error;
      return data || [];
    },
  });

  async function save(form: P) {
    const payload = { ...form, price: Number(form.price), discount_percent: Number(form.discount_percent || 0), cashback_percent: Number(form.cashback_percent || 0), display_order: Number(form.display_order || 0) };
    if (form.id) {
      const { error } = await supabase.from("products").update(payload).eq("id", form.id);
      if (error) return toast.error(error.message);
      await logAdminAction(supabase, "update_product", "product", form.id, { name: form.name });
    } else {
      delete payload.id;
      const { error } = await supabase.from("products").insert(payload);
      if (error) return toast.error(error.message);
      await logAdminAction(supabase, "create_product", "product", null, { name: form.name });
    }
    toast.success("Saved");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
  }

  async function toggle(p: P) {
    await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    await logAdminAction(supabase, "toggle_product", "product", p.id, { active: !p.is_active });
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
  }
  async function remove(p: P) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    await supabase.from("products").delete().eq("id", p.id);
    await logAdminAction(supabase, "delete_product", "product", p.id, {});
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
    toast.info("Deleted");
  }

  return (
    <div>
      <PageHead title="Product Management" subtitle="Data plans, bonuses, discounts & promos" icon={Package}
        actions={<button onClick={() => { setEditing({ network: "MTN", category: "data", is_active: true }); setOpen(true); }} className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm flex items-center gap-1.5"><Plus className="h-4 w-4" /> New product</button>} />

      <GlassCard className="overflow-hidden">
        {isLoading ? <LoadingBlock /> : !data?.length ? <EmptyBlock icon={Package} title="No products yet" body="Add your first data plan or promo." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-900/40">
                <tr><th className="text-left px-4 py-3">Network</th><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Category</th><th className="text-right px-4 py-3">Price</th><th className="text-right px-4 py-3">Disc/Back</th><th className="text-left px-4 py-3">Label</th><th className="text-left px-4 py-3">Active</th><th className="text-right px-4 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map((p: P) => (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-semibold text-violet-300">{p.network}</td>
                    <td className="px-4 py-2.5 text-white">{p.name}<div className="text-[11px] text-slate-500">{p.data_size} · {p.validity}</div></td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 capitalize">{p.category}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-white">{fmtNaira(p.price)}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-slate-300">{p.discount_percent}% / {p.cashback_percent}%</td>
                    <td className="px-4 py-2.5 text-xs">{p.label || "—"}</td>
                    <td className="px-4 py-2.5"><button onClick={() => toggle(p)} className={"px-2 py-0.5 rounded-full text-[10px] font-semibold border " + (p.is_active ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-slate-500/15 text-slate-300 border-slate-500/30")}>{p.is_active ? "ON" : "OFF"}</button></td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setEditing(p); setOpen(true); }} className="p-1.5 rounded-md hover:bg-white/10 text-slate-300"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remove(p)} className="p-1.5 rounded-md hover:bg-rose-500/20 text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const obj: any = Object.fromEntries(fd.entries()); obj.id = editing.id; obj.is_active = editing.is_active; save(obj); }} className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Network"><select name="network" defaultValue={editing.network} className="h-10 px-3 rounded-lg bg-muted border border-border w-full">{NETWORKS.map(n => <option key={n}>{n}</option>)}</select></Field>
                <Field label="Category"><select name="category" defaultValue={editing.category} className="h-10 px-3 rounded-lg bg-muted border border-border w-full">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field>
              </div>
              <Field label="Plan name"><input name="name" required defaultValue={editing.name || ""} className="h-10 px-3 rounded-lg bg-muted border border-border w-full" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data size"><input name="data_size" defaultValue={editing.data_size || ""} className="h-10 px-3 rounded-lg bg-muted border border-border w-full" placeholder="1GB" /></Field>
                <Field label="Validity"><input name="validity" defaultValue={editing.validity || ""} className="h-10 px-3 rounded-lg bg-muted border border-border w-full" placeholder="30 days" /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Price (₦)"><input name="price" type="number" step="0.01" required defaultValue={editing.price || ""} className="h-10 px-3 rounded-lg bg-muted border border-border w-full" /></Field>
                <Field label="Discount %"><input name="discount_percent" type="number" defaultValue={editing.discount_percent || 0} className="h-10 px-3 rounded-lg bg-muted border border-border w-full" /></Field>
                <Field label="Cashback %"><input name="cashback_percent" type="number" defaultValue={editing.cashback_percent || 0} className="h-10 px-3 rounded-lg bg-muted border border-border w-full" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Label"><select name="label" defaultValue={editing.label || ""} className="h-10 px-3 rounded-lg bg-muted border border-border w-full">{LABELS.map(l => <option key={l} value={l}>{l || "(none)"}</option>)}</select></Field>
                <Field label="Display order"><input name="display_order" type="number" defaultValue={editing.display_order || 0} className="h-10 px-3 rounded-lg bg-muted border border-border w-full" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Countdown start"><input name="countdown_start" type="datetime-local" defaultValue={editing.countdown_start ? editing.countdown_start.slice(0, 16) : ""} className="h-10 px-3 rounded-lg bg-muted border border-border w-full" /></Field>
                <Field label="Countdown end"><input name="countdown_end" type="datetime-local" defaultValue={editing.countdown_end ? editing.countdown_end.slice(0, 16) : ""} className="h-10 px-3 rounded-lg bg-muted border border-border w-full" /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Active</label>
              <button type="submit" className="w-full h-11 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold">Save product</button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>{children}</div>;
}