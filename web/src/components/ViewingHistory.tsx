import { formatDateTime, VIEWING_STATUS_LABELS, type ViewingHistoryItem } from "@/lib/api";

const TONE: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-700 ring-blue-200",
  ATTENDED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  NO_SHOW: "bg-amber-50 text-amber-800 ring-amber-200",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200",
};

// Mọi buổi xem của một khách, mới nhất trước (FE-34). Buổi mới nhất là buổi hiện tại nếu còn "Chờ xem".
export default function ViewingHistory({ viewings }: { viewings: ViewingHistoryItem[] }) {
  return (
    <ul className="space-y-2">
      {viewings.map((v, i) => (
        <li key={v.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-slate-800">{v.propertyName ?? `Căn #${v.propertyId}`}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${TONE[v.status] ?? TONE.CANCELLED}`}
          >
            {VIEWING_STATUS_LABELS[v.status] ?? v.status}
          </span>
          <span className="text-xs text-slate-500">
            {v.viewingTime ? formatDateTime(v.viewingTime) : "Chưa có giờ"}
            {i === 0 && v.status === "NEW" ? " · buổi hiện tại" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
