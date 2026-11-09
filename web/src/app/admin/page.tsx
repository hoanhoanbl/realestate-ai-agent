"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LeadStatusBadge from "@/components/LeadStatusBadge";
import LevelBadge from "@/components/LevelBadge";
import { Alert, CARD, Icon, PageHeader, Skeleton, type IconName } from "@/components/ui";
import {
  formatDateTime,
  formatVnd,
  getContracts,
  getFunnel,
  getLeads,
  getSchedule,
  getStats,
  getTasks,
  type ContractRow,
  type TaskRow,
  type Tasks as SignalTasks,
  type Funnel,
  type Lead,
  type LeadStatus,
  type ScheduleRow,
  type Stats,
} from "@/lib/api";
import { useSession } from "@/lib/auth";
import { contractCode } from "@/lib/contract";
import { formatTime, vnDayKey } from "@/lib/time";
import { isHotLead } from "@/lib/mautic";

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
        <Link href={href} className="inline-flex min-h-11 items-center text-xs font-medium text-brand-600 hover:underline sm:min-h-0">
          Xem tất cả
        </Link>
      </div>
      {count === 0 ? <p className="mt-2 text-sm text-slate-500">{empty}</p> : <ul className="mt-2 divide-y divide-slate-100">{children}</ul>}
    </div>
  );
}

// Một dòng khách trong các nhóm việc lấy từ GET /stats/tasks
function SignalItem({ row, detail }: { row: TaskRow; detail?: string | null }) {
  return (
    <li>
      <Link href={`/admin/leads/${row.leadId}`} className="flex items-center justify-between gap-3 py-2 hover:text-brand-700">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{row.leadName}</span>
          <span className="block truncate text-xs text-slate-500">
            {[row.propertyName, row.viewingTime ? formatDateTime(row.viewingTime) : null, detail].filter(Boolean).join(" · ")}
          </span>
        </span>
        <LevelBadge level={row.leadLevel} />
      </Link>
    </li>
  );
}

// Các nhóm việc từ tín hiệu của khách và buổi xem
const SIGNAL_GROUPS: {
  key: keyof SignalTasks;
  title: string;
  empty: string;
  detail?: (r: TaskRow) => string | null;
}[] = [
  { key: "pendingAttendance", title: "Buổi xem chờ xác nhận", empty: "Mọi buổi xem đã qua đều đã được ghi nhận." },
  {
    key: "wantsDeposit",
    title: "Khách muốn đặt cọc",
    empty: "Chưa có khách nào báo muốn đặt cọc.",
    detail: (r) => (r.rating ? `${r.rating}/5 sao` : null),
  },
  {
    key: "notInterested",
    title: "Khách báo không còn nhu cầu",
    empty: "Không có khách nào báo không còn nhu cầu.",
    detail: (r) => r.comment ?? null,
  },
  {
    key: "reservedBackups",
    title: "Khách có lịch xem căn đã có người cọc",
    empty: "Không có khách nào hẹn xem căn đang giữ cọc.",
  },
  {
    key: "customerRequests",
    title: "Khách xin đổi lịch",
    empty: "Không có yêu cầu đổi lịch mới.",
    detail: (r) => r.note ?? null,
  },
];

// Ma trận 2 trục (Hậu): mức AI chấm × điểm tương tác Mautic
const ENGAGED_POINTS = 20;

interface Matrix {
  vipHot: number;
  coolingHot: number;
  breakthrough: number;
  nurturing: number;
}

function buildMatrix(leads: Lead[]): Matrix {
  const m: Matrix = { vipHot: 0, coolingHot: 0, breakthrough: 0, nurturing: 0 };
  for (const l of leads) {
    const isHot = isHotLead(l);
    const isHigh = (l.mauticPoints ?? 0) >= ENGAGED_POINTS;
    if (isHot && isHigh) m.vipHot++;
    else if (isHot) m.coolingHot++;
    else if (isHigh) m.breakthrough++;
    else m.nurturing++;
  }
  return m;
}

const MATRIX_CELLS: { key: keyof Matrix; title: string; icon: IconName; rule: string; text: string; href: string; style: string; badge: string }[] = [
  {
    key: "vipHot",
    title: "Ưu tiên số 1",
    icon: "rocket",
    rule: `HOT + Mautic ≥ ${ENGAGED_POINTS} pts`,
    text: "Ngân sách cao và tương tác sôi nổi. Nên gọi chốt cọc ngay!",
    href: "/admin/leads?filter=VIP_HOT",
    style: "border-rose-200 bg-rose-50/60 hover:bg-rose-50 text-rose-700",
    badge: "bg-rose-200 text-rose-800",
  },
  {
    key: "coolingHot",
    title: "Tiềm năng đang nguội",
    icon: "clock",
    rule: `HOT + Mautic < ${ENGAGED_POINTS} pts`,
    text: "Hồ sơ tốt nhưng ít mở mail. Đề xuất sale gọi thăm dò lại.",
    href: "/admin/leads?level=HOT",
    style: "border-amber-200 bg-amber-50/60 hover:bg-amber-50 text-amber-700",
    badge: "bg-amber-200 text-amber-800",
  },
  {
    key: "breakthrough",
    title: "Tương tác bứt phá",
    icon: "flame",
    rule: `WARM/COLD + Mautic ≥ ${ENGAGED_POINTS} pts`,
    text: "Xem lại nhà nhiều lần. Cơ hội nâng cấp lead lên HOT!",
    href: "/admin/leads?filter=HIGH_ENGAGEMENT",
    style: "border-purple-200 bg-purple-50/60 hover:bg-purple-50 text-purple-700",
    badge: "bg-purple-200 text-purple-800",
  },
  {
    key: "nurturing",
    title: "Nuôi dưỡng tự động",
    icon: "mail",
    rule: `WARM/COLD + Mautic < ${ENGAGED_POINTS} pts`,
    text: "Đang trong chuỗi email Mautic. Tiếp tục theo dõi tự động.",
    href: "/admin/leads",
    style: "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700",
    badge: "bg-slate-200 text-slate-800",
  },
];

interface Tasks {
  pendingLeads: Lead[];
  todayViewings: ScheduleRow[];
  pendingContracts: ContractRow[];
  matrix: Matrix;
  signals: SignalTasks;
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
      Promise.all([getFunnel(), getStats(), getLeads(), getSchedule(), getContracts(), getTasks()])
        .then(([f, s, leads, schedule, contracts, signals]) => {
          if (cancelled) return;
          const today = vnDayKey(new Date());
          setFunnel(f);
          setStats(s);
          setTasks({
            // Khách mới chờ duyệt: điểm AI cao xếp trước
            pendingLeads: leads.filter((l) => l.status === "NEW").sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
            todayViewings: schedule
              .filter((v) => vnDayKey(v.viewingTime) === today && v.leadStatus !== "LOST" && v.viewingStatus !== "CANCELLED")
              .sort((a, b) => a.viewingTime.localeCompare(b.viewingTime)),
            pendingContracts: contracts.filter((c) => c.status === "PENDING_APPROVAL"),
            matrix: buildMatrix(leads),
            signals,
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
          <div className="animate-fade-up mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6 xl:grid-cols-5">
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
            <div className={`min-w-0 p-4 sm:p-5 lg:col-span-2 ${CARD}`}>
              <h2 className="font-semibold text-slate-900">Việc cần làm</h2>
              {!tasks ? (
                <Skeleton className="mt-4 h-40" />
              ) : (
                <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 [&>*]:min-w-0">
                  <TaskGroup title="Khách chờ duyệt lịch" count={tasks.pendingLeads.length} href="/admin/leads?status=NEW" empty="Không còn khách nào chờ duyệt.">
                    {tasks.pendingLeads.slice(0, 5).map((l) => (
                      <li key={l.id}>
                        <Link href={`/admin/leads/${l.id}`} className="flex min-h-11 items-center justify-between gap-3 py-2 hover:text-brand-700">
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
                          <Link href={`/admin/leads/${v.leadId}`} className="flex min-h-11 items-center gap-3 py-2 hover:text-brand-700">
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

                  {SIGNAL_GROUPS.map((g) => (
                    <TaskGroup
                      key={g.key}
                      title={g.title}
                      count={tasks.signals[g.key].length}
                      href="/admin/leads"
                      empty={g.empty}
                    >
                      {tasks.signals[g.key].slice(0, 4).map((r) => (
                        <SignalItem key={r.leadId} row={r} detail={g.detail?.(r)} />
                      ))}
                    </TaskGroup>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className={`min-w-0 p-4 sm:p-5 ${CARD}`}>
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
                <p className="mt-2 text-sm text-slate-600">
                  {funnel.noShow ?? 0} lần khách không đến buổi xem
                </p>
              </div>

              <div className={`min-w-0 p-4 sm:p-5 ${CARD}`}>
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

          {tasks && (
            <div className={`mt-6 p-5 ${CARD}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-slate-900">Ma trận 2 trục (AI Score × Mautic Points)</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Đối chiếu độ tiềm năng AI chấm ban đầu với mức tương tác thực tế từ Mautic Marketing Automation.
                  </p>
                </div>
                <Link href="/admin/leads?filter=VIP_HOT" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-600 hover:underline sm:min-h-0">
                  Xem khách ưu tiên chốt cọc <Icon name="arrowRight" className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {MATRIX_CELLS.map((c) => (
                  <Link key={c.key} href={c.href} className={`rounded-lg border p-4 transition hover:shadow-card ${c.style}`}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sm font-bold">
                        <Icon name={c.icon} className="h-4 w-4 shrink-0" />
                        {c.title}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.badge}`}>{tasks.matrix[c.key]}</span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-800">{c.rule}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{c.text}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
