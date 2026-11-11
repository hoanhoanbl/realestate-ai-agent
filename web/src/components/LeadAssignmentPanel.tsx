"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { addLeadNote, formatDateTime, getAssignees, reassignLead, type AssigneeOption, type LeadDetail } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { Alert, Button, CARD, INPUT } from "@/components/ui";

export default function LeadAssignmentPanel({ lead, onChanged }: { lead: LeadDetail; onChanged: () => void }) {
  const session = useSession();
  const id = useId();
  const manager = session?.user.role === "MANAGER";
  const canNote = manager || session?.user.id === lead.assignedUserId;
  const [options, setOptions] = useState<AssigneeOption[]>([]);
  const [assignee, setAssignee] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!manager) return;
    let active = true;
    getAssignees().then(data => { if (active) setOptions(data); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Không tải được danh sách nhân viên"); });
    return () => { active = false; };
  }, [manager]);
  async function save(e: FormEvent, kind: "assignment" | "note") {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      if (kind === "assignment") {
        await reassignLead(lead.id, Number(assignee), reason.trim() || undefined);
        setAssignee(""); setReason(""); setNotice("Đã cập nhật người phụ trách và hạn phản hồi.");
      } else {
        await addLeadNote(lead.id, note.trim()); setNote(""); setNotice("Đã lưu ghi chú vào dòng thời gian.");
      }
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được thay đổi"); }
    finally { setBusy(false); }
  }
  return (
    <section className={`mt-5 space-y-4 p-4 sm:p-5 ${CARD}`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="font-semibold text-slate-900">Người phụ trách và ghi chú</h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-slate-500">Người phụ trách</dt><dd className="mt-1 font-medium text-slate-900">{lead.assignedUser?.name ?? (lead.assignedUserId ? `Nhân viên #${lead.assignedUserId}` : "Chưa phân công")}</dd></div>
        <div><dt className="text-slate-500">Nhận khách lúc</dt><dd className="mt-1">{lead.assignedAt ? formatDateTime(lead.assignedAt) : "Chưa có phiên nhận khách"}</dd></div>
        <div><dt className="text-slate-500">Phản hồi đầu tiên</dt><dd className="mt-1">{lead.firstResponseAt ? formatDateTime(lead.firstResponseAt) : lead.responseDueAt ? `Hạn ${formatDateTime(lead.responseDueAt)}` : "Chưa có hạn"}</dd></div>
      </dl>
      {error && <Alert>{error}</Alert>}
      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
      {manager && (
        <form onSubmit={e => save(e, "assignment")} className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-slate-700" htmlFor={`${id}-assignee`}>Chuyển người phụ trách
            <select id={`${id}-assignee`} className={INPUT} value={assignee} onChange={e => setAssignee(e.target.value)} required disabled={busy}>
              <option value="">Chọn nhân viên</option>
              {options.map(u => <option key={u.id} value={u.id} disabled={u.role === "SALE" && !u.acceptingLeads}>{u.name}{!u.acceptingLeads && u.role === "SALE" ? " — Tạm ngừng nhận khách" : ""}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700" htmlFor={`${id}-reason`}>Lý do chuyển (không bắt buộc)
            <input id={`${id}-reason`} className={INPUT} value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} disabled={busy} />
          </label>
          <div className="sm:col-span-2"><Button type="submit" variant="secondary" disabled={busy || !assignee || Number(assignee) === lead.assignedUserId}>{busy ? "Đang lưu…" : "Chuyển người phụ trách"}</Button></div>
        </form>
      )}
      {canNote ? (
        <form onSubmit={e => save(e, "note")} className="space-y-2 border-t border-slate-100 pt-4">
          <label htmlFor={`${id}-note`} className="text-sm font-medium text-slate-700">Ghi chú kết quả liên hệ</label>
          <textarea id={`${id}-note`} className={`${INPUT} min-h-24`} value={note} onChange={e => setNote(e.target.value)} maxLength={5000} required disabled={busy} placeholder="Ví dụ: Đã gọi, khách muốn xem vào thứ Bảy." />
          <Button type="submit" disabled={busy || !note.trim()}>{busy ? "Đang lưu…" : "Lưu ghi chú"}</Button>
        </form>
      ) : <p className="text-sm text-slate-500">Người phụ trách và quản lý có thể ghi chú kết quả liên hệ.</p>}
    </section>
  );
}
