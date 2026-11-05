"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ContractStatusBadge from "@/components/ContractStatusBadge";
import { Alert, CARD, EmptyState, Icon, PageHeader, Skeleton } from "@/components/ui";
import { formatDateTime, formatVnd, getContracts, type ContractRow, type ContractStatus } from "@/lib/api";
import { contractCode } from "@/lib/contract";

const POLL_MS = 10000;

type Filter = "ALL" | ContractStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "PENDING_APPROVAL", label: "Chờ duyệt" },
  { value: "SENT", label: "Chờ khách ký" },
  { value: "SIGNED", label: "Đã ký" },
  { value: "DRAFTING", label: "Đang soạn" },
  { value: "REJECTED", label: "Từ chối" },
  { value: "EXPIRED", label: "Hết hạn" },
];

function Summary({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone: string }) {
  return (
    <div className={`p-4 ${CARD}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function ContractsPage() {
  const [rows, setRows] = useState<ContractRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");

  useEffect(() => {
    let cancelled = false;
    function load() {
      getContracts()
        .then((data) => {
          if (cancelled) return;
          setRows(data);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Lỗi không xác định.");
        });
    }
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const counts = useMemo(() => {
    const result: Record<string, number> = { ALL: rows?.length ?? 0 };
    for (const r of rows ?? []) result[r.status] = (result[r.status] ?? 0) + 1;
    return result;
  }, [rows]);

  const signedTotal = useMemo(
    () => (rows ?? []).filter((r) => r.status === "SIGNED").reduce((sum, r) => sum + Number(r.depositAmount), 0),
    [rows],
  );

  const visible = (rows ?? []).filter((r) => filter === "ALL" || r.status === filter);
  // Chỉ hiện chip của trạng thái đang có hợp đồng (và chip đang chọn)
  const chips = FILTERS.filter((f) => f.value === "ALL" || f.value === filter || (counts[f.value] ?? 0) > 0);

  return (
    <section>
      <PageHeader
        title="Hợp đồng đặt cọc"
        description="Tạo hợp đồng từ trang chi tiết của khách đã xem nhà. AI soạn và rà soát, quản lý duyệt, khách ký online."
      />

      {rows !== null && (
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Summary label="Chờ quản lý duyệt" value={counts.PENDING_APPROVAL ?? 0} tone={(counts.PENDING_APPROVAL ?? 0) > 0 ? "text-amber-600" : "text-slate-900"} />
          <Summary label="Đã gửi, chờ khách ký" value={counts.SENT ?? 0} tone="text-blue-600" />
          <Summary label="Tiền cọc đã ký" value={formatVnd(signedTotal)} hint={`${counts.SIGNED ?? 0} hợp đồng`} tone="text-emerald-600" />
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-1.5">
        {chips.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.value)}
              className={`min-h-11 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition sm:min-h-0 ${
                active ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
              }`}
            >
              {f.label} <span className={active ? "text-blue-100" : "text-slate-400"}>{counts[f.value] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {error && <Alert className="mt-4">{error}</Alert>}
      {rows === null && !error && <Skeleton className="mt-5 h-64 rounded-xl" />}

      {rows !== null && visible.length === 0 && (
        <EmptyState
          className="mt-4"
          icon={<Icon name="contract" className="h-10 w-10" />}
          title={rows.length === 0 ? "Chưa có hợp đồng nào" : "Không có hợp đồng ở trạng thái này"}
          description="Mở một khách đã xem nhà rồi bấm Tạo hợp đồng đặt cọc."
        />
      )}

      {visible.length > 0 && (
        <ul className={`mt-4 divide-y divide-slate-100 ${CARD}`}>
          {visible.map((r) => (
            <li key={r.id} className="relative flex flex-wrap items-center gap-x-6 gap-y-2 p-4 transition hover:bg-slate-50">
              <div className="w-28 shrink-0">
                {/* after:inset-0: cả hàng bấm được để mở hợp đồng */}
                <Link
                  href={`/admin/hop-dong/${r.id}`}
                  className="font-mono text-sm font-semibold text-brand-700 after:absolute after:inset-0 hover:underline"
                >
                  {contractCode(r.id)}
                </Link>
                <p className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</p>
              </div>
              <div className="min-w-[180px] flex-1">
                <Link href={`/admin/leads/${r.leadId}`} className="relative z-10 inline-flex min-h-11 items-center font-medium text-slate-900 hover:text-brand-700 sm:min-h-0">
                  {r.leadName}
                </Link>
                <p className="text-sm text-slate-500">{r.propertyName}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-900">{formatVnd(r.depositAmount)}</p>
                <p className="text-xs text-slate-500">{r.signedAt ? `Ký ${formatDateTime(r.signedAt)}` : "Tiền cọc"}</p>
              </div>
              <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                <ContractStatusBadge status={r.status} />
                {r.status === "SIGNED" && (
                  <Link
                    href={`/admin/hop-dong/${r.id}/in`}
                    target="_blank"
                    title="In / Lưu PDF"
                    className="relative z-10 inline-flex min-h-11 items-center gap-1 rounded-md px-3 py-1 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-white hover:text-slate-900 sm:min-h-0"
                  >
                    <Icon name="printer" className="h-4 w-4" /> In
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
