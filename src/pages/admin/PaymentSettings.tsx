import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Settings, Loader2, Copy, Eye, EyeOff, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GlassCard, LoadingBlock, PageHead, logAdminAction } from "./_shared";

export default function PaymentSettings() {
  const [activeTab, setActiveTab] = useState<"paystack" | "manual">("paystack");

  return (
    <div>
      <PageHead
        title="Payment Settings"
        subtitle="Manage Paystack and Manual Bank Transfer configuration"
        icon={CreditCard}
      />

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: "paystack", label: "Paystack Configuration" },
          { id: "manual", label: "Manual Bank Transfer" },
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

      {activeTab === "paystack" && <PaystackConfigTab />}
      {activeTab === "manual" && <ManualBankTransferTab />}
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
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 30000,
    retry: 1,
  });

  const [form, setForm] = useState<any>(null);
  const [showTestSecret, setShowTestSecret] = useState(false);
  const [showLiveSecret, setShowLiveSecret] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        id: data.id,
        test_public_key: data.test_public_key || "",
        test_secret_key: data.test_secret_key || "",
        live_public_key: data.live_public_key || "",
        live_secret_key: data.live_secret_key || "",
        mode: data.mode || "test",
      });
    }
  }, [data]);

  async function save() {
    if (!form) return;
    setBusy(true);

    try {
      const { error } = await supabase
        .from("paystack_config")
        .update({
          test_public_key: form.test_public_key,
          test_secret_key: form.test_secret_key,
          live_public_key: form.live_public_key,
          live_secret_key: form.live_secret_key,
          mode: form.mode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", form.id);

      if (error) throw error;

      await logAdminAction(supabase, "update_paystack_config", "paystack_config", form.id, {
        mode: form.mode,
      });

      toast.success("Paystack configuration saved successfully");
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
        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-5 w-5 text-violet-300" />
          <h3 className="font-semibold text-white text-lg">Paystack Configuration</h3>
        </div>

        <div className="space-y-6">
          {/* Test Mode Section */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <h4 className="font-medium text-white flex items-center gap-2 mb-4">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              Test Mode Keys
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
                  Public Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.test_public_key}
                    onChange={(e) => setForm({ ...form, test_public_key: e.target.value })}
                    placeholder="pk_test_..."
                    className="flex-1 h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(form.test_public_key);
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
                    type={showTestSecret ? "text" : "password"}
                    value={form.test_secret_key}
                    onChange={(e) => setForm({ ...form, test_secret_key: e.target.value })}
                    placeholder="sk_test_..."
                    className="flex-1 h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
                  />
                  <button
                    onClick={() => setShowTestSecret(!showTestSecret)}
                    className="h-10 w-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center"
                  >
                    {showTestSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Live Mode Section */}
          <div className="p-4 rounded-lg bg-white/5 border border-rose-500/20">
            <h4 className="font-medium text-white flex items-center gap-2 mb-4">
              <span className="h-2 w-2 rounded-full bg-rose-500"></span>
              Live Mode Keys
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
                  Public Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.live_public_key}
                    onChange={(e) => setForm({ ...form, live_public_key: e.target.value })}
                    placeholder="pk_live_..."
                    className="flex-1 h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(form.live_public_key);
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
                    type={showLiveSecret ? "text" : "password"}
                    value={form.live_secret_key}
                    onChange={(e) => setForm({ ...form, live_secret_key: e.target.value })}
                    placeholder="sk_live_..."
                    className="flex-1 h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
                  />
                  <button
                    onClick={() => setShowLiveSecret(!showLiveSecret)}
                    className="h-10 w-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center"
                  >
                    {showLiveSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
              Active Mode
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setForm({ ...form, mode: "test" })}
                className={`flex-1 h-10 px-3 rounded-lg font-medium transition ${
                  form.mode === "test"
                    ? "bg-amber-600 text-amber-100"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                Test Mode
              </button>
              <button
                onClick={() => setForm({ ...form, mode: "live" })}
                className={`flex-1 h-10 px-3 rounded-lg font-medium transition ${
                  form.mode === "live"
                    ? "bg-rose-600 text-rose-100"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                Live Mode
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {form.mode === "test"
                ? "✓ Using test credentials. Transactions are simulated."
                : "⚠ Using live credentials. Real charges will apply."}
            </p>
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
          💡 Get your keys from <strong>Paystack Dashboard → Settings → API Keys</strong>
        </p>
      </div>
    </div>
  );
}

// Manual Bank Transfer Tab
function ManualBankTransferTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "manual_bank_transfer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_bank_transfer")
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 30000,
    retry: 1,
  });

  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        id: data.id,
        bank_name: data.bank_name || "",
        account_name: data.account_name || "",
        account_number: data.account_number || "",
        instructions: data.instructions || "",
      });
    }
  }, [data]);

  async function save() {
    if (!form) return;

    if (!form.bank_name.trim() || !form.account_name.trim() || !form.account_number.trim()) {
      return toast.error("All fields are required");
    }

    setBusy(true);

    try {
      const { error } = await supabase
        .from("manual_bank_transfer")
        .update({
          bank_name: form.bank_name,
          account_name: form.account_name,
          account_number: form.account_number,
          instructions: form.instructions,
          updated_at: new Date().toISOString(),
        })
        .eq("id", form.id);

      if (error) throw error;

      await logAdminAction(supabase, "update_manual_bank_transfer", "manual_bank_transfer", form.id, {
        bank_name: form.bank_name,
        account_name: form.account_name,
      });

      toast.success("Manual Bank Transfer details updated");
      qc.invalidateQueries({ queryKey: ["admin", "manual_bank_transfer"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !form) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-5 w-5 text-violet-300" />
          <h3 className="font-semibold text-white text-lg">Manual Bank Transfer</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
              Bank Name *
            </label>
            <input
              type="text"
              value={form.bank_name}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              placeholder="e.g., Access Bank"
              className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
              Account Name *
            </label>
            <input
              type="text"
              value={form.account_name}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
              placeholder="e.g., Your Company Name"
              className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
              Account Number *
            </label>
            <input
              type="text"
              value={form.account_number}
              onChange={(e) => setForm({ ...form, account_number: e.target.value })}
              placeholder="e.g., 1234567890"
              className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
              Instructions (shown to users)
            </label>
            <textarea
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="e.g., Send exactly the amount shown. Reference will be your username."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
            />
          </div>
        </div>

        <button
          onClick={save}
          disabled={busy}
          className="mt-6 w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Details
        </button>
      </GlassCard>

      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
        <p className="text-sm text-green-300">
          ✓ Changes are saved immediately and visible to users on the wallet funding page
        </p>
      </div>
    </div>
  );
}
