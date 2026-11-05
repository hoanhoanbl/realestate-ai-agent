import type { LeadStatus } from "@/lib/api";

const CONFIG: Record<LeadStatus, { label: string; style: string }> = {
  NEW: {
    label: "Mới",
    style: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  CONFIRMED: {
    label: "Đã chốt lịch",
    style: "bg-blue-100 text-blue-700 ring-blue-200",
  },
  VIEWED: {
    label: "Đã xem nhà",
    style: "bg-violet-100 text-violet-700 ring-violet-200",
  },
  DEPOSIT: {
    label: "Đang làm hợp đồng cọc",
    style: "bg-amber-100 text-amber-800 ring-amber-200",
  },
  SIGNED: {
    label: "Đã ký hợp đồng cọc",
    style: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  },
  LOST: {
    label: "Không mua",
    style: "bg-rose-100 text-rose-700 ring-rose-200",
  },
};

export default function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const cfg = CONFIG[status] ?? CONFIG.NEW;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cfg.style}`}
    >
      {cfg.label}
    </span>
  );
}
