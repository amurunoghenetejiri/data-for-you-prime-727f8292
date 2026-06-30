import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CreditCard, Settings, Loader2, Copy, Eye, EyeOff, Plus, Trash2,
  Edit2, Check, X, ChevronRight, Shield
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GlassCard, LoadingBlock, PageHead, logAdminAction, EmptyBlock } from "./_shared";

export default function PaymentSettings() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"providers" | "paystack" | "monnify" | "manual">("providers");

  return (
    <div>
      <PageHead
        title="Payment Settings"
        subtitle="Manage payment providers and manual payment methods"
        icon={CreditCard}
      />

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: "providers", label: "Providers" },
          { id: "paystack", label: "Paystack" },
          { id: "monnify", label: "Monnify" },
          { id: "manual", label: "Manual Methods" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "providers" && <PaymentProvidersTab />}
      {activeTab === "paystack" && <PaystackConfigTab />}
      {activeTab === "monnify" && <MonnifyConfigTab />}
      {activeTab === "manual" && <ManualPaymentMethodsTab />}
    </div>
  );
}

// Payment Providers Tab
function PaymentProvidersTab() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "payment_providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_providers")
        .select("*")
        .order("provider_name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 30000,
    retry: 1,
  });

  const qc = useQueryClient();

  async function toggleProvider(provider: any) {
    try {
      const { error } = await supabase
        .from("payment_providers")
        .update({ is_enabled: !provider.is_enabled })
        .eq("id", provider.id);

      if (error) throw error;
      
      await logAdminAction(supabase, "toggle_payment_provider", "payment_provider", provider.id, {
        provider_name: provider.provider_name,
        enabled: !provider.is_enabled,
      });
      
      toast.success(`${provider.provider_name} ${!provider.is_enabled ? "enabled" : "disabled"}`);
      qc.invalidateQueries({ queryKey: ["admin", "payment_providers"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update provider");
    }
  }

  if (isLoading) return <LoadingBlock />;
  if (error) return <div className="text-rose-300">Failed to load providers</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data?.map((provider: any) => (
        <GlassCard key={provider.id} className="p-5">
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-semibold text-white capitalize">{provider.provider_name.replace(/_/g, " ")}</h3>
            <button
              onClick={() => toggleProvider(provider)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                provider.is_enabled
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "bg-slate-500/15 text-slate-300 border border-slate-500/30"
              }`}
            >
              {provider.is_enabled ? "Enabled" : "Disabled"}
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            {provider.provider_name === "paystack" && "Card, USSD, Bank Transfer, etc."}
            {provider.provider_name === "monnify" && "Transfer, USSD, Card Payments"}
            {provider.provider_name === "manual_bank_transfer" && "Manual bank transfer requests"}
          </p>
          <button className="w-full px-3 py-2 rounded-lg bg-violet-600/20 text-violet-300 text-sm font-medium hover:bg-violet-600/30 transition flex items-center justify-center gap-2">
            <Settings className="h-4 w-4" />
            Configure
          </button>
        </GlassCard>
      ))}
    </div>
  );
}

// Paystack Configuration Tab
function PaystackConfigTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "paystack_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paystack_config")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30000,
    retry: 1,
  });

  const [form, setForm] = useState<any>(null);
  const [showSecrets, setShowSecrets] = useState({ test: false, live: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function save() {
    if (!form) return;
    setBusy(true);

    try {
      const { error } = await supabase
        .from("paystack_config")
        .update({
          ...form,
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", form.id);

      if (error) throw error;

      await logAdminAction(supabase, "update_paystack_config", "paystack_config", form.id, {
        mode: form.mode,
      });

      toast.success("Paystack configuration saved");
      qc.invalidateQueries({ queryKey: ["admin", "paystack_config"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !form) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <Shield className="h-5 w-5 text-violet-300" />
          <h3 className="font-semibold text-white">Paystack Configuration</h3>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Test Mode */}
          <div className="space-y-4 p-4 rounded-lg bg-white/5 border border-white/10">
            <h4 className="font-medium text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              Test Mode
            </h4>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
                Public Key
              </label>
              <div className="flex gap-2">
                <input
                  type={showSecrets.test ? "text" : "password"}
                  value={form.test_public_key || ""}
                  onChange={(e) => setForm({ ...form, test_public_key: e.target.value })}
                  placeholder="pk_test_..."
                  className="flex-1 h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(form.test_public_key || "");
                    toast.success("Copied");
                  }}
                  className="h-10 w-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
                Secret Key
              </label>
              <div className="flex gap-2">
                <input
                  type={showSecrets.test ? "text" : "password"}
                  value={form.test_secret_key || ""}
                  onChange={(e) => setForm({ ...form, test_secret_key: e.target.value })}
                  placeholder="sk_test_..."
                  className="flex-1 h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
                />
                <button
                  onClick={() => setShowSecrets({ ...showSecrets, test: !showSecrets.test })}
                  className="h-10 w-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center"
                >
                  {showSecrets.test ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
                Webhook Secret (Optional)
              </label>
              <input
                type="password"
                value={form.test_webhook_secret || ""}
                onChange={(e) => setForm({ ...form, test_webhook_secret: e.target.value })}
                placeholder="whsec_test_..."
                className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
              />
            </div>
          </div>

          {/* Live Mode */}
          <div className="space-y-4 p-4 rounded-lg bg-white/5 border border-rose-500/20">
            <h4 className="font-medium text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500"></span>
              Live Mode
            </h4>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
                Public Key
              </label>
              <div className="flex gap-2">
                <input
                  type={showSecrets.live ? "text" : "password"}
                  value={form.live_public_key || ""}
                  onChange={(e) => setForm({ ...form, live_public_key: e.target.value })}
                  placeholder="pk_live_..."
                  className="flex-1 h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(form.live_public_key || "");
                    toast.success("Copied");
                  }}
                  className="h-10 w-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
                Secret Key
              </label>
              <div className="flex gap-2">
                <input
                  type={showSecrets.live ? "text" : "password"}
                  value={form.live_secret_key || ""}
                  onChange={(e) => setForm({ ...form, live_secret_key: e.target.value })}
                  placeholder="sk_live_..."
                  className="flex-1 h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
                />
                <button
                  onClick={() => setShowSecrets({ ...showSecrets, live: !showSecrets.live })}
                  className="h-10 w-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center"
                >
                  {showSecrets.live ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
                Webhook Secret (Optional)
              </label>
              <input
                type="password"
                value={form.live_webhook_secret || ""}
                onChange={(e) => setForm({ ...form, live_webhook_secret: e.target.value })}
                placeholder="whsec_live_..."
                className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
              />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Active Mode</label>
          <select
            value={form.mode}
            onChange={(e) => setForm({ ...form, mode: e.target.value })}
            className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white"
          >
            <option value="test">Test Mode (Using test keys)</option>
            <option value="live">Live Mode (Using live keys)</option>
          </select>
          <p className="text-xs text-slate-400 mt-1">
            {form.mode === "test"
              ? "✓ Test mode is active. All transactions will use test credentials."
              : "⚠ Live mode is active. All transactions will use live credentials."}
          </p>
        </div>

        <button
          onClick={save}
          disabled={busy}
          className="mt-6 w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Configuration
        </button>
      </GlassCard>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-sm text-blue-300">
          💡 <strong>Tip:</strong> Configure both test and live keys. You can switch between them at any time without code changes.
        </p>
      </div>
    </div>
  );
}

// Monnify Configuration Tab
function MonnifyConfigTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "monnify_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monnify_config")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30000,
    retry: 1,
  });

  const [form, setForm] = useState<any>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function save() {
    if (!form) return;
    setBusy(true);

    try {
      const { error } = await supabase
        .from("monnify_config")
        .update({
          ...form,
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", form.id);

      if (error) throw error;

      await logAdminAction(supabase, "update_monnify_config", "monnify_config", form.id, {
        environment: form.environment,
        is_enabled: form.is_enabled,
      });

      toast.success("Monnify configuration saved");
      qc.invalidateQueries({ queryKey: ["admin", "monnify_config"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !form) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-violet-300" />
            <h3 className="font-semibold text-white">Monnify Configuration</h3>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_enabled}
              onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-slate-300">Enabled</span>
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
              Environment
            </label>
            <select
              value={form.environment}
              onChange={(e) => setForm({ ...form, environment: e.target.value })}
              className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white"
            >
              <option value="sandbox">Sandbox (Testing)</option>
              <option value="production">Production (Live)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
              API Key
            </label>
            <input
              type="text"
              value={form.api_key || ""}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder="Your Monnify API Key"
              className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
              Secret Key
            </label>
            <div className="flex gap-2">
              <input
                type={showSecret ? "text" : "password"}
                value={form.secret_key || ""}
                onChange={(e) => setForm({ ...form, secret_key: e.target.value })}
                placeholder="Your Monnify Secret Key"
                className="flex-1 h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
              />
              <button
                onClick={() => setShowSecret(!showSecret)}
                className="h-10 w-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
              Contract Code
            </label>
            <input
              type="text"
              value={form.contract_code || ""}
              onChange={(e) => setForm({ ...form, contract_code: e.target.value })}
              placeholder="Your Monnify Contract Code"
              className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
              Base URL
            </label>
            <input
              type="text"
              value={form.base_url || ""}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              placeholder={form.environment === "sandbox" ? "https://sandbox.monnify.com" : "https://api.monnify.com"}
              className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
            />
          </div>
        </div>

        <button
          onClick={save}
          disabled={busy}
          className="mt-6 w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Configuration
        </button>
      </GlassCard>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-sm text-blue-300">
          💡 <strong>Tip:</strong> Start with Sandbox to test integration, then switch to Production when ready for live payments.
        </p>
      </div>
    </div>
  );
}

// Manual Payment Methods Tab
function ManualPaymentMethodsTab() {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "manual_payment_methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_payment_methods")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 10000,
    retry: 1,
  });

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {isAddingNew && (
        <ManualPaymentMethodForm
          onClose={() => setIsAddingNew(false)}
          onSave={() => {
            refetch();
            setIsAddingNew(false);
            qc.invalidateQueries({ queryKey: ["admin", "manual_payment_methods"] });
          }}
        />
      )}

      {editingId && (
        <ManualPaymentMethodForm
          methodId={editingId}
          onClose={() => setEditingId(null)}
          onSave={() => {
            refetch();
            setEditingId(null);
            qc.invalidateQueries({ queryKey: ["admin", "manual_payment_methods"] });
          }}
        />
      )}

      {!isAddingNew && !editingId && (
        <button
          onClick={() => setIsAddingNew(true)}
          className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold flex items-center gap-2 hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Payment Method
        </button>
      )}

      <div className="grid gap-4">
        {isLoading ? (
          <LoadingBlock />
        ) : !data?.length ? (
          <EmptyBlock
            icon={CreditCard}
            title="No manual payment methods"
            body="Add payment methods like bank transfer, Opay, PalmPay, etc."
            action={<button onClick={() => setIsAddingNew(true)} className="px-4 py-2 rounded-lg bg-violet-600 text-white font-medium">Add Method</button>}
          />
        ) : (
          data.map((method: any) => (
            <GlassCard key={method.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-white">{method.display_name}</h4>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        method.is_enabled
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-slate-500/15 text-slate-300"
                      }`}
                    >
                      {method.is_enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  {method.bank_name && <p className="text-sm text-slate-400">Bank: {method.bank_name}</p>}
                  {method.account_name && <p className="text-sm text-slate-400">Account: {method.account_name}</p>}
                  {method.account_number && <p className="text-sm text-slate-400">Number: {method.account_number}</p>}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditingId(method.id)}
                    className="h-9 w-9 rounded-lg bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 flex items-center justify-center"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <DeletePaymentMethodButton methodId={method.id} onDeleted={() => refetch()} />
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}

// Manual Payment Method Form Component
function ManualPaymentMethodForm({
  methodId,
  onClose,
  onSave,
}: {
  methodId?: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const qc = useQueryClient();
  const { data: existingMethod, isLoading } = useQuery({
    queryKey: ["admin", "manual_payment_method", methodId],
    enabled: !!methodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_payment_methods")
        .select("*")
        .eq("id", methodId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5000,
    retry: 1,
  });

  const [form, setForm] = useState({
    display_name: "",
    bank_name: "",
    account_name: "",
    account_number: "",
    description: "",
    is_enabled: true,
    sort_order: 0,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (existingMethod) {
      setForm(existingMethod);
    }
  }, [existingMethod]);

  async function handleSave() {
    if (!form.display_name.trim()) return toast.error("Payment method name is required");

    setBusy(true);

    try {
      if (methodId) {
        const { error } = await supabase
          .from("manual_payment_methods")
          .update({
            ...form,
            updated_at: new Date().toISOString(),
            updated_by: (await supabase.auth.getUser()).data.user?.id,
          })
          .eq("id", methodId);

        if (error) throw error;
        
        await logAdminAction(supabase, "update_manual_payment_method", "manual_payment_method", methodId, {
          display_name: form.display_name,
        });
        
        toast.success("Payment method updated");
      } else {
        const { error } = await supabase.from("manual_payment_methods").insert({
          ...form,
          created_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        });

        if (error) throw error;
        
        await logAdminAction(supabase, "create_manual_payment_method", "manual_payment_method", null, {
          display_name: form.display_name,
        });
        
        toast.success("Payment method added");
      }

      qc.invalidateQueries({ queryKey: ["admin", "manual_payment_methods"] });
      onSave();
    } catch (err: any) {
      toast.error(err.message || "Failed to save payment method");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading && methodId) return <LoadingBlock />;

  return (
    <GlassCard className="p-6">
      <h3 className="font-semibold text-white mb-4">
        {methodId ? "Edit Payment Method" : "Add New Payment Method"}
      </h3>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
            Display Name *
          </label>
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            placeholder="e.g., Bank Transfer, Opay, PalmPay"
            className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
            Bank Name (Optional)
          </label>
          <input
            type="text"
            value={form.bank_name}
            onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
            placeholder="e.g., Access Bank, UBA, First Bank"
            className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
            Account Name (Optional)
          </label>
          <input
            type="text"
            value={form.account_name}
            onChange={(e) => setForm({ ...form, account_name: e.target.value })}
            placeholder="Your account holder name"
            className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
            Account Number (Optional)
          </label>
          <input
            type="text"
            value={form.account_number}
            onChange={(e) => setForm({ ...form, account_number: e.target.value })}
            placeholder="10 digit account number"
            className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
            Description (Optional)
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Instructions for users"
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
            Sort Order
          </label>
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
            className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_enabled}
              onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-slate-300">Enabled</span>
          </label>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {methodId ? "Update" : "Add"} Method
        </button>
      </div>
    </GlassCard>
  );
}

// Delete Payment Method Button
function DeletePaymentMethodButton({
  methodId,
  onDeleted,
}: {
  methodId: string;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this payment method? This cannot be undone.")) return;

    setBusy(true);
    
    try {
      const { error } = await supabase.from("manual_payment_methods").delete().eq("id", methodId);
      if (error) throw error;

      await logAdminAction(supabase, "delete_manual_payment_method", "manual_payment_method", methodId, {});
      toast.success("Payment method deleted");
      onDeleted();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete payment method");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      className="h-9 w-9 rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 flex items-center justify-center disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
