import type { Property } from "@/lib/api";

export const TYPE_LABELS: Record<string, string> = {
  APARTMENT: "Căn hộ",
  TOWNHOUSE: "Nhà phố",
  VILLA: "Biệt thự",
  SHOPHOUSE: "Shophouse",
  LAND: "Đất nền",
};

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

// Backend chưa có cột thành phố nên suy ra từ địa chỉ
const CITIES = ["TP.HCM", "Hà Nội", "Đà Nẵng", "Phú Quốc"];

export function cityOf(address: string): string {
  return CITIES.find((c) => address.includes(c)) ?? "Khác";
}

export const CITY_OPTIONS = [...CITIES, "Khác"];

const BILLION = 1_000_000_000;

export interface PriceRange {
  value: string;
  label: string;
  min: number;
  max: number;
}

export const PRICE_RANGES: PriceRange[] = [
  { value: "ALL", label: "Mọi mức giá", min: 0, max: Infinity },
  { value: "LT3", label: "Dưới 3 tỷ", min: 0, max: 3 * BILLION },
  { value: "3-6", label: "3 đến 6 tỷ", min: 3 * BILLION, max: 6 * BILLION },
  { value: "6-10", label: "6 đến 10 tỷ", min: 6 * BILLION, max: 10 * BILLION },
  { value: "GT10", label: "Trên 10 tỷ", min: 10 * BILLION, max: Infinity },
];

export function inPriceRange(p: Property, rangeValue: string): boolean {
  const range = PRICE_RANGES.find((r) => r.value === rangeValue);
  if (!range) return true;
  const price = Number(p.price);
  return price >= range.min && price < range.max;
}

// Giá dạng "2,8 tỷ" cho thẻ nhà
export function formatBillion(value: string | number): string {
  const n = Number(value) / BILLION;
  return `${n.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
}
