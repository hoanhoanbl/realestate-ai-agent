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
import { useSession } from "@/lib/auth";

// useSearchParams cần nằm trong Suspense
export default function ReportsPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Đang tải...</p>}>
      <ReportsContent />
    </Suspense>
  );
}

const ROWS: { key: string; label: string }[] = [
  { key: "new_leads", label: "Khách mới" },
  { key: "confirmed", label: "Đã chốt lịch" },
  { key: "viewed", label: "Đã xem nhà" },
  { key: "deposits", label: "Tạo hợp đồng cọc" },
  { key: "signed", label: "Đã ký" },
  { key: "lost", label: "Mất khách" },
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
      <p className="rounded-lg bg-amber-50 p-4 text-amber-800 ring-1 ring-amber-200">Chỉ quản lý được xem báo cáo kinh doanh.</p>
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Báo cáo kinh doanh</h1>
          <p className="mt-1 text-sm text-slate-600">
            Tự động tạo 8 giờ sáng thứ Hai. AI Agent tra cứu cơ sở dữ liệu (chỉ đọc) để viết nhận định.
          </p>
        </div>
        <button
          type="button"
          onClick={runNow}
          disabled={running}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {running ? "Đang tạo..." : "Tạo báo cáo ngay"}
        </button>
      </div>

      {notice && <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800 ring-1 ring-blue-200">{notice}</p>}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}
      {list === null && !error && <p className="mt-6 text-slate-500">Đang tải...</p>}
      {list !== null && list.length === 0 && (
        <p className="mt-6 rounded-lg bg-slate-50 p-4 text-slate-600 ring-1 ring-slate-200">Chưa có báo cáo nào. Bấm &quot;Tạo báo cáo ngay&quot;.</p>
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
                    className={`w-full rounded-lg border p-3 text-left text-sm ${
                      selectedId === r.id ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
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
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-bold text-slate-900">{analysis.headline}</h2>
                  {!analysis.aiUsed && <p className="mt-1 text-xs text-amber-700">AI không khả dụng, nội dung dựng từ số liệu.</p>}
                </div>

                {detail.alerts.length > 0 && (
                  <div className="rounded-xl bg-rose-50 p-5 ring-1 ring-rose-200">
                    <h3 className="text-sm font-semibold uppercase text-rose-700">Điểm bất thường ({detail.alerts.length})</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-900">
                      {detail.alerts.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
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

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="text-sm font-semibold uppercase text-slate-500">Tỉ lệ chuyển đổi</h3>
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
                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, v ?? 0)}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold uppercase text-slate-500">Nhận định</h3>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-800">
                      {analysis.insights.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold uppercase text-slate-500">Đề xuất cho tuần tới</h3>
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
