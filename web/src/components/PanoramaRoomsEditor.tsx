"use client";

import { useMemo, useState } from "react";
import Panorama360 from "@/components/Panorama360";
import { Button, INPUT } from "@/components/ui";
import type { PanoramaRoom } from "@/lib/api";

// Khớp giới hạn của backend (MAX_PANORAMA_ROOMS)
export const MAX_PANORAMA_ROOMS = 10;

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Bỏ dòng trống cả hai ô, cắt khoảng trắng. Dùng khi lưu và khi xem thử
export function cleanRooms(rows: PanoramaRoom[]): PanoramaRoom[] {
  return rows
    .map((r) => ({ title: r.title.trim(), url: r.url.trim() }))
    .filter((r) => r.title !== "" || r.url !== "");
}

// Trả câu báo lỗi đầu tiên, hoặc null nếu hợp lệ
export function validateRooms(rows: PanoramaRoom[]): string | null {
  const rooms = cleanRooms(rows);
  if (rooms.length > MAX_PANORAMA_ROOMS) return `Tối đa ${MAX_PANORAMA_ROOMS} phòng 360°.`;
  for (const [i, r] of rooms.entries()) {
    if (!r.title) return `Phòng 360° thứ ${i + 1}: nhập tên phòng.`;
    if (!isHttpUrl(r.url)) return `Phòng 360° "${r.title}": link ảnh phải bắt đầu bằng http:// hoặc https://`;
  }
  return null;
}

export default function PanoramaRoomsEditor({
  value,
  onChange,
}: {
  value: PanoramaRoom[];
  onChange: (rows: PanoramaRoom[]) => void;
}) {
  // Chụp danh sách lúc bấm "Xem thử" để gõ tiếp không làm tải lại ảnh
  const [preview, setPreview] = useState<PanoramaRoom[] | null>(null);
  // Chỉ xem thử các dòng đã đủ tên và link hợp lệ
  const previewRooms = useMemo(() => cleanRooms(value).filter((r) => r.title && isHttpUrl(r.url)), [value]);

  function update(i: number, patch: Partial<PanoramaRoom>) {
    onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="mt-2 border-t border-brand-100 pt-4 sm:col-span-2">
      <p className="mb-1 text-sm font-semibold text-slate-900">Ảnh 360° theo phòng</p>
      <p className="mb-2 text-xs text-slate-500">
        Mỗi phòng một ảnh toàn cảnh tỉ lệ 2:1 (chụp bằng chế độ 360° của điện thoại hoặc camera 360°), nên dưới 3 MB. Máy
        chủ chứa ảnh phải cho web khác tải ảnh; bấm &quot;Xem thử&quot; để kiểm tra trước khi lưu. Không có phòng nào thì
        trang khách chỉ hiện ảnh thường.
      </p>

      <div className="space-y-2">
        {value.map((r, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
            <input
              aria-label={`Tên phòng ${i + 1}`}
              placeholder="Tên phòng, ví dụ Phòng khách"
              maxLength={50}
              className={INPUT}
              value={r.title}
              onChange={(e) => update(i, { title: e.target.value })}
            />
            <input
              aria-label={`Link ảnh 360° phòng ${i + 1}`}
              type="url"
              placeholder="https://..."
              className={INPUT}
              value={r.url}
              onChange={(e) => update(i, { url: e.target.value })}
            />
            <Button variant="ghost" size="sm" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              Xoá
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={value.length >= MAX_PANORAMA_ROOMS}
          onClick={() => onChange([...value, { title: "", url: "" }])}
        >
          + Thêm phòng
        </Button>
        {(preview || previewRooms.length > 0) && (
          <Button variant="ghost" size="sm" onClick={() => setPreview(preview ? null : previewRooms)}>
            {preview ? "Đóng xem thử" : "Xem thử"}
          </Button>
        )}
      </div>

      {preview && preview.length > 0 && <Panorama360 rooms={preview} className="mt-3 aspect-[16/9] rounded-lg" />}
    </div>
  );
}
