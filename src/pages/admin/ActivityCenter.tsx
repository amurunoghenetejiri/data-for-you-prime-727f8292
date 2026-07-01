import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Search, Download, Loader2, Filter } from "lucide-react";
import { GlassCard, LoadingBlock, PageHead, StatusPill } from "./_shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = ["all", "auth", "wallet", "data", "airtime", "cable", "electricity", "education", "transfer", "withdraw", "profile", "support", "referral", "transaction"] as const;
const STATUSES = ["all", "success", "pending", "failed", "approved", "rejected", "processing"];
const PAGE_SIZE = 25;

type Row = {
  id: string; user_id: string | null; category: string; action: string;
  status: string | null; ip_address: string | null; user_agent: string | null;
  details: any; created_at: string;
};

export default function AdminActivityCenter() {
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { username?: string; email?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  async function load() {
    setLoading(true);
    let query = supabase.from("user_activity_log").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (cat !== "all") query = query.eq("category", cat);
    if (status !== "all") query = query.eq("status", status);
    if (q.trim()) query = query.ilike("action", `%${q.trim()}%`);
    query = query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    const { data, count, error } = await query;
    if (!error) {
      setRows((data || []) as any);
      setTotal(count || 0);
      const ids = Array.from(new Set((data || []).map((r: any) => r.user_id).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, username, email").in("id", ids);
        const map: Record<string, any> = {};
        (profs || []).forEach((p: any) => { map[p.id] = p; });
        setProfiles(map);
      }
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cat, status, page]);
  useEffect(() => {
    const ch = supabase.channel("activity-live").on("postgres_changes", { event: "INSERT", schema: "public", table: "user_activity_log" }, () => {
      if (page === 0) load();
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [page, cat, status, q]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function exportCsv() {
    const header = ["When", "User", "Email", "Category", "Action", "Status", "IP", "Device", "Details"];
    const csv = [header.join(",")].concat(rows.map((r) => {
      const p = r.user_id ? profiles[r.user_id] : undefined;
      const cells = [
        new Date(r.created_at).toISOString(),
        p?.username || "",
        p?.email || "",
        r.category,
        r.action,
        r.status || "",
        r.ip_address || "",
        (r.user_agent || "").replace(/,/g, ";"),
        JSON.stringify(r.details || {}).replace(/"/g, '""'),
      ];
      return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
    })).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `activity-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHead title="Activity Center" subtitle="Every important action performed across the platform." icon={Activity}
        actions={<Button variant="outline" onClick={exportCsv} className="border-white/10 text-white/80"><Download className="h-4 w-4 mr-2" />Export CSV</Button>} />

      <GlassCard className="p-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setPage(0); load(); } }}
              placeholder="Search action…" className="pl-8 bg-slate-900/60 border-white/10 text-white" />
          </div>
          <Select value={cat} onValueChange={(v) => { setPage(0); setCat(v); }}>
            <SelectTrigger className="w-[160px] bg-slate-900/60 border-white/10 text-white"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setPage(0); setStatus(v); }}>
            <SelectTrigger className="w-[140px] bg-slate-900/60 border-white/10 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => { setPage(0); load(); }} className="bg-violet-600 hover:bg-violet-500">Apply</Button>
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        {loading ? <LoadingBlock /> : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No activity found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/40 text-slate-400 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">IP / Device</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const p = r.user_id ? profiles[r.user_id] : undefined;
                  return (
                    <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2 text-white">
                        <div>{p?.username || <span className="text-slate-500">—</span>}</div>
                        <div className="text-[11px] text-slate-500">{p?.email || ""}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-300 capitalize">{r.category}</td>
                      <td className="px-3 py-2 text-slate-200">{r.action}</td>
                      <td className="px-3 py-2"><StatusPill status={r.status || "success"} /></td>
                      <td className="px-3 py-2 text-[11px] text-slate-400">
                        <div>{r.ip_address || "—"}</div>
                        <div className="truncate max-w-[220px]">{r.user_agent || ""}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
        <div>Page {page + 1} of {pageCount} · {total} events</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-white/10 text-white/80" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
          <Button size="sm" variant="outline" className="border-white/10 text-white/80" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
