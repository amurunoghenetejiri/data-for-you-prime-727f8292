import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { sampleTransactions, Transaction } from "@/lib/data";

export interface User {
  name: string;
  username: string;
  email: string;
  phone: string;
  pin?: string;
  avatarId?: string;
  referralCode?: string;
  referredBy?: string;
  createdAt?: string;
}

export interface PaymentSettings {
  bankName: string;
  accountName: string;
  accountNumber: string;
  ussdCode: string;
  supportEmail: string;
  paystackPublicKey?: string;
  paystackMode?: "test" | "live";
}

interface AppState {
  user: User | null;
  login: (identifier: string, _password: string) => void;
  register: (data: { name: string; username: string; email: string; phone: string; password: string; pin: string; avatarId?: string; referredBy?: string }) => void;
  logout: () => void;
  authOpen: false | "login" | "register";
  openAuth: (mode: "login" | "register") => void;
  closeAuth: () => void;

  wallet: number;
  hideBalance: boolean;
  toggleHideBalance: () => void;
  fundWallet: (amount: number, note?: string) => void;
  deductWallet: (amount: number) => boolean;
  setPin: (pin: string) => void;
  verifyPin: (pin: string) => boolean;
  updateAvatar: (avatarId: string) => void;

  transactions: Transaction[];
  addTransaction: (t: Omit<Transaction, "id" | "date" | "reference">) => Transaction;

  settings: PaymentSettings;
  updateSettings: (s: Partial<PaymentSettings>) => void;

  notifications: { id: string; title: string; body: string; date: string; read: boolean }[];
  pushNotification: (n: { title: string; body: string }) => void;
  markAllRead: () => void;

  theme: "light" | "dark";
  toggleTheme: () => void;

  fundingRequests: FundingRequest[];
  submitFundingRequest: (r: Omit<FundingRequest, "id" | "date" | "status" | "username">) => void;
  approveFunding: (id: string) => void;
  rejectFunding: (id: string) => void;

  isAdmin: boolean;
  allUsers: { username: string; email: string; phone: string; createdAt?: string; referralCode?: string }[];
}

export interface FundingRequest {
  id: string;
  username: string;
  amount: number;
  bank: string;
  receiptName: string;
  receiptDataUrl?: string;
  date: string;
  status: "pending" | "approved" | "rejected";
}

const defaultSettings: PaymentSettings = {
  bankName: "Opay",
  accountName: "Jaskitinana",
  accountNumber: "8165906606",
  ussdCode: "*955*8165906606*Amount#",
  supportEmail: "support@data4me.ng",
  paystackPublicKey: "",
  paystackMode: "test",
};

const Ctx = createContext<AppState | null>(null);

function genReferralCode(username: string) {
  return (username.slice(0, 4).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()).slice(0, 8);
}

function load<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => load("d4m_user", null));
  const [authOpen, setAuthOpen] = useState<false | "login" | "register">(false);
  const [wallet, setWallet] = useState<number>(() => {
    const u = load<User | null>("d4m_user", null);
    return u ? load(`d4m_wallet_${u.username}`, 0) : 0;
  });
  const [hideBalance, setHideBalance] = useState<boolean>(() => load("d4m_hide_balance", false));
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const u = load<User | null>("d4m_user", null);
    return u ? load(`d4m_tx_${u.username}`, []) : [];
  });
  const [settings, setSettings] = useState<PaymentSettings>(() => load("d4m_settings", defaultSettings));
  const [notifications, setNotifications] = useState(() => load("d4m_notifs", [
    { id: "n1", title: "Welcome to Data4Me 🎉", body: "Your account is ready. Fund your wallet to get started.", date: new Date().toISOString(), read: false },
  ]));
  const [theme, setTheme] = useState<"light" | "dark">(() => load("d4m_theme", "light"));
  const [fundingRequests, setFundingRequests] = useState<FundingRequest[]>(() => load("d4m_funding_requests", []));
  const [allUsers, setAllUsers] = useState<AppState["allUsers"]>(() => load("d4m_all_users", []));

  useEffect(() => { localStorage.setItem("d4m_user", JSON.stringify(user)); }, [user]);
  useEffect(() => { if (user) localStorage.setItem(`d4m_wallet_${user.username}`, JSON.stringify(wallet)); }, [wallet, user]);
  useEffect(() => { if (user) localStorage.setItem(`d4m_tx_${user.username}`, JSON.stringify(transactions)); }, [transactions, user]);
  useEffect(() => { localStorage.setItem("d4m_settings", JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem("d4m_notifs", JSON.stringify(notifications)); }, [notifications]);
  useEffect(() => { localStorage.setItem("d4m_hide_balance", JSON.stringify(hideBalance)); }, [hideBalance]);
  useEffect(() => { localStorage.setItem("d4m_funding_requests", JSON.stringify(fundingRequests)); }, [fundingRequests]);
  useEffect(() => { localStorage.setItem("d4m_all_users", JSON.stringify(allUsers)); }, [allUsers]);

  // Theme application
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("d4m_theme", JSON.stringify(theme));
  }, [theme]);

  // Session timeout — auto-logout after 15 minutes of inactivity
  useEffect(() => {
    if (!user) return;
    let timer: number;
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(() => setUser(null), 15 * 60 * 1000); };
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { window.clearTimeout(timer); events.forEach((e) => window.removeEventListener(e, reset)); };
  }, [user]);

  const value = useMemo<AppState>(() => ({
    user,
    login: (identifier) => {
      const match = allUsers.find(
        (u) => u.email === identifier || u.phone === identifier || u.username === identifier,
      );
      const username = match?.username || (identifier.includes("@") ? identifier.split("@")[0] : identifier) || "user";
      const stored = load<User | null>(`d4m_userdata_${username}`, null);
      const u: User = stored || {
        name: username,
        username,
        email: match?.email || (identifier.includes("@") ? identifier : ""),
        phone: match?.phone || (!identifier.includes("@") ? identifier : ""),
        pin: "",
        avatarId: "anonymous",
        referralCode: genReferralCode(username),
        createdAt: new Date().toISOString(),
      };
      setUser(u);
      setWallet(load(`d4m_wallet_${u.username}`, 0));
      setTransactions(load(`d4m_tx_${u.username}`, []));
      setAuthOpen(false);
    },
    register: ({ name, username, email, phone, pin, avatarId, referredBy }) => {
      const referralCode = genReferralCode(username);
      const newUser: User = {
        name, username, email, phone, pin,
        avatarId: avatarId || "anonymous",
        referralCode,
        referredBy,
        createdAt: new Date().toISOString(),
      };
      setUser(newUser);
      localStorage.setItem(`d4m_userdata_${username}`, JSON.stringify(newUser));
      setAllUsers((cur) => cur.some((u) => u.username === username) ? cur : [...cur, { username, email, phone, createdAt: newUser.createdAt, referralCode }]);
      setWallet(0);
      setTransactions([]);
      setAuthOpen(false);
      // Referral reward (demo)
      if (referredBy) {
        const refUser = allUsers.find((u) => u.referralCode === referredBy);
        if (refUser) {
          const refWalletKey = `d4m_wallet_${refUser.username}`;
          const cur = load<number>(refWalletKey, 0);
          localStorage.setItem(refWalletKey, JSON.stringify(cur + 1000));
        }
      }
    },
    logout: () => {
      if (user) localStorage.setItem(`d4m_userdata_${user.username}`, JSON.stringify(user));
      setUser(null);
      setWallet(0);
      setTransactions([]);
    },
    authOpen,
    openAuth: (m) => setAuthOpen(m),
    closeAuth: () => setAuthOpen(false),
    wallet,
    hideBalance,
    toggleHideBalance: () => setHideBalance((h) => !h),
    fundWallet: (amount, note) => {
      setWallet((w) => w + amount);
      setTransactions((tx) => [{ id: crypto.randomUUID(), type: "wallet", amount, status: "success", date: new Date().toISOString(), reference: "D4M-" + Math.floor(Math.random() * 100000), description: note || "Wallet funding" }, ...tx]);
    },
    deductWallet: (amount) => {
      if (wallet < amount) return false;
      setWallet((w) => w - amount);
      return true;
    },
    setPin: (pin) => setUser((u) => (u ? { ...u, pin } : u)),
    verifyPin: (pin) => !!user?.pin && user.pin === pin,
    updateAvatar: (avatarId) => setUser((u) => (u ? { ...u, avatarId } : u)),
    transactions,
    addTransaction: (t) => {
      const full: Transaction = { ...t, id: crypto.randomUUID(), date: new Date().toISOString(), reference: "D4M-" + Math.floor(Math.random() * 100000) };
      setTransactions((tx) => [full, ...tx]);
      return full;
    },
    settings,
    updateSettings: (s) => setSettings((cur) => ({ ...cur, ...s })),
    notifications,
    pushNotification: (n) =>
      setNotifications((cur) => [{ id: crypto.randomUUID(), title: n.title, body: n.body, date: new Date().toISOString(), read: false }, ...cur]),
    markAllRead: () => setNotifications((n) => n.map((x) => ({ ...x, read: true }))),
    theme,
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    fundingRequests,
    submitFundingRequest: (r) => {
      if (!user) return;
      setFundingRequests((cur) => [{ ...r, id: crypto.randomUUID(), username: user.username, date: new Date().toISOString(), status: "pending" }, ...cur]);
    },
    approveFunding: (id) => {
      setFundingRequests((cur) =>
        cur.map((r) => {
          if (r.id !== id || r.status !== "pending") return r;
          // credit the requester's wallet
          const key = `d4m_wallet_${r.username}`;
          const w = load<number>(key, 0);
          localStorage.setItem(key, JSON.stringify(w + r.amount));
          if (user && user.username === r.username) setWallet(w + r.amount);
          return { ...r, status: "approved" };
        }),
      );
    },
    rejectFunding: (id) => setFundingRequests((cur) => cur.map((r) => (r.id === id ? { ...r, status: "rejected" } : r))),
    isAdmin: user?.username?.toLowerCase() === "admin",
    allUsers,
  }), [user, authOpen, wallet, hideBalance, transactions, settings, notifications, theme, fundingRequests, allUsers]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}