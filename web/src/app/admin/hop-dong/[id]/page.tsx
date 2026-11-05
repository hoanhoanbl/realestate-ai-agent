"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import ContractDocument from "@/components/ContractDocument";
import ContractStatusBadge from "@/components/ContractStatusBadge";
import { Icon, buttonClass } from "@/components/ui";
import {
  ApiError,
  approveContract,
  formatDateTime,
  formatVnd,
  getContract,
  markDepositReceived,
  rejectContract,
  type ContractDetail,
} from "@/lib/api";
import { useSession } from "@/lib/auth";
import { contractCode } from "@/lib/contract";

const POLL_MS = 4000;

const RISK_STYLE: Record<string, string> = {
  LOW: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  MEDIUM: "bg-amber-50 text-amber-800 ring-amber-200",
  HIGH: "bg-rose-50 text-rose-800 ring-rose-200",
};

function parseReview(raw: string | null): { riskLevel: string; notes: string[]; aiUsed: boolean } | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// useParams() cần nằm trong Suspense vì `id` chỉ biết lúc người dùng mở trang
export default function ContractDetailPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Đang tải...</p>}>
      <ContractDetailContent />
    </Suspense>
  );
}

function ContractDetailContent() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const invalidId = !Number.isInteger(id) || id <= 0;
  const session = useSession();

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (invalidId) return;
    let cancelled = false;
    function load() {
      getContract(id)
        .then((data) => {
          if (cancelled) return;
          setContract(data);
          setError(null);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          if (e instanceof ApiError && e.status === 404) setNotFound(true);
          else setError(e instanceof Error ? e.message : "Lỗi không xác định.");
        });
    }
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, invalidId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  async function act(run: () => Promise<unknown>, okMessage: string) {
    setBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      await run();
      setMessage(okMessage);
      setRejecting(false);
      reload();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Link href="/admin/hop-dong" className="text-sm text-brand-600 hover:underline">
      ← Danh sách hợp đồng
    </Link>
  );

  if (invalidId || notFound) {
    return (
      <section>
        {back}
        <p className="mt-6 rounded-lg bg-slate-50 p-4 text-slate-700 ring-1 ring-slate-200">Không tìm thấy hợp đồng.</p>
      </section>
    );
  }
  if (error) {
    return (
      <section>
        {back}
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>
      </section>
    );
  }
  if (!contract) return <p className="text-slate-500">Đang tải...</p>;

  const isManager = session?.user.role === "MANAGER";
  const review = parseReview(contract.aiReview);

  return (
    <section>
      {back}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {contractCode(contract.id)} · {contract.lead?.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ContractStatusBadge status={contract.status} />
            <span className="text-sm text-slate-500">
              Tiền cọc {formatVnd(contract.depositAmount)} / giá {formatVnd(contract.propertyPrice)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {contract.lead && (
            <Link href={`/admin/leads/${contract.lead.id}`} className={buttonClass("ghost", "sm")}>
              Hồ sơ khách →
            </Link>
          )}
          {contract.content && (
            <Link href={`/admin/hop-dong/${contract.id}/in`} target="_blank" className={buttonClass("secondary", "sm")}>
              <Icon name="printer" className="h-4 w-4" />
              {contract.status === "SIGNED" ? "In / Lưu PDF" : "Xem bản in"}
            </Link>
          )}
        </div>
      </div>

      {contract.status === "DRAFTING" && (
        <p className="mt-5 rounded-lg bg-slate-50 p-4 text-slate-600 ring-1 ring-slate-200">
          n8n đang soạn hợp đồng và nhờ AI rà soát. Trang tự cập nhật, thường mất khoảng 30 giây.
        </p>
      )}

      {contract.status === "PENDING_APPROVAL" && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-5">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Cần quản lý duyệt</h2>
          {isManager ? (
            <>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(() => approveContract(contract.id), "Đã duyệt. n8n đã gửi hợp đồng cho khách ký.")}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy ? "Đang xử lý..." : "Duyệt và gửi khách ký"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRejecting((v) => !v)}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50"
                >
                  Từ chối
                </button>
              </div>
              {rejecting && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    maxLength={300}
                    placeholder="Lý do từ chối (bắt buộc)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={busy || !reason.trim()}
                    onClick={() => act(() => rejectContract(contract.id, reason.trim()), "Đã từ chối hợp đồng. Nhân viên đã được báo.")}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    Xác nhận từ chối
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Chỉ quản lý được duyệt hợp đồng. Quản lý đã nhận email có nút duyệt.</p>
          )}
          {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
          {actionError && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 ring-1 ring-red-200">{actionError}</p>
          )}
        </div>
      )}

      {contract.status === "SENT" && contract.signUrl && (
        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/60 p-5 text-sm">
          <p>
            Đã gửi email cho khách{contract.expiresAt && <>, link có hiệu lực đến {formatDateTime(contract.expiresAt)}</>}. Duyệt bởi{" "}
            <b>{contract.approvedBy}</b>.
          </p>
          <p className="mt-2 break-all text-xs text-slate-600">
            Link ký (để hỗ trợ khách khi cần):{" "}
            <a href={contract.signUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">
              {contract.signUrl}
            </a>
          </p>
        </div>
      )}

      {(contract.status === "REJECTED" || contract.status === "EXPIRED") && (
        <p className="mt-5 rounded-lg bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200">
          {contract.status === "REJECTED" ? "Bị từ chối" : "Hết hạn"}: {contract.rejectReason ?? "-"}. Khách đã được đưa về &quot;Đã xem nhà&quot;, bạn có thể tạo hợp đồng mới.
        </p>
      )}

      {contract.status === "SIGNED" && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 text-sm">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Đã ký</h2>
          <p className="mt-2">
            Người ký: <b>{contract.signerName}</b> · {contract.signedAt && formatDateTime(contract.signedAt)} · IP {contract.signedIp ?? "-"}
          </p>
          <p className="text-xs text-slate-500">Duyệt bởi {contract.approvedBy}</p>
          {contract.signature && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={contract.signature} alt="Chữ ký của khách" className="mt-3 h-24 rounded border border-slate-200 bg-white p-1" />
          )}
          <div className="mt-4 border-t border-emerald-200 pt-3">
            {contract.depositReceivedAt ? (
              <p>
                Đã nhận tiền cọc {formatVnd(contract.depositAmount)} lúc {formatDateTime(contract.depositReceivedAt)}
                {contract.depositReceivedBy && <> (xác nhận bởi {contract.depositReceivedBy})</>}
              </p>
            ) : isManager ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`Xác nhận đã nhận tiền cọc ${formatVnd(contract.depositAmount)}?`)) return;
                  act(() => markDepositReceived(contract.id), "Đã ghi nhận đã nhận tiền cọc.");
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Đã nhận tiền cọc
              </button>
            ) : (
              <p className="text-slate-600">Chưa xác nhận nhận tiền cọc (quản lý xác nhận).</p>
            )}
            {message && <p className="mt-2 text-emerald-700">{message}</p>}
            {actionError && (
              <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-red-700 ring-1 ring-red-200">{actionError}</p>
            )}
          </div>
        </div>
      )}

      {review && (
        <div className={`mt-5 rounded-xl p-5 text-sm ring-1 ${RISK_STYLE[review.riskLevel] ?? RISK_STYLE.LOW}`}>
          <h2 className="text-sm font-semibold uppercase">
            Rà soát tự động: mức {review.riskLevel}
            {!review.aiUsed && " (AI không khả dụng, chỉ kiểm tra bằng quy tắc)"}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {review.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {contract.content && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Toàn văn hợp đồng</h2>
          <div className="overflow-x-auto rounded-xl bg-slate-100 p-3 sm:p-6">
            <ContractDocument
              data={{
                id: contract.id,
                content: contract.content,
                status: contract.status,
                approvedBy: contract.approvedBy,
                signerName: contract.signerName,
                signature: contract.signature,
                signedAt: contract.signedAt,
                signedIp: contract.signedIp,
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
