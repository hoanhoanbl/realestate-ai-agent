import { clearSession, getToken, type SessionUser } from "@/lib/auth";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081/api";

export type Level = "HOT" | "WARM" | "COLD";
export type AutomationStatus = "PENDING" | "COMPLETED" | "FAILED";
// Trạng thái bán hàng của khách (khác với AutomationStatus là trạng thái chạy của n8n)
export type LeadStatus =
  | "CONSULTING"
  | "NEW"
  | "CONFIRMED"
  | "VIEWED"
  | "DEPOSIT"
  | "SIGNED"
  | "LOST";

// Kết quả buổi xem (viewings.status)
export type ViewingStatus = "NEW" | "ATTENDED" | "NO_SHOW" | "CANCELLED";
export const VIEWING_STATUS_LABELS: Record<ViewingStatus, string> = {
  NEW: "Chờ xem",
  ATTENDED: "Khách đã đến",
  NO_SHOW: "Khách không đến",
  CANCELLED: "Đã huỷ",
};

// Lý do mất khách (leads.lost_reason)
export type LostReason = "NO_SHOW" | "NOT_INTERESTED" | "CUSTOMER_CANCELLED" | "EXPIRED" | "OTHER";
export const LOST_REASON_LABELS: Record<LostReason, string> = {
  NO_SHOW: "Khách không đến xem",
  NOT_INTERESTED: "Không còn nhu cầu",
  CUSTOMER_CANCELLED: "Khách tự huỷ lịch",
  EXPIRED: "Quá hạn không xử lý",
  OTHER: "Lý do khác",
};

// Trạng thái căn nhà: RESERVED do hệ thống đặt khi có hợp đồng cọc
export type PropertyStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "HIDDEN";
export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  AVAILABLE: "Đang bán",
  RESERVED: "Đang giữ cọc",
  SOLD: "Đã bán",
  HIDDEN: "Đã ẩn",
};

export interface Property {
  id: number;
  name: string;
  address: string;
  // Backend trả price/area dạng chuỗi (kiểu numeric của PostgreSQL)
  price: string | number;
  area: string | number;
  type: string;
  status: string;
  imageUrl: string | null;
  description: string | null;
  // Chỉ GET /properties/{id} và danh sách admin trả hai mảng link này; danh sách công khai trả imageCount, panoramaCount
  panoramas?: PanoramaRoom[] | null;
  images?: string[] | null;
  imageCount?: number;
  panoramaCount?: number;
  // Thông tin chi tiết (FE-31). null = chưa nhập. Số thập phân về dạng chuỗi như price/area
  bedrooms?: number | null;
  bathrooms?: number | null;
  floors?: number | null;
  landArea?: string | number | null;
  floorArea?: string | number | null;
  roadWidth?: string | number | null;
  direction?: string | null;
  legalStatus?: string | null;
  furnishing?: string | null;
  occupancy?: string | null;
  features?: string[] | null;
  furniture?: string[] | null;
  nearby?: NearbyPlace[] | null;
}

export interface PanoramaRoom {
  title: string;
  url: string;
}

export interface NearbyPlace {
  category: string;
  name: string;
  distance: string;
}

export interface Lead {
  id: number;
  name: string;
  email: string | null;
  phone: string;
  // GET trả chuỗi (bigint), POST có thể trả số: luôn dùng Number(...)
  budget: string | number | null;
  phoneNormalized: string | null;
  assignedUserId: number | null;
  assignedAt: string | null;
  responseDueAt: string | null;
  firstResponseAt: string | null;
  interestedPropertyIds: number[] | null;
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
  consentMarketing?: boolean;
  lostReason?: LostReason | null;
  createdAt: string;
}

export interface Viewing {
  id: number;
  propertyId: number;
  leadId: number;
  viewingTime: string;
  status: ViewingStatus;
}

export interface LeadEvent {
  id: number;
  leadId: number;
  type: string;
  note: string | null;
  createdAt: string;
  actorUserId?: number | null;
}

// GET /leads/:id trả thêm viewing và property (null nếu khách chưa có lịch)
export type LeadDetail = Lead & {
  assignedUser: { id: number; name: string; email: string; role: "SALE" | "MANAGER"; telegramChatId: string | null; acceptingLeads: boolean } | null;
  viewing: Viewing | null;
  property: Property | null;
  // Bản ghi cũ trùng điện thoại; không tự gộp lịch sử trong FE-33.
  otherBookings: OtherBooking[];
  // Mọi buổi xem của khách, mới nhất trước (FE-34)
  viewings: ViewingHistoryItem[];
};

export interface ViewingHistoryItem {
  id: number;
  propertyId: number;
  propertyName: string | null;
  viewingTime: string | null;
  status: ViewingStatus;
}

export interface OtherBooking {
  id: number;
  status: LeadStatus;
  createdAt: string;
  propertyName: string | null;
  viewingTime: string | null;
}

// Tên tiếng Việt cho lead_events.type
export const EVENT_LABELS: Record<string, string> = {
  LEAD_CREATED: "Tiếp nhận khách",
  LEAD_ASSIGNED: "Gán người phụ trách",
  LEAD_REASSIGNED: "Chuyển người phụ trách",
  LEAD_REOPENED: "Khách quay lại",
  NOTE_ADDED: "Ghi chú",
  RESPONSE_OVERDUE: "Quá hạn phản hồi",
  AI_SCORED: "AI chấm điểm",
  APPROVED: "Nhân viên duyệt lịch",
  RESCHEDULE_REQUESTED: "Nhân viên yêu cầu đổi giờ",
  APPROVAL_TIMEOUT: "Quá 24 giờ chưa duyệt",
  REMINDER_SENT: "Đã nhắc lịch",
  FEEDBACK_ASKED: "Đã hỏi cảm nhận",
  WARM_NUDGE_SENT: "Đã nhắc khách WARM",
  WARM_NURTURE_STARTED: "Bắt đầu nuôi khách WARM (Mautic)",
  STAFF_NUDGE_SENT: "Đã nhắc nhân viên duyệt lịch",
  HOT_NUDGE_SENT: "Đã nhắc sale gọi khách HOT",
  COLD_NURTURE_STARTED: "Đã đưa khách COLD vào bản tin",
  LEAD_EXPIRED: "Lịch chưa duyệt đã quá hạn",
  LEAD_EXPIRED_NOTIFIED: "Đã báo quản lý lịch quá hạn",
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
  VIEWING_NO_SHOW: "Khách không đến xem",
  VIEWING_CANCELLED: "Lịch xem bị huỷ",
  CUSTOMER_RESCHEDULE_REQUESTED: "Khách xin đổi lịch",
  ATTENDANCE_CHECK_SENT: "Đã nhắc xác nhận buổi xem",
  ATTENDANCE_ESCALATED: "Báo quản lý: buổi xem chưa xác nhận",
  DEPOSIT_RECEIVED: "Đã nhận tiền cọc",
  PROPERTY_RESERVED: "Căn chuyển sang giữ cọc",
  PROPERTY_SOLD: "Căn đã bán",
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
  consentMarketing?: boolean;
  // Ô bẫy bot, người thật để trống
  website?: string;
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
  bySource?: { source: string; count: number }[];
  byAssignee?: { assignedUserId: number | null; count: number }[];
  overdueResponses?: number;
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
  // Chuỗi rỗng = xoá
  imageUrl?: string;
  description?: string;
  // Mảng rỗng = xoá hết (áp dụng cho mọi mảng); null = xoá thông số
  panoramas?: PanoramaRoom[];
  bedrooms?: number | null;
  bathrooms?: number | null;
  floors?: number | null;
  landArea?: number | null;
  floorArea?: number | null;
  roadWidth?: number | null;
  direction?: string | null;
  legalStatus?: string | null;
  furnishing?: string | null;
  occupancy?: string | null;
  images?: string[];
  features?: string[];
  furniture?: string[];
  nearby?: NearbyPlace[];
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
  depositReceivedAt: string | null;
  depositReceivedBy: string | null;
  expiresAt: string | null;
  createdAt: string;
  signUrl: string | null;
  lead: { id: number; name: string; email: string | null; phone: string } | null;
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

export function markDepositReceived(id: number): Promise<ContractDetail> {
  return request<ContractDetail>(`/contracts/${id}/deposit-received`, { method: "POST" });
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
  id: number;
  title: string | null;
  content: string | null;
  customerName: string;
  propertyName: string | null;
  propertyAddress: string | null;
  propertyPrice: string | number;
  depositAmount: string | number;
  status: ContractStatus;
  expiresAt: string | null;
  createdAt: string;
  approvedBy: string | null;
  signedAt: string | null;
  signerName: string | null;
  // Chỉ có khi hợp đồng đã ký
  signature: string | null;
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

// Một lượt hỏi đáp của bot Telegram gắn với khách (FE-36); văn bản đã che email và số dài
export type ChatRoute = "COMMAND" | "BLOCKED" | "AGENT" | "STAFF" | "OUT_OF_SCOPE";
export interface LeadChatLog {
  id: number;
  createdAt: string;
  route: ChatRoute;
  question: string;
  reply: string;
  escalated: boolean;
}

export const CHAT_ROUTE_LABELS: Record<ChatRoute, string> = {
  COMMAND: "Lệnh",
  BLOCKED: "Bị chặn",
  AGENT: "Bot tư vấn",
  STAFF: "Chuyển nhân viên",
  OUT_OF_SCOPE: "Ngoài phạm vi",
};

export function getLeadChatLogs(id: number): Promise<LeadChatLog[]> {
  return request<LeadChatLog[]>(`/leads/${id}/chat-logs`);
}

export interface CreateLeadInput {
  name: string;
  phone: string;
  source: string;
  email?: string;
  budget?: number;
  needs?: string;
  assignedUserId?: number;
  interestedPropertyIds?: number[];
  consentMarketing?: boolean;
  note?: string;
}

export interface IntakeResult { lead: Lead; created: boolean; reopened: boolean }
export interface LeadLookup {
  id: number;
  name: string;
  status: LeadStatus;
  assignedUserId: number | null;
  assignedUserName: string | null;
}

export async function lookupLeadByPhone(phone: string): Promise<LeadLookup | null> {
  const result = await request<{ lead: LeadLookup | null }>(`/leads/lookup?phone=${encodeURIComponent(phone)}`);
  return result.lead;
}

// Admin nhập tay; trùng số điện thoại trả 409, không sửa lead cũ.
export function createLead(input: CreateLeadInput): Promise<IntakeResult> {
  return request("/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}

export function reassignLead(id: number, assignedUserId: number, note?: string): Promise<Lead> {
  return request(`/leads/${id}/assignee`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignedUserId, note }) });
}

export function addLeadNote(id: number, note: string): Promise<LeadEvent> {
  return request(`/leads/${id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
}

export type AssigneeOption = Pick<UserAccount, "id" | "name" | "role" | "acceptingLeads">;
export type UserRoutingInfo = Pick<UserAccount, "id" | "name" | "email" | "role" | "acceptingLeads" | "telegramChatId">;
export function getMyRouting(): Promise<UserRoutingInfo> {
  return request("/users/me/routing");
}
export function getAssignees(): Promise<AssigneeOption[]> {
  return request("/users/assignees");
}

export function updateUserRouting(id: number, input: { acceptingLeads?: boolean; telegramChatId?: string | null }): Promise<UserAccount> {
  return request(`/users/${id}/routing`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}

export function getStats(): Promise<Stats> {
  return request<Stats>("/stats");
}

// Trang Đội sale (chỉ quản lý): số khách và kết quả của từng người phụ trách
export type TeamPeriod = "now" | "week" | "month";
export type TeamOpenStatus = "CONSULTING" | "NEW" | "CONFIRMED" | "VIEWED" | "DEPOSIT";
export interface TeamOwner {
  id: number | null; // null = chưa phân công
  name: string;
  role: "SALE" | "MANAGER" | null;
  acceptingLeads: boolean | null;
  open: Record<TeamOpenStatus | "total", number>;
  overdue: number;
  idle: number;
  assigned: number;
  attended: number;
  signed: number;
  lost: number;
}
export interface TeamStats {
  period: TeamPeriod;
  from: string | null;
  to: string | null;
  acceptingSales: number;
  totalSales: number;
  owners: TeamOwner[];
  totals: Omit<TeamOwner, "id" | "name" | "role" | "acceptingLeads">;
}
export function getTeamStats(period: TeamPeriod): Promise<TeamStats> {
  return request<TeamStats>(`/stats/team?period=${period}`);
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

// Khung giờ khách đặt được của một căn (FE-34). date/time là giờ Việt Nam, start là ISO UTC gửi lại làm viewingTime.
export interface ViewingSlot {
  time: string;
  start: string;
  available: boolean;
}
export interface ViewingSlotDay {
  date: string;
  slots: ViewingSlot[];
}
export interface ViewingSlots {
  earliest: string;
  latest: string;
  days: ViewingSlotDay[];
}

export function getViewingSlots(propertyId: number): Promise<ViewingSlots> {
  return request<ViewingSlots>(`/viewings/slots?propertyId=${propertyId}`);
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
  noShow: number;
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
  viewingStatus: ViewingStatus;
  propertyId: number;
  propertyName: string;
  propertyAddress: string;
  propertyStatus: PropertyStatus;
}

export function getSchedule(): Promise<ScheduleRow[]> {
  return request<ScheduleRow[]>("/viewings/schedule");
}

export function approveLead(id: number): Promise<{ via: "resume" | "manual" }> {
  return request(`/leads/${id}/approve`, { method: "POST" });
}

export function setLeadStatus(
  id: number,
  status: "VIEWED" | "LOST",
  note?: string,
  reason?: LostReason,
): Promise<Lead> {
  return request<Lead>(`/leads/${id}/admin-status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, note, reason }),
  });
}

// Nhân viên ghi nhận kết quả buổi xem. Không đến: hẹn lại (kèm giờ mới) hoặc đóng (mất khách).
export function recordAttendance(
  viewingId: number,
  body:
    | { outcome: "ATTENDED"; note?: string }
    | { outcome: "NO_SHOW"; next: "CLOSE"; note?: string }
    | { outcome: "NO_SHOW"; next: "RESCHEDULE"; viewingTime: string; note?: string },
): Promise<Lead> {
  return request<Lead>(`/viewings/${viewingId}/attendance`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Được ghi nhận buổi xem từ 30 phút trước giờ hẹn (giống backend)
export const ATTENDANCE_GRACE_MS = 30 * 60 * 1000;
export function viewingStarted(iso: string): boolean {
  return Date.now() >= new Date(iso).getTime() - ATTENDANCE_GRACE_MS;
}

// ---- Việc cần làm trên trang Tổng quan ----
export interface TaskRow {
  leadId: number;
  leadName: string;
  leadPhone: string;
  leadLevel: Level | null;
  leadStatus: LeadStatus;
  viewingTime: string | null;
  propertyName: string | null;
  rating?: number | null;
  comment?: string | null;
  note?: string | null;
  requestedAt?: string;
}

export interface Tasks {
  pendingAttendance: TaskRow[];
  wantsDeposit: TaskRow[];
  notInterested: TaskRow[];
  reservedBackups: TaskRow[];
  customerRequests: TaskRow[];
}

export function getTasks(): Promise<Tasks> {
  return request<Tasks>("/stats/tasks");
}

// ---- Khách tự quản lý lịch qua link /lich/<token> ----
export interface ManageBookingInfo {
  leadName: string;
  propertyName: string | null;
  propertyAddress: string | null;
  viewingTime: string | null;
  leadStatus: LeadStatus;
  viewingStatus: ViewingStatus;
  canChange: boolean;
}

export function getManageBooking(token: string): Promise<ManageBookingInfo> {
  return request<ManageBookingInfo>(`/viewings/manage/${encodeURIComponent(token)}`);
}

export function cancelBooking(token: string): Promise<{ ok: true }> {
  return request(`/viewings/manage/${encodeURIComponent(token)}/cancel`, { method: "POST" });
}

export function requestReschedule(token: string, note: string): Promise<{ ok: true }> {
  return request(`/viewings/manage/${encodeURIComponent(token)}/reschedule-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note: note.trim() || undefined }),
  });
}

// FE-35: nhân viên bấm Duyệt / Đổi giờ từ thông báo (không đăng nhập, token có chữ ký)
export interface StaffLinkInfo {
  action: "approve" | "reschedule";
  leadName: string;
  propertyName: string | null;
  propertyAddress: string | null;
  viewingTime: string | null;
  leadStatus: LeadStatus;
  viewingStatus: ViewingStatus;
  canAct: boolean;
  refusal: string | null;
}

export function getStaffLink(token: string): Promise<StaffLinkInfo> {
  return request<StaffLinkInfo>(`/viewings/staff-links/${encodeURIComponent(token)}`);
}

export function confirmStaffLink(token: string): Promise<{ ok: true; action: "approve" | "reschedule"; already?: true }> {
  return request(`/viewings/staff-links/${encodeURIComponent(token)}/confirm`, { method: "POST" });
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

export function formatVnd(value: string | number | null): string {
  if (value === null) return "Chưa cung cấp";
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
  telegramChatId: string | null;
  acceptingLeads: boolean;
  lastAssignedAt: string | null;
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
  telegram: "Telegram",
  hotline: "Gọi hotline",
  property_sign: "Biển treo tại căn",
  walk_in: "Đến văn phòng",
  personal_zalo: "Zalo cá nhân",
  other: "Khác",
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
