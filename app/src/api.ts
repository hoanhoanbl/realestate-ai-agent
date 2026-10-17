// Gọi backend. Điện thoại phải truy cập được địa chỉ này (cùng Wi-Fi với máy chạy Docker):
//   EXPO_PUBLIC_API_URL=http://192.168.1.10:8081/api npx expo start
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8081/api";

export type Level = "HOT" | "WARM" | "COLD";
export type LeadStatus = "NEW" | "CONFIRMED" | "VIEWED" | "DEPOSIT" | "SIGNED" | "LOST";

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: "MANAGER" | "SALE";
}

export interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  budget: string | number;
  needs: string | null;
  score: number | null;
  level: Level | null;
  reason: string | null;
  status: LeadStatus;
  automationStatus: "PENDING" | "COMPLETED" | "FAILED";
  createdAt: string;
}

export interface LeadDetail extends Lead {
  viewing: { id: number; viewingTime: string } | null;
  property: { name: string; address: string; price: string | number } | null;
}

export interface LeadEvent {
  id: number;
  type: string;
  note: string | null;
  createdAt: string;
}

export interface ScheduleRow {
  id: number;
  viewingTime: string;
  leadId: number;
  leadName: string;
  leadPhone: string;
  leadStatus: LeadStatus;
  propertyName: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setToken(value: string | null) {
  token = value;
}

// Token hết hạn thì app tự đưa người dùng về màn hình đăng nhập
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(`Không kết nối được backend (${API_URL}). Kiểm tra Wi-Fi và địa chỉ máy chủ.`, 0);
  }
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    let message = `Lỗi ${res.status}`;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join("; ") : (body.message ?? message);
    } catch {
      // giữ thông báo mặc định
    }
    throw new ApiError(message, res.status);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const login = (email: string, password: string) =>
  request<{ accessToken: string; user: SessionUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const getLeads = () => request<Lead[]>("/leads");
export const getLead = (id: number) => request<LeadDetail>(`/leads/${id}`);
export const getLeadEvents = (id: number) => request<LeadEvent[]>(`/leads/${id}/events`);
export const getSchedule = () => request<ScheduleRow[]>("/viewings/schedule");
export const approveLead = (id: number) => request<{ via: string }>(`/leads/${id}/approve`, { method: "POST" });
export const setLeadStatus = (id: number, status: "VIEWED" | "LOST", note?: string) =>
  request<Lead>(`/leads/${id}/admin-status`, { method: "PUT", body: JSON.stringify({ status, note }) });
export const rescheduleViewing = (viewingId: number, viewingTime: string) =>
  request(`/viewings/${viewingId}`, { method: "PUT", body: JSON.stringify({ viewingTime }) });
export const savePushToken = (pushToken: string) =>
  request("/users/me/push-token", { method: "POST", body: JSON.stringify({ token: pushToken }) });
export const clearPushToken = () => request("/users/me/push-token", { method: "DELETE" });

export function formatVnd(value: string | number): string {
  const n = Number(value);
  return Number.isNaN(n) ? String(value) : `${n.toLocaleString("vi-VN")} đ`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

// "YYYY-MM-DD HH:mm" (giờ Việt Nam) -> ISO có múi giờ, hoặc null nếu sai định dạng
export function parseVnDateTime(text: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(text.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+07:00` : null;
}
