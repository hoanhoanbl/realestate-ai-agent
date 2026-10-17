"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import LeadStatusBadge from "@/components/LeadStatusBadge";
import LevelBadge from "@/components/LevelBadge";
import RescheduleControl from "@/components/RescheduleControl";
import { formatDateTime, getSchedule, type ScheduleRow } from "@/lib/api";

type Tab = "UPCOMING" | "PAST";

export default function SchedulePage() {
  // `at` là thời điểm tải dữ liệu, dùng để chia lịch "sắp tới" / "đã qua"
  const [loaded, setLoaded] = useState<{ rows: ScheduleRow[]; at: number } | null>(null);
  const rows = loaded?.rows ?? null;
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("UPCOMING");
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    getSchedule()
      .then((data) => {
        if (cancelled) return;
        setLoaded({ rows: data, at: Date.now() });
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Lỗi không xác định.");
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const { upcoming, past } = useMemo(() => {
    const now = loaded?.at ?? 0;
    const all = loaded?.rows ?? [];
    return {
      upcoming: all.filter((r) => new Date(r.viewingTime).getTime() >= now),
      past: all.filter((r) => new Date(r.viewingTime).getTime() < now).reverse(),
    };
  }, [loaded]);

  const visible = tab === "UPCOMING" ? upcoming : past;

  return (
    <section>
      <h1 className="text-2xl font-bold text-slate-900">Lịch xem nhà</h1>
      <p className="mt-1 text-sm text-slate-600">
        Đổi giờ ở đây: khách đã chốt lịch sẽ nhận email báo giờ mới, khách chưa duyệt thì chỉ đổi giờ rồi bạn bấm Duyệt.
      </p>

      <div className="mt-5 flex gap-2">
        {([["UPCOMING", `Sắp tới (${upcoming.length})`], ["PAST", `Đã qua (${past.length})`]] as [Tab, string][]).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${
              tab === value ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}
      {rows === null && !error && <p className="mt-6 text-slate-500">Đang tải...</p>}

      {rows !== null && (
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Giờ xem</th>
                <th className="px-3 py-3">Khách</th>
                <th className="px-3 py-3">Căn nhà</th>
                <th className="px-3 py-3">Mức</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3">Đổi giờ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    Không có lịch nào.
                  </td>
                </tr>
              )}
              {visible.map((r) => (
                <tr key={r.id} className="align-top hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-3 font-medium">{formatDateTime(r.viewingTime)}</td>
                  <td className="px-3 py-3">
                    <Link href={`/admin/leads/${r.leadId}`} className="font-medium text-blue-700 hover:underline">
                      {r.leadName}
                    </Link>
                    <div className="text-xs text-slate-500">{r.leadPhone}</div>
                  </td>
                  <td className="max-w-[260px] px-3 py-3 text-slate-600">
                    {r.propertyName}
                    <div className="text-xs text-slate-400">{r.propertyAddress}</div>
                  </td>
                  <td className="px-3 py-3">
                    <LevelBadge level={r.leadLevel} />
                  </td>
                  <td className="px-3 py-3">
                    <LeadStatusBadge status={r.leadStatus} />
                  </td>
                  <td className="px-3 py-3">
                    {(r.leadStatus === "NEW" || r.leadStatus === "CONFIRMED") && tab === "UPCOMING" ? (
                      <RescheduleControl
                        viewingId={r.id}
                        currentTime={r.viewingTime}
                        confirmed={r.leadStatus === "CONFIRMED"}
                        onDone={reload}
                      />
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
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
