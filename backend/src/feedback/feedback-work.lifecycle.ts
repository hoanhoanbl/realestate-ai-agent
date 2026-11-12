import { EntityManager } from 'typeorm';
import { FeedbackWork, FeedbackWorkHistory } from './feedback-work.entity';

// Caller holds the lead lock. Also used when reopening a client to retire old work.
export async function closeFeedbackWork(m: EntityManager, leadId: number, reason: string) {
  // Some isolated legacy modules/tests do not load the feedback feature.
  if (!m.connection?.hasMetadata(FeedbackWork)) return;
  const rows = await m.getRepository(FeedbackWork).find({ where: { leadId }, lock: { mode: 'pessimistic_write' } });
  for (const w of rows.filter(w => w.status !== 'COMPLETED')) {
    w.status = 'COMPLETED'; w.completedAt = new Date(); w.version++;
    await m.save(w);
    await m.getRepository(FeedbackWorkHistory).save({ workId: w.id, actorUserId: 0, actorName: 'Hệ thống', outcome: 'CLOSED', note: reason, nextDueAt: null, nextViewingId: null });
  }
}
