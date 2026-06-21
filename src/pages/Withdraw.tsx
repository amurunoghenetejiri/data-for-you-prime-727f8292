import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/AppContext";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function Withdraw() {
  const { user, wallet, openAuth, deductWallet, addTransaction, pushNotification } = useApp();
  const [bank, setBank] = useState<any>(null);
  const [amount, setAmount] = useState(1000);
  useEffect(() => { if (!user) return; try { const v = localStorage.getItem(`d4m_bank_${user.username}`); if (v) setBank(JSON.parse(v)); } catch {} }, [user]);
  if (!user) return <div className="container py-20 text-center"><h1 className="text-2xl font-bold">Withdraw Funds</h1><Button className="mt-4 bg-gradient-primary" onClick={() => openAuth("login")}>Login to continue</Button></div>;
  return (
    <div className="container py-10 max-w-xl">
      <h1 className="text-3xl font-bold mb-2">Withdraw Funds</h1>
      <p className="text-muted-foreground text-sm mb-6">Withdraw to your saved bank account.</p>
      <Card className="p-6 shadow-card space-y-4">
        {!bank ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">You haven't saved a bank account yet.</p>
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
            <Button className="w-full bg-gradient-primary" onClick={() => {
              if (amount < 100) return toast.error("Minimum withdrawal is ₦100");
              if (!deductWallet(amount)) return toast.error("Insufficient wallet balance");
              addTransaction({ type: "transfer", amount, status: "pending", description: `Withdrawal to ${bank.bank_name} ${bank.account_number}` });
              pushNotification({ title: "Withdrawal requested", body: `Your ₦${amount.toLocaleString()} withdrawal is being processed.` });
              toast.success("Withdrawal request submitted");
            }}><ArrowUpRight className="h-4 w-4 mr-2" />Withdraw ₦{amount.toLocaleString()}</Button>
          </>
        )}
      </Card>
    </div>
  );
}