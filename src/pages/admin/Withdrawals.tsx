import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUpFromLine, Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyBlock, ErrorBlock, GlassCard, LoadingBlock, PageHead, StatusPill, fmtNaira, logAdminAction, maskAcct } from "./_shared";

export default function AdminWithdrawals() {
  const [filter, setFilter] = useState("pending");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "withdrawals", filter],
    queryFn: async () => {
      let qb = supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(200);
      if (filter !== "all") qb = qb.eq("status", filter);
      const { data, error } = await qb;
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((d: any) => d.user_id)));
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, username, email").in("id", ids) : { data: [] as any[] };
      const map = new Map((profiles || []).map((p: any) => [p.id, p]));
      return (data || []).map((d: any) => ({ ...d, profile: map.get(d.user_id) }));
    },
  });

  async function setStatus(w: any, status: "approved" | "rejected" | "completed") {
    const { error } = await supabase.from("withdrawals").update({ status }).eq("id", w.id);
    if (error) return toast.error(error.message);
    await logAdminAction(supabase, `withdrawal_${status}`, "withdrawal", w.id, { amount: w.amount });
    toast.success("Updated");
    refetch();
  }

  return (
    <div>
      <PageHead title="Withdrawals" subtitle="Process user withdrawal requests" icon={ArrowUpFromLine}
        actions={
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm">
            <option value="pending">Pending</option><option value="approved">Approved</option><option value="completed">Completed</option><option value="rejected">Rejected</option><option value="all">All</option>
          </select>
        } />
      <GlassCard className="overflow-hidden">
        {isLoading ? <LoadingBlock /> : error ? <ErrorBlock message={(error as any).message} onRetry={() => refetch()} /> : !data?.length ? <EmptyBlock icon={ArrowUpFromLine} title="No withdrawals" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-900/40">
                <tr><th className="text-left px-4 py-3">User</th><th className="text-right px-4 py-3">Amount</th><th className="text-left px-4 py-3">Bank</th><th className="text-left px-4 py-3">Account</th><th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map((w: any) => (
                  <tr key={w.id}>
                    <td className="px-4 py-3"><p className="text-white font-medium">@{w.profile?.username}</p><p className="text-xs text-slate-400">{w.profile?.email}</p></td>
                    <td className="px-4 py-3 text-right tabular-nums text-white font-semibold">{fmtNaira(w.amount)}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{w.bank_name}<br/><span className="text-slate-500">{w.account_name}</span></td>
                    <td className="px-4 py-3 font-mono text-xs">{maskAcct(w.account_number)}</td>
                    <td className="px-4 py-3"><StatusPill status={w.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {w.status === "pending" && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setStatus(w, "approved")} className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 text-[11px] border border-emerald-500/30">Approve</button>
                          <button onClick={() => setStatus(w, "rejected")} className="px-2 py-1 rounded bg-rose-500/15 text-rose-300 text-[11px] border border-rose-500/30">Reject</button>
                        </div>
                      )}
                      {w.status === "approved" && <button onClick={() => setStatus(w, "completed")} className="px-2 py-1 rounded bg-violet-500/15 text-violet-300 text-[11px] border border-violet-500/30">Mark paid</button>}
                    </td>
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