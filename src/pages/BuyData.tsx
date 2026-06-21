import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dataPlans, networks, NetworkId, DataPlan, categories, PlanCategory } from "@/lib/data";
import { NetworkBadge } from "@/components/NetworkBadge";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, CheckCircle2, Wallet, CreditCard, Copy, Sparkles, Gift } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PinDialog } from "@/components/PinDialog";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { Transaction } from "@/lib/data";

export default function BuyData() {
  const { user, openAuth, wallet, deductWallet, addTransaction, settings, pushNotification } = useApp();
  const [network, setNetwork] = useState<NetworkId>("mtn");
  const [phone, setPhone] = useState("");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<PlanCategory>("monthly");
  const [selected, setSelected] = useState<DataPlan | null>(null);
  const [step, setStep] = useState<"review" | "pay" | "done">("review");
  const [pinOpen, setPinOpen] = useState(false);
  const [receipt, setReceipt] = useState<Transaction | null>(null);

  const plans = useMemo(() => dataPlans.filter((p) =>
    p.network === network &&
    p.category === cat &&
    (query === "" || p.size.toLowerCase().includes(query.toLowerCase())),
  ), [network, cat, query]);

  function start(p: DataPlan) {
    if (!user) { openAuth("login"); return; }
    if (!/^0[789][01]\d{8}$/.test(phone)) { toast.error("Enter a valid Nigerian phone number"); return; }
    setSelected(p); setStep("review");
  }

  function payWallet() {
    if (!selected) return;
    if (wallet < selected.price) { toast.error("Insufficient wallet balance. Fund your wallet first."); return; }
    setPinOpen(true);
  }

  function confirmData() {
    if (!selected) return;
    setPinOpen(false);
    deductWallet(selected.price);
    const tx = addTransaction({ type: "data", network: selected.network, phone, amount: selected.price, status: "success", description: `${selected.network.toUpperCase()} ${selected.size} / ${selected.validity}` });
    pushNotification({ title: "Data purchase successful", body: `${selected.size} delivered to ${phone}. Cashback: ₦${selected.cashback}.` });
    // Award cashback
    if (selected.cashback > 0) {
      addTransaction({ type: "wallet", amount: selected.cashback, status: "success", description: `Cashback on ${selected.size} ${selected.network.toUpperCase()}` });
    }
    setStep("done");
    setReceipt(tx);
    toast.success(`Data delivered! +₦${selected.cashback} cashback`);
  }

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Buy Data</h1>
        <p className="text-muted-foreground mt-1">Pick a network, choose a plan, and we deliver in seconds.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div>
          <Card className="p-5 mb-5 bg-gradient-card shadow-card">
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="mb-2 block">Network</Label>
                <div className="grid grid-cols-4 gap-2">
                  {networks.map((n) => (
                    <button key={n.id} onClick={() => setNetwork(n.id)} className={`flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition ${network === n.id ? "border-primary bg-accent" : "border-transparent bg-muted/40 hover:bg-muted"}`}>
                      <NetworkBadge id={n.id} size="sm" />
                      <span className="text-xs font-medium">{n.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="phone" className="mb-2 block">Phone number</Label>
                <Input id="phone" inputMode="numeric" maxLength={11} placeholder="08012345678" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Tabs value={cat} onValueChange={(v) => setCat(v as PlanCategory)} className="flex-1">
                <TabsList>
                  {categories.map((c) => <TabsTrigger key={c.id} value={c.id}>{c.label}</TabsTrigger>)}
                </TabsList>
              </Tabs>
              <div className="relative sm:w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search size (e.g. 5GB)" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
              </div>
            </div>
          </Card>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {plans.map((p) => (
              <Card key={p.id} className="relative p-5 bg-gradient-card shadow-card hover-lift overflow-hidden">
                <Badge className="absolute top-3 right-3 bg-destructive text-destructive-foreground shadow-md">{p.discount}% OFF</Badge>
                {p.popular && <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-warning/90 text-black text-[10px] font-bold flex items-center gap-1"><Sparkles className="h-3 w-3" />HOT</span>}
                <div className="flex items-center gap-3 mb-3 mt-4">
                  <NetworkBadge id={p.network} size="sm" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.category} · {p.type}</p>
                    <p className="font-semibold">{p.size}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Valid for {p.validity}</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-2xl font-bold">₦{p.price.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground line-through">₦{p.originalPrice.toLocaleString()}</p>
                </div>
                <p className="mt-1 text-xs text-success flex items-center gap-1"><Gift className="h-3 w-3" /> Earn ₦{p.cashback} cashback</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">⏳ Flash sale</span>
                  <Button size="sm" onClick={() => start(p)} className="bg-gradient-primary">Buy</Button>
                </div>
              </Card>
            ))}
            {plans.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-10">No plans match your filters.</p>}
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="p-5 bg-gradient-primary text-primary-foreground shadow-elevated">
            <p className="text-xs opacity-80">Wallet balance</p>
            <p className="text-3xl font-bold">₦{wallet.toLocaleString()}</p>
            <Button variant="secondary" size="sm" className="mt-3" asChild><a href="/wallet">Fund wallet</a></Button>
          </Card>
          <Card className="p-5 shadow-card">
            <h3 className="font-semibold mb-2">Why Data4Me?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {["Instant delivery on all networks", "Refund to wallet on failure", "Lowest prices, no hidden fees"].map((x) => (
                <li key={x} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />{x}</li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setStep("review"); } }}>
        <DialogContent className="sm:max-w-md">
          {selected && step === "review" && (
            <>
              <DialogHeader>
                <DialogTitle>Review your order</DialogTitle>
                <DialogDescription>Confirm before payment.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Row label="Network"><div className="flex items-center gap-2"><NetworkBadge id={selected.network} size="sm" /><span className="font-medium">{selected.network.toUpperCase()}</span></div></Row>
                <Row label="Plan">{selected.size} • {selected.type}</Row>
                <Row label="Validity">{selected.validity}</Row>
                <Row label="Phone">{phone}</Row>
                <Row label="Amount" highlight>₦{selected.price.toLocaleString()}</Row>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
                <Button onClick={() => setStep("pay")} className="bg-gradient-primary">Proceed</Button>
              </div>
            </>
          )}
          {selected && step === "pay" && (
            <>
              <DialogHeader>
                <DialogTitle>Choose payment</DialogTitle>
                <DialogDescription>Demo flow — no real charges.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <button onClick={payWallet} className="w-full p-4 rounded-xl border-2 border-primary bg-accent text-left hover:shadow-card transition">
                  <div className="flex items-center gap-3"><Wallet className="h-5 w-5 text-primary" /><div className="flex-1"><p className="font-semibold">Pay with wallet</p><p className="text-xs text-muted-foreground">Balance: ₦{wallet.toLocaleString()}</p></div><span className="font-bold">₦{selected.price.toLocaleString()}</span></div>
                </button>
                <div className="p-4 rounded-xl border border-border bg-muted/30">
                  <div className="flex items-center gap-2 mb-2"><CreditCard className="h-5 w-5 text-primary" /><p className="font-semibold">Bank transfer</p></div>
                  <div className="text-sm space-y-1">
                    <Row label="Bank">{settings.bankName}</Row>
                    <Row label="Account">{settings.accountName}</Row>
                    <Row label="Number"><span className="flex items-center gap-2 font-mono">{settings.accountNumber}<Copy className="h-3.5 w-3.5 cursor-pointer hover:text-primary" onClick={() => { navigator.clipboard.writeText(settings.accountNumber); toast.success("Copied"); }} /></span></Row>
                  </div>
                  <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => { addTransaction({ type: "data", network: selected.network, phone, amount: selected.price, status: "pending", description: `${selected.network.toUpperCase()} ${selected.size} (transfer)` }); toast.info("Awaiting transfer confirmation"); setSelected(null); }}>I've sent the transfer</Button>
                </div>
              </div>
            </>
          )}
          {selected && step === "done" && (
            <div className="text-center py-6">
              <div className="h-16 w-16 rounded-full bg-success/15 text-success grid place-items-center mx-auto mb-4"><CheckCircle2 className="h-8 w-8" /></div>
              <h3 className="text-xl font-bold">Delivered!</h3>
              <p className="text-muted-foreground text-sm mt-1">{selected.size} sent to {phone}</p>
              <Button className="mt-5 w-full bg-gradient-primary" onClick={() => { setSelected(null); setStep("review"); }}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <PinDialog open={pinOpen} onClose={() => setPinOpen(false)} onVerified={confirmData} title="Authorise data purchase" description={selected ? `Confirm ${selected.size} ${selected.network.toUpperCase()} for ₦${selected.price.toLocaleString()}.` : ""} />
      <ReceiptDialog tx={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function Row({ label, children, highlight }: { label: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${highlight ? "pt-2 border-t border-border text-lg font-semibold" : "text-sm"}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "" : "font-medium"}>{children}</span>
    </div>
  );
}