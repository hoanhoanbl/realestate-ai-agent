import { IsIn } from 'class-validator';
import { CONTACT_ATTEMPT_RESULTS, type ContactAttemptResult } from '../contact.rules';

// No actor, status, contact time or first-response time is accepted from the client.
export class ContactAttemptDto {
  @IsIn(CONTACT_ATTEMPT_RESULTS)
  result: ContactAttemptResult;
}
