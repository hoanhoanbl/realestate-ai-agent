import { clearSession, getToken, type SessionUser } from "@/lib/auth";

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
  STAFF_NUDGE_SENT: "Đã nhắc nhân viên duyệt lịch",
  VIEWING_RESCHEDULED: "Đổi giờ xem nhà",
  FOLLOWUP_FAILED: "Follow-up bị lỗi",
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
  // Gửi kèm token đăng nhập (nếu có). API công khai bỏ qua header này.
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init, headers });
  } catch {
    throw new ApiError(
      `Không kết nối được backend (${API_URL}). Hãy kiểm tra backend đã chạy chưa.`,
      0,
    );
  }

  if (!res.ok) {
    // Token hết hạn: xoá phiên và đưa về trang đăng nhập
    if (res.status === 401 && token) {
      clearSession();
      if (!window.location.pathname.startsWith("/admin/login")) {
        // tải lại cả trang để xoá sạch dữ liệu của phiên cũ
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/admin/login";
      }
    }
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

export function getProperty(id: number): Promise<Property> {
  return request<Property>(`/properties/${id}`);
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

// ---- Khu quản trị (cần đăng nhập) ----

export interface LoginResult {
  accessToken: string;
  user: SessionUser;
}

export function login(email: string, password: string): Promise<LoginResult> {
  return request<LoginResult>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export interface Funnel {
  total: number;
  byStatus: Record<LeadStatus, number>;
  conversionRate: number;
  pendingApproval: number;
  failedAutomation: number;
  viewingsToday: number;
}

export function getFunnel(): Promise<Funnel> {
  return request<Funnel>("/stats/funnel");
}

export interface ScheduleRow {
  id: number;
  viewingTime: string;
  leadId: number;
  leadName: string;
  leadPhone: string;
  leadLevel: Level | null;
  leadStatus: LeadStatus;
  propertyId: number;
  propertyName: string;
  propertyAddress: string;
}

export function getSchedule(): Promise<ScheduleRow[]> {
  return request<ScheduleRow[]>("/viewings/schedule");
}

export function approveLead(id: number): Promise<{ via: "resume" | "manual" }> {
  return request(`/leads/${id}/approve`, { method: "POST" });
}

export function setLeadStatus(id: number, status: "VIEWED" | "LOST", note?: string): Promise<Lead> {
  return request<Lead>(`/leads/${id}/admin-status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, note }),
  });
}

export function rescheduleViewing(viewingId: number, viewingTime: string): Promise<Viewing> {
  return request<Viewing>(`/viewings/${viewingId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ viewingTime }),
  });
}

// ISO (UTC) -> "YYYY-MM-DDTHH:mm" theo giờ Việt Nam, dùng cho ô datetime-local
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).replace(" ", "T").slice(0, 16);
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
