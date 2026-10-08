'use client';

import { useEffect, useState } from 'react';

interface Property {
  id: number;
  name: string;
  address: string;
  price: string | number;
  area: number;
  type: string;
  status: string;
}

export default function BookingPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProps, setLoadingProps] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    budget: '',
    needs: '',
    propertyId: '',
    viewingDate: '',
    viewingTime: '09:00',
  });

  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081/api';

  useEffect(() => {
    async function fetchProperties() {
      try {
        const res = await fetch(`${apiUrl}/properties`);
        if (res.ok) {
          const data = await res.json();
          setProperties(data);
          if (data.length > 0) {
            setFormData((prev) => ({ ...prev, propertyId: String(data[0].id) }));
          }
        }
      } catch (err: any) {
        console.error('Lỗi tải danh sách BĐS:', err);
      } finally {
        setLoadingProps(false);
      }
    }

    // Đặt ngày mặc định là ngày mai
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, viewingDate: dateStr }));

    fetchProperties();
  }, [apiUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage('');
    setSuccessResult(null);

    try {
      const fullViewingTime = `${formData.viewingDate}T${formData.viewingTime}:00`;

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        budget: Number(formData.budget),
        needs: formData.needs.trim(),
        propertyId: Number(formData.propertyId),
        viewingTime: fullViewingTime,
      };

      const res = await fetch(`${apiUrl}/viewings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Gửi yêu cầu thất bại');
      }

      const result = await res.json();
      setSuccessResult(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Có lỗi xảy ra khi gửi đăng ký');
    } finally {
      setSubmitting(false);
    }
  };

  const formatVND = (val: string | number) => {
    const num = Number(val);
    if (isNaN(num) || num === 0) return '';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Hero Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Đặt Lịch Xem Nhà Trực Tuyến
        </h1>
        <p className="text-slate-600 max-w-xl mx-auto text-sm sm:text-base">
          Trải nghiệm tư vấn bất động sản thông minh. Hệ thống tự động xác nhận lịch và hỗ trợ khách hàng tức thì qua AI Agent.
        </p>
      </div>

      {/* Success Notification */}
      {successResult && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-3 text-emerald-800">
            <span className="text-2xl">🎉</span>
            <h2 className="text-lg font-bold">Đặt lịch xem nhà thành công!</h2>
          </div>
          <p className="text-sm text-emerald-700">
            Yêu cầu của bạn đã được ghi nhận vào hệ thống. AI Agent đang thực hiện phân tích nhu cầu và gửi email xác nhận đến <span className="font-semibold underline">{formData.email}</span>.
          </p>
          <div className="bg-white rounded-lg p-4 border border-emerald-200 text-xs sm:text-sm grid grid-cols-2 gap-2 text-slate-700">
            <div><strong>Mã khách (Lead ID):</strong> #{successResult.lead?.id}</div>
            <div><strong>Khách hàng:</strong> {successResult.lead?.name}</div>
            <div><strong>Trạng thái AI:</strong> <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">{successResult.lead?.automationStatus}</span></div>
            <div><strong>Thời gian xem:</strong> {formData.viewingDate} lúc {formData.viewingTime}</div>
          </div>
          <div className="pt-2 flex justify-end">
            <button
              onClick={() => {
                setSuccessResult(null);
                setFormData((prev) => ({ ...prev, name: '', email: '', phone: '', budget: '', needs: '' }));
              }}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline"
            >
              + Đăng ký lịch xem khác
            </button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 text-rose-800 text-sm flex items-center space-x-2">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Booking Form Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Họ và tên */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Họ và Tên <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: Nguyễn Văn Hoàng"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm text-slate-900"
              />
            </div>

            {/* Số điện thoại */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Số Điện Thoại <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="VD: 0901234567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm text-slate-900"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Email nhận xác nhận <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="VD: hoang@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm text-slate-900"
              />
            </div>

            {/* Ngân sách */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Ngân sách dự kiến (VND) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min="100000000"
                step="10000000"
                placeholder="VD: 3500000000 (3.5 tỷ)"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm text-slate-900"
              />
              {formData.budget && (
                <span className="text-xs text-blue-600 font-medium mt-1 block">
                  Ước lượng: {formatVND(formData.budget)}
                </span>
              )}
            </div>
          </div>

          {/* Chọn Bất động sản */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Dự án / Bất động sản quan tâm <span className="text-rose-500">*</span>
            </label>
            {loadingProps ? (
              <div className="text-sm text-slate-400 py-2">Đang tải danh sách bất động sản...</div>
            ) : (
              <select
                required
                value={formData.propertyId}
                onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm text-slate-900 bg-white"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id} - {p.name} | {p.address} ({formatVND(p.price)} - {p.area}m²)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Thời gian xem */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Ngày xem nhà <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.viewingDate}
                onChange={(e) => setFormData({ ...formData, viewingDate: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Giờ xem nhà <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.viewingTime}
                onChange={(e) => setFormData({ ...formData, viewingTime: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm text-slate-900 bg-white"
              >
                <option value="08:30">08:30 Sáng</option>
                <option value="09:00">09:00 Sáng</option>
                <option value="10:00">10:00 Sáng</option>
                <option value="14:00">14:00 Chiều</option>
                <option value="15:30">15:30 Chiều</option>
                <option value="17:00">17:00 Chiều</option>
              </select>
            </div>
          </div>

          {/* Nhu cầu chi tiết */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Nhu cầu cụ thể (AI sẽ dựa vào đây để đánh giá & hỗ trợ)
            </label>
            <textarea
              rows={3}
              placeholder="VD: Cần căn 2 phòng ngủ tầng cao, view thoáng mát, tài chính có sẵn cần sang tên trong tháng 10..."
              value={formData.needs}
              onChange={(e) => setFormData({ ...formData, needs: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm text-slate-900"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-base shadow-lg shadow-blue-500/25 transition disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
          >
            {submitting ? (
              <>
                <span className="animate-spin text-lg">⏳</span>
                <span>Đang xử lý yêu cầu...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Xác Nhận Đặt Lịch Xem Nhà</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
