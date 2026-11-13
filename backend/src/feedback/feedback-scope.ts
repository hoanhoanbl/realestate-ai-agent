import { EntityManager } from 'typeorm';
import { Feedback } from './entities/feedback.entity';
import { Viewing } from '../viewings/entities/viewing.entity';

// Same scope as FE-38: new token belongs to one viewing, legacy token to first viewing.
export async function feedbackViewing(em: EntityManager, feedback: Feedback) {
  const match = /^v([1-9]\d*)_[a-f0-9]{32}$/.exec(feedback.token);
  if (feedback.token.startsWith('v') && !match) return null;
  const id = match ? Number(match[1]) : undefined;
  if (id !== undefined && !Number.isSafeInteger(id)) return null;
  return em.getRepository(Viewing).findOne({
    where: { leadId: feedback.leadId, ...(id ? { id } : {}) }, order: { id: 'ASC' },
  });
}
