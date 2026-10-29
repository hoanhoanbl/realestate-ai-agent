"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import LeadStatusBadge from "@/components/LeadStatusBadge";
import LevelBadge from "@/components/LevelBadge";
import StatusBadge from "@/components/StatusBadge";
import {
  formatDateTime,
  formatVnd,
  getLeads,
  sourceLabel,
  type Lead,
  type LeadStatus,
  type Level,
} from "@/lib/api";

type Filter = "ALL" | Level | "HIGH_ENGAGEMENT" | "VIP_HOT";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "HOT", label: "HOT" },
  { value: "WARM", label: "WARM" },
  { value: "COLD", label: "COLD" },
  { value: "HIGH_ENGAGEMENT", label: "🔥 Tương tác cao (Mautic ≥ 20)" },
  { value: "VIP_HOT", label: "🚀 Ưu tiên chốt cọc" },
];

// Còn khách chờ chấm điểm thì tải lại nhanh, không thì thưa hơn
const POLL_PENDING_MS = 5000;
const POLL_IDLE_MS = 20000;

const STATUS_OPTIONS: { value: "ALL" | LeadStatus; label: string }[] = [
  { value: "ALL", label: "Mọi trạng thái bán hàng" },
  { value: "NEW", label: "Mới (NEW)" },
  { value: "CONFIRMED", label: "Đã chốt lịch (CONFIRMED)" },
  { value: "VIEWED", label: "Đã xem (VIEWED)" },
  { value: "DEPOSIT", label: "Muốn cọc (DEPOSIT)" },
  { value: "SIGNED", label: "Đã ký (SIGNED)" },
  { value: "LOST", label: "Mất khách (LOST)" },
];

function Flag({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-slate-400">-</span>;
  return value ? (
    <span className="text-emerald-600 font-semibold" title="Có">
      ✓
    </span>
  ) : (
    <span className="text-slate-400" title="Chưa">
      ✕
    </span>
  );
}

// useSearchParams() cần nằm trong Suspense để Next.js không cảnh báo khi build
export default function LeadsPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Đang tải...</p>}>
      <LeadsContent />
    </Suspense>
  );
}

function LeadsContent() {
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get("level") as Level) || "ALL";

  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [statusFilter, setStatusFilter] = useState<"ALL" | LeadStatus>("ALL");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // Có lead nào đang PENDING (chờ AI chấm điểm) thì tự tải lại thường xuyên hơn
  const hasPending = useMemo(
    () => leads?.some((l) => l.automationStatus === "PENDING") ?? false,
    [leads],
  );

  useEffect(() => {
    let cancelled = false;

    function load() {
      getLeads()
        .then((data) => {
          if (cancelled) return;
          setLeads(data);
          setError(null);
          setUpdatedAt(new Date());
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : "Lỗi không xác định.");
        });
    }

    const interval = hasPending ? POLL_PENDING_MS : POLL_IDLE_MS;
    const timer = setInterval(load, interval);
    load();

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hasPending]);

  const counts = useMemo(() => {
    const result: Record<Filter, number> = {
      ALL: 0,
      HOT: 0,
      WARM: 0,
      COLD: 0,
      HIGH_ENGAGEMENT: 0,
      VIP_HOT: 0,
    };
    for (const lead of leads ?? []) {
      result.ALL += 1;
      if (lead.level) result[lead.level] += 1;
      const pts = lead.mauticPoints ?? 0;
      if (pts >= 20) result.HIGH_ENGAGEMENT += 1;
      if (lead.level === "HOT" && pts >= 20) result.VIP_HOT += 1;
    }
    return result;
  }, [leads]);

  const visible = useMemo(
    () =>
      (leads ?? []).filter((l) => {
        if (statusFilter !== "ALL" && l.status !== statusFilter) return false;
        if (filter === "ALL") return true;
        if (filter === "HOT" || filter === "WARM" || filter === "COLD") {
          return l.level === filter;
        }
        if (filter === "HIGH_ENGAGEMENT") {
          return (l.mauticPoints ?? 0) >= 20;
        }
        if (filter === "VIP_HOT") {
          return l.level === "HOT" && (l.mauticPoints ?? 0) >= 20;
        }
        return true;
      }),
    [leads, filter, statusFilter],
  );

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Danh sách khách</h1>
          <p className="mt-1 text-sm text-slate-600">
            Điểm và mức độ do AI chấm.{" "}
            {hasPending
              ? "Đang có khách chờ chấm điểm, trang tự cập nhật mỗi 5 giây."
              : "Trang tự cập nhật định kỳ."}
          </p>
        </div>
        {updatedAt && (
          <p className="text-xs text-slate-500">
            Cập nhật lúc {updatedAt.toLocaleTimeString("vi-VN")}
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <select
          aria-label="Lọc theo trạng thái"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | LeadStatus)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${
                active
                  ? "bg-blue-600 text-white ring-blue-600"
                  : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
              }`}
            >
              {f.label} ({counts[f.value]})
            </button>
          );
        })}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200"
        >
          {error}
        </p>
      )}

      {leads === null && !error && (
        <p className="mt-6 text-slate-500">Đang tải...</p>
      )}

      {leads !== null && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-3 py-3">Khách</th>
                <th className="px-3 py-3">Ngân sách</th>
                <th className="px-3 py-3">Nhu cầu</th>
                <th className="px-3 py-3 text-center">Điểm AI</th>
                <th className="px-3 py-3 text-center">Tương tác Mautic</th>
                <th className="px-3 py-3">Lý do AI</th>
                <th className="px-3 py-3 text-center">Email</th>
                <th className="px-3 py-3 text-center">Báo NV</th>
                <th className="px-3 py-3">Xử lý</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3">Tạo lúc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-3 py-8 text-center text-slate-500"
                  >
                    Chưa có khách nào.
                  </td>
                </tr>
              )}
              {visible.map((lead) => (
                <tr key={lead.id} className="align-top hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {lead.name}
                    </Link>
                    <div className="text-xs text-slate-500">{lead.email}</div>
                    <div className="text-xs text-slate-500">{lead.phone}</div>
                    {lead.source && (
                      <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {sourceLabel(lead.source)}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {formatVnd(lead.budget)}
                  </td>
                  <td className="max-w-[200px] px-3 py-3 text-slate-600">
                    {lead.needs ?? "-"}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="font-semibold text-slate-900">
                      {lead.score !== null ? `${lead.score}/100` : "-"}
                    </div>
                    <div className="mt-1">
                      <LevelBadge level={lead.level} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        (lead.mauticPoints ?? 0) >= 20
                          ? "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300"
                          : (lead.mauticPoints ?? 0) > 0
                            ? "bg-slate-100 text-slate-700"
                            : "text-slate-400"
                      }`}
                    >
                      {(lead.mauticPoints ?? 0) >= 20 ? "🔥 " : ""}
                      +{(lead.mauticPoints ?? 0)} pts
                    </span>
                    {lead.level === "HOT" && (lead.mauticPoints ?? 0) >= 20 && (
                      <div className="mt-1">
                        <span className="inline-block rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                          🚀 Ưu tiên
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="max-w-[260px] px-3 py-3 text-slate-600">
                    {lead.reason ?? "-"}
                    {lead.aiReply && (
                      <details className="mt-1 text-xs">
                        <summary className="cursor-pointer text-blue-600">
                          Xem email AI soạn
                        </summary>
                        <p className="mt-1 whitespace-pre-line text-slate-500">
                          {lead.aiReply}
                        </p>
                      </details>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Flag value={lead.emailSent} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Flag value={lead.staffNotified} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={lead.automationStatus} />
                    {lead.automationStatus === "FAILED" &&
                      lead.automationError && (
                        <p className="mt-1 max-w-[180px] text-xs text-rose-600">
                          {lead.automationError}
                        </p>
                      )}
                  </td>
                  <td className="px-3 py-3">
                    <LeadStatusBadge status={lead.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                    {formatDateTime(lead.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
