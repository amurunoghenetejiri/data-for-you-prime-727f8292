import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Headphones, MessageCircle, Mail, BookOpen, Clock, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function Support() {
  return (
    <div className="container py-12">
      <h1 className="text-4xl font-bold">Support center</h1>
      <p className="text-muted-foreground mt-2 max-w-xl">We're here 24/7. Pick a channel below or open a ticket.</p>

      <div className="grid md:grid-cols-3 gap-4 mt-8">
        {[
          { icon: MessageCircle, title: "Live chat", body: "Average response: 2 minutes" },
          { icon: Mail, title: "Email", body: "support@data4me.ng" },
          { icon: Headphones, title: "Phone", body: "+234 800 DATA-4ME" },
        ].map((c) => (
          <Card key={c.title} className="p-6 bg-gradient-card shadow-card hover-lift">
            <c.icon className="h-7 w-7 text-primary mb-3" />
            <h3 className="font-semibold">{c.title}</h3>
            <p className="text-sm text-muted-foreground">{c.body}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 mt-8">
        <Card className="p-6 shadow-card">
          <h2 className="font-semibold text-xl mb-4">Open a support ticket</h2>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); toast.success("Ticket #D4M-" + Math.floor(Math.random()*10000) + " created"); (e.target as HTMLFormElement).reset(); }}>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Order reference (optional)</Label><Input placeholder="D4M-xxxxx" /></div>
              <div><Label>Category</Label><Input defaultValue="Failed transaction" /></div>
            </div>
            <div><Label>Describe the issue</Label><Textarea rows={5} required placeholder="Tell us what happened…" /></div>
            <Button className="bg-gradient-primary" size="lg">Submit ticket</Button>
          </form>
        </Card>
        <Card className="p-6 shadow-card">
          <h3 className="font-semibold flex items-center gap-2 mb-3"><BookOpen className="h-4 w-4 text-primary" /> Helpful resources</h3>
          <ul className="space-y-2 text-sm">
            {[["FAQs", "/faq"], ["How to fund your wallet", "/wallet"], ["Pricing & discounts", "/pricing"], ["Networks supported", "/networks"]].map(([l, t]) => (
              <li key={t}><Link to={t} className="story-link text-foreground">{l}</Link></li>
            ))}
          </ul>
          <div className="mt-6 p-4 rounded-xl bg-accent text-accent-foreground text-sm">
            <p className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4" /> Avg resolution</p>
            <p className="opacity-80 mt-1">Most tickets resolved in under 25 minutes.</p>
          </div>
          <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-success" />98% customer satisfaction</p>
        </Card>
      </div>
    </div>
  );
}