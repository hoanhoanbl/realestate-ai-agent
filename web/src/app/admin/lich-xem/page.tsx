"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import LeadStatusBadge from "@/components/LeadStatusBadge";
import LevelBadge from "@/components/LevelBadge";
import RescheduleControl from "@/components/RescheduleControl";
import { Alert, CARD, EmptyState, Icon, PageHeader, Skeleton } from "@/components/ui";
import { getSchedule, VIEWING_STATUS_LABELS, type ScheduleRow } from "@/lib/api";
import { dayLabel, formatDate, formatTime, vnDayKey } from "@/lib/time";

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

  // Nhóm theo ngày (giờ Việt Nam), giữ thứ tự đã sắp
  const groups = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>();
    for (const r of visible) {
      const key = vnDayKey(r.viewingTime);
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()];
  }, [visible]);

  const tabs: [Tab, string, number][] = [
    ["UPCOMING", "Sắp tới", upcoming.length],
    ["PAST", "Đã qua", past.length],
  ];

  return (
    <section>
      <PageHeader
        title="Lịch xem nhà"
        description="Đổi giờ ở đây: khách đã chốt lịch sẽ nhận email báo giờ mới, khách chưa duyệt thì đổi giờ rồi bấm Duyệt ở trang khách."
      />

      <div className="mt-5 inline-flex rounded-lg bg-slate-100 p-1">
        {tabs.map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              tab === value ? "bg-white text-slate-900 shadow-card" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {label} <span className="text-slate-400">{count}</span>
          </button>
        ))}
      </div>

      {error && <Alert className="mt-4">{error}</Alert>}
      {rows === null && !error && <Skeleton className="mt-5 h-64 rounded-xl" />}

      {rows !== null && visible.length === 0 && (
        <EmptyState
          className="mt-5"
          icon={<Icon name="calendar" className="h-10 w-10" />}
          title={tab === "UPCOMING" ? "Chưa có lịch xem sắp tới" : "Chưa có lịch nào đã qua"}
          description="Khách đặt lịch trên trang web sẽ hiện ở đây."
        />
      )}

      <div className="mt-5 space-y-6">
        {groups.map(([day, items]) => (
          <div key={day}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              {dayLabel(items[0].viewingTime)}
              <span className="text-xs font-normal text-slate-400">
                {formatDate(items[0].viewingTime)} · {items.length} lịch
              </span>
            </h2>
            <ul className={`divide-y divide-slate-100 ${CARD}`}>
              {items.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                  <div className="w-16 shrink-0">
                    <p className="text-lg font-bold text-brand-700">{formatTime(r.viewingTime)}</p>
                  </div>
                  <div className="min-w-[160px] flex-1">
                    <Link href={`/admin/leads/${r.leadId}`} className="font-semibold text-slate-900 hover:text-brand-700">
                      {r.leadName}
                    </Link>
                    <p className="text-xs text-slate-500">{r.leadPhone}</p>
                  </div>
                  <div className="min-w-[200px] flex-[2]">
                    <p className="text-sm font-medium text-slate-700">{r.propertyName}</p>
                    <p className="text-xs text-slate-400">{r.propertyAddress}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <LevelBadge level={r.leadLevel} />
                    <LeadStatusBadge status={r.leadStatus} />
                    {r.viewingStatus && r.viewingStatus !== "NEW" && (
                      <span className="text-xs font-medium text-slate-500">{VIEWING_STATUS_LABELS[r.viewingStatus]}</span>
                    )}
                    {r.propertyStatus === "RESERVED" && r.viewingStatus === "NEW" && (
                      <span className="text-xs font-medium text-amber-700">Căn đã có người cọc</span>
                    )}
                  </div>
                  <div className="ml-auto">
                    {(r.leadStatus === "NEW" || r.leadStatus === "CONFIRMED") && r.viewingStatus === "NEW" && tab === "UPCOMING" && (
                      <RescheduleControl
                        viewingId={r.id}
                        currentTime={r.viewingTime}
                        confirmed={r.leadStatus === "CONFIRMED"}
                        onDone={reload}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
