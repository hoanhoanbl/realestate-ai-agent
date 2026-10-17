"use client";

import { useState } from "react";
import RescheduleControl from "@/components/RescheduleControl";
import { approveLead, setLeadStatus, type LeadDetail } from "@/lib/api";

const BTN = "rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60";

// Các việc nhân viên làm với một khách, tuỳ trạng thái hiện tại. Duyệt lịch vẫn do n8n xử lý (gửi email, ghi log).
export default function LeadActions({ lead, onChanged }: { lead: LeadDetail; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
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

  if (!canApprove && !canMarkViewed && !canLose && !canReschedule) return null;

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
