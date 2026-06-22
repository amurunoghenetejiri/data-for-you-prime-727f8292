import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { ArrowUpRight, ShieldCheck, CheckCircle2, Pencil } from "lucide-react";
import { PinDialog } from "@/components/PinDialog";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { Transaction } from "@/lib/data";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type SavedBank = { bank_name: string; account_number: string; account_name: string };

export default function Transfer() {
  const { user, openAuth, wallet, deductWallet, addTransaction, pushNotification } = useApp();
  const [bank, setBank] = useState<SavedBank | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(1000);
  const [pinOpen, setPinOpen] = useState(false);
  const [receipt, setReceipt] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    supabase.from("bank_details").select("bank_name, account_number, account_name").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setBank(data as SavedBank);
      setLoading(false);
    });
  }, [user?.id]);

  function attempt() {
    if (!user) { openAuth("login"); return; }
    if (!bank) return toast.error("Add your bank details first");
    if (amount < 100) return toast.error("Minimum transfer is ₦100");
    if (wallet < amount) return toast.error("Insufficient wallet balance");
    setPinOpen(true);
  }

  function confirm() {
    setPinOpen(false);
    if (!bank) return;
    deductWallet(amount);
    const tx = addTransaction({
      type: "transfer",
      amount,
      status: "success",
      description: `Transfer to ${bank.account_name} • ${bank.bank_name}`,
      meta: { "Recipient": bank.account_name, "Bank": bank.bank_name, "Account Number": bank.account_number },
    });
    pushNotification({ title: "Transfer successful", body: `₦${amount.toLocaleString()} sent to ${bank.account_name} (${bank.bank_name}).` });
    setReceipt(tx);
  }

  if (!user) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold">Wallet to Bank Transfer</h1>
        <Button className="mt-4 bg-gradient-primary" onClick={() => openAuth("login")}>Login to continue</Button>
      </div>
    );
  }

  return (
    <div className="container py-10 max-w-5xl">
      <h1 className="text-3xl font-bold">Wallet to Bank Transfer</h1>
      <p className="text-muted-foreground mt-1 mb-8">Send Naira from your wallet to your saved bank account.</p>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <Card className="p-6 shadow-card bg-gradient-card">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading your bank details…</p>
          ) : !bank ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-3">You haven't saved a verified bank account yet.</p>
              <Link to="/bank"><Button className="bg-gradient-primary">Add bank details</Button></Link>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-xl border border-success/40 bg-success/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sending to</span>
                  <Link to="/settings" className="text-xs text-primary hover:underline inline-flex items-center gap-1"><Pencil className="h-3 w-3" />Change</Link>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div>
                    <p className="font-semibold">{bank.account_name}</p>
                    <p className="font-mono text-sm text-muted-foreground">{bank.account_number} · {bank.bank_name}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Label className="mb-2 block">Amount (₦)</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[500, 1000, 5000, 10000].map((a) => (
                    <button key={a} onClick={() => setAmount(a)} className={`text-sm py-2 rounded-lg border ${amount === a ? "border-primary bg-accent" : "border-border hover:bg-muted"}`}>₦{a.toLocaleString()}</button>
                  ))}
                </div>
              </div>
              <Button onClick={attempt} className="mt-6 w-full bg-gradient-primary">
                <ArrowUpRight className="h-4 w-4 mr-2" /> Send ₦{amount.toLocaleString()}
              </Button>
            </>
          )}
        </Card>

        <aside className="space-y-4">
          <Card className="p-5 bg-gradient-primary text-primary-foreground shadow-elevated">
            <p className="text-xs opacity-80">Available balance</p>
            <p className="text-3xl font-bold">₦{wallet.toLocaleString()}</p>
          </Card>
          <Card className="p-5 shadow-card">
            <h3 className="font-semibold mb-2 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Secure transfer</h3>
            <p className="text-sm text-muted-foreground">Transfers require your 4-digit Transaction PIN. Update your bank account anytime from Settings.</p>
          </Card>
        </aside>
      </div>
      <PinDialog open={pinOpen} onClose={() => setPinOpen(false)} onVerified={confirm} title="Authorise transfer" description={`Confirm ₦${amount.toLocaleString()} to ${bank?.account_name} (${bank?.bank_name}).`} />
      <ReceiptDialog tx={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
