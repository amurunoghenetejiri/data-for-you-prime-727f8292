import { GlassCard, PageHead } from "./_shared";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BadgeCheck, BarChart3, ShieldCheck, Lock, LifeBuoy, Database } from "lucide-react";

export function KycPage() {
  const { data } = useQuery({ queryKey: ["admin", "kyc"], queryFn: async () => (await supabase.from("user_status").select("*").order("updated_at", { ascending: false })).data || [] });
  return (
    <div>
      <PageHead title="KYC" subtitle="Verification status across all users" icon={BadgeCheck} />
      <GlassCard className="p-5">
        <p className="text-sm text-slate-400 mb-4">{data?.length || 0} status records</p>
        <ul className="divide-y divide-white/5">
          {(data || []).map((s: any) => (
            <li key={s.user_id} className="py-2.5 flex items-center justify-between text-sm">
              <span className="font-mono text-xs text-slate-400">{s.user_id.slice(0, 12)}…</span>
              <span className="flex gap-2">
                <span className={"px-2 py-0.5 rounded-full text-[10px] border " + (s.is_verified ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-slate-500/15 text-slate-300 border-slate-500/30")}>{s.is_verified ? "Verified" : "Unverified"}</span>
                {s.is_blocked && <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30">Blocked</span>}
              </span>
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}

export function ReportsPage() {
  const { data } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: async () => {
      const [tx, users] = await Promise.all([
        supabase.from("transactions").select("amount,type,status,created_at"),
        supabase.from("profiles").select("created_at"),
      ]);
      const days: Record<string, { rev: number; deposits: number; users: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
        days[d] = { rev: 0, deposits: 0, users: 0 };
      }
      (tx.data || []).forEach((t: any) => {
        const d = t.created_at.slice(0, 10); if (!days[d]) return;
        if (t.status === "success") {
          if (t.type === "wallet") days[d].deposits += Number(t.amount);
          else days[d].rev += Number(t.amount);
        }
      });
      (users.data || []).forEach((u: any) => { const d = u.created_at.slice(0, 10); if (days[d]) days[d].users += 1; });
      return days;
    },
  });
  const entries = Object.entries(data || {});
  const max = Math.max(1, ...entries.map(([, v]) => Math.max(v.rev, v.deposits)));
  return (
    <div>
      <PageHead title="Reports" subtitle="Last 7 days at a glance" icon={BarChart3} />
      <GlassCard className="p-5">
        <div className="grid grid-cols-7 gap-3 h-56 items-end">
          {entries.map(([day, v]) => (
            <div key={day} className="flex flex-col items-center gap-1">
              <div className="w-full flex gap-1 items-end h-full">
                <div className="flex-1 bg-gradient-to-t from-violet-600 to-violet-400 rounded-t-md" style={{ height: `${(v.rev / max) * 100}%` }} title={`Revenue ₦${v.rev}`} />
                <div className="flex-1 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md" style={{ height: `${(v.deposits / max) * 100}%` }} title={`Deposits ₦${v.deposits}`} />
              </div>
              <p className="text-[10px] text-slate-500">{day.slice(5)}</p>
              <p className="text-[10px] text-slate-300">+{v.users}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4 text-xs">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-violet-500" /> Revenue</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-500" /> Deposits</span>
          <span className="text-slate-400">+N = new users</span>
        </div>
      </GlassCard>
    </div>
  );
}

export function AdminAccountsPage() {
  const { data } = useQuery({
    queryKey: ["admin", "accounts"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").eq("role", "admin");
      const ids = (roles || []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, username, email, created_at").in("id", ids);
      return profiles || [];
    },
  });
  return (
    <div>
      <PageHead title="Admin Accounts" subtitle="Users with admin role" icon={ShieldCheck} />
      <GlassCard className="p-5">
        <ul className="divide-y divide-white/5">
          {(data || []).map((u: any) => (
            <li key={u.id} className="py-3 flex items-center justify-between text-sm">
              <div>
                <p className="text-white font-medium">@{u.username}</p>
                <p className="text-xs text-slate-400">{u.email}</p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-violet-500/15 text-violet-300 border border-violet-500/30">ADMIN</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500 mt-4">To add a new admin, assign the <code className="px-1 py-0.5 rounded bg-white/10">admin</code> role in the <code className="px-1 py-0.5 rounded bg-white/10">user_roles</code> table.</p>
      </GlassCard>
    </div>
  );
}

export function SecurityPage() {
  return (
    <div>
      <PageHead title="Security" subtitle="Best practices applied to this platform" icon={Lock} />
      <GlassCard className="p-5 space-y-3 text-sm">
        <Row label="Row-level security (RLS)" status="enabled" />
        <Row label="Admin role check (server-side)" status="enabled" />
        <Row label="Audit logging" status="enabled" />
        <Row label="Session inactivity timeout" status="30 min" />
        <Row label="HTTPS / TLS" status="enforced" />
        <Row label="Encrypted secrets (Paystack)" status="server-only" />
        <Row label="Password hashing" status="bcrypt (Supabase Auth)" />
      </GlassCard>
    </div>
  );
}
function Row({ label, status }: { label: string; status: string }) {
  return <div className="flex items-center justify-between border-b border-white/5 pb-2"><span className="text-slate-300">{label}</span><span className="text-emerald-300 text-xs font-semibold">{status}</span></div>;
}

export function SupportPage() {
  const { data } = useQuery({ queryKey: ["admin", "contact"], queryFn: async () => (await supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(100)).data || [] });
  return (
    <div>
      <PageHead title="Support" subtitle="Inbound contact messages" icon={LifeBuoy} />
      <GlassCard className="p-5 space-y-3">
        {(data || []).length === 0 ? <p className="text-sm text-slate-400">No support messages yet.</p> : data!.map((m: any) => (
          <div key={m.id} className="p-3 rounded-lg bg-white/5">
            <div className="flex justify-between"><p className="text-white font-medium text-sm">{m.name || "Anonymous"}</p><p className="text-xs text-slate-500">{new Date(m.created_at).toLocaleString()}</p></div>
            <p className="text-xs text-slate-400">{m.email} · {m.phone || "—"}</p>
            <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{m.message}</p>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

export function DatabasePage() {
  const tables = ["profiles", "wallets", "transactions", "funding_requests", "withdrawals", "products", "audit_logs", "notifications", "user_status", "user_roles", "admin_notes", "admin_messages", "bank_details", "chat_messages", "contact_messages", "login_activity", "app_settings"];
  return (
    <div>
      <PageHead title="Database" subtitle="Schema overview" icon={Database} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tables.map((t) => (
          <GlassCard key={t} className="p-4 flex items-center justify-between">
            <span className="font-mono text-sm text-white">{t}</span>
            <span className="text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">RLS</span>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}