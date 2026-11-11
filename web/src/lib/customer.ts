import { SOURCE_LABELS } from "@/lib/api";

// Chuẩn hoá số điện thoại giống backend (backend/src/leads/intake-rules.ts#normalizePhone):
// bỏ dấu cách, chấm, gạch, ngoặc; "+84" đầu số thành "0"; hợp lệ khi còn 8–15 chữ số.
// Chỉ dùng để quyết định khi nào tra trùng trên form; backend vẫn là nơi kiểm tra cuối cùng.
export function normalizePhoneInput(value: string): string | null {
  if (!/^[+\d\s.()-]+$/.test(value)) return null;
  const phone = value.replace(/[\s.()-]/g, "").replace(/^\+84/, "0");
  return /^\d{8,15}$/.test(phone) ? phone : null;
}

// Nguồn khách khi nhân viên nhập tay (docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md mục 1.1)
export const MANUAL_SOURCES = ["hotline", "property_sign", "walk_in", "personal_zalo", "referral", "other"] as const;
export type ManualSource = (typeof MANUAL_SOURCES)[number];

export function manualSourceLabel(source: ManualSource): string {
  return source === "referral" ? "Người quen giới thiệu" : SOURCE_LABELS[source];
}
