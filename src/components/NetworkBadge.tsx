import { cn } from "@/lib/utils";
import { NetworkId } from "@/lib/data";

const styles: Record<NetworkId, string> = {
  mtn: "bg-[hsl(var(--mtn))] text-black",
  glo: "bg-[hsl(var(--glo))] text-white",
  airtel: "bg-[hsl(var(--airtel))] text-white",
  "9mobile": "bg-[hsl(var(--ninemobile))] text-white",
};

const labels: Record<NetworkId, string> = { mtn: "MTN", glo: "Glo", airtel: "Airtel", "9mobile": "9mobile" };

export function NetworkBadge({ id, size = "md" }: { id: NetworkId; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={cn(
      "inline-flex items-center justify-center font-bold rounded-full shadow-sm",
      styles[id],
      size === "sm" && "h-7 w-7 text-[10px]",
      size === "md" && "h-10 w-10 text-xs",
      size === "lg" && "h-14 w-14 text-sm",
    )}>{labels[id]}</span>
  );
}