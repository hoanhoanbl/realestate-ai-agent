import type { Level } from "@/lib/api";

const STYLES: Record<Level, string> = {
  HOT: "bg-red-100 text-red-700 ring-red-200",
  WARM: "bg-amber-100 text-amber-800 ring-amber-200",
  COLD: "bg-sky-100 text-sky-700 ring-sky-200",
};

export default function LevelBadge({ level }: { level: Level | null }) {
  if (!level) {
    return (
      <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
        Chưa chấm
      </span>
    );
  }
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${STYLES[level]}`}
    >
      {level}
    </span>
  );
}
