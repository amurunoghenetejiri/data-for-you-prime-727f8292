import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Settings as SettingsIcon, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { paymentApi } from '@/lib/api';
import { GlassCard, LoadingBlock, PageHead, logAdminAction } from './_shared';
import { supabase } from '@/integrations/supabase/client';

export default function AdminPaymentSettings() {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [newBankForm, setNewBankForm] = useState<any>(null);
  const [validating, setValidating] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingBank, setSavingBank] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['payment-settings'],
    queryFn: async () => {
      try {
        const [settings, accounts] = await Promise.all([
          paymentApi.getSettings(),
          paymentApi.getBankAccounts(),
        ]);
        return { settings, accounts };
      } catch (err) {
        console.error('Failed to load payment settings:', err);
        return { settings: null, accounts: [] };
      }
    },
  });

  useEffect(() => {
    if (data?.settings) setForm(data.settings);
    if (data?.accounts) setBankAccounts(data.accounts);
  }, [data]);

  async function validatePaystackKeys() {
    if (!form?.paystackPublicKey || !form?.paystackSecretKey) {
      return toast.error('Please enter both public and secret keys');
    }
    setValidating(true);
    try {
      await paymentApi.validatePaystackKeys(form.paystackPublicKey, form.paystackSecretKey);
      toast.success('Keys validated successfully');
    } catch (err) {
      toast.error((err as any).message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  }

  async function savePaymentSettings() {
    setSavingPayment(true);
    try {
      await paymentApi.updateSettings(form);
      const session = await supabase.auth.getSession();
      if (session.data.session?.user.id) {
        await logAdminAction(supabase, 'update_payment_settings', 'payment_settings', '1', form);
      }
      toast.success('Payment settings saved');
      qc.invalidateQueries({ queryKey: ['payment-settings'] });
    } catch (err) {
      toast.error((err as any).message || 'Failed to save settings');
    } finally {
      setSavingPayment(false);
    }
  }

  async function addBankAccount() {
    if (!newBankForm?.bankName || !newBankForm?.accountName || !newBankForm?.accountNumber) {
      return toast.error('Please fill all required fields');
    }
    setSavingBank(true);
    try {
      await paymentApi.createBankAccount(newBankForm);
      toast.success('Bank account added');
      setNewBankForm(null);
      qc.invalidateQueries({ queryKey: ['payment-settings'] });
      const session = await supabase.auth.getSession();
      if (session.data.session?.user.id) {
        await logAdminAction(supabase, 'add_bank_account', 'bank_accounts', newBankForm.accountNumber, newBankForm);
      }
    } catch (err) {
      toast.error((err as any).message || 'Failed to add account');
    } finally {
      setSavingBank(false);
    }
  }

  async function deleteBankAccount(id: string) {
    if (!confirm('Delete this bank account?')) return;
    try {
      await paymentApi.deleteBankAccount(id);
      toast.success('Bank account deleted');
      qc.invalidateQueries({ queryKey: ['payment-settings'] });
      const session = await supabase.auth.getSession();
      if (session.data.session?.user.id) {
        await logAdminAction(supabase, 'delete_bank_account', 'bank_accounts', id, {});
      }
    } catch (err) {
      toast.error((err as any).message || 'Failed to delete account');
    }
  }

  if (isLoading || !form) return <LoadingBlock label="Loading payment settings…" />;

  return (
    <div>
      <PageHead
        title="Payment Management"
        subtitle="Configure payment providers, bank details & security"
        icon={SettingsIcon}
      />

      {/* Paystack Settings */}
      <GlassCard className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <KeyRound className="h-5 w-5 text-violet-300" />
          <h2 className="text-xl font-semibold text-white">Paystack Configuration</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Provider Status</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.paystackEnabled || false}
                onChange={(e) => setForm({ ...form, paystackEnabled: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-slate-300">Enable Paystack</span>
            </label>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Mode</label>
              <select
                value={form.paystackMode || 'test'}
                onChange={(e) => setForm({ ...form, paystackMode: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm"
              >
                <option value="test">Test</option>
                <option value="live">Live</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Public Key</label>
              <input
                type="text"
                value={form.paystackPublicKey || ''}
                onChange={(e) => setForm({ ...form, paystackPublicKey: e.target.value })}
                placeholder="pk_test_... or pk_live_..."
                className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Secret Key</label>
              <input
                type="password"
                value={form.paystackSecretKey || ''}
                onChange={(e) => setForm({ ...form, paystackSecretKey: e.target.value })}
                placeholder="sk_test_... or sk_live_..."
                className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Webhook Secret</label>
              <input
                type="password"
                value={form.paystackWebhookSecret || ''}
                onChange={(e) => setForm({ ...form, paystackWebhookSecret: e.target.value })}
                placeholder="Optional webhook secret"
                className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={validatePaystackKeys}
              disabled={validating || !form.paystackPublicKey || !form.paystackSecretKey}
              className="px-4 py-2.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {validating && <Loader2 className="h-4 w-4 animate-spin" />}
              Validate Keys
            </button>
            <button
              onClick={savePaymentSettings}
              disabled={savingPayment}
              className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2 ml-auto"
            >
              {savingPayment && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Settings
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Bank Accounts */}
      <GlassCard className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Bank Accounts</h2>
          <button
            onClick={() => setNewBankForm({})}
            className="px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-sm font-semibold flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add Account
          </button>
        </div>

        {newBankForm && (
          <div className="p-4 rounded-lg bg-slate-800/40 border border-white/10 mb-4 space-y-3">
            <input
              type="text"
              placeholder="Bank Name"
              value={newBankForm.bankName || ''}
              onChange={(e) => setNewBankForm({ ...newBankForm, bankName: e.target.value })}
              className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm"
            />
            <input
              type="text"
              placeholder="Account Name"
              value={newBankForm.accountName || ''}
              onChange={(e) => setNewBankForm({ ...newBankForm, accountName: e.target.value })}
              className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm"
            />
            <input
              type="text"
              placeholder="Account Number"
              value={newBankForm.accountNumber || ''}
              onChange={(e) => setNewBankForm({ ...newBankForm, accountNumber: e.target.value })}
              className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm"
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newBankForm.isEnabled !== false}
                onChange={(e) => setNewBankForm({ ...newBankForm, isEnabled: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-slate-300">Enable this account</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={addBankAccount}
                disabled={savingBank}
                className="px-3 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-sm font-semibold disabled:opacity-50"
              >
                {savingBank ? 'Saving...' : 'Add'}
              </button>
              <button
                onClick={() => setNewBankForm(null)}
                className="px-3 py-2 rounded-lg bg-slate-700/20 hover:bg-slate-700/30 border border-slate-500/30 text-slate-300 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {bankAccounts.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No bank accounts configured</p>
        ) : (
          <div className="space-y-3">
            {bankAccounts.map((account) => (
              <div key={account.id} className="p-4 rounded-lg bg-slate-800/40 border border-white/10 flex items-start justify-between">
                <div>
                  <p className="font-semibold text-white">{account.bankName}</p>
                  <p className="text-sm text-slate-400">{account.accountName}</p>
                  <p className="text-sm text-slate-500 font-mono">{account.accountNumber}</p>
                  {!account.isEnabled && <p className="text-xs text-amber-300 mt-1">Disabled</p>}
                </div>
                <button
                  onClick={() => deleteBankAccount(account.id)}
                  className="p-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.bankTransferEnabled || false}
          onChange={(e) => setForm({ ...form, bankTransferEnabled: e.target.checked })}
          className="w-4 h-4 rounded"
        />
        <span className="text-sm text-slate-300">Enable Bank Transfer as payment method</span>
      </label>
    </div>
  );
}
