export interface Avatar { id: string; label: string; url: string; }

const base = "https://api.dicebear.com/7.x/avataaars/svg?seed=";
const bgBase = "&backgroundType=gradientLinear";

export const AVATARS: Avatar[] = [
  { id: "blue-male", label: "Blue Male", url: `${base}blue-male${bgBase}&backgroundColor=1e40af` },
  { id: "red-male", label: "Red Male", url: `${base}red-male${bgBase}&backgroundColor=b91c1c` },
  { id: "green-male", label: "Green Male", url: `${base}green-male${bgBase}&backgroundColor=15803d` },
  { id: "purple-male", label: "Purple Male", url: `${base}purple-male${bgBase}&backgroundColor=6d28d9` },
  { id: "black-male", label: "Black Male", url: `${base}black-male${bgBase}&backgroundColor=111827` },
  { id: "gold-male", label: "Gold Male", url: `${base}gold-male${bgBase}&backgroundColor=ca8a04` },
  { id: "blue-female", label: "Blue Female", url: `${base}blue-female-1${bgBase}&backgroundColor=2563eb` },
  { id: "red-female", label: "Red Female", url: `${base}red-female-1${bgBase}&backgroundColor=dc2626` },
  { id: "purple-female", label: "Purple Female", url: `${base}purple-female-1${bgBase}&backgroundColor=9333ea` },
  { id: "green-female", label: "Green Female", url: `${base}green-female-1${bgBase}&backgroundColor=16a34a` },
  { id: "business-man", label: "Business Man", url: `${base}business-man${bgBase}&backgroundColor=0f172a` },
  { id: "business-woman", label: "Business Woman", url: `${base}business-woman${bgBase}&backgroundColor=1e293b` },
  { id: "tech-boy", label: "Tech Boy", url: `${base}tech-boy${bgBase}&backgroundColor=0891b2` },
  { id: "tech-girl", label: "Tech Girl", url: `${base}tech-girl${bgBase}&backgroundColor=db2777` },
  { id: "anonymous", label: "Anonymous Fintech", url: `${base}anonymous-fintech${bgBase}&backgroundColor=000000` },
];

export function getAvatar(id?: string) {
  return AVATARS.find((a) => a.id === id) || AVATARS[14];
}