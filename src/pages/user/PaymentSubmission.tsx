import { useState } from 'react';
import { toast } from 'sonner';
import { CreditCard, Upload, Loader2, CheckCircle } from 'lucide-react';
import { transactionApi, fileApi, paymentApi } from '@/lib/api';
import { useApp } from '@/context/AppContext';

export default function PaymentSubmission() {
  const { user } = useApp();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'paystack' | 'bank'>('bank');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  // Load bank accounts
  const handleMethodChange = async (newMethod: string) => {
    setMethod(newMethod as any);
    if (newMethod === 'bank') {
      try {
        const accounts = await paymentApi.getBankAccounts();
        setBankAccounts(accounts);
      } catch (err) {
        console.error('Failed to load bank accounts:', err);
      }
    }
  };

  const handleSubmit = async () => {
    if (!amount || !user?.id) {
      return toast.error('Please enter an amount');
    }

    if (method === 'bank' && !receipt) {
      return toast.error('Please upload a receipt for bank transfer');
    }

    setLoading(true);
    try {
      let receiptUrl: string | undefined;

      // Upload receipt if provided
      if (receipt) {
        const uploadResult = await fileApi.uploadReceipt(receipt, user.id);
        receiptUrl = uploadResult.url;
      }

      // Submit payment
      await transactionApi.submitPayment(Number(amount), method, receiptUrl);
      
      toast.success('Payment submitted successfully. Please wait for admin approval.');
      setSubmitted(true);
      setAmount('');
      setReceipt(null);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) {
      toast.error((err as any).message || 'Failed to submit payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/5 p-6">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-violet-300" />
          Make Payment
        </h2>

        {submitted && (
          <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm flex items-start gap-3">
            <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>Payment submitted! Admin will review and approve shortly.</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Amount (₦)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Payment Method</label>
            <select
              value={method}
              onChange={(e) => handleMethodChange(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm"
            >
              <option value="bank">Bank Transfer</option>
              <option value="paystack">Paystack</option>
            </select>
          </div>

          {method === 'bank' && bankAccounts.length > 0 && (
            <div className="p-3 rounded-lg bg-slate-800/40 border border-white/10 text-sm">
              <p className="text-slate-300 font-semibold mb-2">Transfer to:</p>
              {bankAccounts
                .filter(a => a.isEnabled)
                .map(account => (
                  <div key={account.id} className="text-slate-400 text-xs space-y-1">
                    <p><span className="text-slate-300">Bank:</span> {account.bankName}</p>
                    <p><span className="text-slate-300">Account:</span> {account.accountName}</p>
                    <p><span className="text-slate-300">Number:</span> {account.accountNumber}</p>
                  </div>
                ))}
            </div>
          )}

          {method === 'bank' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Upload Receipt</label>
              <label className="flex items-center justify-center gap-2 w-full h-24 rounded-lg border-2 border-dashed border-white/20 hover:border-white/40 cursor-pointer transition-colors bg-slate-800/20">
                <Upload className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-400">
                  {receipt ? receipt.name : 'Click to upload receipt'}
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setReceipt(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !amount}
            className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Payment
          </button>
        </div>
      </div>
    </div>
  );
}
