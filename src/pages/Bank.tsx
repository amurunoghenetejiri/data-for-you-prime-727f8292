import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/AppContext";
import { Building2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const NIGERIAN_BANKS = ["Opay","PalmPay","Moniepoint","Access Bank","GTBank","First Bank","UBA","Zenith Bank","Fidelity Bank","Union Bank","Sterling Bank","Wema Bank","FCMB","Keystone Bank","Polaris Bank","Ecobank","Stanbic IBTC"];

export default function Bank() {
  const { user, openAuth } = useApp();
  const key = `d4m_bank_${user?.username || "guest"}`;
  const [bank, setBank] = useState({ bank_name: "", account_number: "", account_name: "" });
  useEffect(() => { try { const v = localStorage.getItem(key); if (v) setBank(JSON.parse(v)); } catch {} }, [key]);
  if (!user) return <div className="container py-20 text-center"><h1 className="text-2xl font-bold">Bank Details</h1><Button className="mt-4 bg-gradient-primary" onClick={() => openAuth("login")}>Login to continue</Button></div>;
  return (
    <div className="container py-10 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-gradient-primary text-primary-foreground grid place-items-center shadow-glow"><Building2 className="h-5 w-5" /></div>
        <div><h1 className="text-3xl font-bold">Bank Details</h1><p className="text-muted-foreground text-sm">For withdrawals · saved permanently to your account</p></div>
      </div>
      <Card className="p-6 shadow-card space-y-4">
        <div><Label>Bank name</Label>
          <select className="w-full border border-input rounded-md h-10 px-3 bg-background" value={bank.bank_name} onChange={(e) => setBank({ ...bank, bank_name: e.target.value })}>
            <option value="">Choose bank…</option>
            {NIGERIAN_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div><Label>Account number</Label><Input value={bank.account_number} onChange={(e) => setBank({ ...bank, account_number: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="0123456789" inputMode="numeric" /></div>
        <div><Label>Account name</Label><Input value={bank.account_name} onChange={(e) => setBank({ ...bank, account_name: e.target.value })} placeholder="As on your bank statement" /></div>
        <Button onClick={() => { if (!bank.bank_name || bank.account_number.length < 10 || !bank.account_name) return toast.error("Fill all fields correctly"); localStorage.setItem(key, JSON.stringify(bank)); toast.success("Bank details saved"); }} className="w-full bg-gradient-primary"><Save className="h-4 w-4 mr-2" />Save bank details</Button>
      </Card>
    </div>
  );
}