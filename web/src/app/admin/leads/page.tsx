"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import LeadStatusBadge from "@/components/LeadStatusBadge";
import LevelBadge from "@/components/LevelBadge";
import StatusBadge from "@/components/StatusBadge";
import { Alert, CARD, EmptyState, Icon, INPUT, PageHeader, Skeleton, type IconName } from "@/components/ui";
import {
  formatDateTime,
  formatVnd,
  getLeads,
  sourceLabel,
  type Lead,
  type LeadStatus,
  type Level,
} from "@/lib/api";
import { normalizeText } from "@/lib/property";

// Mức AI chấm + hai nhóm theo điểm tương tác Mautic (Hậu, trục thứ hai)
type Filter = "ALL" | Level | "HIGH_ENGAGEMENT" | "VIP_HOT";

// Ngưỡng điểm Mautic coi là tương tác cao
const ENGAGED_POINTS = 20;

const FILTERS: { value: Filter; label: string; dot?: string; icon?: IconName }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "HOT", label: "HOT", dot: "bg-red-500" },
  { value: "WARM", label: "WARM", dot: "bg-amber-400" },
  { value: "COLD", label: "COLD", dot: "bg-sky-400" },
  { value: "HIGH_ENGAGEMENT", label: `Tương tác cao (Mautic ≥ ${ENGAGED_POINTS})`, icon: "flame" },
  { value: "VIP_HOT", label: "Ưu tiên chốt cọc", icon: "rocket" },
];

function isEngaged(lead: Lead): boolean {
  return (lead.mauticPoints ?? 0) >= ENGAGED_POINTS;
}

function matchesFilter(lead: Lead, filter: Filter): boolean {
  if (filter === "ALL") return true;
  if (filter === "HIGH_ENGAGEMENT") return isEngaged(lead);
  if (filter === "VIP_HOT") return lead.level === "HOT" && isEngaged(lead);
  return lead.level === filter;
}

// Điểm tương tác Mautic: nổi bật khi vượt ngưỡng, kèm nhãn ưu tiên nếu khách cũng HOT
function MauticPoints({ lead }: { lead: Lead }) {
  const pts = lead.mauticPoints ?? 0;
  const engaged = pts >= ENGAGED_POINTS;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span
        title="Điểm tương tác Mautic (mở mail, bấm link, xem trang)"
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
          engaged ? "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300" : pts > 0 ? "bg-slate-100 text-slate-700" : "text-slate-400"
        }`}
      >
        {engaged && <Icon name="flame" className="h-3.5 w-3.5" />}+{pts} pts
      </span>
      {lead.level === "HOT" && engaged && (
        <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-xs font-bold text-rose-700">
          <Icon name="rocket" className="h-3.5 w-3.5" />
          Ưu tiên
        </span>
      )}
    </div>
  );
}

// Còn khách chờ chấm điểm thì tải lại nhanh, không thì thưa hơn
const POLL_PENDING_MS = 5000;
const POLL_IDLE_MS = 20000;

const STATUS_OPTIONS: { value: "ALL" | LeadStatus; label: string }[] = [
  { value: "ALL", label: "Mọi trạng thái" },
  { value: "NEW", label: "Mới, chờ duyệt" },
  { value: "CONFIRMED", label: "Đã chốt lịch" },
  { value: "VIEWED", label: "Đã xem nhà" },
  { value: "DEPOSIT", label: "Đang làm hợp đồng cọc" },
  { value: "SIGNED", label: "Đã ký hợp đồng cọc" },
  { value: "LOST", label: "Không mua" },
];

const LEVELS: Filter[] = FILTERS.map((f) => f.value);
const STATUSES = STATUS_OPTIONS.map((o) => o.value);

// Ba cờ tự động hoá gọn trong một ô: email đã gửi, đã báo nhân viên
function Flags({ lead }: { lead: Lead }) {
  const flag = (value: boolean | null, label: string) => (
    <span
      title={`${label}: ${value === null ? "chưa rõ" : value ? "có" : "chưa"}`}
      className={`inline-flex h-6 items-center rounded-md px-1.5 text-xs font-medium ring-1 ${
        value ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-50 text-slate-400 ring-slate-200"
      }`}
    >
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-1">
      {flag(lead.emailSent, "Email")}
      {flag(lead.staffNotified, "Báo NV")}
    </div>
  );
}

function matchesSearch(lead: Lead, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  return normalizeText(`${lead.name} ${lead.email} ${lead.phone}`).includes(q);
}

// useSearchParams() cần nằm trong Suspense để Next.js không cảnh báo khi build
export default function LeadsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
      <LeadsContent />
    </Suspense>
  );
}

function LeadsContent() {
  const searchParams = useSearchParams();
  // Link từ trang Tổng quan: ?level=HOT, ?filter=VIP_HOT hoặc ?status=NEW
  const levelParam = (searchParams.get("filter") ?? searchParams.get("level")) as Filter | null;
  const statusParam = searchParams.get("status") as "ALL" | LeadStatus | null;

  const [filter, setFilter] = useState<Filter>(levelParam && LEVELS.includes(levelParam) ? levelParam : "ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | LeadStatus>(
    statusParam && STATUSES.includes(statusParam) ? statusParam : "ALL",
  );
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // Có lead nào đang PENDING (chờ AI chấm điểm) thì tự tải lại thường xuyên hơn
  const hasPending = useMemo(() => leads?.some((l) => l.automationStatus === "PENDING") ?? false, [leads]);

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

  // Đếm theo mức trên tập đã lọc trạng thái + tìm kiếm, để số trên chip khớp với danh sách
  const base = useMemo(
    () => (leads ?? []).filter((l) => (statusFilter === "ALL" || l.status === statusFilter) && matchesSearch(l, query)),
    [leads, statusFilter, query],
  );

  const counts = useMemo(() => {
    const result = Object.fromEntries(FILTERS.map((f) => [f.value, 0])) as Record<Filter, number>;
    for (const lead of base) {
      for (const f of FILTERS) if (matchesFilter(lead, f.value)) result[f.value] += 1;
    }
    return result;
  }, [base]);

  const visible = useMemo(() => base.filter((l) => matchesFilter(l, filter)), [base, filter]);

  return (
    <section>
      <PageHeader
        title="Khách hàng"
        description={
          hasPending
            ? "Điểm và mức do AI chấm. Đang có khách chờ chấm điểm, trang tự cập nhật mỗi 5 giây."
            : "Điểm và mức do AI chấm. Trang tự cập nhật định kỳ."
        }
        actions={updatedAt && <p className="text-xs text-slate-500">Cập nhật lúc {updatedAt.toLocaleTimeString("vi-VN")}</p>}
      />

      <div className={`mt-5 flex flex-wrap items-center gap-3 p-3 ${CARD}`}>
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
            <Icon name="search" className="h-4 w-4" />
          </span>
          <label htmlFor="lead-search" className="sr-only">
            Tìm khách
          </label>
          <input
            id="lead-search"
            type="search"
            placeholder="Tìm theo tên, email, số điện thoại"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${INPUT} pl-9`}
          />
        </div>
        <select
          aria-label="Lọc theo trạng thái"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | LeadStatus)}
          className={INPUT.replace("w-full", "w-auto")}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.value)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition sm:min-h-0 ${
                  active ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                }`}
              >
                {f.dot && <span className={`h-2 w-2 rounded-full ${f.dot}`} />}
                {f.icon && <Icon name={f.icon} className="h-4 w-4" />}
                {f.label}
                <span className={active ? "text-blue-100" : "text-slate-400"}>{counts[f.value]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <Alert className="mt-4">{error}</Alert>}

      {leads === null && !error && (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {leads !== null && visible.length === 0 && (
        <EmptyState
          className="mt-4"
          title={leads.length === 0 ? "Chưa có khách nào" : "Không có khách khớp bộ lọc"}
          description={leads.length === 0 ? "Khách đặt lịch trên trang web sẽ hiện ở đây." : "Thử xoá từ khoá hoặc chọn trạng thái khác."}
        />
      )}

      {leads !== null && visible.length > 0 && (
        <>
          {/* Màn hình rộng (từ 1280px): bảng */}
          <div className={`mt-4 hidden overflow-hidden xl:block ${CARD}`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Khách</th>
                  <th className="px-4 py-3">Ngân sách</th>
                  <th className="px-4 py-3">AI chấm</th>
                  <th className="px-4 py-3">Mautic</th>
                  <th className="w-[28%] px-4 py-3">Lý do AI</th>
                  <th className="px-4 py-3">Tự động</th>
                  <th className="px-4 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((lead) => (
                  <tr key={lead.id} className="align-top transition hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/leads/${lead.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                        {lead.name}
                      </Link>
                      <div className="text-xs text-slate-500">{lead.phone}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        <span>{formatDateTime(lead.createdAt)}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">{sourceLabel(lead.source)}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">{formatVnd(lead.budget)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 text-right text-base font-bold text-slate-900">{lead.score ?? "–"}</span>
                        <LevelBadge level={lead.level} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <MauticPoints lead={lead} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p className="line-clamp-2" title={lead.reason ?? undefined}>
                        {lead.reason ?? "–"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Flags lead={lead} />
                      <div className="mt-1">
                        <StatusBadge status={lead.automationStatus} />
                      </div>
                      {lead.automationStatus === "FAILED" && lead.automationError && (
                        <p className="mt-1 line-clamp-2 max-w-[180px] text-xs text-rose-600" title={lead.automationError}>
                          {lead.automationError}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Màn hình nhỏ hơn: thẻ, 2 cột từ cỡ máy tính bảng */}
          <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:hidden">
            {visible.map((lead) => (
              <li key={lead.id}>
                <Link href={`/admin/leads/${lead.id}`} className={`block p-4 ${CARD}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{lead.name}</p>
                      <p className="text-xs text-slate-500">
                        {lead.phone} · {formatVnd(lead.budget)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="font-bold text-slate-900">{lead.score ?? "–"}</span>
                      <LevelBadge level={lead.level} />
                    </div>
                  </div>
                  {lead.reason && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{lead.reason}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <LeadStatusBadge status={lead.status} />
                    <StatusBadge status={lead.automationStatus} />
                    <MauticPoints lead={lead} />
                    <span className="ml-auto text-xs text-slate-400">{formatDateTime(lead.createdAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
