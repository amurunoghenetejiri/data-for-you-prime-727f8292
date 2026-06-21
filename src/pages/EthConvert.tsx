import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { Bitcoin, TrendingUp, ArrowRight } from "lucide-react";
import { PinDialog } from "@/components/PinDialog";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { Transaction } from "@/lib/data";

const FEE = 0.02;

export default function EthConvert() {
  const { user, openAuth, fundWallet, addTransaction, pushNotification, wallet } = useApp();
  const [rate, setRate] = useState(4_250_000); // ₦ per ETH (demo)
  const [eth, setEth] = useState(0.25);
  const [pinOpen, setPinOpen] = useState(false);
  const [receipt, setReceipt] = useState<Transaction | null>(null);

  useEffect(() => {
    const id = setInterval(() => setRate((r) => Math.round(r * (0.998 + Math.random() * 0.004))), 5000);
    return () => clearInterval(id);
  }, []);

  const gross = Math.round(eth * rate);
  const fee = Math.round(gross * FEE);
  const net = gross - fee;

  function attempt() {
    if (!user) { openAuth("login"); return; }
    if (eth <= 0) return toast.error("Enter a valid ETH amount");
    setPinOpen(true);
  }

  function confirm() {
    setPinOpen(false);
    fundWallet(net);
    const tx = addTransaction({
      type: "eth", amount: net, status: "success",
      description: `Converted ${eth} ETH → ₦${net.toLocaleString()}`,
      meta: { "ETH Amount": `${eth} ETH`, "Rate (₦/ETH)": rate.toLocaleString(), "Gross (₦)": gross.toLocaleString(), "Fee (2%)": `₦${fee.toLocaleString()}`, "Credited (₦)": net.toLocaleString() },
    });
    pushNotification({ title: "ETH conversion successful", body: `₦${net.toLocaleString()} credited to your wallet from ${eth} ETH.` });
    setReceipt(tx);
  }

  return (
    <div className="container py-10 max-w-5xl">
      <h1 className="text-3xl font-bold flex items-center gap-2"><Bitcoin className="h-7 w-7 text-primary" /> ETH → NGN Converter</h1>
      <p className="text-muted-foreground mt-1 mb-8">Convert Ethereum to Naira instantly and credit your wallet. A flat 2% fee applies.</p>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <Card className="p-6 shadow-card bg-gradient-card">
          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary text-secondary-foreground mb-6">
            <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /><span className="text-sm">Live rate</span></div>
            <span className="font-bold">1 ETH = ₦{rate.toLocaleString()}</span>
          </div>

          <Label className="mb-2 block">ETH amount</Label>
          <Input type="number" step="0.001" value={eth} onChange={(e) => setEth(Number(e.target.value) || 0)} />
          <div className="grid grid-cols-4 gap-2 mt-2">
            {[0.05, 0.1, 0.25, 0.5].map((a) => <button key={a} onClick={() => setEth(a)} className={`text-sm py-2 rounded-lg border ${eth === a ? "border-primary bg-accent" : "border-border hover:bg-muted"}`}>{a} ETH</button>)}
          </div>

          <div className="mt-6 p-5 rounded-2xl bg-muted/40 space-y-2 text-sm">
            <Row label="Gross value">₦{gross.toLocaleString()}</Row>
            <Row label="Conversion fee (2%)">−₦{fee.toLocaleString()}</Row>
            <div className="border-t border-border pt-2 flex justify-between items-end">
              <span className="text-muted-foreground">You receive</span>
              <span className="text-2xl font-bold text-primary">₦{net.toLocaleString()}</span>
            </div>
          </div>

          <Button onClick={attempt} className="mt-6 w-full bg-gradient-primary" size="lg">Convert <ArrowRight className="ml-2 h-4 w-4" /></Button>
        </Card>

        <aside className="space-y-4">
          <Card className="p-5 bg-gradient-primary text-primary-foreground shadow-elevated">
            <p className="text-xs opacity-80">Wallet balance</p>
            <p className="text-3xl font-bold">₦{wallet.toLocaleString()}</p>
          </Card>
          <Card className="p-5 shadow-card text-sm space-y-1">
            <h3 className="font-semibold">Formula</h3>
            <p className="text-muted-foreground">NGN Received = (ETH × Rate) − 2% Fee</p>
            <p className="text-xs text-muted-foreground mt-3">Demo rate refreshes every 5 seconds.</p>
          </Card>
        </aside>
      </div>

      <PinDialog open={pinOpen} onClose={() => setPinOpen(false)} onVerified={confirm} title="Authorise conversion" description={`Convert ${eth} ETH to ₦${net.toLocaleString()}.`} />
      <ReceiptDialog tx={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium">{children}</span></div>;
}