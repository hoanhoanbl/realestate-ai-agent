"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import SignaturePad, { type SignaturePadHandle } from "@/components/SignaturePad";
import { ApiError, formatDateTime, formatVnd, getSignInfo, submitSignature, type SignInfo } from "@/lib/api";

// useParams() cần nằm trong Suspense vì `token` chỉ biết lúc người dùng mở trang
export default function SignPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Đang tải...</p>}>
      <SignContent />
    </Suspense>
  );
}

function SignContent() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const padRef = useRef<SignaturePadHandle>(null);

  const [info, setInfo] = useState<SignInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSignInfo(token)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setLoadError(e instanceof Error ? e.message : "Không tải được hợp đồng.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!signerName.trim()) return setError("Vui lòng nhập họ tên đầy đủ.");
    const signature = padRef.current?.toDataUrl();
    if (!signature) return setError("Vui lòng ký vào ô chữ ký.");
    if (!agree) return setError("Vui lòng tick xác nhận đã đọc và đồng ý.");
    setSubmitting(true);
    try {
      await submitSignature(token, { signerName: signerName.trim(), signature, agree: true });
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ký thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  const box = "mx-auto max-w-2xl";
  const notice = (tone: "slate" | "emerald" | "amber", title: string, text?: string) => (
    <section className={box}>
      <div
        className={`rounded-xl border p-6 ${
          tone === "emerald" ? "border-emerald-200 bg-emerald-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"
        }`}
      >
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {text && <p className="mt-2 text-slate-700">{text}</p>}
        <Link href="/" className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
          Về trang chủ
        </Link>
      </div>
    </section>
  );

  if (notFound) return notice("slate", "Liên kết không hợp lệ", "Liên kết ký này không tồn tại hoặc đã bị thay đổi.");
  if (loadError) {
    return (
      <section className={box}>
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{loadError}</p>
      </section>
    );
  }
  if (!info) return <p className="text-slate-500">Đang tải...</p>;

  if (done) return notice("emerald", "Đã ký thành công", "Cảm ơn anh/chị. Chúng tôi đã gửi email xác nhận, nhân viên sẽ liên hệ hướng dẫn bước tiếp theo.");
  if (info.status === "SIGNED") {
    return notice("emerald", "Hợp đồng này đã được ký", info.signedAt ? `Ký bởi ${info.signerName} lúc ${formatDateTime(info.signedAt)}.` : undefined);
  }
  if (info.status === "EXPIRED") return notice("amber", "Liên kết đã hết hạn", "Vui lòng liên hệ nhân viên để được gửi hợp đồng mới.");
  if (info.status !== "SENT") return notice("slate", "Hợp đồng chưa sẵn sàng để ký", "Hợp đồng này không còn hiệu lực. Vui lòng liên hệ nhân viên.");

  return (
    <section className={box}>
      <h1 className="text-2xl font-bold text-slate-900">{info.title ?? "Hợp đồng đặt cọc"}</h1>
      <p className="mt-1 text-sm text-slate-600">
        Chào <b>{info.customerName}</b>. Tiền đặt cọc <b>{formatVnd(info.depositAmount)}</b>
        {info.expiresAt && <>, liên kết có hiệu lực đến {formatDateTime(info.expiresAt)}</>}.
      </p>

      <div className="mt-5 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">{info.content}</pre>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-6" noValidate>
        <div>
          <label htmlFor="signer" className="mb-1 block text-sm font-medium">
            Họ tên đầy đủ của người ký
          </label>
          <input
            id="signer"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            autoComplete="name"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium">Chữ ký</span>
            <button type="button" onClick={() => padRef.current?.clear()} className="text-xs text-blue-600 hover:underline">
              Xoá, ký lại
            </button>
          </div>
          <SignaturePad ref={padRef} />
          <p className="mt-1 text-xs text-slate-500">Dùng chuột hoặc ngón tay để ký.</p>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
          Tôi đã đọc kỹ toàn bộ nội dung hợp đồng và đồng ý ký.
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Đang gửi..." : "Ký hợp đồng"}
        </button>
      </form>
    </section>
  );
}
