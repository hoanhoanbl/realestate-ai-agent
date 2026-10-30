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

// Bỏ dấu tiếng Việt để tìm "thao dien" vẫn ra "Thảo Điền"
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function matchesQuery(p: Property, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  return normalizeText(`${p.name} ${p.address}`).includes(q);
}

export const SORT_OPTIONS = [
  { value: "DEFAULT", label: "Mới đăng" },
  { value: "PRICE_ASC", label: "Giá thấp đến cao" },
  { value: "PRICE_DESC", label: "Giá cao đến thấp" },
  { value: "AREA_DESC", label: "Diện tích lớn nhất" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export function sortProperties(list: Property[], sort: SortValue): Property[] {
  const copy = [...list];
  if (sort === "PRICE_ASC") copy.sort((a, b) => Number(a.price) - Number(b.price));
  else if (sort === "PRICE_DESC") copy.sort((a, b) => Number(b.price) - Number(a.price));
  else if (sort === "AREA_DESC") copy.sort((a, b) => Number(b.area) - Number(a.area));
  else copy.sort((a, b) => b.id - a.id);
  return copy;
}
