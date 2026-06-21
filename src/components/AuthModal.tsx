import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Eye, EyeOff, Check } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { AVATARS } from "@/lib/avatars";
import { cn } from "@/lib/utils";

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-10" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function AuthModal() {
  const { authOpen, closeAuth, login, register, openAuth, allUsers } = useApp();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [otpStage, setOtpStage] = useState<null | { kind: "login" | "register"; otp: string; payload: any; expected: string }>(null);
  const [otpInput, setOtpInput] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string>("anonymous");
  const [loginError, setLoginError] = useState<string>("");

  useEffect(() => { if (authOpen) setTab(authOpen); }, [authOpen]);
  useEffect(() => { if (!authOpen) { setOtpStage(null); setOtpInput(""); } }, [authOpen]);

  function startOtp(kind: "login" | "register", payload: any, channel: string) {
    const otp = String(Math.floor(1000 + Math.random() * 9000));
    setOtpStage({ kind, otp, payload, expected: otp });
    setOtpInput("");
    toast.success(`OTP sent to ${channel}: ${otp}`, { description: "Demo OTP — shown here for testing only.", duration: 8000 });
  }

  function confirmOtp() {
    if (!otpStage) return;
    if (otpInput !== otpStage.expected) { toast.error("Invalid OTP code"); return; }
    if (otpStage.kind === "login") {
      login(otpStage.payload.identifier, otpStage.payload.password);
      toast.success("Welcome back!");
    } else {
      register(otpStage.payload);
      toast.success("Account created! Wallet balance: ₦0.00");
    }
    setOtpStage(null);
  }

  return (
    <Dialog open={!!authOpen} onOpenChange={(o) => !o && closeAuth()}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto p-5 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle>Welcome to Data4Me</DialogTitle>
              <DialogDescription>Buy data & airtime instantly.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        {otpStage ? (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Enter the 4-digit OTP we sent to your email{otpStage.payload.phone ? " (or phone)" : ""} to {otpStage.kind === "login" ? "log in" : "complete registration"}.</p>
            <div className="grid place-items-center">
              <InputOTP maxLength={4} value={otpInput} onChange={setOtpInput}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="h-12 w-12 text-lg" />
                  <InputOTPSlot index={1} className="h-12 w-12 text-lg" />
                  <InputOTPSlot index={2} className="h-12 w-12 text-lg" />
                  <InputOTPSlot index={3} className="h-12 w-12 text-lg" />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setOtpStage(null)}>Back</Button>
              <Button className="bg-gradient-primary" onClick={confirmOtp}>Verify</Button>
            </div>
            <button onClick={() => startOtp(otpStage.kind, otpStage.payload, otpStage.payload.email || otpStage.payload.identifier || "your phone")} className="text-xs text-primary hover:underline w-full text-center">Resend OTP</button>
          </div>
        ) : (
        <Tabs value={tab} onValueChange={(v) => { setTab(v as any); openAuth(v as any); }}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="space-y-4 pt-4">
            <form onSubmit={(e) => { e.preventDefault(); setLoginError(""); const fd = new FormData(e.currentTarget); const identifier = String(fd.get("identifier")); const password = String(fd.get("password")); if (!password || password.length < 6) { setLoginError("Incorrect password. Please try again."); return; } startOtp("login", { identifier, password }, identifier); }} className="space-y-3">
              <div className="space-y-1.5"><Label>Email, phone or username</Label><Input name="identifier" required placeholder="you@example.com / 08012345678" /></div>
              <div className="space-y-1.5"><Label>Password</Label><PasswordInput name="password" required placeholder="••••••••" /></div>
              {loginError && <div role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{loginError}</div>}
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-1.5 text-muted-foreground"><input type="checkbox" defaultChecked className="accent-primary" /> Remember me</label>
                <a href="#" className="text-primary hover:underline" onClick={(e) => { e.preventDefault(); toast.info("Password reset link sent to your email (demo)."); }}>Forgot password?</a>
              </div>
              <Button type="submit" className="w-full" size="lg">Login</Button>
              <p className="text-[11px] text-muted-foreground text-center">A 4-digit OTP will be sent to your email (or phone as backup).</p>
            </form>
          </TabsContent>
          <TabsContent value="register" className="space-y-4 pt-4">
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const pin = String(fd.get("pin"));
              const username = String(fd.get("username"));
              const email = String(fd.get("email"));
              const phone = String(fd.get("phone"));
              if (!/^\d{4}$/.test(pin)) { toast.error("PIN must be exactly 4 digits"); return; }
              if (allUsers.some((u) => u.username === username)) { toast.error("Username already taken"); return; }
              if (allUsers.some((u) => u.email === email)) { toast.error("Email already registered"); return; }
              if (allUsers.some((u) => u.phone === phone)) { toast.error("Phone number already registered"); return; }
              const payload = {
                name: String(fd.get("name")),
                username,
                email,
                phone,
                password: String(fd.get("password")),
                pin,
                avatarId: selectedAvatar,
                referredBy: String(fd.get("referredBy") || "") || undefined,
              };
              startOtp("register", payload, payload.email);
            }} className="space-y-3">
              <div className="space-y-1.5"><Label>Full name</Label><Input name="name" required placeholder="Ada Lovelace" /></div>
              <div className="space-y-1.5"><Label>Username</Label><Input name="username" required placeholder="ada_l" /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" required placeholder="you@example.com" /></div>
              <div className="space-y-1.5"><Label>Phone number</Label><Input name="phone" type="tel" required pattern="[0-9+ ]{7,15}" placeholder="08012345678" /></div>
              <div className="space-y-1.5"><Label>Password</Label><PasswordInput name="password" required minLength={6} placeholder="Create a password" /></div>
              <div className="space-y-1.5"><Label>4-digit Transaction PIN</Label><PasswordInput name="pin" required pattern="\d{4}" maxLength={4} inputMode="numeric" placeholder="••••" /></div>
              <div className="space-y-1.5"><Label>Referral code <span className="text-muted-foreground font-normal">(optional)</span></Label><Input name="referredBy" placeholder="Enter referral code" /></div>
              <div className="space-y-2">
                <Label>Choose your avatar</Label>
                <div className="grid grid-cols-5 gap-2 max-h-44 overflow-y-auto p-1">
                  {AVATARS.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => setSelectedAvatar(a.id)}
                      title={a.label}
                      className={cn(
                        "relative aspect-square rounded-xl overflow-hidden border-2 transition",
                        selectedAvatar === a.id ? "border-primary shadow-glow" : "border-transparent hover:border-border",
                      )}
                    >
                      <img src={a.url} alt={a.label} className="h-full w-full object-cover bg-muted" loading="lazy" />
                      {selectedAvatar === a.id && (
                        <div className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground grid place-items-center">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg">Create account</Button>
              <p className="text-[11px] text-muted-foreground text-center">We'll email you a 4-digit OTP to verify your account.</p>
            </form>
          </TabsContent>
        </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}