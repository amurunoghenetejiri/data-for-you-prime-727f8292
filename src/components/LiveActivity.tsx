import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

const NAMES = ["John","Sarah","Michael","Aisha","Tunde","Chiamaka","Emeka","Ngozi","Tobi","Funmi","Ibrahim","Blessing","Ifeanyi","Halima","David","Adaeze"];
const CITIES = ["Lagos","Abuja","Port Harcourt","Ibadan","Enugu","Kano","Benin","Owerri","Kaduna","Uyo"];
const ACTIONS = [
  () => `purchased MTN ${pick([1,2,3,5,10])}GB`,
  () => `bought Airtel ₦${pick([200,500,1000,2000])} airtime`,
  () => `funded ₦${pick([1000,2000,5000,10000]).toLocaleString()}`,
  () => `subscribed GOtv ${pick(["Max","Jolli","Smallie"])}`,
  () => `paid ₦${pick([1500,2500,5000])} electricity bill`,
  () => `got ₦${pick([16,40,80,160])} cashback`,
  () => `bought Glo ${pick([1,2,5])}GB monthly`,
  () => `referred a friend & earned ₦1,000`,
];
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export function LiveActivity() {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null);

  useEffect(() => {
    let id = 0;
    const show = () => {
      const text = `${pick(NAMES)} from ${pick(CITIES)} ${pick(ACTIONS)()}`;
      setMsg({ id: ++id, text });
      window.setTimeout(() => setMsg(null), 4500);
    };
    const i = window.setTimeout(show, 4000);
    const interval = window.setInterval(show, 9000);
    return () => { window.clearTimeout(i); window.clearInterval(interval); };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-50 max-w-xs">
      {msg && (
        <div key={msg.id} className="pointer-events-auto flex items-center gap-3 bg-card/95 backdrop-blur-xl border border-border shadow-elevated rounded-2xl p-3 pr-4 animate-slide-up">
          <div className="h-8 w-8 rounded-full bg-success/15 text-success grid place-items-center shrink-0">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <p className="text-xs font-medium leading-tight">{msg.text}</p>
        </div>
      )}
    </div>
  );
}