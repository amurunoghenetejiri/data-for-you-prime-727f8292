import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Settings as SettingsIcon, KeyRound, Loader2 } from "lucide-react";
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

  // Change password state
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdBusy, setPwdBusy] = useState(false);

  async function save() {
    const { error } = await supabase.from("app_settings").upsert({ ...form, id: 1, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    await logAdminAction(supabase, "update_settings", "app_settings", "1", form);
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["admin", "settings"] });
  }

  async function changePassword() {
    if (pwd.next.length < 8) return toast.error("New password must be at least 8 characters");
    if (pwd.next !== pwd.confirm) return toast.error("New passwords do not match");
    setPwdBusy(true);
    // Re-authenticate to verify the current password
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (!email) { setPwdBusy(false); return toast.error("No active session"); }
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: pwd.current });
    if (reauthErr) { setPwdBusy(false); return toast.error("Current password is incorrect"); }
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    if (error) { setPwdBusy(false); return toast.error(error.message); }
    await logAdminAction(supabase, "admin_password_changed", "auth", userData.user!.id, {});
    toast.success("Password updated. Please sign in again.");
    await supabase.auth.signOut();
    setPwdBusy(false);
    window.location.href = "/admin";
  }

  if (isLoading || !form) return <LoadingBlock />;

  return (
    <div>
      <PageHead title="System Settings" subtitle="Payment gateway, bank details & admin security" icon={SettingsIcon} />
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
          <h3 className="font-semibold text-white mb-3">Company bank</h3>
          <Field label="Bank name"><input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm" /></Field>
          <Field label="Account name"><input value={form.bank_account_name} onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm" /></Field>
          <Field label="Account number"><input value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm font-mono" /></Field>
        </GlassCard>
      </div>
      <button onClick={save} className="mt-4 px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold">Save settings</button>

      <div className="mt-8 grid lg:grid-cols-2 gap-4">
        <GlassCard className="p-5">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2"><KeyRound className="h-4 w-4 text-violet-300" /> Change password</h3>
          <Field label="Current password"><input type="password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm" /></Field>
          <Field label="New password"><input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm" /></Field>
          <Field label="Confirm new password"><input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm" /></Field>
          <button onClick={changePassword} disabled={pwdBusy} className="mt-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2">
            {pwdBusy && <Loader2 className="h-4 w-4 animate-spin" />} Update password
          </button>
          <p className="text-[11px] text-slate-500 mt-3">You'll be signed out after a successful change.</p>
        </GlassCard>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-3"><label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">{label}</label>{children}</div>;
}
