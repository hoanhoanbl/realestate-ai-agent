'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getStats, type Stats } from '@/lib/api';

export default function StatsPage() {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    hot: 0,
    warm: 0,
    cold: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadStats() {
      try {
        const data = await getStats();
        if (!ignore) {
          setStats(data);
          setError(null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ Backend';
          setError(msg);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadStats();

    return () => {
      ignore = true;
    };
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStats();
      setStats(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ Backend';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getPercent = (count: number) => {
    if (!stats.total || stats.total === 0) return 0;
    return Math.round((count / stats.total) * 100);
  };

  const hotPct = getPercent(stats.hot);
  const warmPct = getPercent(stats.warm);
  const coldPct = getPercent(stats.cold);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Báo Cáo & Thống Kê Phân Loại Lead
          </h1>
          <p className="text-sm text-slate-500">
            Tổng hợp dữ liệu thẩm định và phân loại tự động bởi AI Agent
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition flex items-center space-x-2 self-start sm:self-auto disabled:opacity-50"
        >
          <span>🔄</span>
          <span>{loading ? 'Đang tải...' : 'Làm mới dữ liệu'}</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-sm">
          <div className="flex items-center space-x-2">
            <span>⚠️</span>
            <span>
              <strong>Lỗi tải thống kê:</strong> {error}
            </span>
          </div>
          <button
            onClick={handleRefresh}
            className="text-xs bg-red-100 hover:bg-red-200 text-red-800 font-semibold px-3 py-1.5 rounded-lg transition"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Tổng số Lead</span>
            <span className="text-xl">👥</span>
          </div>
          <div className="mt-4">
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              {loading ? '...' : stats.total}
            </div>
            <p className="text-xs text-slate-500 mt-1">Lượt đăng ký xem nhà</p>
          </div>
        </div>

        {/* HOT */}
        <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-500">
            <span className="text-xs font-bold uppercase tracking-wider">Khách HOT (&ge; 70đ)</span>
            <span className="text-xl">🔥</span>
          </div>
          <div className="mt-4">
            <div className="text-3xl sm:text-4xl font-extrabold text-rose-600">
              {loading ? '...' : stats.hot}
            </div>
            <p className="text-xs text-rose-600/80 font-medium mt-1">Chiếm {hotPct}% tổng khách</p>
          </div>
        </div>

        {/* WARM */}
        <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-xs font-bold uppercase tracking-wider">Khách WARM (40-69đ)</span>
            <span className="text-xl">⚡</span>
          </div>
          <div className="mt-4">
            <div className="text-3xl sm:text-4xl font-extrabold text-amber-600">
              {loading ? '...' : stats.warm}
            </div>
            <p className="text-xs text-amber-600/80 font-medium mt-1">Chiếm {warmPct}% tổng khách</p>
          </div>
        </div>

        {/* COLD */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Khách COLD (&lt; 40đ)</span>
            <span className="text-xl">❄️</span>
          </div>
          <div className="mt-4">
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-600">
              {loading ? '...' : stats.cold}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">Chiếm {coldPct}% tổng khách</p>
          </div>
        </div>
      </div>

      {/* Distribution Chart & Criteria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Bar View */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-900">
            Cơ Cấu Khách Hàng Tiềm Năng
          </h2>

          {/* Stacked Progress Bar */}
          <div className="space-y-2">
            <div className="h-6 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${hotPct}%` }}
                className="bg-rose-500 transition-all duration-500 flex items-center justify-center text-white text-[10px] font-bold"
                title={`HOT: ${hotPct}%`}
              >
                {hotPct > 8 && `${hotPct}%`}
              </div>
              <div
                style={{ width: `${warmPct}%` }}
                className="bg-amber-400 transition-all duration-500 flex items-center justify-center text-white text-[10px] font-bold"
                title={`WARM: ${warmPct}%`}
              >
                {warmPct > 8 && `${warmPct}%`}
              </div>
              <div
                style={{ width: `${coldPct}%` }}
                className="bg-slate-400 transition-all duration-500 flex items-center justify-center text-white text-[10px] font-bold"
                title={`COLD: ${coldPct}%`}
              >
                {coldPct > 8 && `${coldPct}%`}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                <span>HOT ({stats.hot})</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                <span>WARM ({stats.warm})</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span>
                <span>COLD ({stats.cold})</span>
              </span>
            </div>
          </div>

          {/* Action Link */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Xem danh sách phân loại chi tiết</span>
            <Link
              href="/leads"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition"
            >
              Đi tới Quản lý Leads →
            </Link>
          </div>
        </div>

        {/* Lead Classification Criteria */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900">
            Tiêu Chí Phân Loại AI
          </h2>
          <div className="space-y-3 text-xs text-slate-600">
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-100">
              <span className="font-bold text-rose-700 block mb-1">🔥 Khách HOT (&ge; 70 điểm)</span>
              <span className="text-slate-600 leading-relaxed">
                Ngân sách và nhu cầu rõ ràng. Ưu tiên liên hệ trong 30 phút, thông báo nhân viên phụ trách.
              </span>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
              <span className="font-bold text-amber-700 block mb-1">⚡ Khách WARM (40 - 69 điểm)</span>
              <span className="text-slate-600 leading-relaxed">
                Có nhu cầu nhưng chưa xác định cụ thể khu vực/tài chính. Chăm sóc trong 24 giờ.
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-700 block mb-1">❄️ Khách COLD (&lt; 40 điểm)</span>
              <span className="text-slate-600 leading-relaxed">
                Thiếu thông tin hoặc ngân sách chưa phù hợp. Gửi email xác nhận và lưu trữ tiếp thị.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
