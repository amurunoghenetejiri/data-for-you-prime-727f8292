import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users as UsersIcon, Search, Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyBlock, ErrorBlock, GlassCard, LoadingBlock, PageHead, StatusPill, fmtNaira } from "./_shared";

const PAGE = 20;

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<"all" | "active" | "blocked">("all");

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
        status: sMap.get(r.id)?.is_blocked ? "blocked" : "active",
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
            <option value="blocked">Blocked</option>
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
                    <td className="px-4 py-3 text-right"><Link to={`/admin/users/${u.id}`} className="px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-200 text-xs font-medium">Manage</Link></td>
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