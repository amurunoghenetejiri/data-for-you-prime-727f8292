import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { ArrowUpRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { PinDialog } from "@/components/PinDialog";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { Transaction } from "@/lib/data";

const BANKS = ["OPay","Access Bank","GTBank","First Bank","Zenith Bank","UBA","Fidelity Bank","FCMB","Sterling Bank","Wema Bank","Moniepoint","PalmPay","Union Bank","Ecobank","Stanbic IBTC","Polaris Bank","Keystone Bank"];
const SAMPLE_NAMES = ["Destiny Ade","Chidinma Okafor","Tunde Bakare","Aisha Mohammed","Emeka Nnaji","Ngozi Eze","Bola Adeyemi"];

export default function Transfer() {
  const { user, openAuth, wallet, deductWallet, addTransaction, pushNotification } = useApp();
  const [account, setAccount] = useState("");
  const [bank, setBank] = useState("OPay");
  const [amount, setAmount] = useState(1000);
  const [verified, setVerified] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [receipt, setReceipt] = useState<Transaction | null>(null);

  function verify() {
    if (!/^\d{10}$/.test(account)) return toast.error("Enter a valid 10-digit account number");
    const name = SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
    setVerified(name);
    toast.success(`Account verified: ${name}`);
  }

  function attempt() {
    if (!user) { openAuth("login"); return; }
    if (!verified) return toast.error("Verify the recipient account first");
    if (amount < 100) return toast.error("Minimum transfer is ₦100");
    if (wallet < amount) return toast.error("Insufficient wallet balance");
    setPinOpen(true);
  }

  function confirm() {
    setPinOpen(false);
    deductWallet(amount);
    const tx = addTransaction({
      type: "transfer",
      amount,
      status: "success",
      description: `Transfer to ${verified} • ${bank}`,
      meta: { "Recipient": verified!, "Bank": bank, "Account Number": account },
    });
    pushNotification({ title: "Transfer successful", body: `₦${amount.toLocaleString()} sent to ${verified} (${bank}).` });
    setReceipt(tx);
    setVerified(null); setAccount("");
  }

  return (
    <div className="container py-10 max-w-5xl">
      <h1 className="text-3xl font-bold">Wallet to Bank Transfer</h1>
      <p className="text-muted-foreground mt-1 mb-8">Send Naira from your Data4Me wallet to any Nigerian bank account.</p>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <Card className="p-6 shadow-card bg-gradient-card">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="mb-2 block">Bank</Label>
              <Select value={bank} onValueChange={setBank}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">Account number</Label>
              <Input inputMode="numeric" maxLength={10} value={account} onChange={(e) => { setAccount(e.target.value.replace(/\D/g, "")); setVerified(null); }} placeholder="0123456789" />
            </div>
          </div>
          <Button variant="outline" className="mt-3" onClick={verify}>Verify account</Button>
          {verified && (
            <div className="mt-3 p-3 rounded-lg bg-success/10 text-success text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Account Name: <strong>{verified}</strong></div>
          )}
          <div className="mt-6">
            <Label className="mb-2 block">Amount (₦)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
            <div className="grid grid-cols-4 gap-2 mt-2">
              {[500, 1000, 5000, 10000].map((a) => <button key={a} onClick={() => setAmount(a)} className={`text-sm py-2 rounded-lg border ${amount === a ? "border-primary bg-accent" : "border-border hover:bg-muted"}`}>₦{a.toLocaleString()}</button>)}
            </div>
          </div>
          <Button onClick={attempt} className="mt-6 w-full bg-gradient-primary"><ArrowUpRight className="h-4 w-4 mr-2" /> Send ₦{amount.toLocaleString()}</Button>
        </Card>

        <aside className="space-y-4">
          <Card className="p-5 bg-gradient-primary text-primary-foreground shadow-elevated">
            <p className="text-xs opacity-80">Available balance</p>
            <p className="text-3xl font-bold">₦{wallet.toLocaleString()}</p>
          </Card>
          <Card className="p-5 shadow-card">
            <h3 className="font-semibold mb-2 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Secure transfer</h3>
            <p className="text-sm text-muted-foreground">All transfers require your 4-digit Transaction PIN and are logged in your transaction history.</p>
          </Card>
        </aside>
      </div>
      <PinDialog open={pinOpen} onClose={() => setPinOpen(false)} onVerified={confirm} title="Authorise transfer" description={`Confirm ₦${amount.toLocaleString()} to ${verified} (${bank}).`} />
      <ReceiptDialog tx={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}