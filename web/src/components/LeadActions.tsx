"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RescheduleControl from "@/components/RescheduleControl";
import {
  approveLead,
  createContract,
  formatDateTime,
  formatVnd,
  getContracts,
  recordAttendance,
  setLeadStatus,
  toLocalInput,
  viewingStarted,
  type LeadDetail,
  type LostReason,
} from "@/lib/api";

const BTN = "rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60";

// Các việc nhân viên làm với một khách, tuỳ trạng thái hiện tại. Duyệt lịch vẫn do n8n xử lý (gửi email, ghi log).
export default function LeadActions({ lead, onChanged }: { lead: LeadDetail; onChanged: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  // Tiền cọc gợi ý 10% giá nhà; nhân viên sửa được
  const [deposit, setDeposit] = useState("");
  const [contractId, setContractId] = useState<number | null>(null);

  // Khách đang đặt cọc hoặc đã ký thì tìm hợp đồng của khách để dẫn link
  useEffect(() => {
    if (lead.status !== "DEPOSIT" && lead.status !== "SIGNED") return;
    let cancelled = false;
    getContracts()
      .then((rows) => {
        if (!cancelled) setContractId(rows.find((r) => r.leadId === lead.id)?.id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lead.id, lead.status]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Khung "Khách không đến": hẹn lại (chọn giờ mới) hoặc đóng
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [noShowTime, setNoShowTime] = useState("");
  // Khung "Không mua": chọn lý do
  const [loseOpen, setLoseOpen] = useState(false);
  const [loseReason, setLoseReason] = useState<LostReason>("OTHER");
  const [loseNote, setLoseNote] = useState("");

  async function run(key: string, action: () => Promise<string | void>) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      const msg = await action();
      if (msg) setMessage(msg);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setBusy(null);
    }
  }

  const viewing = lead.viewing;
  const viewingPending = viewing !== null && viewing.status === "NEW";
  const canApprove = lead.status === "NEW" && lead.automationStatus !== "PENDING" && viewingPending;
  // Ghi nhận buổi xem: khách đã chốt lịch, buổi xem chưa ghi nhận, và đã tới giờ (sớm nhất 30 phút trước giờ hẹn)
  const attendancePending = lead.status === "CONFIRMED" && viewingPending;
  const started = viewing !== null && viewingStarted(viewing.viewingTime);
  const canMarkViewed = attendancePending && started;
  // Đang cọc thì không đóng lead được: quản lý từ chối hợp đồng trước, khách tự về "Đã xem nhà" (BF-06)
  const depositing = lead.status === "DEPOSIT";
  const canLose = lead.status !== "SIGNED" && lead.status !== "LOST" && !depositing;
  // Quá giờ hẹn thì dùng "Khách không đến > Hẹn lại" để còn ghi nhận lần vắng mặt
  const canReschedule = (lead.status === "NEW" || (lead.status === "CONFIRMED" && !started)) && viewingPending;

  const canCreateContract = lead.status === "VIEWED" && lead.property !== null;
  const defaultDeposit = lead.property ? Math.round(Number(lead.property.price) * 0.1) : 0;

  const contractLink = contractId !== null && (
    <Link href={`/admin/hop-dong/${contractId}`} className={`${BTN} bg-white text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50`}>
      Xem hợp đồng
    </Link>
  );

  if (!canApprove && !attendancePending && !canLose && !canReschedule && !canCreateContract && !contractLink && !depositing)
    return null;

  return (
    <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/50 p-5">
      <h2 className="text-sm font-semibold uppercase text-slate-500">Việc cần làm</h2>
      <div className="mt-3 flex flex-wrap items-start gap-3">
        {canApprove && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              run("approve", async () => {
                const r = await approveLead(lead.id);
                return r.via === "resume"
                  ? "Đã duyệt. Email xác nhận đã gửi cho khách."
                  : "Đã gửi yêu cầu chốt lịch cho n8n. Vài giây nữa trạng thái sẽ cập nhật.";
              })
            }
            className={`${BTN} bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            {busy === "approve" ? "Đang duyệt..." : "Duyệt lịch xem"}
          </button>
        )}
        {canReschedule && lead.viewing && (
          <RescheduleControl
            viewingId={lead.viewing.id}
            currentTime={lead.viewing.viewingTime}
            confirmed={lead.status === "CONFIRMED"}
            onDone={onChanged}
          />
        )}
        {attendancePending && !started && viewing && (
          <p className="self-center text-sm text-slate-500">
            Chưa đến giờ hẹn ({formatDateTime(viewing.viewingTime)}). Nút ghi nhận khách có đến hay không sẽ hiện từ 30
            phút trước giờ hẹn.
          </p>
        )}
        {canMarkViewed && viewing && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              run("viewed", async () => {
                await recordAttendance(viewing.id, { outcome: "ATTENDED" });
                return "Đã ghi nhận khách có đến xem nhà.";
              })
            }
            className={`${BTN} bg-violet-600 text-white hover:bg-violet-700`}
          >
            {busy === "viewed" ? "Đang lưu..." : "Khách có đến"}
          </button>
        )}
        {canMarkViewed && viewing && !noShowOpen && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              setNoShowTime("");
              setNoShowOpen(true);
            }}
            className={`${BTN} bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50`}
          >
            Khách không đến
          </button>
        )}
        {canMarkViewed && viewing && noShowOpen && (
          <div className="flex flex-col gap-2 rounded-lg bg-white p-3 ring-1 ring-slate-300">
            <p className="text-sm font-medium text-slate-700">Khách không đến. Hẹn lại hay đóng?</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={noShowTime}
                min={toLocalInput(new Date().toISOString())}
                onChange={(e) => setNoShowTime(e.target.value)}
                aria-label="Giờ hẹn lại"
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  run("noshow-reschedule", async () => {
                    if (!noShowTime) throw new Error("Chọn giờ hẹn lại.");
                    if (new Date(noShowTime).getTime() < Date.now()) throw new Error("Giờ hẹn lại phải ở trong tương lai.");
                    await recordAttendance(viewing.id, {
                      outcome: "NO_SHOW",
                      next: "RESCHEDULE",
                      viewingTime: noShowTime.length === 16 ? `${noShowTime}:00` : noShowTime,
                    });
                    setNoShowOpen(false);
                    return "Đã ghi nhận khách không đến và hẹn lại. Khách sẽ nhận email báo giờ mới.";
                  })
                }
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Hẹn lại
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  if (!window.confirm("Đóng khách này với lý do: khách không đến xem?")) return;
                  run("noshow-close", async () => {
                    await recordAttendance(viewing.id, { outcome: "NO_SHOW", next: "CLOSE" });
                    setNoShowOpen(false);
                    return "Đã ghi nhận khách không đến và đóng khách.";
                  });
                }}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50 disabled:opacity-60"
              >
                Đóng (Không mua)
              </button>
              <button
                type="button"
                onClick={() => setNoShowOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Huỷ
              </button>
            </div>
          </div>
        )}
        {canCreateContract && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-amber-300">
            <input
              type="number"
              min={1}
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder={`Tiền cọc, gợi ý ${formatVnd(defaultDeposit)}`}
              aria-label="Tiền đặt cọc (VND)"
              className="w-56 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                run("contract", async () => {
                  const amount = deposit === "" ? defaultDeposit : Number(deposit);
                  if (!Number.isInteger(amount) || amount < 1) throw new Error("Tiền đặt cọc phải là số nguyên dương.");
                  const c = await createContract(lead.id, amount);
                  router.push(`/admin/hop-dong/${c.id}`);
                })
              }
              className={`${BTN} bg-amber-500 text-white hover:bg-amber-600`}
            >
              {busy === "contract" ? "Đang tạo..." : "Tạo hợp đồng đặt cọc"}
            </button>
          </div>
        )}
        {contractLink}
        {depositing && (
          <p className="self-center text-sm text-slate-500">
            Khách đang đặt cọc nên chưa chuyển sang &quot;Không mua&quot; được. Nếu khách không mua nữa, quản lý từ chối
            hợp đồng trước; khách sẽ về &quot;Đã xem nhà&quot; và căn mở bán lại.
          </p>
        )}
        {canLose && !loseOpen && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              setLoseReason("OTHER");
              setLoseNote("");
              setLoseOpen(true);
            }}
            className={`${BTN} bg-white text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50`}
          >
            Không mua
          </button>
        )}
        {canLose && loseOpen && (
          <div className="flex flex-col gap-2 rounded-lg bg-white p-3 ring-1 ring-rose-300">
            <label className="text-sm font-medium text-slate-700">
              Lý do không mua
              <select
                value={loseReason}
                onChange={(e) => setLoseReason(e.target.value as LostReason)}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="OTHER">Lý do khác</option>
                <option value="NOT_INTERESTED">Không còn nhu cầu</option>
              </select>
            </label>
            <input
              type="text"
              value={loseNote}
              onChange={(e) => setLoseNote(e.target.value)}
              placeholder="Ghi chú (không bắt buộc)"
              maxLength={300}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  run("lost", async () => {
                    await setLeadStatus(lead.id, "LOST", loseNote.trim() || "Không mua", loseReason);
                    setLoseOpen(false);
                    return "Đã chuyển khách sang Không mua.";
                  })
                }
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {busy === "lost" ? "Đang lưu..." : "Xác nhận không mua"}
              </button>
              <button
                type="button"
                onClick={() => setLoseOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Huỷ
              </button>
            </div>
          </div>
        )}
      </div>
      {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
