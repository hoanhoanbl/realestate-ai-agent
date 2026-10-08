'use client';

import { useEffect, useState } from 'react';

interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  budget: number | string;
  needs: string | null;
  score: number | null;
  level: 'HOT' | 'WARM' | 'COLD' | null;
  reason: string | null;
  aiReply: string | null;
  emailSent: boolean | null;
  staffNotified: boolean | null;
  automationStatus: string;
  status: string;
  createdAt: string;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081/api';

  const fetchLeads = async (level = filterLevel) => {
    setLoading(true);
    try {
      let url = `${apiUrl}/leads`;
      if (level && level !== 'ALL') {
        url += `?level=${level}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads(filterLevel);
  }, [filterLevel]);

  const formatVND = (val: string | number) => {
    const num = Number(val);
    if (isNaN(num)) return '0 đ';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  const getLevelBadge = (level: string | null) => {
    switch (level) {
      case 'HOT':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">🔥 HOT</span>;
      case 'WARM':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">⚡ WARM</span>;
      case 'COLD':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">❄️ COLD</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Chưa chấm</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Hoàn thành</span>;
      case 'FAILED':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800">Lỗi AI</span>;
      case 'PENDING':
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 animate-pulse">Đang xử lý</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Quản Lý Khách Hàng Tiềm Năng (Leads)
          </h1>
          <p className="text-sm text-slate-500">
            Danh sách khách đã đặt lịch và kết quả thẩm định tự động từ AI Agent.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Refresh Button */}
          <button
            onClick={() => fetchLeads()}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            🔄 Tải lại
          </button>

          {/* Filter Pills */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {['ALL', 'HOT', 'WARM', 'COLD'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  filterLevel === lvl
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lvl === 'ALL' ? 'Tất cả' : lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            <span className="inline-block animate-spin mr-2">⏳</span> Đang tải danh sách khách hàng...
          </div>
        ) : leads.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            Không tìm thấy khách hàng nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Khách hàng</th>
                  <th className="px-6 py-4">Ngân sách</th>
                  <th className="px-6 py-4">Điểm AI</th>
                  <th className="px-6 py-4">Phân loại</th>
                  <th className="px-6 py-4">Tự động hoá</th>
                  <th className="px-6 py-4">Ngày tạo</th>
                  <th className="px-6 py-4 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 font-bold text-slate-900">#{lead.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{lead.name}</div>
                      <div className="text-xs text-slate-400">{lead.phone} • {lead.email}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {formatVND(lead.budget)}
                    </td>
                    <td className="px-6 py-4">
                      {lead.score !== null ? (
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-base text-slate-900">{lead.score}</span>
                          <span className="text-xs text-slate-400">/100</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getLevelBadge(lead.level)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(lead.automationStatus)}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(lead.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedLead(lead)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition"
                      >
                        Xem AI
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                Chi Tiết Lead #{selectedLead.id} - {selectedLead.name}
              </h2>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-700">
              <div>
                <span className="font-bold text-xs uppercase text-slate-400 block">Nhu cầu của khách:</span>
                <p className="bg-slate-50 p-3 rounded-lg text-slate-800 mt-1">
                  {selectedLead.needs || 'Không nhập'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <span className="font-bold text-xs uppercase text-slate-400 block">Điểm & Mức độ:</span>
                  <div className="mt-1 flex items-center space-x-2">
                    <span className="text-xl font-extrabold">{selectedLead.score ?? '—'}</span>
                    {getLevelBadge(selectedLead.level)}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg">
                  <span className="font-bold text-xs uppercase text-slate-400 block">Thông báo tự động:</span>
                  <div className="mt-1 text-xs space-y-1">
                    <div>📧 Email khách: {selectedLead.emailSent ? '✅ Đã gửi' : '❌ Chưa'}</div>
                    <div>🔔 Báo nhân viên: {selectedLead.staffNotified ? '✅ Đã báo' : '❌ Chưa'}</div>
                  </div>
                </div>
              </div>

              <div>
                <span className="font-bold text-xs uppercase text-slate-400 block">Lý do AI đánh giá:</span>
                <p className="bg-blue-50/60 border border-blue-100 p-3 rounded-lg text-blue-900 font-medium text-xs mt-1">
                  {selectedLead.reason || 'Chưa có phân tích'}
                </p>
              </div>

              {selectedLead.aiReply && (
                <div>
                  <span className="font-bold text-xs uppercase text-slate-400 block">Nội dung thư AI đã soạn:</span>
                  <p className="bg-emerald-50/60 border border-emerald-100 p-3 rounded-lg text-emerald-950 text-xs mt-1 whitespace-pre-line">
                    {selectedLead.aiReply}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
