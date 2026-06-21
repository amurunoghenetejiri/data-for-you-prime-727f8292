import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/AppContext";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function Withdraw() {
  const { user, wallet, openAuth, pushNotification } = useApp();
  const [bank, setBank] = useState<{ bank_name: string; account_number: string; account_name: string } | null>(null);
  const [amount, setAmount] = useState(1000);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);

  async function refreshRecent() {
    if (!user?.id) return;
    const { data } = await supabase.from("withdrawals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5);
    setRecent(data || []);
  }

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("bank_details").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setBank({ bank_name: data.bank_name, account_number: data.account_number, account_name: data.account_name });
    });
    refreshRecent();
    const ch = supabase.channel(`wd-${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "withdrawals", filter: `user_id=eq.${user.id}` }, () => refreshRecent()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  if (!user) return <div className="container py-20 text-center"><h1 className="text-2xl font-bold">Withdraw Funds</h1><Button className="mt-4 bg-gradient-primary" onClick={() => openAuth("login")}>Login to continue</Button></div>;

  async function submit() {
    if (amount < 100) return toast.error("Minimum withdrawal is ₦100");
    if (amount > wallet) return toast.error("Insufficient wallet balance");
    if (!bank) return toast.error("Add a verified bank account first");
    setBusy(true);
    // Deduct wallet immediately (will be refunded if rejected)
    const { data: walletRow } = await supabase.from("wallets").select("balance").eq("user_id", user!.id!).maybeSingle();
    if (!walletRow || Number(walletRow.balance) < amount) { setBusy(false); return toast.error("Insufficient balance"); }
    const { error: walErr } = await supabase.from("wallets").update({ balance: Number(walletRow.balance) - amount } as any).eq("user_id", user!.id!);
    if (walErr) { setBusy(false); return toast.error(walErr.message); }
    const { error } = await supabase.from("withdrawals").insert({
      user_id: user!.id!,
      amount,
      bank_name: bank.bank_name,
      account_number: bank.account_number,
      account_name: bank.account_name,
      status: "pending",
    } as any);
    setBusy(false);
    if (error) {
      // refund
      await supabase.from("wallets").update({ balance: Number(walletRow.balance) } as any).eq("user_id", user!.id!);
      return toast.error(error.message);
    }
    // Notify admin
    await supabase.from("notifications").insert({ user_id: null, title: "Withdrawal requested", body: `${user!.username} requested ₦${amount.toLocaleString()} to ${bank.bank_name} ${bank.account_number}` });
    pushNotification({ title: "Withdrawal pending review", body: `Your ₦${amount.toLocaleString()} withdrawal is being processed by admin.` });
    toast.success("Withdrawal request submitted");
    refreshRecent();
  }

  return (
    <div className="container py-10 max-w-xl">
      <h1 className="text-3xl font-bold mb-2">Withdraw Funds</h1>
      <p className="text-muted-foreground text-sm mb-6">Withdraw to your saved, verified bank account. Admin approves all withdrawals.</p>
      <Card className="p-6 shadow-card space-y-4">
        {!bank ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">You haven't saved a verified bank account yet.</p>
            <Link to="/bank"><Button className="bg-gradient-primary">Add bank details</Button></Link>
          </div>
        ) : (
          <>
            <div className="p-4 bg-muted/40 rounded-xl text-sm">
              <p className="text-muted-foreground text-xs">Sending to</p>
              <p className="font-semibold">{bank.account_name}</p>
              <p className="font-mono text-sm">{bank.account_number} · {bank.bank_name}</p>
            </div>
            <div>
              <Label>Amount (₦)</Label>
              <Input type="number" min={100} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground mt-1">Wallet balance: ₦{wallet.toLocaleString()}</p>
            </div>
            <Button className="w-full bg-gradient-primary" disabled={busy} onClick={submit}>
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</> : <><ArrowUpRight className="h-4 w-4 mr-2" />Withdraw ₦{amount.toLocaleString()}</>}
            </Button>
          </>
        )}
      </Card>

      {recent.length > 0 && (
        <Card className="p-6 shadow-card mt-6">
          <h3 className="font-semibold mb-3">Recent withdrawals</h3>
          <ul className="divide-y divide-border">
            {recent.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">₦{Number(w.amount).toLocaleString()} → {w.bank_name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  w.status === "successful" ? "bg-success/15 text-success" :
                  w.status === "rejected" ? "bg-destructive/15 text-destructive" :
                  "bg-amber-500/15 text-amber-600"
                }`}>{w.status === "pending" ? "Processing" : w.status === "successful" ? "Successful" : w.status === "rejected" ? "Rejected" : w.status}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
