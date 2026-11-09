export const MAUTIC_PUBLIC_URL = process.env.NEXT_PUBLIC_MAUTIC_URL || "";

// Dùng cùng quy tắc cho thẻ chi tiết, ma trận và bộ lọc ưu tiên.
export function isHotLead(lead: { level: string | null; score: number | null }): boolean {
  return lead.level === "HOT" || (lead.score !== null && lead.score >= 70);
}
