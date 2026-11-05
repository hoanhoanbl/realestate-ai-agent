"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  formatDateTime,
  formatVnd,
  getReport,
  getReports,
  runReportNow,
  type ReportDetail,
  type ReportRow,
} from "@/lib/api";
import CompareBars from "@/components/CompareBars";
import { Alert, Button, CARD, EmptyState, Icon, PageHeader, Skeleton } from "@/components/ui";
import { useSession } from "@/lib/auth";

// useSearchParams cần nằm trong Suspense
export default function ReportsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
      <ReportsContent />
    </Suspense>
  );
}

const ROWS: { key: string; label: string }[] = [
  { key: "new_leads", label: "Khách mới" },
  { key: "confirmed", label: "Đã chốt lịch" },
  { key: "viewed", label: "Đã xem nhà" },
  { key: "no_show", label: "Khách không đến" },
  { key: "deposits", label: "Tạo hợp đồng cọc" },
  { key: "signed", label: "Đã ký" },
  { key: "lost", label: "Không mua" },
];

const FUNNEL: { key: string; label: string }[] = [
  { key: "leadToConfirmed", label: "Khách mới → chốt lịch" },
  { key: "confirmedToViewed", label: "Chốt lịch → đã xem" },
  { key: "viewedToDeposit", label: "Đã xem → đặt cọc" },
  { key: "depositToSigned", label: "Đặt cọc → ký" },
];

function num(v: unknown): number {
  return Number(v ?? 0);
}

function ReportsContent() {
  const session = useSession();
  const searchParams = useSearchParams();
  const wantedId = Number(searchParams.get("id")) || null;

  const [list, setList] = useState<ReportRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(wantedId);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    getReports()
      .then((rows) => {
        if (cancelled) return;
        setList(rows);
        setError(null);
        // mặc định mở báo cáo mới nhất
        setSelectedId((cur) => cur ?? rows[0]?.id ?? null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Lỗi không xác định.");
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    if (selectedId === null) return;
    let cancelled = false;
    getReport(selectedId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Lỗi không xác định.");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (session && session.user.role !== "MANAGER") {
    return (
      <Alert tone="warning">Chỉ quản lý được xem báo cáo kinh doanh.</Alert>
    );
  }

  async function runNow() {
    setRunning(true);
    setNotice(null);
    try {
      await runReportNow();
      setNotice("Đã nhờ n8n tạo báo cáo. AI Agent cần khoảng 30 đến 60 giây, trang sẽ tự cập nhật.");
      // thăm dò vài lần cho tới khi báo cáo mới xuất hiện
      const before = list?.[0]?.id ?? 0;
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const rows = await getReports();
        if ((rows[0]?.id ?? 0) > before) {
          setList(rows);
          setSelectedId(rows[0].id);
          setNotice(null);
          break;
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không tạo được báo cáo.");
    } finally {
      setRunning(false);
      reload();
    }
  }

  const metrics = detail?.metrics as
    | { cur: Record<string, unknown>; prev: Record<string, unknown>; delta: Record<string, number>; funnel: Record<string, number | null>; period: string }
    | undefined;
  const analysis = detail?.analysis as { headline: string; insights: string[]; recommendations: string[]; aiUsed: boolean } | undefined;

  return (
    <section>
      <PageHeader
        title="Báo cáo kinh doanh"
        description="Tự động tạo 8 giờ sáng thứ Hai. AI Agent tra cứu cơ sở dữ liệu (chỉ đọc) để viết nhận định."
        actions={
          <Button onClick={runNow} disabled={running}>
            <Icon name="sparkles" className="h-4 w-4" />
            {running ? "Đang tạo..." : "Tạo báo cáo ngay"}
          </Button>
        }
      />

      {notice && (
        <Alert tone="info" className="mt-3">
          {notice}
        </Alert>
      )}
      {error && <Alert className="mt-3">{error}</Alert>}
      {list === null && !error && <Skeleton className="mt-6 h-64 rounded-xl" />}
      {list !== null && list.length === 0 && (
        <EmptyState
          className="mt-6"
          icon={<Icon name="chart" className="h-10 w-10" />}
          title="Chưa có báo cáo nào"
          description="Bấm Tạo báo cáo ngay để AI Agent tổng hợp số liệu tuần này."
        />
      )}

      {list !== null && list.length > 0 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-4">
          <aside className="lg:col-span-1">
            <ul className="space-y-2">
              {list.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    aria-current={selectedId === r.id ? "true" : undefined}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                      selectedId === r.id ? "border-brand-200 bg-brand-50 ring-1 ring-brand-200" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-medium text-slate-900">
                      {r.periodStart} → {r.periodEnd}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">Tạo lúc {formatDateTime(r.createdAt)}</div>
                    {r.alertCount > 0 && <div className="mt-1 text-xs font-medium text-rose-600">{r.alertCount} cảnh báo</div>}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="space-y-4 lg:col-span-3">
            {detail && metrics && analysis && (
              <>
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 p-6 text-white">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-100">
                    <Icon name="sparkles" className="h-4 w-4" />
                    {analysis.aiUsed ? "AI tóm tắt" : "Tóm tắt từ số liệu (AI không khả dụng)"} · {detail.periodStart} → {detail.periodEnd}
                  </p>
                  <h2 className="mt-2 text-lg font-bold leading-snug sm:text-xl">{analysis.headline}</h2>
                </div>

                {detail.alerts.length > 0 && (
                  <div className="rounded-xl bg-rose-50 p-5 ring-1 ring-rose-200">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-rose-700">
                      <Icon name="alert" className="h-4 w-4" />
                      Điểm bất thường ({detail.alerts.length})
                    </h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-900">
                      {detail.alerts.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid gap-4 xl:grid-cols-2">
                <div className={`p-5 ${CARD}`}>
                  <h3 className="font-semibold text-slate-900">So sánh với tuần trước</h3>
                  <div className="mt-3">
                    <CompareBars rows={ROWS.map((r) => ({ label: r.label, current: num(metrics.cur[r.key]), previous: num(metrics.prev[r.key]) }))} />
                  </div>
                </div>
                <div className={`overflow-x-auto ${CARD}`}>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Chỉ số</th>
                        <th className="px-4 py-3 text-right">Tuần này</th>
                        <th className="px-4 py-3 text-right">Tuần trước</th>
                        <th className="px-4 py-3 text-right">Chênh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ROWS.map((r) => {
                        const d = metrics.delta[r.key] ?? 0;
                        return (
                          <tr key={r.key}>
                            <td className="px-4 py-2.5">{r.label}</td>
                            <td className="px-4 py-2.5 text-right font-semibold">{num(metrics.cur[r.key])}</td>
                            <td className="px-4 py-2.5 text-right text-slate-500">{num(metrics.prev[r.key])}</td>
                            <td className={`px-4 py-2.5 text-right ${d > 0 ? "text-emerald-600" : d < 0 ? "text-rose-600" : "text-slate-400"}`}>
                              {d > 0 ? `+${d}` : d}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50">
                        <td className="px-4 py-2.5">Tiền cọc đã ký</td>
                        <td className="px-4 py-2.5 text-right font-semibold" colSpan={3}>
                          {formatVnd(num(metrics.cur.signed_amount))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                </div>

                <div className={`p-5 ${CARD}`}>
                  <h3 className="font-semibold text-slate-900">Tỉ lệ chuyển đổi</h3>
                  <ul className="mt-3 space-y-3">
                    {FUNNEL.map((f) => {
                      const v = metrics.funnel[f.key];
                      return (
                        <li key={f.key}>
                          <div className="flex justify-between text-sm">
                            <span>{f.label}</span>
                            <span className="font-semibold">{v === null || v === undefined ? "-" : `${v}%`}</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, v ?? 0)}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className={`p-5 ${CARD}`}>
                    <h3 className="font-semibold text-slate-900">Nhận định</h3>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-800">
                      {analysis.insights.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                  <div className={`p-5 ${CARD}`}>
                    <h3 className="font-semibold text-slate-900">Đề xuất cho tuần tới</h3>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-800">
                      {analysis.recommendations.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
