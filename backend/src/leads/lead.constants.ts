export const LEAD_STATUSES = [
  'CONSULTING',
  'NEW',
  'CONFIRMED',
  'VIEWED',
  'DEPOSIT',
  'SIGNED',
  'LOST',
];

export const LEAD_EVENT_TYPES = [
  'LEAD_CREATED',
  'LEAD_ASSIGNED',
  'LEAD_REASSIGNED',
  'LEAD_REOPENED',
  'NOTE_ADDED',
  'RESPONSE_OVERDUE',
  'AI_SCORED',
  'APPROVED',
  'RESCHEDULE_REQUESTED',
  'APPROVAL_TIMEOUT',
  'REMINDER_SENT',
  'FEEDBACK_ASKED',
  'WARM_NUDGE_SENT',
  'WARM_NURTURE_STARTED',
  'HOT_NUDGE_SENT',
  'COLD_NURTURE_STARTED',
  'LEAD_EXPIRED',
  'LEAD_EXPIRED_NOTIFIED',
  'STAFF_NUDGE_SENT',
  'FOLLOWUP_FAILED',
  'VIEWING_RESCHEDULED',
  'FEEDBACK_RECEIVED',
  'FEEDBACK_ANALYZED',
  'FEEDBACK_WORK_CREATED',
  'FEEDBACK_WORK_UPDATED',
  'FEEDBACK_ALERT_RESOLVED',
  'CONTRACT_CREATED',
  'CONTRACT_REDRAFT_REQUESTED',
  'CONTRACT_DRAFTED',
  'CONTRACT_SENT',
  'CONTRACT_SIGNED',
  'CONTRACT_REJECTED',
  'CONTRACT_EXPIRED',
  'MAUTIC_SYNCED',
  'MAUTIC_SCORE_CHANGED',
  'STATUS_CHANGED',
  'VIEWING_NO_SHOW',
  'VIEWING_CANCELLED',
  'CUSTOMER_RESCHEDULE_REQUESTED',
  'ATTENDANCE_CHECK_SENT',
  'ATTENDANCE_ESCALATED',
  'DEPOSIT_RECEIVED',
  'PROPERTY_RESERVED',
  'PROPERTY_SOLD',
  // FE-43 (change journey-followup-ladder, design D10). Nhóm liên hệ và bậc nhắc ghi bởi FE-44, FE-45, FE-46;
  // nhóm hợp đồng ghi bởi FE-48, FE-49; VIEWING_CONFIRMATION_SENT ghi bởi luồng 1b (FE-50), đọc bởi luồng 2 (FE-54).
  'CONTACTED',
  'CONTACT_ATTEMPTED',
  'LADDER_STEP_SENT',
  'LADDER_APPROVED',
  'LEAD_STALE_CLOSED',
  'REBOOK_INVITE_SENT',
  'CONTRACT_PRICE_AGREED',
  'CONTRACT_ARCHIVED',
  'VIEWING_CONFIRMATION_SENT',
];

// Sự kiện tính là "có hoạt động" cho bộ đếm im lặng của luồng 9 (design D3). Là danh sách cho phép:
// sự kiện tự động thêm sau này (ví dụ VIEWING_CONFIRMATION_SENT) không bao giờ tự đặt lại đồng hồ.
export const LEAD_ACTIVITY_EVENT_TYPES = [
  'NOTE_ADDED',
  'CONTACTED',
  'CONTACT_ATTEMPTED',
  'STATUS_CHANGED',
  'LEAD_ASSIGNED',
  'LEAD_REASSIGNED',
  'LEAD_REOPENED',
  'FEEDBACK_RECEIVED',
  'APPROVED',
  'VIEWING_NO_SHOW',
  'VIEWING_CANCELLED',
  'VIEWING_RESCHEDULED',
  'CUSTOMER_RESCHEDULE_REQUESTED',
  'FEEDBACK_WORK_UPDATED',
  'LADDER_APPROVED',
];

// Lý do mất khách. Bốn lý do đầu và OTHER có từ trước; STALE do luồng 9 đặt khi khách im lặng 14 ngày;
// năm lý do còn lại là nhóm lý do chi tiết nhân viên chọn khi bấm "Không mua" (FE-44).
export const LOST_REASONS = [
  'NO_SHOW',
  'NOT_INTERESTED',
  'CUSTOMER_CANCELLED',
  'EXPIRED',
  'OTHER',
  'STALE',
  'PRICE_TOO_HIGH',
  'CHOSE_OTHER_PROPERTY',
  'BOUGHT_ELSEWHERE',
  'UNREACHABLE',
  'NO_LONGER_NEEDED',
];

// Lý do nhân viên được chọn tay: đúng sáu nhóm của spec lead-contact-tracking, liệt kê thẳng (không suy ra bằng
// phép lọc) để mã mới thêm vào LOST_REASONS không tự lọt vào danh sách chọn tay.
// Bốn lý do do hệ thống sở hữu (STALE, NO_SHOW, EXPIRED, CUSTOMER_CANCELLED) chỉ do đường mã tương ứng đặt.
// NOT_INTERESTED là mã cũ: vẫn nằm trong LOST_REASONS để đọc dữ liệu cũ và kết quả "Không mua" của theo dõi
// phản hồi, nhưng không chọn tay được nữa (trùng nghĩa với NO_LONGER_NEEDED). FE-44 áp danh sách này vào API đổi trạng thái thủ công.
export const SYSTEM_LOST_REASONS = ['STALE', 'NO_SHOW', 'EXPIRED', 'CUSTOMER_CANCELLED'];
export const LEGACY_LOST_REASONS = ['NOT_INTERESTED'];
export const MANUAL_LOST_REASONS = [
  'PRICE_TOO_HIGH',
  'CHOSE_OTHER_PROPERTY',
  'BOUGHT_ELSEWHERE',
  'UNREACHABLE',
  'NO_LONGER_NEEDED',
  'OTHER',
];

// Ghi chú của sự kiện VIEWING_CONFIRMATION_SENT (design D10). lead_events không có cột buổi xem hay JSON,
// nên buổi xem và giờ hẹn nằm trong note theo đúng một dạng: viewing=<id>;time=<ISO 8601 UTC>.
// SQL của luồng 2 (FE-54) so khớp đúng chuỗi này, nên giờ luôn là toISOString() (có mili giây, hậu tố Z).
export function buildViewingConfirmationNote(viewingId: number, viewingTime: Date | string): string {
  const time = new Date(viewingTime);
  if (!Number.isInteger(viewingId) || viewingId < 1 || Number.isNaN(time.getTime())) {
    throw new Error('Cần mã buổi xem nguyên dương và giờ hẹn hợp lệ');
  }
  return `viewing=${viewingId};time=${time.toISOString()}`;
}

// Ngược lại với buildViewingConfirmationNote. Trả null khi ghi chú không đúng dạng (bỏ qua, không ném lỗi).
export function parseViewingConfirmationNote(note: string | null | undefined): { viewingId: number; viewingTime: Date } | null {
  const match = /^viewing=(\d+);time=(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)$/.exec(note ?? '');
  if (!match) return null;
  const viewingId = Number(match[1]);
  const viewingTime = new Date(match[2]);
  if (viewingId < 1 || Number.isNaN(viewingTime.getTime()) || viewingTime.toISOString() !== match[2]) return null;
  return { viewingId, viewingTime };
}
