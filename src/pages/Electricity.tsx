import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { PinDialog } from "@/components/PinDialog";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { Transaction } from "@/lib/data";

const DISCOS = ["EKEDC (Eko)", "IKEDC (Ikeja)", "AEDC (Abuja)", "IBEDC (Ibadan)", "PHED (Port Harcourt)", "KEDCO (Kano)", "KAEDCO (Kaduna)", "EEDC (Enugu)", "BEDC (Benin)", "JED (Jos)", "YEDC (Yola)"];

export default function Electricity() {
  const { user, openAuth, wallet, deductWallet, addTransaction, pushNotification } = useApp();
  const [disco, setDisco] = useState(DISCOS[0]);
  const [meterType, setMeterType] = useState<"prepaid" | "postpaid">("prepaid");
  const [meter, setMeter] = useState("");
  const [amount, setAmount] = useState(2000);
  const [pinOpen, setPinOpen] = useState(false);
  const [receipt, setReceipt] = useState<Transaction | null>(null);

  function attempt() {
    if (!user) { openAuth("login"); return; }
    if (!/^\d{10,13}$/.test(meter)) return toast.error("Enter a valid meter number");
    if (amount < 500) return toast.error("Minimum is ₦500");
    if (wallet < amount) return toast.error("Insufficient wallet balance");
    setPinOpen(true);
  }

  function confirm() {
    setPinOpen(false);
    deductWallet(amount);
    const token = Array.from({ length: 4 }, () => Math.floor(1000 + Math.random() * 9000)).join("-");
    const tx = addTransaction({
      type: "electricity", amount, status: "success",
      description: `${disco} • ${meterType}`,
      meta: { Disco: disco, "Meter Type": meterType, "Meter Number": meter, Token: token },
    });
    pushNotification({ title: "Electricity payment successful", body: `Token: ${token} for meter ${meter}.` });
    setReceipt(tx);
    setMeter("");
  }

  return (
    <div className="container py-10 max-w-4xl">
      <h1 className="text-3xl font-bold flex items-center gap-2"><Zap className="h-7 w-7 text-primary" /> Electricity Bills</h1>
      <p className="text-muted-foreground mt-1 mb-8">Pay any Nigerian disco. Tokens delivered instantly for prepaid meters.</p>

      <Card className="p-6 shadow-card bg-gradient-card">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="mb-2 block">Disco</Label>
            <Select value={disco} onValueChange={setDisco}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DISCOS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Meter type</Label>
            <Select value={meterType} onValueChange={(v) => setMeterType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prepaid">Prepaid</SelectItem>
                <SelectItem value="postpaid">Postpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Meter number</Label>
            <Input inputMode="numeric" maxLength={13} value={meter} onChange={(e) => setMeter(e.target.value.replace(/\D/g, ""))} placeholder="1234567890" />
          </div>
          <div>
            <Label className="mb-2 block">Amount (₦)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[1000, 2000, 5000, 10000].map((a) => <button key={a} onClick={() => setAmount(a)} className={`text-sm py-2 rounded-lg border ${amount === a ? "border-primary bg-accent" : "border-border hover:bg-muted"}`}>₦{a.toLocaleString()}</button>)}
        </div>
        <Button onClick={attempt} className="mt-6 w-full bg-gradient-primary" size="lg">Pay ₦{amount.toLocaleString()}</Button>
      </Card>

      <PinDialog open={pinOpen} onClose={() => setPinOpen(false)} onVerified={confirm} title="Authorise payment" description={`Pay ₦${amount.toLocaleString()} to ${disco} (${meter}).`} />
      <ReceiptDialog tx={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}