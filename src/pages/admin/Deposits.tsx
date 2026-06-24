import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDownToLine, Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyBlock, ErrorBlock, GlassCard, LoadingBlock, PageHead, StatusPill, fmtNaira, logAdminAction } from "./_shared";

export default function AdminDeposits() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "deposits", filter],
    queryFn: async () => {
      let qb = supabase.from("funding_requests").select("*").order("created_at", { ascending: false }).limit(200);
      if (filter !== "all") qb = qb.eq("status", filter);
      const { data, error } = await qb;
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((d: any) => d.user_id)));
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, username, email").in("id", ids) : { data: [] as any[] };
      const map = new Map((profiles || []).map((p: any) => [p.id, p]));
      return (data || []).map((d: any) => ({ ...d, profile: map.get(d.user_id) }));
    },
  });

  async function approve(r: any) {
    const { error: e1 } = await supabase.from("funding_requests").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", r.id);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase.rpc("credit_wallet", { _user_id: r.user_id, _amount: r.amount, _reference: r.reference, _description: `Deposit approved` });
    if (e2) return toast.error(e2.message);
    await logAdminAction(supabase, "approve_deposit", "funding_request", r.id, { amount: r.amount, user_id: r.user_id });
    toast.success(`Credited ${fmtNaira(r.amount)} to @${r.profile?.username}`);
    qc.invalidateQueries({ queryKey: ["admin"] });
    refetch();
  }

  async function reject(r: any) {
    const reason = prompt("Reason for rejection (shown to user):", "Receipt could not be verified.");
    if (reason === null) return;
    const { error } = await supabase.from("funding_requests").update({ status: "rejected", reviewed_at: new Date().toISOString(), note: reason }).eq("id", r.id);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({ user_id: r.user_id, title: "Funding rejected", body: `Your ₦${Number(r.amount).toLocaleString()} funding request was rejected: ${reason}` });
    await logAdminAction(supabase, "reject_deposit", "funding_request", r.id, { reason });
    toast.info("Rejected and user notified");
    refetch();
  }

  async function cancel(r: any) {
    if (!confirm("Cancel this deposit request?")) return;
    const { error } = await supabase.from("funding_requests").update({ status: "cancelled", reviewed_at: new Date().toISOString() }).eq("id", r.id);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({ user_id: r.user_id, title: "Funding cancelled", body: `Your ₦${Number(r.amount).toLocaleString()} funding request was cancelled by admin.` });
    await logAdminAction(supabase, "cancel_deposit", "funding_request", r.id, {});
    toast.info("Cancelled");
    refetch();
  }

  return (
    <div>
      <PageHead title="Deposits" subtitle="Review wallet funding requests" icon={ArrowDownToLine}
        actions={
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm">
            <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option>
          </select>
        } />

      <GlassCard className="overflow-hidden">
        {isLoading ? <LoadingBlock /> : error ? <ErrorBlock message={(error as any).message} onRetry={() => refetch()} /> : !data?.length ? <EmptyBlock icon={ArrowDownToLine} title="No deposits" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-900/40">
                <tr><th className="text-left px-4 py-3">User</th><th className="text-right px-4 py-3">Amount</th><th className="text-left px-4 py-3">Method</th><th className="text-left px-4 py-3">Reference</th><th className="text-left px-4 py-3">Receipt</th><th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map((r: any) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3"><p className="text-white font-medium">@{r.profile?.username || "user"}</p><p className="text-xs text-slate-400">{r.profile?.email}</p></td>
                    <td className="px-4 py-3 text-right tabular-nums text-white font-semibold">{fmtNaira(r.amount)}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{r.bank || r.provider}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.reference}</td>
                    <td className="px-4 py-3">{r.receipt_url ? <a href={r.receipt_url} target="_blank" rel="noreferrer" className="text-violet-300 hover:underline text-xs">View</a> : "—"}</td>
                    <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "pending" && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => approve(r)} className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Approve</button>
                          <button onClick={() => reject(r)} className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-medium"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
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