"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  createViewing,
  formatVnd,
  getProperties,
  type Lead,
  type Property,
} from "@/lib/api";

interface FormState {
  name: string;
  email: string;
  phone: string;
  budget: string;
  needs: string;
  propertyId: string;
  viewingTime: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  phone: "",
  budget: "",
  needs: "",
  propertyId: "",
  viewingTime: "",
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
  if (!form.propertyId) return "Vui lòng chọn bất động sản.";
  if (!form.viewingTime) return "Vui lòng chọn giờ xem nhà.";
  if (new Date(form.viewingTime).getTime() < Date.now()) {
    return "Giờ xem nhà phải ở trong tương lai.";
  }
  return null;
}

export default function BookingPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Lead | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProperties()
      .then((data) => {
        if (!cancelled) setProperties(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Không tải được danh sách nhà.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      form.viewingTime.length === 16
        ? `${form.viewingTime}:00`
        : form.viewingTime;

    setSubmitting(true);
    try {
      const result = await createViewing({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        budget: Number(form.budget),
        needs: form.needs.trim() || undefined,
        propertyId: Number(form.propertyId),
        viewingTime,
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
      <section className="mx-auto max-w-xl rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <h1 className="text-xl font-bold text-emerald-800">
          Đã nhận yêu cầu xem nhà
        </h1>
        <p className="mt-3 text-emerald-900">
          Cảm ơn <b>{created.name}</b>. Hệ thống đang chấm điểm và sẽ gửi email
          xác nhận tới <b>{created.email}</b> trong ít phút.
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          Mã khách hàng: #{created.id}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setCreated(null);
              setForm(EMPTY_FORM);
            }}
            className="rounded-lg bg-white px-4 py-2 font-medium text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-100"
          >
            Đăng ký thêm
          </button>
          <Link
            href="/leads"
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
          >
            Xem kết quả chấm điểm
          </Link>
        </div>
      </section>
    );
  }

  const budgetNumber = Number(form.budget);

  return (
    <section className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900">Đăng ký xem nhà</h1>
      <p className="mt-1 text-sm text-slate-600">
        Điền thông tin, chúng tôi sẽ xác nhận lịch qua email.
      </p>

      {loadError && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          {loadError}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6"
        noValidate
      >
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
            <p className="mt-1 text-xs text-slate-500">
              = {formatVnd(budgetNumber)}
            </p>
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
            placeholder="Ví dụ: Căn hộ 2 phòng ngủ gần biển, cần mua trong 1 tháng"
          />
        </div>

        <div>
          <label htmlFor="property" className="mb-1 block text-sm font-medium">
            Bất động sản muốn xem
          </label>
          <select
            id="property"
            className={INPUT}
            value={form.propertyId}
            onChange={(e) => update("propertyId", e.target.value)}
          >
            <option value="">Chọn bất động sản</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} - {p.address} ({formatVnd(p.price)},{" "}
                {Number(p.area)} m²)
              </option>
            ))}
          </select>
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
    </section>
  );
}
