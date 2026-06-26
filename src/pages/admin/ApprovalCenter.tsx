import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BadgeCheck, Check, X, Eye, Download, Ban } from "lucide-react";
import { toast } from "sonner";
import { EmptyBlock, GlassCard, LoadingBlock, PageHead, StatusPill, fmtNaira } from "./_shared";

export default function ApprovalCenter() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "cancelled">("pending");
  const [preview, setPreview] = useState<any | null>(null);
  const [remark, setRemark] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["approval", tab],
    queryFn: async () => {
      const { data: rows } = await supabase.from("funding_requests").select("*").eq("status", tab).order("created_at", { ascending: false }).limit(200);
      const ids = Array.from(new Set((rows || []).map((r: any) => r.user_id)));
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id,username,email,phone").in("id", ids) : { data: [] as any[] };
      const map = new Map((profs || []).map((p: any) => [p.id, p]));
      return (rows || []).map((r: any) => ({ ...r, profile: map.get(r.user_id) }));
    },
  });

  // realtime auto-refresh
  useEffect(() => {
    const ch = supabase.channel("approval-fr")
      .on("postgres_changes", { event: "*", schema: "public", table: "funding_requests" }, () => qc.invalidateQueries({ queryKey: ["approval"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  async function act(kind: "approve" | "reject" | "cancel", r: any) {
    const rpc = kind === "approve" ? "approve_funding" : kind === "reject" ? "reject_funding" : "cancel_funding";
    const { error } = await supabase.rpc(rpc, { _id: r.id, _remark: remark || null });
    if (error) return toast.error(error.message);
    toast.success(kind[0].toUpperCase() + kind.slice(1) + "d");
    setPreview(null); setRemark("");
    refetch();
  }

  return (
    <div>
      <PageHead title="Approval Center" subtitle="Approve, reject or cancel user funding requests" icon={BadgeCheck} />

      <GlassCard className="p-2 mb-4 flex gap-1 overflow-x-auto">
        {(["pending", "approved", "rejected", "cancelled"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={"px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider " + (tab === t ? "bg-violet-600 text-white" : "text-slate-400 hover:bg-white/5")}>{t}</button>
        ))}
      </GlassCard>

      <GlassCard className="overflow-hidden">
        {isLoading ? <LoadingBlock /> : !data?.length ? <EmptyBlock icon={BadgeCheck} title={`No ${tab} requests`} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-900/40">
                <tr><th className="text-left px-4 py-3">User</th><th className="text-right px-4 py-3">Amount</th><th className="text-left px-4 py-3">Method</th><th className="text-left px-4 py-3">Reference</th><th className="text-left px-4 py-3">When</th><th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map((r: any) => (
                  <tr key={r.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3"><p className="text-white font-medium">@{r.profile?.username || "user"}</p><p className="text-xs text-slate-400">{r.profile?.email}</p></td>
                    <td className="px-4 py-3 text-right tabular-nums text-white font-semibold">{fmtNaira(r.amount)}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{r.bank || r.provider || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.reference || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { setPreview(r); setRemark(r.admin_remark || ""); }} className="px-2.5 py-1.5 rounded-lg bg-violet-500/15 text-violet-300 border border-violet-500/30 text-xs font-medium inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> Review</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={() => setPreview(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Funding request</h3>
                <p className="text-xs text-slate-400">@{preview.profile?.username} • {preview.profile?.email}</p>
              </div>
              <StatusPill status={preview.status} />
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-4">
              <div><p className="text-[10px] uppercase tracking-widest text-slate-500">Amount</p><p className="text-xl font-bold text-white">{fmtNaira(preview.amount)}</p></div>
              <div><p className="text-[10px] uppercase tracking-widest text-slate-500">Reference</p><p className="text-sm font-mono text-slate-200">{preview.reference || "—"}</p></div>
              <div><p className="text-[10px] uppercase tracking-widest text-slate-500">Method</p><p className="text-sm text-slate-200">{preview.bank || preview.provider || "—"}</p></div>
              <div><p className="text-[10px] uppercase tracking-widest text-slate-500">When</p><p className="text-sm text-slate-200">{new Date(preview.created_at).toLocaleString()}</p></div>
              {preview.note && <div className="sm:col-span-2"><p className="text-[10px] uppercase tracking-widest text-slate-500">User note</p><p className="text-sm text-slate-200">{preview.note}</p></div>}
            </div>
            {preview.receipt_url && (
              <div className="px-5 pb-3">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Receipt</p>
                <div className="rounded-lg overflow-hidden border border-white/10 bg-black/40">
                  <img src={preview.receipt_url} alt="Receipt" className="w-full max-h-[50vh] object-contain" />
                </div>
                <a href={preview.receipt_url} download target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-violet-300 hover:underline"><Download className="h-3 w-3" /> Download</a>
              </div>
            )}
            <div className="px-5 pb-5">
              <label className="text-[10px] uppercase tracking-widest text-slate-500">Admin remark (shown to user)</label>
              <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full mt-1 min-h-20 px-3 py-2 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm" placeholder="Optional comment…" />
            </div>
            {preview.status === "pending" && (
              <div className="p-5 border-t border-white/10 flex flex-wrap gap-2 justify-end">
                <button onClick={() => act("cancel", preview)} className="px-3 py-2 rounded-lg bg-slate-500/15 text-slate-200 border border-slate-500/30 text-sm inline-flex items-center gap-1"><Ban className="h-4 w-4" /> Cancel</button>
                <button onClick={() => act("reject", preview)} className="px-3 py-2 rounded-lg bg-rose-500/15 text-rose-200 border border-rose-500/30 text-sm inline-flex items-center gap-1"><X className="h-4 w-4" /> Reject</button>
                <button onClick={() => act("approve", preview)} className="px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 text-sm inline-flex items-center gap-1"><Check className="h-4 w-4" /> Approve & credit</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
