"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LeadStatusBadge from "@/components/LeadStatusBadge";
import LevelBadge from "@/components/LevelBadge";
import { Alert, CARD, Icon, PageHeader, Skeleton, type IconName } from "@/components/ui";
import {
  formatVnd,
  getContracts,
  getFunnel,
  getLeads,
  getSchedule,
  getStats,
  type ContractRow,
  type Funnel,
  type Lead,
  type LeadStatus,
  type ScheduleRow,
  type Stats,
} from "@/lib/api";
import { useSession } from "@/lib/auth";
import { contractCode } from "@/lib/contract";
import { formatTime, vnDayKey } from "@/lib/time";

const POLL_MS = 15000;

// Thứ tự phễu bán hàng (LOST tách riêng vì là nhánh rời)
const FUNNEL_ORDER: LeadStatus[] = ["NEW", "CONFIRMED", "VIEWED", "DEPOSIT", "SIGNED"];

const BAR: Record<LeadStatus, string> = {
  NEW: "bg-slate-400",
  CONFIRMED: "bg-blue-500",
  VIEWED: "bg-violet-500",
  DEPOSIT: "bg-amber-500",
  SIGNED: "bg-emerald-500",
  LOST: "bg-rose-400",
};

type Tone = "brand" | "amber" | "rose" | "emerald" | "violet";

const TONE: Record<Tone, { chip: string; value: string }> = {
  brand: { chip: "bg-brand-50 text-brand-600", value: "text-slate-900" },
  amber: { chip: "bg-amber-50 text-amber-600", value: "text-amber-600" },
  rose: { chip: "bg-rose-50 text-rose-600", value: "text-rose-600" },
  emerald: { chip: "bg-emerald-50 text-emerald-600", value: "text-emerald-600" },
  violet: { chip: "bg-violet-50 text-violet-600", value: "text-slate-900" },
};

function Kpi({ label, value, hint, icon, tone = "brand", href, wide = false }: {
  wide?: boolean;
  label: string;
  value: string | number;
  hint?: string;
  icon: IconName;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <div className={`flex h-full items-start gap-4 p-5 transition ${CARD} ${href ? "hover:shadow-card-hover" : ""}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${TONE[tone].chip}`}>
        <Icon name={icon} />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className={`mt-0.5 text-2xl font-bold ${TONE[tone].value}`}>{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
  const span = wide ? "lg:col-span-3 xl:col-span-1" : "lg:col-span-2 xl:col-span-1";
  return href ? <Link href={href} className={span}>{body}</Link> : <div className={span}>{body}</div>;
}

function TaskGroup({ title, count, href, empty, children }: {
  title: string;
  count: number;
  href: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          {title} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{count}</span>
        </h3>
        <Link href={href} className="text-xs font-medium text-brand-600 hover:underline">
          Xem tất cả
        </Link>
      </div>
      {count === 0 ? <p className="mt-2 text-sm text-slate-500">{empty}</p> : <ul className="mt-2 divide-y divide-slate-100">{children}</ul>}
    </div>
  );
}

interface Tasks {
  pendingLeads: Lead[];
  todayViewings: ScheduleRow[];
  pendingContracts: ContractRow[];
}

export default function OverviewPage() {
  const session = useSession();
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tasks, setTasks] = useState<Tasks | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      Promise.all([getFunnel(), getStats(), getLeads(), getSchedule(), getContracts()])
        .then(([f, s, leads, schedule, contracts]) => {
          if (cancelled) return;
          const today = vnDayKey(new Date());
          setFunnel(f);
          setStats(s);
          setTasks({
            // Khách mới chờ duyệt: điểm AI cao xếp trước
            pendingLeads: leads.filter((l) => l.status === "NEW").sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
            todayViewings: schedule
              .filter((v) => vnDayKey(v.viewingTime) === today && v.leadStatus !== "LOST")
              .sort((a, b) => a.viewingTime.localeCompare(b.viewingTime)),
            pendingContracts: contracts.filter((c) => c.status === "PENDING_APPROVAL"),
          });
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

  const max = funnel ? Math.max(1, ...FUNNEL_ORDER.map((s) => funnel.byStatus[s])) : 1;
  const userName = session?.user.name.trim() ?? "";
  const scored = stats ? stats.hot + stats.warm + stats.cold : 0;

  return (
    <section>
      <PageHeader
        title={userName ? `Xin chào, ${userName}` : "Tổng quan"}
        description="Phễu bán hàng và các việc cần xử lý hôm nay. Tự cập nhật mỗi 15 giây."
      />

      {error && <Alert className="mt-4">{error}</Alert>}

      {!funnel && !error && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {funnel && (
        <>
          {/* lg: lưới 6 cột (2 ô đầu rộng 3, 3 ô sau rộng 2), xl: 5 ô một hàng */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6 xl:grid-cols-5">
            <Kpi wide label="Tổng số khách" value={funnel.total} icon="users" href="/admin/leads" />
            <Kpi
              wide
              label="Chờ duyệt lịch"
              value={funnel.pendingApproval}
              icon="clock"
              tone={funnel.pendingApproval > 0 ? "amber" : "brand"}
              hint="Khách mới, AI đã chấm"
              href="/admin/leads?status=NEW"
            />
            <Kpi label="Lịch xem hôm nay" value={funnel.viewingsToday} icon="calendar" tone="violet" href="/admin/lich-xem" />
            <Kpi label="Tỉ lệ chốt" value={`${funnel.conversionRate}%`} icon="check" tone="emerald" hint="Đã ký / tổng số khách" />
            <Kpi
              label="Tự động hoá lỗi"
              value={funnel.failedAutomation}
              icon="alert"
              tone={funnel.failedAutomation > 0 ? "rose" : "brand"}
              hint="Khách n8n xử lý thất bại"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className={`p-5 lg:col-span-2 ${CARD}`}>
              <h2 className="font-semibold text-slate-900">Việc cần làm</h2>
              {!tasks ? (
                <Skeleton className="mt-4 h-40" />
              ) : (
                <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <TaskGroup title="Khách chờ duyệt lịch" count={tasks.pendingLeads.length} href="/admin/leads?status=NEW" empty="Không còn khách nào chờ duyệt.">
                    {tasks.pendingLeads.slice(0, 5).map((l) => (
                      <li key={l.id}>
                        <Link href={`/admin/leads/${l.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-brand-700">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{l.name}</span>
                            <span className="block text-xs text-slate-500">Ngân sách {formatVnd(l.budget)}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            {l.score !== null && <span className="text-sm font-semibold text-slate-700">{l.score}</span>}
                            <LevelBadge level={l.level} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </TaskGroup>

                  <div className="space-y-6">
                    <TaskGroup title="Lịch xem hôm nay" count={tasks.todayViewings.length} href="/admin/lich-xem" empty="Hôm nay không có lịch xem.">
                      {tasks.todayViewings.slice(0, 4).map((v) => (
                        <li key={v.id}>
                          <Link href={`/admin/leads/${v.leadId}`} className="flex items-center gap-3 py-2 hover:text-brand-700">
                            <span className="w-12 shrink-0 text-sm font-bold text-brand-700">{formatTime(v.viewingTime)}</span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{v.leadName}</span>
                              <span className="block truncate text-xs text-slate-500">{v.propertyName}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </TaskGroup>

                    <TaskGroup title="Hợp đồng chờ duyệt" count={tasks.pendingContracts.length} href="/admin/hop-dong" empty="Không có hợp đồng chờ duyệt.">
                      {tasks.pendingContracts.slice(0, 4).map((c) => (
                        <li key={c.id}>
                          <Link href={`/admin/hop-dong/${c.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-brand-700">
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">
                                {contractCode(c.id)} · {c.leadName}
                              </span>
                              <span className="block truncate text-xs text-slate-500">{c.propertyName}</span>
                            </span>
                            <span className="shrink-0 text-sm font-semibold text-slate-700">{formatVnd(c.depositAmount)}</span>
                          </Link>
                        </li>
                      ))}
                    </TaskGroup>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className={`p-5 ${CARD}`}>
                <h2 className="font-semibold text-slate-900">Phễu bán hàng</h2>
                <ul className="mt-4 space-y-3">
                  {FUNNEL_ORDER.map((s) => (
                    <li key={s}>
                      <div className="flex items-center justify-between text-sm">
                        <LeadStatusBadge status={s} />
                        <span className="font-semibold text-slate-800">{funnel.byStatus[s]}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${BAR[s]}`} style={{ width: `${(funnel.byStatus[s] / max) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
                  <LeadStatusBadge status="LOST" /> {funnel.byStatus.LOST} khách không mua
                </p>
              </div>

              <div className={`p-5 ${CARD}`}>
                <h2 className="font-semibold text-slate-900">Mức tiềm năng (AI chấm)</h2>
                {stats && (
                  <>
                    {/* Thanh chồng tỉ lệ HOT / WARM / COLD */}
                    <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
                      {scored > 0 && (
                        <>
                          <div className="bg-red-500" style={{ width: `${(stats.hot / scored) * 100}%` }} />
                          <div className="bg-amber-400" style={{ width: `${(stats.warm / scored) * 100}%` }} />
                          <div className="bg-sky-400" style={{ width: `${(stats.cold / scored) * 100}%` }} />
                        </>
                      )}
                    </div>
                    <ul className="mt-4 space-y-2 text-sm">
                      <li className="flex items-center justify-between">
                        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />HOT</span>
                        <span className="font-semibold">{stats.hot}</span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />WARM</span>
                        <span className="font-semibold">{stats.warm}</span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" />COLD</span>
                        <span className="font-semibold">{stats.cold}</span>
                      </li>
                      <li className="flex justify-between border-t border-slate-100 pt-2 text-slate-500">
                        <span>Chưa chấm</span>
                        <span>{stats.total - scored}</span>
                      </li>
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
