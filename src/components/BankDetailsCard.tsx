import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, CheckCircle2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";

const NIGERIAN_BANKS = ["Opay","PalmPay","Moniepoint","Kuda","Access Bank","GTBank","First Bank","UBA","Zenith Bank","Fidelity Bank","Union Bank","Sterling Bank","Wema Bank","FCMB","Keystone Bank","Polaris Bank","Ecobank","Stanbic IBTC"];

export function BankDetailsCard() {
  const { user } = useApp();
  const [bank, setBank] = useState({ bank_name: "", account_number: "", account_name: "" });
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verified, setVerified] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("bank_details").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) { setBank({ bank_name: data.bank_name, account_number: data.account_number, account_name: data.account_name }); setVerified(true); }
      else setEditing(true);
    });
  }, [user?.id]);

  async function verify() {
    if (!bank.bank_name || bank.account_number.length < 10) return toast.error("Pick a bank and enter a 10-digit account number");
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("paystack-resolve", { body: { account_number: bank.account_number, bank_name: bank.bank_name } });
      if (error) throw new Error(error.message || "Could not reach verification service");
      if ((data as any)?.error) throw new Error((data as any).error);
      if (!data?.account_name) throw new Error("Account could not be verified");
      setBank({ ...bank, account_name: data.account_name });
      setVerified(true);
      toast.success(`Verified: ${data.account_name}`);
    } catch (e: any) {
      setVerified(false);
      toast.error(e.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  async function save() {
    if (!verified || !bank.account_name) return toast.error("Verify the account before saving");
    setSaving(true);
    const { error } = await supabase.from("bank_details").upsert({
      user_id: user!.id!, bank_name: bank.bank_name, account_number: bank.account_number, account_name: bank.account_name,
    } as any, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Bank details saved");
    setEditing(false);
  }

  if (!user) return null;

  return (
    <Card className="p-6 shadow-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-gradient-primary text-primary-foreground grid place-items-center"><Building2 className="h-5 w-5" /></div>
        <div>
          <h3 className="font-semibold">My Bank Account</h3>
          <p className="text-xs text-muted-foreground">Used for withdrawals and wallet-to-bank transfers</p>
        </div>
      </div>

      {!editing && verified ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-success/40 bg-success/5 p-4">
            <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="h-4 w-4 text-success" /><span className="text-xs font-semibold text-success uppercase">Verified</span></div>
            <p className="font-semibold text-lg">{bank.account_name}</p>
            <p className="font-mono text-sm text-muted-foreground">{bank.account_number}</p>
            <p className="text-sm">{bank.bank_name}</p>
          </div>
          <Button variant="outline" onClick={() => { setEditing(true); setVerified(false); }}>Update bank details</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label>Bank name</Label>
            <Select value={bank.bank_name} onValueChange={(v) => { setBank({ ...bank, bank_name: v, account_name: "" }); setVerified(false); }}>
              <SelectTrigger><SelectValue placeholder="Choose bank…" /></SelectTrigger>
              <SelectContent className="max-h-[60vh] overflow-y-auto">
                {NIGERIAN_BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Account number</Label>
            <Input value={bank.account_number} onChange={(e) => { setBank({ ...bank, account_number: e.target.value.replace(/\D/g, "").slice(0, 10), account_name: "" }); setVerified(false); }} placeholder="0123456789" inputMode="numeric" />
          </div>
          {verified && bank.account_name && (
            <div className="rounded-xl border border-success/40 bg-success/5 p-3 flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" /><span><b>{bank.account_name}</b> — {bank.bank_name}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={verify} disabled={verifying} variant="outline">{verifying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying…</> : "Verify account"}</Button>
            <Button onClick={save} disabled={!verified || saving} className="bg-gradient-primary"><Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
