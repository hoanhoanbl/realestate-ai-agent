// Ngày giờ luôn tính theo giờ Việt Nam, dù máy người xem đặt múi giờ nào
const TZ = "Asia/Ho_Chi_Minh";

// "2026-10-30" theo giờ Việt Nam, dùng để nhóm theo ngày
export function vnDayKey(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: TZ });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}

// "Hôm nay", "Ngày mai", "Hôm qua" hoặc "Thứ Sáu, 31/10"
export function dayLabel(iso: string): string {
  const key = vnDayKey(iso);
  const now = Date.now();
  if (key === vnDayKey(new Date(now))) return "Hôm nay";
  if (key === vnDayKey(new Date(now + 86400000))) return "Ngày mai";
  if (key === vnDayKey(new Date(now - 86400000))) return "Hôm qua";
  const text = new Date(iso).toLocaleDateString("vi-VN", { timeZone: TZ, weekday: "long", day: "2-digit", month: "2-digit" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}
