import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Megaphone, Send } from "lucide-react";
import { toast } from "sonner";
import { GlassCard, PageHead, logAdminAction } from "./_shared";

export default function AdminNotifications() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data } = useQuery({
    queryKey: ["admin", "broadcast"],
    queryFn: async () => (await supabase.from("notifications").select("*").is("user_id", null).order("created_at", { ascending: false }).limit(50)).data || [],
  });

  async function broadcast() {
    if (!title.trim() || !body.trim()) return toast.error("Title and body required");
    const { data: profiles } = await supabase.from("profiles").select("id");
    const rows = (profiles || []).map((p: any) => ({ user_id: p.id, title, body }));
    rows.push({ user_id: null as any, title, body });
    const { error } = await supabase.from("notifications").insert(rows as any);
    if (error) return toast.error(error.message);
    await logAdminAction(supabase, "broadcast", "notification", null, { title, recipients: rows.length - 1 });
    toast.success(`Broadcast sent to ${rows.length - 1} users`);
    setTitle(""); setBody("");
    qc.invalidateQueries({ queryKey: ["admin", "broadcast"] });
  }

  return (
    <div>
      <PageHead title="Notifications" subtitle="Send announcements to every user" icon={Bell} />
      <div className="grid lg:grid-cols-2 gap-4">
        <GlassCard className="p-5">
          <h3 className="font-semibold text-white flex items-center gap-2 mb-3"><Megaphone className="h-4 w-4" /> New broadcast</h3>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Headline" className="w-full h-10 px-3 mb-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tell your users…" className="w-full min-h-28 px-3 py-2 mb-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm" />
          <button onClick={broadcast} className="w-full h-11 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold flex items-center justify-center gap-2"><Send className="h-4 w-4" /> Send to all users</button>
        </GlassCard>
        <GlassCard className="p-5">
          <h3 className="font-semibold text-white mb-3">Past broadcasts</h3>
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {(data || []).length === 0 ? <p className="text-sm text-slate-400">No broadcasts yet.</p> : data!.map((n: any) => (
              <div key={n.id} className="p-3 rounded-lg bg-white/5">
                <p className="text-sm text-white font-medium">{n.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{n.body}</p>
                <p className="text-[10px] text-slate-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}