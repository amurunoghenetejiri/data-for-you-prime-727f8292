import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, Search, Download } from "lucide-react";
import { useState } from "react";
import { EmptyBlock, ErrorBlock, GlassCard, LoadingBlock, PageHead, StatusPill, fmtNaira } from "./_shared";

export default function AdminTransactions() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "tx", q, status, type],
    queryFn: async () => {
      let qb = supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500);
      if (status !== "all") qb = qb.eq("status", status);
      if (type !== "all") qb = qb.eq("type", type);
      if (q) qb = qb.or(`reference.ilike.%${q}%,description.ilike.%${q}%`);
      const { data, error } = await qb;
      if (error) throw error;
      return data || [];
    },
  });

  function exportCsv() {
    const rows = data || [];
    const csv = ["Reference,Type,Amount,Status,Description,Date", ...rows.map((r: any) => `${r.reference},${r.type},${r.amount},${r.status},"${(r.description || "").replace(/"/g, "'")}",${r.created_at}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `transactions-${Date.now()}.csv`; a.click();
  }

  return (
    <div>
      <PageHead title="Transactions" subtitle="Every payment, transfer and purchase across the platform" icon={Receipt}
        actions={<button onClick={exportCsv} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm flex items-center gap-1.5"><Download className="h-4 w-4" /> Export</button>} />

      <GlassCard className="p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reference or description" className="w-full h-10 pl-9 pr-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm">
            <option value="all">All statuses</option><option value="success">Success</option><option value="pending">Pending</option><option value="failed">Failed</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm">
            <option value="all">All types</option><option value="wallet">Wallet</option><option value="data">Data</option><option value="airtime">Airtime</option><option value="cable">Cable</option><option value="electricity">Electricity</option><option value="transfer">Transfer</option>
          </select>
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        {isLoading ? <LoadingBlock /> : error ? <ErrorBlock message={(error as any).message} onRetry={() => refetch()} /> : !data?.length ? <EmptyBlock icon={Receipt} title="No transactions" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-900/40">
                <tr><th className="text-left px-4 py-3">Reference</th><th className="text-left px-4 py-3">Type</th><th className="text-right px-4 py-3">Amount</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3 hidden md:table-cell">Description</th><th className="text-right px-4 py-3">Date</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map((t: any) => (
                  <tr key={t.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-300">{t.reference}</td>
                    <td className="px-4 py-2.5 capitalize text-slate-300">{t.type}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-white">{fmtNaira(t.amount)}</td>
                    <td className="px-4 py-2.5"><StatusPill status={t.status} /></td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-xs text-slate-400 max-w-xs truncate">{t.description}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-slate-400">{new Date(t.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}