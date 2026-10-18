export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081/api";

export type Level = "HOT" | "WARM" | "COLD";
export type AutomationStatus = "PENDING" | "COMPLETED" | "FAILED";
// Trạng thái bán hàng của khách (khác với AutomationStatus là trạng thái chạy của n8n)
export type LeadStatus =
  | "NEW"
  | "CONFIRMED"
  | "VIEWED"
  | "DEPOSIT"
  | "SIGNED"
  | "LOST";

export interface Property {
  id: number;
  name: string;
  address: string;
  // Backend trả price/area dạng chuỗi (kiểu numeric của PostgreSQL)
  price: string | number;
  area: string | number;
  type: string;
  status: string;
}

export interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  // GET trả chuỗi (bigint), POST có thể trả số: luôn dùng Number(...)
  budget: string | number;
  needs: string | null;
  score: number | null;
  level: Level | null;
  reason: string | null;
  aiReply: string | null;
  emailSent: boolean | null;
  staffNotified: boolean | null;
  automationStatus: AutomationStatus;
  automationError?: string | null;
  status: LeadStatus;
  createdAt: string;
}

export interface Viewing {
  id: number;
  propertyId: number;
  leadId: number;
  viewingTime: string;
  status: string;
}

export interface LeadEvent {
  id: number;
  leadId: number;
  type: string;
  note: string | null;
  createdAt: string;
}

// GET /leads/:id trả thêm viewing và property (null nếu khách chưa có lịch)
export type LeadDetail = Lead & {
  viewing: Viewing | null;
  property: Property | null;
};

// Tên tiếng Việt cho lead_events.type
export const EVENT_LABELS: Record<string, string> = {
  AI_SCORED: "AI chấm điểm",
  APPROVED: "Nhân viên duyệt lịch",
  RESCHEDULE_REQUESTED: "Nhân viên yêu cầu đổi giờ",
  APPROVAL_TIMEOUT: "Quá 24 giờ chưa duyệt",
  REMINDER_SENT: "Đã nhắc lịch",
  FEEDBACK_ASKED: "Đã hỏi cảm nhận",
  WARM_NUDGE_SENT: "Đã nhắc khách WARM",
  STATUS_CHANGED: "Đổi trạng thái",
};

export function eventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type;
}

export interface CreateViewingInput {
  name: string;
  email: string;
  phone: string;
  budget: number;
  needs?: string;
  propertyId: number;
  viewingTime: string;
}

export interface CreateViewingResult {
  viewing: Viewing;
  lead: Lead;
}

export interface Stats {
  total: number;
  hot: number;
  warm: number;
  cold: number;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init });
  } catch {
    throw new ApiError(
      `Không kết nối được backend (${API_URL}). Hãy kiểm tra backend đã chạy chưa.`,
      0,
    );
  }

  if (!res.ok) {
    let message = `Lỗi ${res.status}`;
    try {
      const body = await res.json();
      const detail = Array.isArray(body.message)
        ? body.message.join("; ")
        : body.message;
      if (detail) message = detail;
    } catch {
      // giữ thông báo mặc định
    }
    throw new ApiError(message, res.status);
  }

  return (await res.json()) as T;
}

export function getProperties(): Promise<Property[]> {
  return request<Property[]>("/properties");
}

export function getLeads(level?: Level): Promise<Lead[]> {
  const query = level ? `?level=${level}` : "";
  return request<Lead[]>(`/leads${query}`);
}

export function getLead(id: number): Promise<LeadDetail> {
  return request<LeadDetail>(`/leads/${id}`);
}

export function getLeadEvents(id: number): Promise<LeadEvent[]> {
  return request<LeadEvent[]>(`/leads/${id}/events`);
}

export function getStats(): Promise<Stats> {
  return request<Stats>("/stats");
}

export function createViewing(
  input: CreateViewingInput,
): Promise<CreateViewingResult> {
  return request<CreateViewingResult>("/viewings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function formatVnd(value: string | number): string {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `${n.toLocaleString("vi-VN")} đ`;
}

// Backend trả thời gian ISO giờ UTC (đuôi Z): luôn hiển thị theo giờ Việt Nam.
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ---- Khu khách ----

export function getProperty(id: number): Promise<Property> {
  return request<Property>(`/properties/${id}`);
}

// GET /sign/:token: nội dung hợp đồng cho khách xem trước khi ký
export interface SignInfo {
  title: string | null;
  content: string | null;
  customerName: string;
  propertyName: string | null;
  depositAmount: string | number;
  status: "DRAFTING" | "PENDING_APPROVAL" | "SENT" | "SIGNED" | "REJECTED" | "EXPIRED";
  expiresAt: string | null;
  signedAt: string | null;
  signerName: string | null;
}

export function getSignInfo(token: string): Promise<SignInfo> {
  return request<SignInfo>(`/sign/${encodeURIComponent(token)}`);
}

export interface SignatureInput {
  signerName: string;
  // Ảnh PNG dạng data URL
  signature: string;
  agree: true;
}

export function submitSignature(token: string, input: SignatureInput): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/sign/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
