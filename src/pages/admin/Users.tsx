import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users as UsersIcon, Search, Inbox, Ban, ShieldCheck, Clock, ShieldOff } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { EmptyBlock, ErrorBlock, GlassCard, LoadingBlock, PageHead, StatusPill, fmtNaira } from "./_shared";

const PAGE = 20;

export default function AdminUsers() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<"all" | "active" | "suspended" | "blocked" | "disabled">("all");

  async function setStatus(user_id: string, status: string) {
    let reason: string | null = null;
    let until: string | null = null;
    if (status !== "active") {
      reason = prompt(`Reason for ${status} (shown to user):`, "");
      if (reason === null) return;
    }
    if (status === "suspended") {
      const days = prompt("Suspend for how many days? (leave blank for indefinite)", "7");
      if (days === null) return;
      if (days.trim()) until = new Date(Date.now() + Number(days) * 86400000).toISOString();
    }
    const { error } = await supabase.rpc("set_user_status", { _user_id: user_id, _status: status, _reason: reason, _suspended_until: until });
    if (error) return toast.error(error.message);
    toast.success(`User ${status}`);
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "users", q, page, filter],
    queryFn: async () => {
      let qb = supabase.from("profiles").select("id, username, email, phone, created_at", { count: "exact" }).order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
      if (q) qb = qb.or(`username.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
      const { data: rows, count, error } = await qb;
      if (error) throw error;
      const ids = (rows || []).map((r: any) => r.id);
      const [{ data: wallets }, { data: statuses }, { data: logins }] = await Promise.all([
        ids.length ? supabase.from("wallets").select("user_id, balance").in("user_id", ids) : Promise.resolve({ data: [] as any[] }),
        ids.length ? supabase.from("user_status").select("user_id, is_blocked, is_verified").in("user_id", ids) : Promise.resolve({ data: [] as any[] }),
        ids.length ? supabase.from("login_activity").select("user_id, created_at").in("user_id", ids).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
      ]);
      const wMap = new Map((wallets || []).map((w: any) => [w.user_id, w.balance]));
      const sMap = new Map((statuses || []).map((s: any) => [s.user_id, s]));
      const lMap = new Map<string, string>();
      (logins || []).forEach((l: any) => { if (!lMap.has(l.user_id)) lMap.set(l.user_id, l.created_at); });
      const merged = (rows || []).map((r: any) => ({
        ...r,
        balance: wMap.get(r.id) || 0,
        status: sMap.get(r.id)?.status || (sMap.get(r.id)?.is_blocked ? "blocked" : "active"),
        verified: !!sMap.get(r.id)?.is_verified,
        last_login: lMap.get(r.id) || null,
      }));
      const filtered = filter === "all" ? merged : merged.filter((u) => u.status === filter);
      return { rows: filtered, total: count || 0 };
    },
  });

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data?.total || 0) / PAGE)), [data?.total]);

  return (
    <div>
      <PageHead title="User Management" subtitle="Search, inspect and manage every registered account" icon={UsersIcon} />

      <GlassCard className="p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input value={q} onChange={(e) => { setPage(0); setQ(e.target.value); }} placeholder="Search by username, email or phone" className="w-full h-10 pl-9 pr-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-sm text-white">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="blocked">Blocked</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        {isLoading ? <LoadingBlock /> :
          error ? <ErrorBlock message={(error as any).message} onRetry={() => refetch()} /> :
          !data?.rows.length ? <EmptyBlock icon={Inbox} title="No users found" body="Try adjusting your search or filter." /> :
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-900/40">
                <tr>
                  <th className="text-left px-4 py-3">Username</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Email</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Phone</th>
                  <th className="text-right px-4 py-3">Balance</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Joined</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Last login</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.rows.map((u: any) => (
                  <tr key={u.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white font-medium">@{u.username || "user"}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-300">{u.email}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-400">{u.phone || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-white">{fmtNaira(u.balance)}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-400">{u.last_login ? new Date(u.last_login).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3"><StatusPill status={u.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1 flex-wrap justify-end">
                        {u.status !== "active" && <button onClick={() => setStatus(u.id, "active")} title="Reactivate" className="h-7 w-7 grid place-items-center rounded-md bg-emerald-500/15 text-emerald-200 border border-emerald-500/30"><ShieldCheck className="h-3.5 w-3.5" /></button>}
                        {u.status !== "suspended" && <button onClick={() => setStatus(u.id, "suspended")} title="Suspend" className="h-7 w-7 grid place-items-center rounded-md bg-amber-500/15 text-amber-200 border border-amber-500/30"><Clock className="h-3.5 w-3.5" /></button>}
                        {u.status !== "blocked" && <button onClick={() => setStatus(u.id, "blocked")} title="Block" className="h-7 w-7 grid place-items-center rounded-md bg-rose-500/15 text-rose-200 border border-rose-500/30"><Ban className="h-3.5 w-3.5" /></button>}
                        {u.status !== "disabled" && <button onClick={() => setStatus(u.id, "disabled")} title="Disable" className="h-7 w-7 grid place-items-center rounded-md bg-slate-500/15 text-slate-200 border border-slate-500/30"><ShieldOff className="h-3.5 w-3.5" /></button>}
                        <Link to={`/admin/users/${u.id}`} className="px-2.5 py-1 rounded-md bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-200 text-xs font-medium">Manage</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </GlassCard>

      <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
        <p>Page {page + 1} of {totalPages} · {data?.total || 0} users</p>
        <div className="flex gap-2">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-40">Prev</button>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}