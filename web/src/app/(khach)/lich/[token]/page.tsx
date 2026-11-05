"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Icon } from "@/components/ui";
import {
  ApiError,
  cancelBooking,
  formatDateTime,
  getManageBooking,
  requestReschedule,
  type ManageBookingInfo,
} from "@/lib/api";

// Trang khách tự huỷ hoặc xin đổi lịch, mở từ link trong email xác nhận (/lich/<token>)
export default function ManageBookingPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Đang tải...</p>}>
      <ManageBookingContent />
    </Suspense>
  );
}

function ManageBookingContent() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [info, setInfo] = useState<ManageBookingInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<"idle" | "reschedule">("idle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"cancelled" | "requested" | null>(null);

  useEffect(() => {
    let cancelled = false;
    getManageBooking(token)
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

  async function run(action: () => Promise<unknown>, result: "cancelled" | "requested") {
    setBusy(true);
    setError(null);
    try {
      await action();
      setDone(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  }

  const box = "mx-auto max-w-xl";

  if (notFound) {
    return (
      <section className={box}>
        <p className="rounded-lg bg-slate-50 p-4 text-slate-700 ring-1 ring-slate-200">Liên kết không hợp lệ.</p>
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

  if (done) {
    return (
      <section className={box}>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <h1 className="text-xl font-bold text-emerald-800">
            {done === "cancelled" ? "Đã huỷ lịch xem nhà" : "Đã gửi yêu cầu đổi lịch"}
          </h1>
          <p className="mt-2 text-emerald-900">
            {done === "cancelled"
              ? "Cảm ơn anh/chị đã báo trước. Khi cần, anh/chị có thể đặt lịch mới bất cứ lúc nào."
              : "Nhân viên sẽ liên hệ để hẹn giờ mới. Lịch cũ vẫn giữ cho tới khi nhân viên đổi."}
          </p>
          <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">
            Xem các căn khác
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={box}>
      <h1 className="text-2xl font-bold text-slate-900">Lịch xem nhà của anh/chị</h1>
      <p className="mt-1 text-slate-600">
        Chào <b className="text-slate-900">{info.leadName}</b>, đây là lịch xem nhà đã đặt.
      </p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        {info.viewingTime && (
          <div className="flex items-center gap-3 bg-brand-600 px-5 py-4 text-white">
            <Icon name="calendar" className="h-6 w-6 shrink-0" />
            <div>
              <p className="text-xs uppercase tracking-wide text-brand-100">Giờ xem nhà</p>
              <p className="text-lg font-bold">{formatDateTime(info.viewingTime)}</p>
            </div>
          </div>
        )}
        <div className="space-y-3 p-5 text-sm text-slate-800">
          {info.propertyName && (
            <p className="flex items-start gap-3">
              <Icon name="home" className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
              <span>
                <span className="block text-xs text-slate-500">Căn nhà</span>
                <b className="text-base">{info.propertyName}</b>
              </span>
            </p>
          )}
          {info.propertyAddress && (
            <div className="flex items-start gap-3">
              <Icon name="pin" className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-slate-500">Địa chỉ</span>
                {info.propertyAddress}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(info.propertyAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex min-h-11 w-fit items-center gap-1 font-medium text-brand-600 hover:underline sm:min-h-0"
                >
                  Chỉ đường bằng Google Maps
                  <Icon name="externalLink" className="h-4 w-4" />
                </a>
              </span>
            </div>
          )}
        </div>
      </div>

      {!info.canChange ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
          {info.viewingStatus === "CANCELLED" || info.leadStatus === "LOST"
            ? "Lịch này đã được huỷ."
            : "Lịch này không còn thay đổi được qua liên kết. Vui lòng liên hệ nhân viên nếu cần hỗ trợ."}
        </p>
      ) : mode === "reschedule" ? (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <label htmlFor="note" className="block text-sm font-medium">
            Anh/chị muốn đổi sang khi nào? (không bắt buộc)
          </label>
          <textarea
            id="note"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: chiều thứ 7 hoặc sáng chủ nhật"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base sm:text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => requestReschedule(token, note), "requested")}
              className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? "Đang gửi..." : "Gửi yêu cầu đổi lịch"}
            </button>
            <button
              type="button"
              onClick={() => setMode("idle")}
              className="min-h-11 rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Quay lại
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode("reschedule")}
            className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Xin đổi lịch
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!window.confirm("Anh/chị chắc chắn muốn huỷ lịch xem nhà này?")) return;
              run(() => cancelBooking(token), "cancelled");
            }}
            className="min-h-11 rounded-lg bg-white px-4 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50 disabled:opacity-60"
          >
            {busy ? "Đang huỷ..." : "Huỷ lịch"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}
    </section>
  );
}
