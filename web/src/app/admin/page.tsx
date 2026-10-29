"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LeadStatusBadge from "@/components/LeadStatusBadge";
import { getFunnel, getLeads, getStats, type Funnel, type Lead, type LeadStatus, type Stats } from "@/lib/api";

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

function Kpi({ label, value, hint, tone = "slate", href }: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "slate" | "amber" | "rose" | "emerald";
  href?: string;
}) {
  const color = { slate: "text-slate-900", amber: "text-amber-600", rose: "text-rose-600", emerald: "text-emerald-600" }[tone];
  const body = (
    <div className="rounded-xl border border-slate-200 bg-white p-5 transition hover:shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function OverviewPage() {
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      Promise.all([getFunnel(), getStats(), getLeads()])
        .then(([f, s, l]) => {
          if (cancelled) return;
          setFunnel(f);
          setStats(s);
          setLeads(l);
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

  const matrix = useMemo(() => {
    let vipHot = 0;
    let coolingHot = 0;
    let breakthrough = 0;
    let nurturing = 0;
    for (const l of leads ?? []) {
      const isHot = l.level === "HOT";
      const isHigh = (l.mauticPoints ?? 0) >= 20;
      if (isHot && isHigh) vipHot++;
      else if (isHot && !isHigh) coolingHot++;
      else if (!isHot && isHigh) breakthrough++;
      else nurturing++;
    }
    return { vipHot, coolingHot, breakthrough, nurturing };
  }, [leads]);

  const max = funnel ? Math.max(1, ...FUNNEL_ORDER.map((s) => funnel.byStatus[s])) : 1;

  return (
    <section>
      <h1 className="text-2xl font-bold text-slate-900">Tổng quan</h1>
      <p className="mt-1 text-sm text-slate-600">Phễu bán hàng và các việc cần xử lý. Tự cập nhật mỗi 15 giây.</p>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}
      {!funnel && !error && <p className="mt-6 text-slate-500">Đang tải...</p>}

      {funnel && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label="Tổng số khách" value={funnel.total} href="/admin/leads" />
            <Kpi
              label="Chờ duyệt lịch"
              value={funnel.pendingApproval}
              tone={funnel.pendingApproval > 0 ? "amber" : "slate"}
              hint="Khách mới, AI đã chấm"
              href="/admin/leads?status=NEW"
            />
            <Kpi label="Lịch xem hôm nay" value={funnel.viewingsToday} href="/admin/lich-xem" />
            <Kpi label="Tỉ lệ chốt" value={`${funnel.conversionRate}%`} tone="emerald" hint="Đã ký / tổng số khách" />
            <Kpi
              label="n8n báo lỗi"
              value={funnel.failedAutomation}
              tone={funnel.failedAutomation > 0 ? "rose" : "slate"}
              hint="Khách xử lý tự động thất bại"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold uppercase text-slate-500">Phễu theo trạng thái</h2>
              <ul className="mt-4 space-y-3">
                {FUNNEL_ORDER.map((s) => (
                  <li key={s}>
                    <div className="flex items-center justify-between text-sm">
                      <LeadStatusBadge status={s} />
                      <span className="font-semibold text-slate-800">{funnel.byStatus[s]}</span>
                    </div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${BAR[s]}`}
                        style={{ width: `${(funnel.byStatus[s] / max) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
                <LeadStatusBadge status="LOST" /> {funnel.byStatus.LOST} khách không mua
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase text-slate-500">Mức tiềm năng (AI chấm)</h2>
              {stats && (
                <ul className="mt-4 space-y-3 text-sm">
                  <li className="flex justify-between"><span className="font-semibold text-red-600">HOT</span><span>{stats.hot}</span></li>
                  <li className="flex justify-between"><span className="font-semibold text-amber-600">WARM</span><span>{stats.warm}</span></li>
                  <li className="flex justify-between"><span className="font-semibold text-sky-600">COLD</span><span>{stats.cold}</span></li>
                  <li className="flex justify-between border-t border-slate-100 pt-3 text-slate-500">
                    <span>Chưa chấm</span>
                    <span>{stats.total - stats.hot - stats.warm - stats.cold}</span>
                  </li>
                </ul>
              )}
            </div>
          </div>

          {/* Ma trận 2 trục: AI Score & Mautic Points */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold uppercase text-slate-700">
                  Ma trận 2 trục (AI Score × Mautic Points)
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Đối chiếu giữa độ tiềm năng AI chấm ban đầu và mức độ tương tác thực tế từ Mautic Marketing Automation.
                </p>
              </div>
              <Link
                href="/admin/leads?filter=VIP_HOT"
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Xem khách ưu tiên chốt cọc →
              </Link>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Link
                href="/admin/leads?filter=VIP_HOT"
                className="group rounded-lg border border-rose-200 bg-rose-50/60 p-4 transition hover:bg-rose-50 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-700">🚀 Ưu tiên số 1</span>
                  <span className="rounded-full bg-rose-200 px-2 py-0.5 text-xs font-bold text-rose-800">
                    {matrix.vipHot}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-800">HOT + Mautic ≥ 20 pts</p>
                <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
                  Ngân sách cao và tương tác sôi nổi. Nên gọi chốt cọc ngay!
                </p>
              </Link>

              <Link
                href="/admin/leads?level=HOT"
                className="group rounded-lg border border-amber-200 bg-amber-50/60 p-4 transition hover:bg-amber-50 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700">⏳ Tiềm năng đang nguội</span>
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
                    {matrix.coolingHot}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-800">HOT + Mautic &lt; 20 pts</p>
                <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
                  Hồ sơ tốt nhưng ít mở mail. Đề xuất sale gọi thăm dò lại.
                </p>
              </Link>

              <Link
                href="/admin/leads?filter=HIGH_ENGAGEMENT"
                className="group rounded-lg border border-purple-200 bg-purple-50/60 p-4 transition hover:bg-purple-50 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-700">🔥 Tương tác bứt phá</span>
                  <span className="rounded-full bg-purple-200 px-2 py-0.5 text-xs font-bold text-purple-800">
                    {matrix.breakthrough}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-800">WARM/COLD + Mautic ≥ 20 pts</p>
                <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
                  Xem lại nhà nhiều lần. Cơ hội nâng cấp lead lên HOT!
                </p>
              </Link>

              <Link
                href="/admin/leads"
                className="group rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">📨 Nuôi dưỡng tự động</span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-800">
                    {matrix.nurturing}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-800">WARM/COLD + Mautic &lt; 20 pts</p>
                <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
                  Đang trong chuỗi email Mautic. Tiếp tục theo dõi tự động.
                </p>
              </Link>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
