"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createViewing, formatVnd, type Lead, type Property } from "@/lib/api";

interface FormState {
  name: string;
  email: string;
  phone: string;
  budget: string;
  needs: string;
  viewingTime: string;
  consentData: boolean;
  consentMarketing: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  phone: "",
  budget: "",
  needs: "",
  viewingTime: "",
  consentData: false,
  consentMarketing: false,
};

const INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function validate(form: FormState): string | null {
  if (!form.name.trim()) return "Vui lòng nhập họ tên.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "Email không đúng định dạng.";
  }
  if (!/^[0-9+\s.-]{8,15}$/.test(form.phone.trim())) {
    return "Số điện thoại không hợp lệ (8 đến 15 chữ số).";
  }
  const budget = Number(form.budget);
  if (form.budget === "" || !Number.isInteger(budget) || budget < 0) {
    return "Ngân sách phải là số nguyên không âm (đơn vị VND).";
  }
  if (!form.viewingTime) return "Vui lòng chọn giờ xem nhà.";
  if (new Date(form.viewingTime).getTime() < Date.now()) {
    return "Giờ xem nhà phải ở trong tương lai.";
  }
  if (!form.consentData) {
    return "Vui lòng xác nhận đồng ý cho phép xử lý dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP.";
  }
  return null;
}

// Form đặt lịch xem MỘT căn nhà cụ thể (đặt ở trang chi tiết nhà)
export default function BookingForm({ property }: { property: Property }) {
  const searchParams = useSearchParams();
  const utmSource = searchParams.get("utm_source") || undefined;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Lead | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const problem = validate(form);
    if (problem) {
      setError(problem);
      return;
    }

    // input datetime-local trả "YYYY-MM-DDTHH:mm", backend cần có giây
    const viewingTime =
      form.viewingTime.length === 16 ? `${form.viewingTime}:00` : form.viewingTime;

    setSubmitting(true);
    try {
      const result = await createViewing({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        budget: Number(form.budget),
        needs: form.needs.trim() || undefined,
        propertyId: property.id,
        viewingTime,
        source: utmSource,
      });
      setCreated(result.lead);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gửi yêu cầu thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="text-xl font-bold text-emerald-800">Đã nhận yêu cầu xem nhà</h2>
        <p className="mt-3 text-emerald-900">
          Cảm ơn <b>{created.name}</b>. Chúng tôi sẽ gửi email tới <b>{created.email}</b> và
          nhân viên sẽ liên hệ xác nhận lịch xem <b>{property.name}</b>.
        </p>
        <p className="mt-1 text-sm text-emerald-800">Mã yêu cầu: #{created.id}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
          >
            Xem căn khác
          </Link>
        </div>
      </div>
    );
  }

  const budgetNumber = Number(form.budget);

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
      noValidate
    >
      <h2 className="text-lg font-bold text-slate-900">Đăng ký xem nhà</h2>

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Họ tên
        </label>
        <input
          id="name"
          className={INPUT}
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          autoComplete="name"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            className={INPUT}
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium">
            Số điện thoại
          </label>
          <input
            id="phone"
            type="tel"
            className={INPUT}
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            autoComplete="tel"
          />
        </div>
      </div>

      <div>
        <label htmlFor="budget" className="mb-1 block text-sm font-medium">
          Ngân sách (VND)
        </label>
        <input
          id="budget"
          type="number"
          min={0}
          step={1}
          className={INPUT}
          value={form.budget}
          onChange={(e) => update("budget", e.target.value)}
          placeholder="Ví dụ: 3000000000"
        />
        {form.budget !== "" && !Number.isNaN(budgetNumber) && (
          <p className="mt-1 text-xs text-slate-500">= {formatVnd(budgetNumber)}</p>
        )}
      </div>

      <div>
        <label htmlFor="needs" className="mb-1 block text-sm font-medium">
          Nhu cầu (không bắt buộc)
        </label>
        <textarea
          id="needs"
          rows={3}
          className={INPUT}
          value={form.needs}
          onChange={(e) => update("needs", e.target.value)}
          placeholder="Ví dụ: cần mua trong 1 tháng, ưu tiên gần trường học"
        />
      </div>

      <div>
        <label htmlFor="time" className="mb-1 block text-sm font-medium">
          Giờ xem nhà
        </label>
        <input
          id="time"
          type="datetime-local"
          className={INPUT}
          value={form.viewingTime}
          onChange={(e) => update("viewingTime", e.target.value)}
        />
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
        <div className="flex items-start gap-2.5">
          <input
            id="consentData"
            type="checkbox"
            checked={form.consentData}
            onChange={(e) => update("consentData", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <label
            htmlFor="consentData"
            className="cursor-pointer select-none leading-relaxed"
          >
            <span className="font-semibold text-slate-900">
              Đồng ý xử lý dữ liệu cá nhân (*)
            </span>
            : Tôi đồng ý cho phép RealEstate AI thu thập và xử lý thông tin cá
            nhân (họ tên, email, số điện thoại) phục vụ việc liên hệ, tư vấn và
            xếp lịch xem nhà theo quy định tại <b>Nghị định 13/2023/NĐ-CP</b>.
          </label>
        </div>

        <div className="flex items-start gap-2.5 border-t border-slate-200/60 pt-2.5">
          <input
            id="consentMarketing"
            type="checkbox"
            checked={form.consentMarketing}
            onChange={(e) => update("consentMarketing", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <label
            htmlFor="consentMarketing"
            className="cursor-pointer select-none leading-relaxed text-slate-600"
          >
            <span className="font-medium text-slate-800">
              Nhận thông tin thị trường (tuỳ chọn)
            </span>
            : Tôi đồng ý nhận email bản tin, cập nhật biến động giá và gợi ý bất
            động sản phù hợp từ hệ thống.
          </label>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
      </button>
    </form>
  );
}
