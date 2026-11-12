"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { FEEDBACK_WORK_OUTCOMES, formatDateTime, getFeedbackWork, getProperties, recordFeedbackWork, getFeedbackAlertReview, resolveFeedbackAlert,
  type FeedbackWork, type Property, type FeedbackAlertReview } from "@/lib/api";
import { useSession } from "@/lib/auth";

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const states = { PENDING: "Chưa xử lý", IN_PROGRESS: "Đang xử lý", COMPLETED: "Hoàn tất" };
const filters = { OPEN: "Việc còn mở", PENDING: "Chưa xử lý", IN_PROGRESS: "Đang xử lý", TODAY: "Đến hạn hôm nay", OVERDUE: "Quá hạn", COMPLETED: "Đã hoàn tất", ALL: "Tất cả" };
const message = (e: unknown) => e instanceof Error ? e.message : "Không xử lý được yêu cầu";
const vnIso = (value: string) => {
  if (!value) throw new Error("Vui lòng chọn đầy đủ ngày và giờ.");
  const date = new Date(`${value}+07:00`);
  if (!Number.isFinite(date.getTime())) throw new Error("Ngày giờ không hợp lệ, vui lòng chọn lại.");
  return date.toISOString();
};

function WorkForm({ work, onSaved }: { work: FeedbackWork; onSaved: () => void }) {
  const [outcome, setOutcome] = useState("CONTACTED");
  const [note, setNote] = useState("");
  const [complete, setComplete] = useState(false);
  const [due, setDue] = useState("");
  const [property, setProperty] = useState("");
  const [time, setTime] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getProperties().then(p => { if (active) setProperties(p.filter(x => x.status === "AVAILABLE")); })
      .catch(e => { if (active) setError(message(e)); });
    return () => { active = false; };
  }, []);
  const needsDate = ["NEEDS_TIME", "UNREACHABLE"].includes(outcome) || (outcome === "CONTACTED" && !complete);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError(null);
    try {
      await recordFeedbackWork(work.id, { version: work.version, outcome, note,
        ...(outcome === "CONTACTED" ? { complete } : {}),
        ...(needsDate ? { nextDueAt: vnIso(due) } : {}),
        ...(outcome === "NEXT_VIEWING" ? { propertyId: Number(property), viewingTime: vnIso(time) } : {}) });
      onSaved();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg bg-slate-50 p-3">
    <label className="block text-sm">Kết quả liên hệ
      <select className={inputClass} value={outcome} onChange={e => setOutcome(e.target.value)} disabled={busy}>
        {Object.entries(FEEDBACK_WORK_OUTCOMES).filter(([k]) => k !== "CLOSED").map(([k,v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </label>
    <label className="block text-sm">Nội dung trao đổi / lý do (bắt buộc)
      <textarea className={inputClass} required maxLength={2000} value={note} onChange={e => setNote(e.target.value)} disabled={busy} />
    </label>
    {outcome === "CONTACTED" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={complete} onChange={e => setComplete(e.target.checked)} disabled={busy} />Đã xử lý xong, không cần gọi tiếp</label>}
    {needsDate && <label className="block text-sm">Hạn liên hệ tiếp (giờ Việt Nam)
      <input className={inputClass} type="datetime-local" required value={due} onChange={e => setDue(e.target.value)} disabled={busy} />
    </label>}
    {outcome === "NEXT_VIEWING" && <>
      <label className="block text-sm">Căn nhà muốn xem tiếp<select className={inputClass} required value={property} onChange={e => setProperty(e.target.value)} disabled={busy}>
        <option value="">Chọn căn đang bán</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      <label className="block text-sm">Giờ xem (giờ Việt Nam, 08:00–19:00)<input className={inputClass} required type="datetime-local" value={time} onChange={e => setTime(e.target.value)} disabled={busy} /></label>
      <p className="text-xs text-slate-600">Lưu sẽ tạo lịch chờ duyệt, kiểm tra trùng giờ và lịch đang mở của khách. Sau đó xử lý lịch theo luồng đặt lịch hiện có.</p>
    </>}
    {outcome === "NOT_BUYING" && <p className="text-sm text-rose-700">Lưu sẽ đóng khách với lý do không còn nhu cầu và hủy lịch đang chờ. Hợp đồng còn hiệu lực phải được xử lý trước.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy}>{busy ? "Đang lưu…" : outcome === "NEXT_VIEWING" ? "Tạo lịch và hoàn tất việc" : "Lưu kết quả"}</button>
  </form>;
}

function WorkCard({ work, onSaved }: { work: FeedbackWork; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const closed = work.status === "COMPLETED" || ["LOST", "SIGNED"].includes(work.leadStatus);
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 [overflow-wrap:anywhere]">
    <div className="flex flex-wrap justify-between gap-2">
      <Link href={`/admin/leads/${work.leadId}`} className="font-semibold text-blue-700">{work.leadName} · Việc #{work.id}</Link>
      <span className={work.overdue ? "text-sm font-semibold text-red-700" : "text-sm text-slate-600"}>{work.overdue ? "Quá hạn · " : ""}{states[work.status]}</span>
    </div>
    <p className="mt-2 text-sm">{work.propertyName ?? "Chưa xác định căn của phản hồi cũ"}{work.viewingTime ? ` · ${formatDateTime(work.viewingTime)}` : ""}</p>
    <p className="mt-1 text-sm text-slate-600">Sale: {work.assignedUserName ?? "Chưa phân công"} · Hạn: {formatDateTime(work.dueAt)}</p>
    <p className="mt-2 text-sm">{work.rating}/5 · {({ DEPOSIT: "Muốn đặt cọc", OTHER: "Muốn xem căn khác", NONE: "Không quan tâm" } as Record<string,string>)[work.interest] ?? work.interest}</p>
    <p className="mt-1 whitespace-pre-wrap text-sm">{work.comment || "Khách không ghi thêm nhận xét."}</p>
    {work.aiSummary && <p className="mt-2 text-sm text-slate-600">AI tóm tắt: {work.aiSummary}</p>}
    {!closed && <button className="mt-3 text-sm font-medium text-blue-700" onClick={() => setEditing(v => !v)}>{editing ? "Đóng biểu mẫu" : "Ghi kết quả liên hệ"}</button>}
    {editing && !closed && <WorkForm key={work.version} work={work} onSaved={() => { setEditing(false); onSaved(); }} />}
    {!!work.history.length && <details className="mt-3 text-sm"><summary className="cursor-pointer text-slate-700">Lịch sử xử lý ({work.history.length})</summary>
      <ol className="mt-2 space-y-3 border-l border-slate-200 pl-3">{work.history.map(h => <li key={h.id}>
        <p className="font-medium">{FEEDBACK_WORK_OUTCOMES[h.outcome] ?? h.outcome} · {h.actorName}</p>
        <p className="text-xs text-slate-500">{formatDateTime(h.createdAt)}</p><p className="whitespace-pre-wrap">{h.note}</p>
        {h.nextDueAt && <p>Gọi tiếp: {formatDateTime(h.nextDueAt)}</p>}{h.nextViewingId && <p>Đã tạo buổi xem #{h.nextViewingId}</p>}
      </li>)}</ol>
    </details>}
  </article>;
}

function AlertReview() {
  const [rows, setRows] = useState<FeedbackAlertReview[]>([]);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    getFeedbackAlertReview().then(r => { if (active) setRows(r); }).catch(e => { if (active) setError(message(e)); });
    return () => { active = false; };
  }, [revision]);
  async function resolve(e: FormEvent<HTMLFormElement>, id: number) {
    e.preventDefault(); if (busy) return;
    const data = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    try { await resolveFeedbackAlert(id, data.get('delivered') === 'yes', String(data.get('note'))); setRevision(v => v+1); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <div className="mt-5">{error && <p role="alert" className="text-red-700">{error}</p>}{rows.length > 0 && <details className="rounded-xl border border-amber-300 p-4"><summary className="cursor-pointer font-medium">Thông báo cần đối soát ({rows.length})</summary>
    <p className="mt-2 text-sm">Kiểm tra lịch sử gửi trên nhà cung cấp trước khi xác nhận. Hệ thống đang giữ các lần gửi chưa rõ kết quả để tránh gửi trùng.</p>
    {rows.map(r => <form key={r.id} onSubmit={e => resolve(e, r.id)} className="mt-3 space-y-2 border-t pt-3">
      <p className="text-sm">Thông báo #{r.id}, việc #{r.workId}, {r.kind}: {r.error || "Lần gửi bị gián đoạn"}</p>
      <label className="block text-sm">Kết quả kiểm tra<select className={inputClass} name="delivered"><option value="yes">Đã gửi thành công</option><option value="no">Xác nhận chưa gửi, cho phép thử lại</option></select></label>
      <label className="block text-sm">Bằng chứng / lý do<input className={inputClass} name="note" required maxLength={500} /></label>
      <button disabled={busy} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Lưu đối soát</button>
    </form>)}
  </details>}</div>;
}

export default function FeedbackWorkPanel({ leadId, ownerId, onChanged }: { leadId?: number; ownerId?: number | null; onChanged?: () => void }) {
  const session = useSession();
  const allowed = !!session && (session.user.role === "MANAGER" || !leadId || session.user.id === ownerId);
  const [filter, setFilter] = useState("OPEN");
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<FeedbackWork[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    const load = () => getFeedbackWork(filter, leadId).then(r => { if (active) { setRows(r); setError(null); } })
      .catch(e => { if (active) setError(message(e)); });
    void load(); const timer = setInterval(load, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [allowed, filter, leadId, revision, session?.user.id]);
  if (!allowed) return null;
  return <section className="mt-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Theo dõi sau phản hồi</h2>
      {!leadId && <label className="text-sm">Lọc công việc<select className={inputClass} value={filter} onChange={e => { setRows(null); setFilter(e.target.value); }}>
        {Object.entries(filters).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
      </select></label>}
    </div>
    <p className="mt-1 text-sm text-slate-500">Giờ Việt Nam · tự cập nhật mỗi 15 giây. Nhắc khi quá hạn; báo quản lý sau thêm 2 giờ làm việc.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {rows === null && !error && <p className="mt-3 text-sm">Đang tải công việc…</p>}
    {rows?.length === 0 && <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Chưa có công việc phù hợp.</p>}
    <div className="mt-3 grid gap-3">{rows?.map(w => <WorkCard key={`${w.id}:${w.version}`} work={w} onSaved={() => { setRevision(v => v+1); onChanged?.(); }} />)}</div>
    {rows && rows.length >= 200 && <p className="mt-2 text-sm">Đang hiển thị tối đa 200 việc. Dùng bộ lọc hoặc mở hồ sơ khách để xem cụ thể.</p>}
    {!leadId && session?.user.role === "MANAGER" && <AlertReview />}
  </section>;
}
