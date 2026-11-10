"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createViewing,
  formatVnd,
  getViewingSlots,
  type Lead,
  type Property,
  type ViewingSlots,
} from "@/lib/api";
import { dayLabel, formatDate, formatTime } from "@/lib/time";

interface FormState {
  name: string;
  email: string;
  phone: string;
  budget: string;
  needs: string;
  // ISO UTC của khung giờ đã chọn (ViewingSlot.start)
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
  "w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

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
  if (!form.viewingTime) return "Vui lòng chọn ngày và khung giờ xem nhà.";
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
  // Ô bẫy bot: ẩn với người dùng, bot tự điền thì backend từ chối
  const [website, setWebsite] = useState("");

  // Khung giờ còn trống của căn này (FE-34)
  const [slots, setSlots] = useState<ViewingSlots | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [day, setDay] = useState<string>("");

  const loadSlots = useCallback(async () => {
    try {
      const data = await getViewingSlots(property.id);
      setSlots(data);
      setSlotsError(null);
      // Giữ ngày đang chọn nếu còn khung trống, không thì chuyển sang ngày đầu tiên còn khung
      setDay((current) => {
        const stillOpen = data.days.find((d) => d.date === current && d.slots.some((x) => x.available));
        return stillOpen ? current : (data.days.find((d) => d.slots.some((x) => x.available))?.date ?? "");
      });
      // Khung đang chọn mà vừa bị người khác đặt thì bỏ chọn
      setForm((prev) => {
        const chosen = data.days.flatMap((d) => d.slots).find((x) => x.start === prev.viewingTime);
        return chosen?.available ? prev : { ...prev, viewingTime: "" };
      });
    } catch (e: unknown) {
      setSlotsError(e instanceof Error ? e.message : "Không tải được các khung giờ.");
    }
  }, [property.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSlots();
  }, [loadSlots]);

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

    setSubmitting(true);
    try {
      const result = await createViewing({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        budget: Number(form.budget),
        needs: form.needs.trim() || undefined,
        propertyId: property.id,
        viewingTime: form.viewingTime,
        source: utmSource,
        consentMarketing: form.consentMarketing,
        website: website || undefined,
      });
      setCreated(result.lead);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gửi yêu cầu thất bại.");
      // Khung vừa bị đặt hoặc giờ không còn hợp lệ: tải lại để khách chọn khung khác
      if (e instanceof ApiError && (e.status === 400 || e.status === 409)) void loadSlots();
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
      className="relative space-y-4 rounded-xl border border-slate-200 bg-white p-6"
      noValidate
    >
      <h2 className="text-lg font-bold text-slate-900">Đăng ký xem nhà</h2>

      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

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

      <fieldset className="min-w-0">
        <legend className="mb-1 block text-sm font-medium">Giờ xem nhà</legend>
        {slotsError && (
          <p className="text-sm text-red-700">
            {slotsError}{" "}
            <button type="button" onClick={() => void loadSlots()} className="font-medium underline">
              Tải lại
            </button>
          </p>
        )}
        {!slots && !slotsError && <p className="text-sm text-slate-500">Đang tải các khung giờ…</p>}
        {slots && !slots.days.some((d) => d.slots.some((x) => x.available)) && (
          <p className="text-sm text-slate-600">
            Căn này đã kín lịch trong 14 ngày tới. Vui lòng liên hệ nhân viên hoặc chọn căn khác.
          </p>
        )}
        {slots && slots.days.some((d) => d.slots.some((x) => x.available)) && (
          <>
            <div role="group" aria-label="Chọn ngày" className="flex gap-2 overflow-x-auto pb-1">
              {slots.days.map((d) => {
                const open = d.slots.some((x) => x.available);
                const active = d.date === day;
                return (
                  <button
                    key={d.date}
                    type="button"
                    disabled={!open}
                    aria-pressed={active}
                    aria-label={dayLabel(d.slots[0].start).includes(",") ? dayLabel(d.slots[0].start) : `${dayLabel(d.slots[0].start)}, ${formatDate(d.slots[0].start).slice(0, 5)}`}
                    onClick={() => setDay(d.date)}
                    className={`min-h-11 shrink-0 rounded-lg border px-3 py-2 text-sm ${
                      active
                        ? "border-blue-600 bg-blue-600 font-semibold text-white"
                        : open
                          ? "border-slate-300 bg-white text-slate-800 hover:border-blue-400"
                          : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                    }`}
                  >
                    {/* dayLabel đã kèm ngày với các thứ khác hôm nay/ngày mai: chỉ lấy phần trước dấu phẩy */}
                    <span className="block">{dayLabel(d.slots[0].start).split(",")[0]}</span>
                    <span className="block text-xs opacity-80">{formatDate(d.slots[0].start).slice(0, 5)}</span>
                  </button>
                );
              })}
            </div>
            <div role="group" aria-label="Chọn khung giờ" className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(slots.days.find((d) => d.date === day)?.slots ?? []).map((slot) => {
                const selected = form.viewingTime === slot.start;
                return (
                  <button
                    key={slot.start}
                    type="button"
                    disabled={!slot.available}
                    aria-pressed={selected}
                    onClick={() => update("viewingTime", slot.start)}
                    className={`min-h-11 rounded-lg border px-2 py-2 text-sm ${
                      selected
                        ? "border-blue-600 bg-blue-600 font-semibold text-white"
                        : slot.available
                          ? "border-slate-300 bg-white text-slate-800 hover:border-blue-400"
                          : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through"
                    }`}
                  >
                    {formatTime(slot.start)}
                    {!slot.available && <span className="sr-only"> (đã có người đặt)</span>}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Khung gạch ngang đã có khách đặt. Xem nhà từ 08:00 đến 19:00, đặt trước tối thiểu 3 giờ làm việc.
            </p>
          </>
        )}
      </fieldset>

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
