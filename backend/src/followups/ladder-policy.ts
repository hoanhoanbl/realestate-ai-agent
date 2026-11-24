import { LADDER_QUIET_DAYS, LADDER_REACH_DAYS, LADDER_STALE_DAYS } from './followup-policy';

export type LadderKind = 'REACH' | 'QUIET' | 'STALE';
export interface LadderSnapshot {
  lead_id: number; status: string; lost_reason: string | null;
  created_at: Date | string; assigned_at: Date | string | null;
  contacted_at: Date | string | null; activity_at: Date | string;
  eligible_since: Date | string; reach_anchor: Date | string;
  has_open_viewing: boolean; has_live_contract: boolean; has_open_feedback: boolean;
}
export interface LadderDue { kind: LadderKind; step: number | null; anchor: string }
const day = 86_400_000;

// One highest-priority action per lead. Automated log entries never affect activity_at.
export function ladderDecision(s: LadderSnapshot, now: Date): LadderDue | null {
  const activity = new Date(s.activity_at).getTime();
  const reach = new Date(s.reach_anchor).getTime();
  const eligible = new Date(s.eligible_since).getTime();
  const time = now.getTime();
  if (![activity, reach, eligible, time].every(Number.isFinite) || activity > time || s.has_live_contract) return null;
  const quietStatus = ['CONSULTING', 'VIEWED'].includes(s.status);
  const quietAllowed = quietStatus && !s.has_open_viewing && !s.has_open_feedback;
  if (quietAllowed && time - activity >= LADDER_STALE_DAYS * day)
    return { kind: 'STALE', step: null, anchor: new Date(activity).toISOString() };
  if (['CONSULTING', 'NEW'].includes(s.status) && !s.contacted_at) {
    const step = [...LADDER_REACH_DAYS].reverse().find(n => reach + n * day <= time);
    if (step !== undefined && eligible <= reach + step * day)
      return { kind: 'REACH', step, anchor: new Date(reach).toISOString() };
  }
  const reachFinishedBeforeEligible = reach + LADDER_REACH_DAYS[LADDER_REACH_DAYS.length - 1] * day < eligible;
  if (quietAllowed && (s.contacted_at || reachFinishedBeforeEligible) && time - activity >= LADDER_QUIET_DAYS * day)
    return { kind: 'QUIET', step: null, anchor: new Date(activity).toISOString() };
  return null;
}

export function isLadderDue(s: LadderSnapshot, candidate: LadderDue, now: Date): boolean {
  const current = ladderDecision(s, now);
  return current !== null && current.kind === candidate.kind && current.step === candidate.step &&
    new Date(current.anchor).getTime() === new Date(candidate.anchor).getTime();
}
