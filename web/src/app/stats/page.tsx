'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface StatsData {
  total: number;
  hot: number;
  warm: number;
  cold: number;
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData>({
    total: 0,
    hot: 0,
    warm: 0,
    cold: 0,
  });
  const [loading, setLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081/api';

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Lỗi tải thống kê:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

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
          onClick={fetchStats}
          className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition flex items-center space-x-2 self-start sm:self-auto"
        >
          <span>🔄</span>
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

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

      {/* Distribution Chart & Insights */}
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

        {/* AI Agent System Status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900">
            Hạ Tầng Tự Động Hóa
          </h2>
          <div className="space-y-3 text-xs text-slate-600">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
              <span className="font-medium">Backend API</span>
              <span className="font-bold text-emerald-600">🟢 Port 8081 (NestJS)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
              <span className="font-medium">Workflow Engine</span>
              <span className="font-bold text-emerald-600">🟢 Port 5678 (n8n)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
              <span className="font-medium">Model Trí Tuệ Nhân Tạo</span>
              <span className="font-bold text-blue-600">Gemini 1.5 Flash</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
              <span className="font-medium">Kênh thông báo tức thì</span>
              <span className="font-bold text-slate-800">Email + Telegram Bot</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
