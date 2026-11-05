"use client";

import { useState } from "react";
import { rescheduleViewing, toLocalInput } from "@/lib/api";

// Nút "Đổi giờ" mở ô chọn giờ mới. Khách đã chốt lịch sẽ nhận email báo giờ mới (do n8n gửi).
export default function RescheduleControl({
  viewingId,
  currentTime,
  confirmed,
  onDone,
}: {
  viewingId: number;
  currentTime: string;
  confirmed: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!value) {
      setError("Chọn giờ mới.");
      return;
    }
    if (new Date(value).getTime() < Date.now()) {
      setError("Giờ mới phải ở trong tương lai.");
      return;
    }
    setSaving(true);
    try {
      await rescheduleViewing(viewingId, value.length === 16 ? `${value}:00` : value);
      setOpen(false);
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Đổi giờ thất bại.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(toLocalInput(currentTime));
          setOpen(true);
        }}
        className="min-h-11 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 sm:min-h-0 ring-1 ring-slate-300 hover:bg-slate-50"
      >
        Đổi giờ
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-md border border-slate-300 bg-white min-h-11 px-2 py-1.5 text-base sm:min-h-0 sm:text-sm"
      />
      {confirmed && <p className="text-xs text-slate-500">Khách sẽ nhận email báo giờ mới.</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          Hủy
        </button>
      </div>
    </div>
  );
}
