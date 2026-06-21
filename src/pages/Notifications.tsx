import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Notifications() {
  const { notifications, markAllRead, user, openAuth } = useApp();
  if (!user) {
    return (
      <div className="container py-20 text-center">
        <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-muted-foreground mt-2">Login to see your notifications.</p>
        <Button className="mt-6 bg-gradient-primary" onClick={() => openAuth("login")}>Login</Button>
      </div>
    );
  }
  return (
    <div className="container py-10 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground text-sm">{notifications.filter(n => !n.read).length} unread</p>
        </div>
        <Button variant="outline" onClick={markAllRead}><Check className="h-4 w-4 mr-2" />Mark all read</Button>
      </div>
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No notifications yet.</Card>
        ) : notifications.map((n) => (
          <Card key={n.id} className={cn("p-4 shadow-card flex gap-3 items-start", !n.read && "border-primary/40 bg-primary/5")}>
            <div className={cn("h-9 w-9 rounded-full grid place-items-center", n.read ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground")}>
              <Bell className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.body}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(n.date).toLocaleString()}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}