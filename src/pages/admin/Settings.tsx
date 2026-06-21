import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GlassCard, LoadingBlock, PageHead, logAdminAction } from "./_shared";

export default function AdminSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => (await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (data) setForm(data); }, [data]);

  async function save() {
    const { error } = await supabase.from("app_settings").upsert({ ...form, id: 1, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    await logAdminAction(supabase, "update_settings", "app_settings", "1", form);
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["admin", "settings"] });
  }

  if (isLoading || !form) return <LoadingBlock />;

  return (
    <div>
      <PageHead title="System Settings" subtitle="Payment gateway & company bank details" icon={SettingsIcon} />
      <div className="grid lg:grid-cols-2 gap-4">
        <GlassCard className="p-5">
          <h3 className="font-semibold text-white mb-3">Paystack</h3>
          <Field label="Public key"><input value={form.paystack_public_key || ""} onChange={(e) => setForm({ ...form, paystack_public_key: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm font-mono" placeholder="pk_test_..." /></Field>
          <Field label="Mode">
            <select value={form.paystack_mode} onChange={(e) => setForm({ ...form, paystack_mode: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm">
              <option value="test">Test</option><option value="live">Live</option>
            </select>
          </Field>
        </GlassCard>
        <GlassCard className="p-5">
          <h3 className="font-semibold text-white mb-3">Company bank (Opay)</h3>
          <Field label="Bank name"><input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm" /></Field>
          <Field label="Account name"><input value={form.bank_account_name} onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm" /></Field>
          <Field label="Account number"><input value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm font-mono" /></Field>
        </GlassCard>
      </div>
      <button onClick={save} className="mt-4 px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold">Save settings</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-3"><label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">{label}</label>{children}</div>;
}