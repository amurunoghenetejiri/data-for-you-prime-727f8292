import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onVerified: () => void;
}

export function PinDialog({ open, title = "Enter Transaction PIN", description = "Authorise this transaction with your 4-digit PIN.", onClose, onVerified }: Props) {
  const { user, verifyPin, setPin } = useApp();
  const [pin, setPinValue] = useState("");
  const needsSetup = !user?.pin;

  useEffect(() => { if (!open) setPinValue(""); }, [open]);

  function submit() {
    if (pin.length !== 4) return toast.error("PIN must be 4 digits");
    if (needsSetup) {
      setPin(pin);
      toast.success("Transaction PIN set");
      onVerified();
      return;
    }
    if (!verifyPin(pin)) { toast.error("Incorrect PIN"); setPinValue(""); return; }
    onVerified();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-2xl bg-accent text-accent-foreground grid place-items-center mb-2"><ShieldCheck className="h-6 w-6" /></div>
          <DialogTitle className="text-center">{needsSetup ? "Create your 4-digit PIN" : title}</DialogTitle>
          <DialogDescription className="text-center">{needsSetup ? "Set a 4-digit Transaction PIN to secure all financial actions." : description}</DialogDescription>
        </DialogHeader>
        <div className="grid place-items-center py-3">
          <InputOTP maxLength={4} value={pin} onChange={setPinValue} pattern="^[0-9]*$">
            <InputOTPGroup>
              <InputOTPSlot index={0} className="h-12 w-12 text-lg" />
              <InputOTPSlot index={1} className="h-12 w-12 text-lg" />
              <InputOTPSlot index={2} className="h-12 w-12 text-lg" />
              <InputOTPSlot index={3} className="h-12 w-12 text-lg" />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button onClick={submit} className="w-full bg-gradient-primary">{needsSetup ? "Set PIN & Continue" : "Confirm"}</Button>
      </DialogContent>
    </Dialog>
  );
}