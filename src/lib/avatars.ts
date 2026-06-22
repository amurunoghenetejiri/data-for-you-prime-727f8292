export interface Avatar { id: string; label: string; url: string; }

// High-quality 3D-style avatars via DiceBear "personas" — modern flat-3D vector look.
// Vibrant gradient backgrounds give a movie-poster / Pixar-inspired feel.
const make = (seed: string, bg: string) =>
  `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(seed)}&backgroundType=gradientLinear&backgroundColor=${bg}&radius=50`;

export const AVATARS: Avatar[] = [
  { id: "nova",       label: "Nova",          url: make("Nova-3D",         "8b5cf6,6366f1") },
  { id: "atlas",      label: "Atlas",         url: make("Atlas-3D",        "0ea5e9,06b6d4") },
  { id: "ember",      label: "Ember",         url: make("Ember-3D",        "ef4444,f97316") },
  { id: "jade",       label: "Jade",          url: make("Jade-3D",         "10b981,14b8a6") },
  { id: "rose",       label: "Rose",          url: make("Rose-3D",         "ec4899,f43f5e") },
  { id: "midas",      label: "Midas",         url: make("Midas-3D",        "f59e0b,eab308") },
  { id: "onyx",       label: "Onyx",          url: make("Onyx-3D",         "0f172a,334155") },
  { id: "iris",       label: "Iris",          url: make("Iris-3D",         "a855f7,d946ef") },
  { id: "kai",        label: "Kai",           url: make("Kai-3D",          "2563eb,7c3aed") },
  { id: "luna",       label: "Luna",          url: make("Luna-3D",         "db2777,9333ea") },
  { id: "zane",       label: "Zane",          url: make("Zane-3D",         "0891b2,2563eb") },
  { id: "sage",       label: "Sage",          url: make("Sage-3D",         "16a34a,84cc16") },
  { id: "ravi",       label: "Ravi",          url: make("Ravi-3D",         "dc2626,b91c1c") },
  { id: "amari",      label: "Amari",         url: make("Amari-3D",        "7c2d12,c2410c") },
  { id: "phoenix",    label: "Phoenix",       url: make("Phoenix-3D",      "f97316,e11d48") },
  { id: "stella",     label: "Stella",        url: make("Stella-3D",       "6366f1,3b82f6") },
];

export function getAvatar(id?: string) {
  return AVATARS.find((a) => a.id === id) || AVATARS[0];
}
