"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LeadStatusBadge from "@/components/LeadStatusBadge";
import { getFunnel, getStats, type Funnel, type LeadStatus, type Stats } from "@/lib/api";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      Promise.all([getFunnel(), getStats()])
        .then(([f, s]) => {
          if (cancelled) return;
          setFunnel(f);
          setStats(s);
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
        </>
      )}
    </section>
  );
}
