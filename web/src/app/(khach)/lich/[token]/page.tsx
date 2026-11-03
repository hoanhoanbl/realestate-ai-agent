"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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
          <Link href="/" className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">
            Xem các căn khác
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={box}>
      <h1 className="text-2xl font-bold text-slate-900">Lịch xem nhà của anh/chị</h1>
      <div className="mt-4 space-y-1 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-800">
        <p>
          Khách hàng: <b>{info.leadName}</b>
        </p>
        {info.propertyName && (
          <p>
            Căn nhà: <b>{info.propertyName}</b>
          </p>
        )}
        {info.propertyAddress && <p>Địa chỉ: {info.propertyAddress}</p>}
        {info.viewingTime && (
          <p>
            Thời gian: <b>{formatDateTime(info.viewingTime)}</b>
          </p>
        )}
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => requestReschedule(token, note), "requested")}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? "Đang gửi..." : "Gửi yêu cầu đổi lịch"}
            </button>
            <button
              type="button"
              onClick={() => setMode("idle")}
              className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
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
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
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
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50 disabled:opacity-60"
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
