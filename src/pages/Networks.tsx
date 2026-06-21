import { Card } from "@/components/ui/card";
import { networks, dataPlans } from "@/lib/data";
import { NetworkBadge } from "@/components/NetworkBadge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function Networks() {
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold">Supported Networks</h1>
      <p className="text-muted-foreground mt-1 mb-8">All major Nigerian carriers. One platform. Zero stress.</p>
      <div className="grid md:grid-cols-2 gap-5">
        {networks.map((n) => {
          const count = dataPlans.filter((p) => p.network === n.id).length;
          const cheapest = Math.min(...dataPlans.filter((p) => p.network === n.id).map((p) => p.price));
          return (
            <Card key={n.id} className="p-6 bg-gradient-card shadow-card hover-lift">
              <div className="flex items-start gap-4">
                <NetworkBadge id={n.id} size="lg" />
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{n.name}</h2>
                  <p className="text-sm text-muted-foreground italic">"{n.tagline}"</p>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <Stat label="Active plans" value={count.toString()} />
                    <Stat label="From" value={`₦${cheapest.toLocaleString()}`} />
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button asChild size="sm" className="bg-gradient-primary"><Link to="/buy-data">Buy data <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                    <Button asChild size="sm" variant="outline"><Link to="/buy-airtime">Airtime</Link></Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div>;
}