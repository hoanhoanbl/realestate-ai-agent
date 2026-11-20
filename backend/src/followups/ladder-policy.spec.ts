import { isLadderDue, ladderDecision, type LadderSnapshot } from './ladder-policy';
const epoch = new Date('2026-10-01T03:00:00Z').getTime();
const at = (n: number) => new Date(epoch + n * 86_400_000);
const snapshot = (patch: Partial<LadderSnapshot> = {}): LadderSnapshot => ({ lead_id: 1, status: 'CONSULTING', lost_reason: null,
  created_at: at(0), assigned_at: at(0), contacted_at: null, activity_at: at(0), eligible_since: at(0), reach_anchor: at(0),
  has_open_viewing: false, has_live_contract: false, has_open_feedback: false, ...patch });
describe('FE-45 ladder policy', () => {
  it.each([[0,null],[1,1],[2,1],[3,3],[6,3],[7,7],[13,7]])('highest reach step day %i', (n, step) => {
    const due = ladderDecision(snapshot(), at(n!));
    expect(due?.step ?? null).toBe(step);
  });
  it('never sends a step late after return on day 2; day 3 remains eligible', () => {
    const s = snapshot({ eligible_since: at(2), activity_at: at(2) });
    expect(ladderDecision(s,at(2))).toBeNull();
    expect(ladderDecision(s,at(3))?.step).toBe(3);
  });
  it('reassignment/reopening reset reach anchor', () => {
    const s = snapshot({ assigned_at: at(20), reach_anchor: at(20), eligible_since: at(20), activity_at: at(20) });
    expect(ladderDecision(s,at(20))).toBeNull();
    expect(ladderDecision(s,at(21))?.step).toBe(1);
  });
  it('day 7 unreached receives reach only', () => expect(ladderDecision(snapshot(),at(7))?.kind).toBe('REACH'));
  it('cancelled day 10: quiet day 17, stale day 24', () => {
    const s = snapshot({ eligible_since: at(10), activity_at: at(10) });
    expect(ladderDecision(s,at(16))).toBeNull();
    expect(ladderDecision(s,at(17))?.kind).toBe('QUIET');
    expect(ladderDecision(s,at(24))?.kind).toBe('STALE');
  });
  it('contact stops reach; note resets silence', () => {
    const s=snapshot({ contacted_at: at(2), activity_at: at(5) });
    expect(ladderDecision(s,at(7))).toBeNull();
    expect(ladderDecision(s,at(12))?.kind).toBe('QUIET');
  });
  it.each(['CONFIRMED','DEPOSIT','SIGNED','LOST'])('excludes status %s', status => expect(ladderDecision(snapshot({status}),at(30))).toBeNull());
  it.each(['has_open_viewing','has_live_contract','has_open_feedback'] as const)('protects quiet/stale with %s', guard => {
    const s=snapshot({ status:'VIEWED', contacted_at:at(0),[guard]:true });
    expect(ladderDecision(s,at(7))).toBeNull(); expect(ladderDecision(s,at(14))).toBeNull();
  });
  it('rejects stale snapshots/forged anchors', () => {
    expect(isLadderDue(snapshot(),{kind:'REACH',step:1,anchor:at(0).toISOString()},at(3))).toBe(false);
    expect(isLadderDue(snapshot(),{kind:'REACH',step:3,anchor:at(1).toISOString()},at(3))).toBe(false);
  });
});
