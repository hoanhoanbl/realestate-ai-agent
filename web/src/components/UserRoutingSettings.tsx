"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { getMyRouting, updateUserRouting, type UserRoutingInfo } from "@/lib/api";
import { Alert, Button, INPUT } from "@/components/ui";

export default function UserRoutingSettings({ user, onUpdated }: { user?: UserRoutingInfo; onUpdated?: (value: UserRoutingInfo) => void }) {
  const id = useId();
  const [account, setAccount] = useState<UserRoutingInfo | null>(user ?? null);
  const [accepting, setAccepting] = useState(user?.acceptingLeads ?? true);
  const [telegram, setTelegram] = useState(user?.telegramChatId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (user) return;
    let active = true;
    getMyRouting().then(data => { if (active) { setAccount(data); setAccepting(data.acceptingLeads); setTelegram(data.telegramChatId ?? ""); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Không tải được cấu hình nhận khách"); });
    return () => { active = false; };
  }, [user]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!account || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const saved = await updateUserRouting(account.id, { acceptingLeads: accepting, telegramChatId: telegram.trim() || null });
      setAccount(saved); setNotice("Đã lưu cấu hình nhận khách."); onUpdated?.(saved);
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được cấu hình"); }
    finally { setBusy(false); }
  }
  if (!account) return error ? <Alert>{error}</Alert> : <p className="text-sm text-slate-500">Đang tải cấu hình nhận khách…</p>;
  return (
    <form onSubmit={submit} className="min-w-0 space-y-3 text-sm">
      {account.role === "SALE" && <label className="flex min-h-11 cursor-pointer items-center gap-3 font-medium text-slate-700" htmlFor={`${id}-accepting`}>
        <input id={`${id}-accepting`} type="checkbox" role="switch" aria-checked={accepting} checked={accepting} onChange={e => setAccepting(e.target.checked)} disabled={busy} className="h-5 w-5 accent-blue-600" />
        {accepting ? "Đang nhận khách" : "Tạm ngừng nhận khách"}
      </label>}
      <label htmlFor={`${id}-telegram`} className="block space-y-1 text-slate-700">Telegram cá nhân (không bắt buộc)
        <input id={`${id}-telegram`} value={telegram} onChange={e => setTelegram(e.target.value)} className={INPUT} inputMode="numeric" pattern="[1-9][0-9]{0,19}" maxLength={20} disabled={busy} autoComplete="off" />
      </label>
      <p className="text-xs text-slate-500">Tạm ngừng chỉ bỏ qua lượt chia mới; khách đang phụ trách vẫn giữ nguyên.</p>
      {error && <Alert>{error}</Alert>}
      {notice && <p role="status" className="text-emerald-700">{notice}</p>}
      <Button type="submit" size="sm" variant="secondary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu cấu hình"}</Button>
    </form>
  );
}
