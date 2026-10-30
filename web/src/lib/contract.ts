// Mã hợp đồng hiển thị: 9 -> "HD-0009"
export function contractCode(id: number): string {
  return `HD-${String(id).padStart(4, "0")}`;
}
