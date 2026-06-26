import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Radio } from "lucide-react";
import { GlassCard, PageHead, EmptyBlock } from "./_shared";

type Row = { id: string; user_id: string | null; user_email: string | null; event: string; category: string; details: any; created_at: string };

const catColor: Record<string, string> = {
  auth: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  funding: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  support: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  data: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  airtime: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  general: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

export default function LiveActivity() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setRows((data as any) || []));
    const ch = supabase.channel("admin-activity")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs" }, (p) => {
        setRows((cur) => [p.new as Row, ...cur].slice(0, 500));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const cats = Array.from(new Set(rows.map((r) => r.category)));
  const filtered = filter === "all" ? rows : rows.filter((r) => r.category === filter);

  return (
    <div>
      <PageHead title="Live Activity Feed" subtitle="Every action from every user, in real time" icon={Activity}
        actions={<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-semibold"><Radio className="h-3 w-3 animate-pulse" /> LIVE</span>} />

      <GlassCard className="p-3 mb-4 flex flex-wrap gap-2">
        <button onClick={() => setFilter("all")} className={"px-3 py-1.5 rounded-lg text-xs font-medium border " + (filter === "all" ? "bg-violet-600/30 text-violet-200 border-violet-500/40" : "bg-white/5 text-slate-300 border-white/10")}>All ({rows.length})</button>
        {cats.map((c) => (
          <button key={c} onClick={() => setFilter(c)} className={"px-3 py-1.5 rounded-lg text-xs font-medium border " + (filter === c ? "bg-violet-600/30 text-violet-200 border-violet-500/40" : "bg-white/5 text-slate-300 border-white/10")}>{c}</button>
        ))}
      </GlassCard>

      <GlassCard className="divide-y divide-white/5 max-h-[70vh] overflow-y-auto">
        {filtered.length === 0 ? <EmptyBlock icon={Activity} title="No activity yet" body="User events will stream in here in real time." /> : filtered.map((r) => (
          <div key={r.id} className="p-3 flex items-start gap-3 hover:bg-white/[0.02]">
            <span className={"shrink-0 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold border " + (catColor[r.category] || catColor.general)}>{r.category}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white truncate">{r.event}</p>
              <p className="text-xs text-slate-400 truncate">{r.user_email || "system"} • {new Date(r.created_at).toLocaleString()}</p>
              {r.details && Object.keys(r.details).length > 0 && (
                <pre className="mt-1 text-[10px] text-slate-500 bg-black/30 rounded p-1.5 overflow-x-auto">{JSON.stringify(r.details)}</pre>
              )}
            </div>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}
