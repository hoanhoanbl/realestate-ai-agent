import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { MANUAL_LOST_REASONS } from './lead.constants';

// FE-44: evaluated from a fresh snapshot inside the locked lead transaction.
export const CONTACT_ATTEMPT_RESULTS = ['NO_ANSWER', 'BUSY', 'CALL_BACK', 'WRONG_NUMBER'] as const;
export type ContactAttemptResult = (typeof CONTACT_ATTEMPT_RESULTS)[number];
export const CONTACT_ATTEMPT_LABELS: Record<ContactAttemptResult, string> = {
  NO_ANSWER: 'Không nghe máy',
  BUSY: 'Máy bận',
  CALL_BACK: 'Hẹn gọi lại',
  WRONG_NUMBER: 'Sai số điện thoại',
};

export interface ContactSnapshot {
  status: string;
  assignedUserId: number | null;
  contactedAt: Date | null;
  firstResponseAt: Date | null;
}

export function manualLostReason(reason?: string): string {
  const value = reason ?? 'OTHER';
  if (!MANUAL_LOST_REASONS.includes(value)) {
    throw new BadRequestException('Chọn lý do không mua hợp lệ; lý do hệ thống và mã cũ không được chọn tay');
  }
  return value;
}

export interface ContactPlan {
  patch: { contactedAt?: Date; firstResponseAt?: Date };
  event: { type: 'CONTACTED' | 'CONTACT_ATTEMPTED'; actorUserId: number; note: string } | null;
}

function authorize(lead: ContactSnapshot, actor: AuthUser) {
  if (actor.role !== 'MANAGER' && !(actor.role === 'SALE' && actor.id === lead.assignedUserId)) {
    throw new ForbiddenException('Chỉ người phụ trách hoặc quản lý được ghi nhận liên hệ');
  }
  if (['LOST', 'SIGNED'].includes(lead.status)) {
    throw new BadRequestException('Khách đã đóng hoặc đã ký, không ghi nhận liên hệ mới');
  }
}

// These functions never mutate the snapshot. Callers must reload it under the lead lock,
// then save the patch and event in ONE transaction, including first_response_at.
export function planContactMark(lead: ContactSnapshot, actor: AuthUser, now: Date): ContactPlan {
  authorize(lead, actor);
  return {
    patch: {
      ...(!lead.contactedAt ? { contactedAt: now } : {}),
      ...(!lead.firstResponseAt ? { firstResponseAt: now } : {}),
    },
    event: lead.contactedAt ? null : {
      type: 'CONTACTED', actorUserId: actor.id, note: 'Nhân viên ghi nhận đã liên hệ được với khách',
    },
  };
}

export function planContactAttempt(
  lead: ContactSnapshot, actor: AuthUser, result: unknown, now: Date,
): ContactPlan {
  authorize(lead, actor);
  if (!CONTACT_ATTEMPT_RESULTS.includes(result as ContactAttemptResult)) {
    throw new BadRequestException('Kết quả liên hệ không hợp lệ');
  }
  const key = result as ContactAttemptResult;
  return {
    patch: !lead.firstResponseAt ? { firstResponseAt: now } : {},
    event: { type: 'CONTACT_ATTEMPTED', actorUserId: actor.id, note: `${key}: ${CONTACT_ATTEMPT_LABELS[key]}` },
  };
}
