import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileClock } from "lucide-react";
import { EmptyBlock, GlassCard, LoadingBlock, PageHead } from "./_shared";

export default function AdminAuditLogs() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15_000,
  });

  return (
    <div>
      <PageHead title="Audit Logs" subtitle="Every administrative action — for accountability" icon={FileClock} />
      <GlassCard className="overflow-hidden">
        {isLoading ? <LoadingBlock /> : !data?.length ? <EmptyBlock icon={FileClock} title="No audit entries yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-900/40">
                <tr><th className="text-left px-4 py-3">Time</th><th className="text-left px-4 py-3">Admin</th><th className="text-left px-4 py-3">Action</th><th className="text-left px-4 py-3">Target</th><th className="text-left px-4 py-3 hidden md:table-cell">Details</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map((l: any) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-300">{l.admin_email || l.admin_id.slice(0, 8)}</td>
                    <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-violet-500/15 text-violet-300 border border-violet-500/30">{l.action}</span></td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{l.target_type ? `${l.target_type}:${l.target_id?.slice(0, 8) || ""}` : "—"}</td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-[11px] font-mono text-slate-500 max-w-xs truncate">{JSON.stringify(l.details)}</td>
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