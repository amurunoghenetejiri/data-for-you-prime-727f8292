import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { getAvatar } from "@/lib/avatars";

type Msg = { id: string; username: string; avatarId?: string; body: string; date: string };

export default function Chat() {
  const { user, openAuth } = useApp();
  const [messages, setMessages] = useState<Msg[]>(() => { try { return JSON.parse(localStorage.getItem("d4m_chat") || "[]"); } catch { return []; } });
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem("d4m_chat", JSON.stringify(messages.slice(-100))); endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Cross-tab sync
  useEffect(() => {
    const sync = () => { try { setMessages(JSON.parse(localStorage.getItem("d4m_chat") || "[]")); } catch {} };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function send() {
    if (!user) { openAuth("login"); return; }
    if (!body.trim()) return;
    setMessages((m) => [...m, { id: crypto.randomUUID(), username: user.username, avatarId: user.avatarId, body: body.trim(), date: new Date().toISOString() }]);
    setBody("");
  }

  return (
    <div className="container py-10 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-gradient-primary text-primary-foreground grid place-items-center shadow-glow"><MessageCircle className="h-5 w-5" /></div>
        <div><h1 className="text-3xl font-bold">Community Chat</h1><p className="text-muted-foreground text-sm">Connect with other Data4Me users</p></div>
      </div>
      <Card className="p-4 shadow-card h-[60vh] flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">No messages yet. Say hi! 👋</p>
          ) : messages.map((m) => {
            const mine = user && m.username === user.username;
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                <img src={getAvatar(m.avatarId).url} alt="" className="h-8 w-8 rounded-full bg-muted" />
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <p className="text-xs opacity-80 font-medium">@{m.username}</p>
                  <p className="text-sm">{m.body}</p>
                  <p className="text-[10px] opacity-60 mt-0.5">{new Date(m.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <div className="flex gap-2 pt-3 border-t border-border mt-3">
          <Input placeholder={user ? "Type a message…" : "Login to chat"} value={body} disabled={!user} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
          <Button onClick={send} disabled={!user} className="bg-gradient-primary"><Send className="h-4 w-4" /></Button>
        </div>
      </Card>
    </div>
  );
}