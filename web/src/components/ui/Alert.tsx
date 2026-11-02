import type { ReactNode } from "react";

export type AlertTone = "error" | "warning" | "info" | "success";

const TONES: Record<AlertTone, string> = {
  error: "bg-red-50 text-red-700 ring-red-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  info: "bg-slate-50 text-slate-700 ring-slate-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export default function Alert({ tone = "error", className = "", children }: { tone?: AlertTone; className?: string; children: ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ring-1 ${TONES[tone]} ${className}`}>
      {children}
    </p>
  );
}
