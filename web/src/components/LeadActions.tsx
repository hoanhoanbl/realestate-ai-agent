"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RescheduleControl from "@/components/RescheduleControl";
import { approveLead, createContract, formatVnd, getContracts, setLeadStatus, type LeadDetail } from "@/lib/api";

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

  const canApprove = lead.status === "NEW" && lead.automationStatus !== "PENDING";
  const canMarkViewed = lead.status === "CONFIRMED";
  const canLose = lead.status !== "SIGNED" && lead.status !== "LOST";
  const canReschedule = (lead.status === "NEW" || lead.status === "CONFIRMED") && lead.viewing;

  const canCreateContract = lead.status === "VIEWED" && lead.property !== null;
  const defaultDeposit = lead.property ? Math.round(Number(lead.property.price) * 0.1) : 0;

  const contractLink = contractId !== null && (
    <Link href={`/admin/hop-dong/${contractId}`} className={`${BTN} bg-white text-blue-700 ring-1 ring-blue-300 hover:bg-blue-50`}>
      Xem hợp đồng
    </Link>
  );

  if (!canApprove && !canMarkViewed && !canLose && !canReschedule && !canCreateContract && !contractLink) return null;

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
        {canMarkViewed && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("viewed", async () => { await setLeadStatus(lead.id, "VIEWED"); return "Đã đánh dấu khách đã xem nhà."; })}
            className={`${BTN} bg-violet-600 text-white hover:bg-violet-700`}
          >
            Đã xem nhà
          </button>
        )}
        {canMarkViewed && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              if (!window.confirm("Khách không đến xem? Khách sẽ chuyển sang 'Không mua'.")) return;
              run("noshow", async () => { await setLeadStatus(lead.id, "LOST", "Khách không đến"); return "Đã ghi nhận khách không đến."; });
            }}
            className={`${BTN} bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50`}
          >
            Khách không đến
          </button>
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
        {canLose && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              if (!window.confirm("Đánh dấu khách này không mua?")) return;
              run("lost", async () => { await setLeadStatus(lead.id, "LOST", "Mất khách"); return "Đã đánh dấu mất khách."; });
            }}
            className={`${BTN} bg-white text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50`}
          >
            Mất khách
          </button>
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
