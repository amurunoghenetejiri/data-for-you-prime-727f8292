import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Ban, ShieldOff, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { GlassCard, PageHead, LoadingBlock, EmptyBlock, StatusPill } from "./_shared";

type Row = { user_id: string; status: string; block_reason: string | null; blocked_at: string | null; suspended_until: string | null; profile?: { username: string; email: string } };

export default function BlockedUsers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("user_status").select("*").neq("status", "active").order("blocked_at", { ascending: false }).limit(500);
    const ids = (data || []).map((r: any) => r.user_id);
    const { data: profs } = ids.length ? await supabase.from("profiles").select("id,username,email").in("id", ids) : { data: [] as any[] };
    const map = new Map((profs || []).map((p: any) => [p.id, p]));
    setRows(((data as any[]) || []).map((r) => ({ ...r, profile: map.get(r.user_id) })));
    setLoading(false);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("blocked-users")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_status" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

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
    load();
  }

  return (
    <div>
      <PageHead title="Blocked & Suspended Users" subtitle="Manage user access restrictions" icon={Ban} />
      <GlassCard className="overflow-hidden">
        {loading ? <LoadingBlock /> : rows.length === 0 ? <EmptyBlock icon={ShieldCheck} title="No restricted users" body="All accounts are currently active." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-900/40">
                <tr><th className="text-left px-4 py-3">User</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Reason</th><th className="text-left px-4 py-3">Since</th><th className="text-left px-4 py-3">Until</th><th className="text-right px-4 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r) => (
                  <tr key={r.user_id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3"><p className="text-white font-medium">@{r.profile?.username || "user"}</p><p className="text-xs text-slate-400">{r.profile?.email}</p></td>
                    <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-300 max-w-xs truncate">{r.block_reason || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.blocked_at ? new Date(r.blocked_at).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.suspended_until ? new Date(r.suspended_until).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => setStatus(r.user_id, "active")} className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 text-xs inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Unblock</button>
                        <button onClick={() => setStatus(r.user_id, "suspended")} className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-200 border border-amber-500/30 text-xs inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Suspend</button>
                        <button onClick={() => setStatus(r.user_id, "blocked")} className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 text-rose-200 border border-rose-500/30 text-xs inline-flex items-center gap-1"><Ban className="h-3.5 w-3.5" /> Block</button>
                        <button onClick={() => setStatus(r.user_id, "disabled")} className="px-2.5 py-1.5 rounded-lg bg-slate-500/15 text-slate-200 border border-slate-500/30 text-xs inline-flex items-center gap-1"><ShieldOff className="h-3.5 w-3.5" /> Disable</button>
                      </div>
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

export function useUserStatusActions() {
  return async (user_id: string, status: string, reason?: string, until?: string) => {
    const { error } = await supabase.rpc("set_user_status", { _user_id: user_id, _status: status, _reason: reason || null, _suspended_until: until || null });
    if (error) throw error;
  };
}
