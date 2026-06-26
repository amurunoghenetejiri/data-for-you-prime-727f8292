import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";

export function AdminNotificationBell() {
  const [count, setCount] = useState(0);
  const [latest, setLatest] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const { data } = await supabase.from("notifications").select("*").is("user_id", null).order("created_at", { ascending: false }).limit(20);
    setLatest((data as any) || []);
    setCount(((data as any[]) || []).filter((n) => !n.read).length);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (p) => {
        if ((p.new as any).user_id === null) {
          setLatest((cur) => [p.new, ...cur].slice(0, 20));
          setCount((c) => c + 1);
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function markAll() {
    await supabase.from("notifications").update({ read: true } as any).is("user_id", null).eq("read", false);
    setCount(0); load();
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative h-9 w-9 grid place-items-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10">
        <Bell className="h-4 w-4 text-violet-200" />
        {count > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center">{count > 99 ? "99+" : count}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto z-50 rounded-xl bg-slate-900 border border-white/10 shadow-2xl">
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <p className="font-semibold text-white text-sm">Admin notifications</p>
              <button onClick={markAll} className="text-[11px] text-violet-300 hover:underline">Mark all read</button>
            </div>
            <div className="divide-y divide-white/5">
              {latest.length === 0 ? <p className="p-4 text-xs text-slate-400 text-center">No notifications yet.</p> : latest.map((n: any) => (
                <div key={n.id} className={"p-3 " + (n.read ? "" : "bg-violet-500/5")}>
                  <p className="text-sm text-white">{n.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{n.body}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <Link to="/admin/notifications" onClick={() => setOpen(false)} className="block p-3 text-center text-xs text-violet-300 hover:bg-white/5 border-t border-white/10">View all →</Link>
          </div>
        </>
      )}
    </div>
  );
}
