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

// ---------- Thông tin chi tiết căn nhà (FE-31). Mã khớp backend/src/properties/property-options.ts ----------

export const LEGAL_LABELS: Record<string, string> = {
  SO_HONG: "Sổ hồng",
  SO_DO: "Sổ đỏ",
  HDMB: "Hợp đồng mua bán",
  CHO_SO: "Đang chờ sổ",
};

export const FURNISHING_LABELS: Record<string, string> = {
  FULL: "Đầy đủ nội thất",
  BASIC: "Nội thất cơ bản",
  NONE: "Bàn giao thô",
};

export const OCCUPANCY_LABELS: Record<string, string> = {
  VACANT: "Nhà trống",
  OWNER_LIVING: "Chủ đang ở",
  RENTED: "Đang cho thuê",
};

export const DIRECTION_LABELS: Record<string, string> = {
  DONG: "Đông",
  TAY: "Tây",
  NAM: "Nam",
  BAC: "Bắc",
  DONG_BAC: "Đông Bắc",
  DONG_NAM: "Đông Nam",
  TAY_BAC: "Tây Bắc",
  TAY_NAM: "Tây Nam",
};

export const NEARBY_LABELS: Record<string, string> = {
  SCHOOL: "Trường học",
  HOSPITAL: "Y tế",
  MARKET: "Chợ, siêu thị",
  MALL: "Trung tâm thương mại",
  PARK: "Công viên, cảnh quan",
  TRANSPORT: "Giao thông",
  OTHER: "Khác",
};

// Gợi ý để quản lý bấm chọn nhanh; vẫn gõ thêm được mục khác
export const FEATURE_SUGGESTIONS = [
  "Ban công",
  "Sân vườn",
  "Sân thượng",
  "Chỗ đậu ô tô",
  "Gara ô tô",
  "Thang máy",
  "Hồ bơi",
  "Phòng gym",
  "An ninh 24/7",
  "View sông",
  "Căn góc",
  "Mặt tiền kinh doanh",
];

export const FURNITURE_SUGGESTIONS = [
  "Sofa",
  "Bàn ăn",
  "Giường",
  "Tủ quần áo",
  "Tủ lạnh",
  "Máy giặt",
  "Điều hòa",
  "Tivi",
  "Bếp từ",
  "Tủ bếp",
  "Bình nóng lạnh",
];

// Số thập phân từ backend là chuỗi "63.60": hiện "63,6"
export function formatNumber(value: string | number): string {
  return Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

export function bedroomsLabel(p: Pick<Property, "bedrooms" | "type">): string | null {
  if (p.bedrooms === null || p.bedrooms === undefined) return null;
  if (p.bedrooms === 0) return p.type === "APARTMENT" ? "Studio" : "0";
  return String(p.bedrooms);
}

export interface InfoRow {
  label: string;
  value: string;
}

// Các dòng "Thông tin cơ bản" ở trang chi tiết; dòng nào chưa nhập thì bỏ
export function basicInfoRows(p: Property): InfoRow[] {
  const m2 = (v: string | number | null | undefined) => (v === null || v === undefined ? null : `${formatNumber(v)} m²`);
  const isLand = p.type === "LAND";
  // Đất nền thường có diện tích đất = diện tích chính: không lặp hai dòng
  const landArea = p.landArea != null && Number(p.landArea) !== Number(p.area) ? p.landArea : null;
  const occupancy =
    p.occupancy === "VACANT" && isLand ? "Đất trống" : p.occupancy ? (OCCUPANCY_LABELS[p.occupancy] ?? p.occupancy) : null;
  const directionLabel = p.type === "APARTMENT" ? "Hướng ban công" : isLand ? "Hướng" : "Hướng nhà";
  const rows: [string, string | null][] = [
    ["Loại hình", typeLabel(p.type)],
    ["Phòng ngủ", bedroomsLabel(p)],
    ["Phòng tắm, WC", p.bathrooms === null || p.bathrooms === undefined ? null : String(p.bathrooms)],
    [p.type === "APARTMENT" ? "Tầng" : "Số tầng", p.floors === null || p.floors === undefined ? null : String(p.floors)],
    ["Diện tích", m2(p.area)],
    ["Diện tích đất", m2(landArea)],
    ["Diện tích sàn", m2(p.floorArea)],
    [directionLabel, p.direction ? (DIRECTION_LABELS[p.direction] ?? p.direction) : null],
    ["Pháp lý", p.legalStatus ? (LEGAL_LABELS[p.legalStatus] ?? p.legalStatus) : null],
    ["Nội thất", p.furnishing ? (FURNISHING_LABELS[p.furnishing] ?? p.furnishing) : null],
    ["Tình trạng sử dụng", occupancy],
    ["Đường, hẻm trước nhà", p.roadWidth === null || p.roadWidth === undefined ? null : `${formatNumber(p.roadWidth)} m`],
    ["Giá bán", formatBillion(p.price)],
  ];
  return rows.filter((r): r is [string, string] => r[1] !== null).map(([label, value]) => ({ label, value }));
}
