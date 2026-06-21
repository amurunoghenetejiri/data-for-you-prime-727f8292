import { Link } from "react-router-dom";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 group ${className}`}>
      <svg viewBox="0 0 64 64" className="h-9 w-9 rounded-xl shadow-glow group-hover:scale-105 transition">
        <defs>
          <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--primary-glow))" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#logoGrad)" />
        <path d="M14 40 Q32 14 50 40" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="22" cy="36" r="2.5" fill="white" opacity="0.85" />
        <circle cx="32" cy="30" r="2.5" fill="white" />
        <circle cx="42" cy="36" r="2.5" fill="white" opacity="0.85" />
        <circle cx="32" cy="46" r="3.5" fill="white" />
      </svg>
      <span className="font-bold text-lg tracking-tight">Data<span className="text-gradient">4Me</span></span>
    </Link>
  );
}