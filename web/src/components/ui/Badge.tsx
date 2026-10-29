import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "brand" | "green" | "amber" | "red" | "sky" | "purple";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-100 text-amber-800 ring-amber-200",
  red: "bg-rose-100 text-rose-700 ring-rose-200",
  sky: "bg-sky-100 text-sky-700 ring-sky-200",
  purple: "bg-purple-100 text-purple-700 ring-purple-200",
};

export default function Badge({ tone = "neutral", className = "", children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}
