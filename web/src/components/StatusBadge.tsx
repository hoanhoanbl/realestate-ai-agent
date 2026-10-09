import type { AutomationStatus } from "@/lib/api";

const CONFIG: Record<AutomationStatus, { label: string; style: string }> = {
  PENDING: {
    label: "Đang xử lý",
    style: "bg-slate-100 text-slate-600 ring-slate-200",
  },
  COMPLETED: {
    label: "Hoàn tất",
    style: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  },
  FAILED: {
    label: "Lỗi",
    style: "bg-rose-100 text-rose-700 ring-rose-200",
  },
};

export default function StatusBadge({ status }: { status: AutomationStatus }) {
  const cfg = CONFIG[status] ?? CONFIG.PENDING;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cfg.style}`}
    >
      {cfg.label}
    </span>
  );
}
