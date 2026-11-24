"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useSession } from "@/lib/auth";
import { CONTACT_ATTEMPT_OPTIONS, markLeadContacted, recordLeadContactAttempt, type ContactAttemptResult, type LeadDetail } from "@/lib/api";

interface Props {
  leadId: number;
  contactedAt: string | null;
  canEdit: boolean;
  onMarkContacted: () => Promise<{ contactedAt: string }>;
  onRecordAttempt: (result: ContactAttemptResult) => Promise<unknown>;
}

const BUTTON = "min-h-11 rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60";

export default function LeadContactPanel(props: Props) {
  // Changing customer resets the form and feedback, including an in-flight action's UI.
  return <ContactPanel key={props.leadId} {...props} />;
}

export function LeadContactSection({ lead, onChanged }: { lead: LeadDetail; onChanged: () => void }) {
  const session = useSession();
  const canEdit = lead.status !== "LOST" && lead.status !== "SIGNED" &&
    (session?.user.role === "MANAGER" || session?.user.id === lead.assignedUserId);
  return (
    <div className="mt-5">
      <LeadContactPanel
        key={`${lead.id}:${lead.assignedUserId}`}
        leadId={lead.id}
        contactedAt={lead.contactedAt ?? null}
        canEdit={canEdit}
        onMarkContacted={async () => {
          const saved = await markLeadContacted(lead.id);
          onChanged();
          return { contactedAt: saved.contactedAt };
        }}
        onRecordAttempt={async result => {
          await recordLeadContactAttempt(lead.id, result);
          onChanged();
        }}
      />
    </div>
  );
}

function ContactPanel({ contactedAt, canEdit, onMarkContacted, onRecordAttempt }: Props) {
  const id = useId();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState<"contact" | "attempt" | null>(null);
  const [result, setResult] = useState<ContactAttemptResult>("NO_ANSWER");
  const [savedContactAt, setSavedContactAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reachedAt = contactedAt ?? savedContactAt;

  async function run(action: "contact" | "attempt") {
    // Ref also stops a second click before React has rendered disabled buttons.
    if (inFlight.current || !canEdit || (action === "contact" && reachedAt)) return;
    inFlight.current = true;
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      if (action === "contact") {
        const response = await onMarkContacted();
        setSavedContactAt(response.contactedAt);
        setMessage("Đã ghi nhận liên hệ được với khách.");
      } else {
        await onRecordAttempt(result);
        setMessage("Đã ghi lần gọi. Thao tác này không đánh dấu khách đã liên hệ được.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Chưa lưu được kết quả liên hệ. Vui lòng thử lại.");
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void run("attempt");
  }

  return (
    <section aria-labelledby={`${id}-title`} aria-busy={busy !== null} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 id={`${id}-title`} className="text-sm font-semibold uppercase text-slate-500">Liên hệ khách</h2>
      <p className="mt-3 text-sm text-slate-700">
        {reachedAt ? <>Đã liên hệ được: <time dateTime={reachedAt}>{new Date(reachedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</time>.</> : "Chưa ghi nhận liên hệ được với khách."}
      </p>
      {canEdit ? (
        <div className="mt-3 space-y-4">
          {!reachedAt && (
            <div className="space-y-2">
              <button type="button" disabled={busy !== null} onClick={() => void run("contact")} className={`${BUTTON} bg-emerald-600 text-white hover:bg-emerald-700`}>
                {busy === "contact" ? "Đang lưu…" : "Đã liên hệ được"}
              </button>
              <p className="text-xs text-slate-500">Chỉ ghi nhận khi đã nói chuyện được với khách.</p>
            </div>
          )}
          <form onSubmit={submit} className="space-y-2 border-t border-slate-100 pt-3">
            <label htmlFor={`${id}-result`} className="block text-sm font-medium text-slate-700">Ghi lần gọi chưa liên hệ được</label>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <select id={`${id}-result`} value={result} disabled={busy !== null} onChange={e => setResult(e.target.value as ContactAttemptResult)} className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 sm:flex-1">
                {CONTACT_ATTEMPT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <button type="submit" disabled={busy !== null} className={`${BUTTON} bg-blue-600 text-white hover:bg-blue-700`}>
                {busy === "attempt" ? "Đang lưu…" : "Lưu lần gọi"}
              </button>
            </div>
            <p className="text-xs text-slate-500">Lưu vào lịch sử, không tự đóng hồ sơ hoặc đặt hạn gọi tiếp.</p>
          </form>
        </div>
      ) : <p className="mt-3 text-sm text-slate-500">Người phụ trách hoặc quản lý có thể ghi nhận liên hệ cho hồ sơ đang mở.</p>}
      {message && <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}
      {error && <p role="alert" className="mt-3 break-words text-sm text-red-700">{error}</p>}
    </section>
  );
}
