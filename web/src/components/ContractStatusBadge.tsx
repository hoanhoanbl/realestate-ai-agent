import type { ContractStatus } from "@/lib/api";

const CONFIG: Record<ContractStatus, { label: string; style: string }> = {
  DRAFTING: { label: "Đang soạn", style: "bg-slate-100 text-slate-600 ring-slate-200" },
  PENDING_APPROVAL: { label: "Chờ duyệt", style: "bg-amber-100 text-amber-800 ring-amber-200" },
  SENT: { label: "Đã gửi khách ký", style: "bg-blue-100 text-blue-700 ring-blue-200" },
  SIGNED: { label: "Đã ký", style: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
  REJECTED: { label: "Bị từ chối", style: "bg-rose-100 text-rose-700 ring-rose-200" },
  EXPIRED: { label: "Hết hạn", style: "bg-slate-200 text-slate-600 ring-slate-300" },
};

export default function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const cfg = CONFIG[status] ?? CONFIG.DRAFTING;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cfg.style}`}>
      {cfg.label}
    </span>
  );
}
