import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, Ban, Clock, ShieldOff, LogOut } from "lucide-react";

type Status = { status: string; block_reason: string | null; suspended_until: string | null } | null;

export function AccountStatusGate({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!uid) { setStatus(null); return; }
    let alive = true;
    const fetchStatus = async () => {
      const { data } = await supabase.from("user_status").select("status,block_reason,suspended_until").eq("user_id", uid).maybeSingle();
      if (!alive) return;
      setStatus((data as any) || { status: "active", block_reason: null, suspended_until: null });
    };
    fetchStatus();
    const ch = supabase.channel(`status-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_status", filter: `user_id=eq.${uid}` }, (p) => {
        setStatus((p.new as any) || null);
      }).subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [uid]);

  // Auto-lift suspension if window has passed
  const effectiveStatus = (() => {
    if (!status) return "active";
    if (status.status === "suspended" && status.suspended_until && new Date(status.suspended_until) < new Date()) return "active";
    return status.status;
  })();

  if (!uid || effectiveStatus === "active") return <>{children}</>;

  const meta: Record<string, { icon: any; title: string; color: string }> = {
    blocked: { icon: Ban, title: "Account Blocked", color: "rose" },
    suspended: { icon: Clock, title: "Account Suspended", color: "amber" },
    disabled: { icon: ShieldOff, title: "Account Disabled", color: "slate" },
  };
  const m = meta[effectiveStatus] || { icon: ShieldAlert, title: "Account restricted", color: "rose" };
  const Icon = m.icon;

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-950 via-rose-950/30 to-slate-950 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 p-8 text-center shadow-2xl">
        <div className={`mx-auto h-16 w-16 rounded-2xl bg-${m.color}-500/15 border border-${m.color}-500/30 grid place-items-center mb-4`}>
          <Icon className={`h-8 w-8 text-${m.color}-300`} />
        </div>
        <h1 className="text-2xl font-bold text-white">{m.title}</h1>
        <p className="text-sm text-slate-400 mt-2">{status?.block_reason || "Please contact support for more information."}</p>
        {effectiveStatus === "suspended" && status?.suspended_until && (
          <p className="text-xs text-amber-300 mt-3">Access returns automatically on {new Date(status.suspended_until).toLocaleString()}</p>
        )}
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }} className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
