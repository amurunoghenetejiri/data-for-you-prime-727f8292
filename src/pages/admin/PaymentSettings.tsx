import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Loader2, Plus, Trash2, Save, KeyRound, Building2, CheckCircle2, XCircle, Star, Edit2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GlassCard, LoadingBlock, PageHead, StatusPill, logAdminAction } from "./_shared";

type BankRow = {
  id: string; bank_name: string; account_name: string; account_number: string;
  account_type: string | null; instructions: string | null;
  is_default: boolean; is_active: boolean; sort_order: number;
};

const SECRET_LABELS: Record<string, string> = {
  paystack_test_secret_key: "Test Secret Key",
  paystack_live_secret_key: "Live Secret Key",
  paystack_webhook_secret: "Webhook Secret",
};

export default function AdminPaymentSettings() {
  const qc = useQueryClient();

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["admin", "payment_settings"],
    queryFn: async () => (await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const { data: secretStatus, refetch: refetchSecrets } = useQuery({
    queryKey: ["admin", "secret_status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-secrets", { method: "GET" as any });
      if (error) throw error;
      return data?.secrets as Record<string, { set: boolean; updated_at?: string }>;
    },
  });

  const [secretDraft, setSecretDraft] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [savingSecret, setSavingSecret] = useState<string | null>(null);

  async function saveSecret(name: string) {
    const value = (secretDraft[name] || "").trim();
    if (!value) return toast.error("Enter a value first");
    setSavingSecret(name);
    try {
      const { data, error } = await supabase.functions.invoke("admin-secrets", { body: { action: "save", name, value } });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`${SECRET_LABELS[name]} saved`);
      setSecretDraft((s) => ({ ...s, [name]: "" }));
      refetchSecrets();
    } catch (e: any) {
      toast.error(e.message || "Could not save secret");
    } finally { setSavingSecret(null); }
  }

  async function deleteSecret(name: string) {
    if (!confirm(`Remove ${SECRET_LABELS[name]}?`)) return;
    const { error } = await supabase.functions.invoke("admin-secrets", { body: { action: "delete", name } });
    if (error) return toast.error(error.message);
    toast.success("Removed");
    refetchSecrets();
  }

  async function saveSettings() {
    if (!form) return;
    const patch = {
      id: 1,
      paystack_enabled: !!form.paystack_enabled,
      manual_bank_enabled: !!form.manual_bank_enabled,
      paystack_mode: form.paystack_mode || "test",
      paystack_test_public_key: form.paystack_test_public_key || "",
      paystack_live_public_key: form.paystack_live_public_key || "",
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("app_settings").upsert(patch);
    if (error) return toast.error(error.message);
    await logAdminAction(supabase, "update_payment_settings", "app_settings", "1", patch);
    toast.success("Payment settings saved");
    qc.invalidateQueries({ queryKey: ["admin", "payment_settings"] });
  }

  // ---------- Bank Accounts ----------
  const { data: banks, isLoading: loadingBanks, refetch: refetchBanks } = useQuery({
    queryKey: ["admin", "payment_banks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_bank_accounts").select("*").order("sort_order").order("created_at");
      if (error) throw error;
      return data as BankRow[];
    },
  });

  const [editing, setEditing] = useState<Partial<BankRow> | null>(null);

  async function saveBank() {
    if (!editing) return;
    const payload = {
      bank_name: (editing.bank_name || "").trim(),
      account_name: (editing.account_name || "").trim(),
      account_number: (editing.account_number || "").trim(),
      account_type: editing.account_type || "Savings",
      instructions: editing.instructions || null,
      is_default: !!editing.is_default,
      is_active: editing.is_active !== false,
      sort_order: Number(editing.sort_order || 0),
    };
    if (!payload.bank_name || !payload.account_name || payload.account_number.length < 8) {
      return toast.error("Bank name, account name and a valid account number are required");
    }
    let error;
    if (editing.id) {
      ({ error } = await supabase.from("payment_bank_accounts").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("payment_bank_accounts").insert(payload));
    }
    if (error) return toast.error(error.message);
    await logAdminAction(supabase, editing.id ? "edit_bank_account" : "add_bank_account", "payment_bank_accounts", editing.id, payload);
    toast.success("Saved");
    setEditing(null);
    refetchBanks();
  }

  async function deleteBank(id: string) {
    if (!confirm("Delete this bank account?")) return;
    const { error } = await supabase.from("payment_bank_accounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAdminAction(supabase, "delete_bank_account", "payment_bank_accounts", id, {});
    toast.success("Deleted");
    refetchBanks();
  }

  async function setDefault(row: BankRow) {
    const { error } = await supabase.from("payment_bank_accounts").update({ is_default: true, is_active: true }).eq("id", row.id);
    if (error) return toast.error(error.message);
    await logAdminAction(supabase, "set_default_bank", "payment_bank_accounts", row.id, { bank_name: row.bank_name });
    refetchBanks();
    toast.success(`${row.bank_name} is now default`);
  }

  async function toggleActive(row: BankRow) {
    const { error } = await supabase.from("payment_bank_accounts").update({ is_active: !row.is_active }).eq("id", row.id);
    if (error) return toast.error(error.message);
    refetchBanks();
  }

  const mode = form?.paystack_mode || "test";
  const activePubKey = useMemo(() => mode === "live" ? form?.paystack_live_public_key : form?.paystack_test_public_key, [form, mode]);

  if (loadingSettings) return <LoadingBlock />;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHead title="Payment Settings" subtitle="Control Paystack and manual bank transfer for the entire site." icon={CreditCard} />

      {/* Toggles */}
      <GlassCard className="p-5 mb-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <ToggleRow
            label="Paystack (instant card / USSD / bank)"
            desc="When off, users won't see the Paystack option on the wallet page."
            checked={!!form?.paystack_enabled}
            onChange={(v) => setForm({ ...form, paystack_enabled: v })}
          />
          <ToggleRow
            label="Manual bank transfer"
            desc="When off, users can't submit receipts for manual funding."
            checked={!!form?.manual_bank_enabled}
            onChange={(v) => setForm({ ...form, manual_bank_enabled: v })}
          />
        </div>
      </GlassCard>

      {/* Paystack */}
      <GlassCard className="p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-300 grid place-items-center border border-emerald-500/30"><KeyRound className="h-5 w-5" /></div>
            <div>
              <h3 className="text-white font-semibold">Paystack Configuration</h3>
              <p className="text-xs text-slate-400">Currently in <span className="uppercase font-semibold text-emerald-300">{mode}</span> mode</p>
            </div>
          </div>
          <Button onClick={saveSettings} className="bg-violet-600 hover:bg-violet-500"><Save className="h-4 w-4 mr-2" />Save</Button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-300 text-xs">Mode</Label>
            <Select value={mode} onValueChange={(v) => setForm({ ...form, paystack_mode: v })}>
              <SelectTrigger className="bg-slate-900/60 border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="test">Test mode</SelectItem><SelectItem value="live">Live mode</SelectItem></SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500 mt-1">The active mode chooses which key pair the site uses.</p>
          </div>
          <div>
            <Label className="text-slate-300 text-xs">Active Public Key ({mode})</Label>
            <Input
              className="bg-slate-900/60 border-white/10 text-white font-mono text-xs"
              value={activePubKey || ""}
              placeholder={`pk_${mode}_...`}
              onChange={(e) => setForm({ ...form, [mode === "live" ? "paystack_live_public_key" : "paystack_test_public_key"]: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-slate-300 text-xs">Test Public Key</Label>
            <Input className="bg-slate-900/60 border-white/10 text-white font-mono text-xs"
              value={form?.paystack_test_public_key || ""} placeholder="pk_test_..."
              onChange={(e) => setForm({ ...form, paystack_test_public_key: e.target.value })} />
          </div>
          <div>
            <Label className="text-slate-300 text-xs">Live Public Key</Label>
            <Input className="bg-slate-900/60 border-white/10 text-white font-mono text-xs"
              value={form?.paystack_live_public_key || ""} placeholder="pk_live_..."
              onChange={(e) => setForm({ ...form, paystack_live_public_key: e.target.value })} />
          </div>
        </div>

        {/* Secret keys */}
        <div className="mt-6 border-t border-white/5 pt-4">
          <h4 className="text-sm font-semibold text-white mb-3">Secret keys (encrypted, validated with Paystack before saving)</h4>
          <div className="space-y-3">
            {(["paystack_test_secret_key", "paystack_live_secret_key", "paystack_webhook_secret"] as const).map((name) => {
              const info = secretStatus?.[name];
              const isShown = !!showSecret[name];
              return (
                <div key={name} className="p-3 rounded-xl bg-slate-900/40 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-white font-medium">{SECRET_LABELS[name]}</div>
                    <div className="flex items-center gap-2">
                      {info?.set ? <StatusPill status="active" /> : <StatusPill status="pending" />}
                      {info?.updated_at && <span className="text-[10px] text-slate-500">updated {new Date(info.updated_at).toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Input
                        className="bg-slate-950/60 border-white/10 text-white font-mono text-xs pr-9"
                        type={isShown ? "text" : "password"}
                        placeholder={info?.set ? "•••••••• (enter a new value to replace)" : "Paste your key…"}
                        value={secretDraft[name] || ""}
                        onChange={(e) => setSecretDraft({ ...secretDraft, [name]: e.target.value })}
                      />
                      <button type="button" onClick={() => setShowSecret({ ...showSecret, [name]: !isShown })}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                        {isShown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button onClick={() => saveSecret(name)} disabled={savingSecret === name}
                      className="bg-emerald-600 hover:bg-emerald-500">
                      {savingSecret === name ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" />Save & validate</>}
                    </Button>
                    {info?.set && (
                      <Button variant="outline" onClick={() => deleteSecret(name)} className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {/* Bank Accounts */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/15 text-cyan-300 grid place-items-center border border-cyan-500/30"><Building2 className="h-5 w-5" /></div>
            <div>
              <h3 className="text-white font-semibold">Manual Bank Accounts</h3>
              <p className="text-xs text-slate-400">Users see the default (or any active) account on the wallet page in real-time.</p>
            </div>
          </div>
          <Button onClick={() => setEditing({ is_active: true, is_default: (banks || []).length === 0, account_type: "Savings" })} className="bg-violet-600 hover:bg-violet-500">
            <Plus className="h-4 w-4 mr-2" />Add bank
          </Button>
        </div>

        {loadingBanks ? <LoadingBlock /> : (
          <div className="space-y-2">
            {(banks || []).length === 0 && <p className="text-sm text-slate-400 text-center py-6">No bank accounts yet.</p>}
            {(banks || []).map((b) => (
              <div key={b.id} className="p-3 rounded-xl bg-slate-900/40 border border-white/5 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold">{b.bank_name}</span>
                    {b.is_default && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1"><Star className="h-3 w-3" />Default</span>}
                    <StatusPill status={b.is_active ? "active" : "blocked"} />
                  </div>
                  <p className="text-sm text-slate-300 mt-0.5">{b.account_name} · <span className="font-mono">{b.account_number}</span></p>
                  {b.instructions && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{b.instructions}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} />
                  {!b.is_default && <Button size="sm" variant="outline" onClick={() => setDefault(b)} className="border-white/10 text-white/80"><Star className="h-3.5 w-3.5 mr-1" />Default</Button>}
                  <Button size="sm" variant="outline" onClick={() => setEditing(b)} className="border-white/10 text-white/80"><Edit2 className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={() => deleteBank(b.id)} className="border-rose-500/30 text-rose-300"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit bank" : "Add bank"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <Field label="Bank name"><Input value={editing.bank_name || ""} onChange={(e) => setEditing({ ...editing, bank_name: e.target.value })} /></Field>
              <Field label="Account name"><Input value={editing.account_name || ""} onChange={(e) => setEditing({ ...editing, account_name: e.target.value })} /></Field>
              <Field label="Account number"><Input value={editing.account_number || ""} onChange={(e) => setEditing({ ...editing, account_number: e.target.value })} /></Field>
              <Field label="Account type">
                <Select value={editing.account_type || "Savings"} onValueChange={(v) => setEditing({ ...editing, account_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Savings">Savings</SelectItem>
                    <SelectItem value="Current">Current</SelectItem>
                    <SelectItem value="Corporate">Corporate</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Instructions / notes (shown to user)"><Textarea rows={3} value={editing.instructions || ""} onChange={(e) => setEditing({ ...editing, instructions: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sort order"><Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></Field>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 text-sm"><Switch checked={editing.is_default !== false ? !!editing.is_default : false} onCheckedChange={(v) => setEditing({ ...editing, is_default: v })} />Default</label>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={editing.is_active !== false} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />Active</label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveBank} className="bg-violet-600 hover:bg-violet-500">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="p-3 rounded-xl bg-slate-900/40 border border-white/5 flex items-start gap-3">
      <div className="mt-0.5">{checked ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-slate-500" />}</div>
      <div className="flex-1">
        <p className="text-white font-medium text-sm">{label}</p>
        {desc && <p className="text-xs text-slate-400">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="text-xs">{label}</Label><div className="mt-1">{children}</div></div>;
}
