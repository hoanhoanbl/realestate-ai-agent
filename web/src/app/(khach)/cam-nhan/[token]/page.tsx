"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Icon } from "@/components/ui";
import {
  ApiError,
  formatDateTime,
  getFeedbackInfo,
  submitFeedback,
  type FeedbackInfo,
  type FeedbackInterest,
} from "@/lib/api";

const INTERESTS: { value: FeedbackInterest; label: string; hint: string }[] = [
  { value: "DEPOSIT", label: "Tôi muốn đặt cọc căn này", hint: "Nhân viên sẽ liên hệ về hợp đồng" },
  { value: "OTHER", label: "Tôi muốn xem thêm căn khác", hint: "Nhân viên sẽ gợi ý căn phù hợp hơn" },
  { value: "NONE", label: "Tôi chưa có nhu cầu nữa", hint: "Cảm ơn anh/chị đã dành thời gian" },
];

// useParams() cần nằm trong Suspense vì `token` chỉ biết lúc người dùng mở trang
export default function FeedbackPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Đang tải...</p>}>
      <FeedbackContent />
    </Suspense>
  );
}

function FeedbackContent() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [info, setInfo] = useState<FeedbackInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [interest, setInterest] = useState<FeedbackInterest | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFeedbackInfo(token)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setLoadError(e instanceof Error ? e.message : "Không tải được trang này.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (rating < 1) return setError("Vui lòng chọn số sao.");
    if (!interest) return setError("Vui lòng chọn một lựa chọn bên dưới.");
    setSubmitting(true);
    try {
      await submitFeedback(token, { rating, interest, comment: comment.trim() || undefined });
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gửi thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  const box = "mx-auto max-w-xl";

  if (notFound) {
    return (
      <section className={box}>
        <p className="rounded-lg bg-slate-50 p-4 text-slate-700 ring-1 ring-slate-200">
          Liên kết này không hợp lệ hoặc đã hết hạn.
        </p>
      </section>
    );
  }
  if (loadError) {
    return (
      <section className={box}>
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{loadError}</p>
      </section>
    );
  }
  if (!info) return <p className="text-slate-500">Đang tải...</p>;

  if (done || info.submitted) {
    return (
      <section className={box}>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <h1 className="text-xl font-bold text-emerald-800">
            {done ? "Cảm ơn anh/chị đã chia sẻ" : "Anh/chị đã gửi cảm nhận rồi"}
          </h1>
          <p className="mt-2 text-emerald-900">Nhân viên sẽ xem và liên hệ lại với anh/chị nếu cần.</p>
          <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">
            Xem các căn khác
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={box}>
      <h1 className="text-2xl font-bold text-slate-900">Anh/chị thấy căn nhà thế nào?</h1>
      <p className="mt-1 text-sm text-slate-600">
        Chào <b>{info.leadName}</b>
        {info.propertyName && (
          <>
            , cảm ơn anh/chị đã xem <b>{info.propertyName}</b>
            {info.viewingTime && <> lúc {formatDateTime(info.viewingTime)}</>}
          </>
        )}
        . Chỉ mất 30 giây.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-6" noValidate>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Mức độ hài lòng</legend>
          <div className="flex gap-1" role="radiogroup" aria-label="Số sao">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} sao`}
                onClick={() => setRating(n)}
                className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-amber-50 hover:text-amber-400 ${n <= rating ? "text-amber-400" : "text-slate-300"}`}
              >
                <Icon name="star" filled={n <= rating} className="h-8 w-8" />
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Bước tiếp theo anh/chị muốn?</legend>
          <div className="space-y-2">
            {INTERESTS.map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  interest === o.value ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input type="radio" name="interest" className="mt-1" checked={interest === o.value} onChange={() => setInterest(o.value)} />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{o.label}</span>
                  <span className="block text-xs text-slate-500">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="comment" className="mb-1 block text-sm font-medium">
            Góp ý thêm (không bắt buộc)
          </label>
          <textarea
            id="comment"
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="Vị trí, giá, tiện ích... anh/chị thấy thế nào?"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Đang gửi..." : "Gửi cảm nhận"}
        </button>
      </form>
    </section>
  );
}
