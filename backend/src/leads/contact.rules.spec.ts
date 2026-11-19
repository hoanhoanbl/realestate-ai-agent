import { BadRequestException, ForbiddenException, ValidationPipe } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { ContactAttemptDto } from './dto/contact-attempt.dto';
import { CONTACT_ATTEMPT_RESULTS, manualLostReason, planContactAttempt, planContactMark, type ContactSnapshot } from './contact.rules';

const owner: AuthUser = { id: 2, name: 'An', email: 'an@example.test', role: 'SALE' };
const other: AuthUser = { ...owner, id: 3 };
const manager: AuthUser = { ...owner, id: 1, role: 'MANAGER' };
const now = new Date('2026-11-18T03:00:00Z');
const earlier = new Date('2026-11-17T03:00:00Z');
const snapshot = (patch: Partial<ContactSnapshot> = {}): ContactSnapshot => ({
  status: 'CONSULTING', assignedUserId: owner.id, contactedAt: null, firstResponseAt: null, ...patch,
});

describe('FE-44: contact decisions before persistence', () => {
  it('records first contact, authenticated actor and first response together without mutating the input', () => {
    const lead = Object.freeze(snapshot());
    expect(planContactMark(lead, owner, now)).toEqual({
      patch: { contactedAt: now, firstResponseAt: now },
      event: { type: 'CONTACTED', actorUserId: owner.id, note: expect.any(String) },
    });
    expect(lead.contactedAt).toBeNull();
    expect(lead.firstResponseAt).toBeNull();
  });

  it('preserves the first contact time and does not create a second contact event', () => {
    expect(planContactMark(snapshot({ contactedAt: earlier, firstResponseAt: earlier }), owner, now))
      .toEqual({ patch: {}, event: null });
  });

  it('counts an explicit action in a new assignment as first response without overwriting old contact history', () => {
    expect(planContactMark(snapshot({ contactedAt: earlier }), owner, now))
      .toEqual({ patch: { firstResponseAt: now }, event: null });
  });

  it.each(CONTACT_ATTEMPT_RESULTS)('logs %s without marking the customer as reached', result => {
    const lead = Object.freeze(snapshot());
    const plan = planContactAttempt(lead, owner, result, now);
    expect(plan.patch).toEqual({ firstResponseAt: now });
    expect(plan.event).toMatchObject({ type: 'CONTACT_ATTEMPTED', actorUserId: owner.id });
    expect(plan.event?.note.startsWith(`${result}: `)).toBe(true);
    expect(lead.contactedAt).toBeNull();
  });

  it('preserves existing contact and response times after a later unsuccessful call', () => {
    const lead = snapshot({ contactedAt: earlier, firstResponseAt: earlier });
    expect(planContactAttempt(lead, owner, 'NO_ANSWER', now).patch).toEqual({});
    expect(lead.contactedAt).toBe(earlier);
    expect(lead.firstResponseAt).toBe(earlier);
  });

  it.each([undefined, null, '', 'CONTACTED', 'no_answer', {}, ['NO_ANSWER']])('rejects invalid attempt result %j', result => {
    expect(() => planContactAttempt(snapshot(), owner, result, now)).toThrow(BadRequestException);
  });

  it('allows the manager to record contact for another sale or an unassigned lead', () => {
    for (const assignedUserId of [owner.id, null]) {
      expect(planContactMark(snapshot({ assignedUserId }), manager, now).event?.actorUserId).toBe(manager.id);
    }
  });

  it('blocks the old sale after reassignment and blocks other sales on unassigned leads', () => {
    for (const assignedUserId of [other.id, null]) {
      const lead = snapshot({ assignedUserId });
      expect(() => planContactMark(lead, owner, now)).toThrow(ForbiddenException);
      expect(() => planContactAttempt(lead, owner, 'BUSY', now)).toThrow(ForbiddenException);
    }
  });

  it.each(['LOST', 'SIGNED'])('refuses both actions on %s leads, even when already marked or performed by a manager', status => {
    for (const actor of [owner, manager]) {
      const lead = snapshot({ status, contactedAt: earlier });
      expect(() => planContactMark(lead, actor, now)).toThrow(BadRequestException);
      expect(() => planContactAttempt(lead, actor, 'NO_ANSWER', now)).toThrow(BadRequestException);
    }
  });

  it('uses OTHER by default but refuses legacy, system-only and unknown manual reasons', () => {
    expect(manualLostReason()).toBe('OTHER');
    expect(manualLostReason('PRICE_TOO_HIGH')).toBe('PRICE_TOO_HIGH');
    for (const reason of ['STALE', 'NO_SHOW', 'EXPIRED', 'CUSTOMER_CANCELLED', 'NOT_INTERESTED', 'unknown']) {
      expect(() => manualLostReason(reason)).toThrow(BadRequestException);
    }
  });
});

describe('FE-44: contact attempt DTO validation (routes covered by integration tests)', () => {
  // Match main.ts: strip unknown properties rather than inventing a stricter route contract.
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const metadata = { type: 'body' as const, metatype: ContactAttemptDto };

  it.each(CONTACT_ATTEMPT_RESULTS)('accepts the supported result %s', async result => {
    expect(await pipe.transform({ result }, metadata)).toEqual({ result });
  });
  it('rejects missing or unsupported results', async () => {
    for (const body of [{}, { result: 'CONTACTED' }, { result: null }]) {
      await expect(pipe.transform(body, metadata)).rejects.toThrow(BadRequestException);
    }
  });
  it('strips client attempts to supply actor, response time or contact time', async () => {
    for (const field of ['actorUserId', 'contactedAt', 'firstResponseAt', 'status']) {
      expect(await pipe.transform({ result: 'BUSY', [field]: 'forged' }, metadata)).toEqual({ result: 'BUSY' });
    }
  });
});
