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
  type Lead,
  type LeadStatus,
  type Level,
} from "@/lib/api";

type Filter = "ALL" | Level;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "HOT", label: "HOT" },
  { value: "WARM", label: "WARM" },
  { value: "COLD", label: "COLD" },
];

// Còn khách chờ chấm điểm thì tải lại nhanh, không thì thưa hơn
const POLL_PENDING_MS = 5000;
const POLL_IDLE_MS = 20000;

function Flag({ value }: { value: boolean | null | undefined }) {
  if (value === true) return <span className="text-emerald-600">✓</span>;
  if (value === false) return <span className="text-slate-400">✗</span>;
  return <span className="text-slate-300">-</span>;
}

const STATUS_OPTIONS: { value: "ALL" | LeadStatus; label: string }[] = [
  { value: "ALL", label: "Mọi trạng thái" },
  { value: "NEW", label: "Mới (chờ duyệt)" },
  { value: "CONFIRMED", label: "Đã chốt lịch" },
  { value: "VIEWED", label: "Đã xem nhà" },
  { value: "DEPOSIT", label: "Muốn đặt cọc" },
  { value: "SIGNED", label: "Đã ký" },
  { value: "LOST", label: "Không mua" },
];

// useSearchParams cần nằm trong Suspense
export default function LeadsPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Đang tải...</p>}>
      <LeadsContent />
    </Suspense>
  );
}

function LeadsContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [statusFilter, setStatusFilter] = useState<"ALL" | LeadStatus>(
    STATUS_OPTIONS.some((o) => o.value === initialStatus) ? (initialStatus as LeadStatus) : "ALL",
  );
  const [filter, setFilter] = useState<Filter>("ALL");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const hasPending = (leads ?? []).some((l) => l.automationStatus === "PENDING");

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

    load();
    const timer = setInterval(load, hasPending ? POLL_PENDING_MS : POLL_IDLE_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hasPending]);

  const counts = useMemo(() => {
    const result = { ALL: 0, HOT: 0, WARM: 0, COLD: 0 };
    for (const lead of leads ?? []) {
      result.ALL += 1;
      if (lead.level) result[lead.level] += 1;
    }
    return result;
  }, [leads]);

  const visible = useMemo(
    () =>
      (leads ?? []).filter(
        (l) => (filter === "ALL" || l.level === filter) && (statusFilter === "ALL" || l.status === statusFilter),
      ),
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
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Khách</th>
                <th className="px-3 py-3">Ngân sách</th>
                <th className="px-3 py-3">Nhu cầu</th>
                <th className="px-3 py-3 text-center">Điểm</th>
                <th className="px-3 py-3">Mức</th>
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
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {formatVnd(lead.budget)}
                  </td>
                  <td className="max-w-[200px] px-3 py-3 text-slate-600">
                    {lead.needs ?? "-"}
                  </td>
                  <td className="px-3 py-3 text-center font-semibold">
                    {lead.score ?? "-"}
                  </td>
                  <td className="px-3 py-3">
                    <LevelBadge level={lead.level} />
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
