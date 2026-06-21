import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/AppContext";
import { NetworkBadge } from "@/components/NetworkBadge";
import { Search, ArrowDownLeft, ArrowUpRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Receipt } from "lucide-react";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { Transaction } from "@/lib/data";

export default function Transactions() {
  const { transactions } = useApp();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [receipt, setReceipt] = useState<Transaction | null>(null);

  const filtered = useMemo(() => transactions.filter((t) => {
    if (tab !== "all" && t.type !== tab) return false;
    if (q && !(t.description.toLowerCase().includes(q.toLowerCase()) || t.reference.toLowerCase().includes(q.toLowerCase()) || (t.phone || "").includes(q))) return false;
    return true;
  }), [transactions, tab, q]);

  const totalSpent = transactions.filter((t) => t.type !== "wallet" && t.status === "success").reduce((s, t) => s + t.amount, 0);
  const successCount = transactions.filter((t) => t.status === "success").length;

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold">Transactions</h1>
      <p className="text-muted-foreground mt-1 mb-6">Every top-up, neatly tracked.</p>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 bg-gradient-card shadow-card"><p className="text-xs text-muted-foreground">Total transactions</p><p className="text-2xl font-bold">{transactions.length}</p></Card>
        <Card className="p-5 bg-gradient-card shadow-card"><p className="text-xs text-muted-foreground">Successful</p><p className="text-2xl font-bold text-success">{successCount}</p></Card>
        <Card className="p-5 bg-gradient-card shadow-card"><p className="text-xs text-muted-foreground">Total spent</p><p className="text-2xl font-bold">₦{totalSpent.toLocaleString()}</p></Card>
      </div>

      <Card className="p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              {[["all", "All"], ["data", "Data"], ["airtime", "Airtime"], ["wallet", "Wallet"]].map(([v, l]) => <TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search reference, phone…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Reference</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Receipt</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} className="hover:bg-muted/40">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {t.network ? <NetworkBadge id={t.network} size="sm" /> : <div className={cn("h-7 w-7 rounded-full grid place-items-center", t.type === "wallet" ? "bg-success/15 text-success" : "bg-muted")}>{t.type === "wallet" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</div>}
                      <div>
                        <p className="font-medium text-sm">{t.description}</p>
                        {t.phone && <p className="text-xs text-muted-foreground">{t.phone}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(t.date).toLocaleString()}</TableCell>
                  <TableCell><StatusPill status={t.status} /></TableCell>
                  <TableCell className={cn("text-right font-semibold", t.type === "wallet" && "text-success")}>{t.type === "wallet" ? "+" : "-"}₦{t.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setReceipt(t)}><Receipt className="h-4 w-4 mr-1" />Receipt</Button></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No transactions match your filters.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>
      <ReceiptDialog tx={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function StatusPill({ status }: { status: "success" | "pending" | "failed" }) {
  const map = {
    success: "bg-success/15 text-success",
    pending: "bg-warning/20 text-[hsl(var(--warning))]",
    failed: "bg-destructive/15 text-destructive",
  };
  return <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full capitalize", map[status])}>{status === "pending" && <Clock className="h-3 w-3" />}{status}</span>;
}