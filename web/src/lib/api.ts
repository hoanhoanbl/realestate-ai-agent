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
  source: string | null;
  mauticContactId?: number | null;
  mauticPoints?: number;
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
  WARM_NURTURE_STARTED: "Bắt đầu nuôi khách WARM (Mautic)",
  STAFF_NUDGE_SENT: "Đã nhắc nhân viên duyệt lịch",
  VIEWING_RESCHEDULED: "Đổi giờ xem nhà",
  FEEDBACK_RECEIVED: "Khách gửi cảm nhận",
  FEEDBACK_ANALYZED: "AI phân tích cảm nhận",
  CONTRACT_CREATED: "Tạo hợp đồng",
  CONTRACT_DRAFTED: "Hợp đồng soạn xong",
  CONTRACT_SENT: "Hợp đồng gửi khách ký",
  CONTRACT_SIGNED: "Khách ký hợp đồng",
  CONTRACT_REJECTED: "Hợp đồng bị từ chối",
  CONTRACT_EXPIRED: "Hợp đồng hết hạn",
  FOLLOWUP_FAILED: "Follow-up bị lỗi",
  MAUTIC_SYNCED: "Đồng bộ sang Mautic",
  MAUTIC_SCORE_CHANGED: "Điểm Mautic thay đổi",
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
  source?: string;
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

export interface PropertyInput {
  name: string;
  address: string;
  price: number;
  area: number;
  type: string;
  status?: string;
}

// Gồm cả căn đã ẩn (chỉ admin)
export function getAdminProperties(): Promise<Property[]> {
  return request<Property[]>("/properties/admin/all");
}

export function createProperty(input: PropertyInput): Promise<Property> {
  return request<Property>("/properties", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateProperty(id: number, input: Partial<PropertyInput>): Promise<Property> {
  return request<Property>(`/properties/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

// ---- Cảm nhận sau buổi xem ----

export type FeedbackInterest = "DEPOSIT" | "OTHER" | "NONE";

// Trang công khai của khách: chỉ có tên, căn nhà, giờ xem
export interface FeedbackInfo {
  leadName: string;
  propertyName: string | null;
  viewingTime: string | null;
  submitted: boolean;
}

export function getFeedbackInfo(token: string): Promise<FeedbackInfo> {
  return request<FeedbackInfo>(`/feedback/${encodeURIComponent(token)}`);
}

export function submitFeedback(
  token: string,
  body: { rating: number; interest: FeedbackInterest; comment?: string },
): Promise<{ ok: true }> {
  return request(`/feedback/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Cho trang chi tiết khách ở admin
export interface Feedback {
  id: number;
  leadId: number;
  rating: number | null;
  interest: FeedbackInterest | null;
  comment: string | null;
  submittedAt: string | null;
  aiSentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | null;
  aiSummary: string | null;
  aiNextAction: string | null;
}

export async function getLeadFeedback(leadId: number): Promise<Feedback | null> {
  // Backend trả rỗng (không có nội dung) khi khách chưa có cảm nhận nào
  const text = await request<Feedback | null>(`/feedback/lead/${leadId}`).catch((e: unknown) => {
    if (e instanceof SyntaxError) return null;
    throw e;
  });
  return text;
}

// ---- Hợp đồng đặt cọc ----

export type ContractStatus = "DRAFTING" | "PENDING_APPROVAL" | "SENT" | "SIGNED" | "REJECTED" | "EXPIRED";

export interface ContractRow {
  id: number;
  status: ContractStatus;
  depositAmount: string | number;
  createdAt: string;
  signedAt: string | null;
  leadId: number;
  leadName: string;
  propertyName: string;
}

export interface ContractDetail {
  id: number;
  leadId: number;
  title: string | null;
  content: string | null;
  depositAmount: string | number;
  propertyPrice: string | number;
  status: ContractStatus;
  aiReview: string | null;
  rejectReason: string | null;
  approvedBy: string | null;
  createdBy: string | null;
  signerName: string | null;
  signature: string | null;
  signedAt: string | null;
  signedIp: string | null;
  expiresAt: string | null;
  createdAt: string;
  signUrl: string | null;
  lead: { id: number; name: string; email: string; phone: string } | null;
  property: Property | null;
}

export function getContracts(): Promise<ContractRow[]> {
  return request<ContractRow[]>("/contracts");
}

export function getContract(id: number): Promise<ContractDetail> {
  return request<ContractDetail>(`/contracts/${id}`);
}

export function createContract(leadId: number, depositAmount: number): Promise<{ id: number }> {
  return request<{ id: number }>("/contracts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leadId, depositAmount }),
  });
}

export function approveContract(id: number): Promise<{ ok: true }> {
  return request(`/contracts/${id}/approve`, { method: "POST" });
}

export function rejectContract(id: number, reason: string): Promise<{ ok: true }> {
  return request(`/contracts/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

// Trang ký công khai của khách
export interface SignInfo {
  title: string | null;
  content: string | null;
  customerName: string;
  propertyName: string | null;
  depositAmount: string | number;
  status: ContractStatus;
  expiresAt: string | null;
  signedAt: string | null;
  signerName: string | null;
}

export function getSignInfo(token: string): Promise<SignInfo> {
  return request<SignInfo>(`/sign/${encodeURIComponent(token)}`);
}

export function submitSignature(
  token: string,
  body: { signerName: string; signature: string; agree: boolean },
): Promise<{ ok: true }> {
  return request(`/sign/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---- Báo cáo kinh doanh (chỉ quản lý) ----

export interface ReportRow {
  id: number;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  headline: string | null;
  alertCount: number;
}

export interface ReportDetail {
  id: number;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  metrics: Record<string, unknown>;
  analysis: Record<string, unknown>;
  alerts: string[];
}

export function getReports(): Promise<ReportRow[]> {
  return request<ReportRow[]>("/reports");
}

export function getReport(id: number): Promise<ReportDetail> {
  return request<ReportDetail>(`/reports/${id}`);
}

export function runReportNow(): Promise<{ ok: true }> {
  return request("/reports/run", { method: "POST" });
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

// ---- Quản lý tài khoản & phân quyền (chỉ quản lý) ----

export interface UserAccount {
  id: number;
  email: string;
  name: string;
  role: "MANAGER" | "SALE";
  pushToken: string | null;
  createdAt: string;
}

export function getUsers(): Promise<UserAccount[]> {
  return request<UserAccount[]>("/users");
}

export function createUser(data: {
  email: string;
  name: string;
  password: string;
  role: "MANAGER" | "SALE";
}): Promise<UserAccount> {
  return request<UserAccount>("/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// Nhãn nguồn khách cho hiển thị
export const SOURCE_LABELS: Record<string, string> = {
  facebook: "Facebook",
  zalo: "Zalo",
  google: "Google",
  tiktok: "TikTok",
  referral: "Giới thiệu",
  direct: "Trực tiếp",
};

export function sourceLabel(source: string | null): string {
  if (!source) return "Trực tiếp";
  return SOURCE_LABELS[source] ?? source;
}
