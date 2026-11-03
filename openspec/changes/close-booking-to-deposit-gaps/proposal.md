## Why

A review of the end-to-end flow (booking → approval → viewing → feedback → deposit contract) found 12 gaps. Three of them are real business errors: one property can get two active deposit contracts, a property under deposit still accepts new viewings, and n8n flow 2 marks a no-show customer as "viewed" when staff forget to click. The rest leave data wrong or leads stuck. The project deadline is 5/12/2026, so the gaps must be closed while there is still time to test on the VPS.

## What Changes

The 12 gaps, numbered as in the review:

1. **One active contract per property.** Creating a contract fails if the property already has a contract in `DRAFTING`, `PENDING_APPROVAL`, `SENT` or `SIGNED`. A partial unique index in the database enforces the same rule.
2. **Property reservation.** New property statuses `RESERVED` and `SOLD`:
   - Creating a contract moves the property to `RESERVED`.
   - A rejected or expired contract moves it back to `AVAILABLE`.
   - A manager can mark it `SOLD`.
   - Other customers who already have a viewing of that property keep their booking, and staff are told to call them.
3. **No automatic "viewed".** Flow 2 no longer moves `CONFIRMED` leads to `VIEWED`. It asks staff to confirm attendance (`ATTENDANCE_CHECK`) and escalates to the manager if nobody confirms.
4. **Flow 2 running in production.** Fix its Gemini credential reference, re-import it and publish it on the VPS after a dry-run query.
5. **Reminder after reschedule.** Flow 2 sends a new reminder when the viewing time changes after a reminder was already sent.
6. **Attendance only after the viewing starts.** "Viewed" / "No-show" can be set only from 30 minutes before the viewing time.
7. **No double booking.** A booking or reschedule fails with 409 if another pending viewing of the same property is within 60 minutes.
8. **Duplicate bookings.** The same email cannot hold two pending bookings for the same property. The admin lead page lists the customer's earlier bookings, matched by email.
9. **Abuse protection on the public booking form.** Rate limit per client IP. Requests carrying a valid `X-Webhook-Secret` (n8n flow 6) are exempt. A honeypot field catches bots.
10. **Separate no-show from lost.** `viewings.status` gets real values: `NEW`, `ATTENDED`, `NO_SHOW`, `CANCELLED`. New column `leads.lost_reason`. Stats and the weekly report (flow 4) count no-shows separately.
11. **Clear deposit semantics.**
    - UI labels: `DEPOSIT` = "Đang làm hợp đồng cọc", `SIGNED` = "Đã ký hợp đồng cọc".
    - A manager action "Đã nhận tiền cọc" records `contracts.deposit_received_at`.
    - A manager action marks the property `SOLD`.
12. **Customer self-service and feedback follow-up.**
    - The booking confirmation email links to a page where the customer can cancel or ask to reschedule.
    - The admin overview gets task groups for:
      - viewings waiting for attendance confirmation;
      - customers who answered "want to deposit";
      - customers who answered "no longer interested".

No lead status is added or renamed. Flows 6 and 7 and the web badges keep working with the existing six statuses.

**Defaults taken without explicit confirmation** (decisions 2–6 of the plan review):
- Other bookings on a reserved property are kept as backups.
- A no-show offers "reschedule" or "close as lost".
- Duplicate leads are linked by email, not merged.
- Item 11 stops at "deposit received" and "sold". There is no payment or notarization flow.
- "Ask to reschedule" only notifies staff. The customer does not pick a new time.

Hoàng implements every item, including the backend and flow 2.

## Capabilities

### New Capabilities
- `viewing-attendance`: viewing outcome states, the attendance-marking rules and time guard, no-show handling and lost reasons, the flow 2 attendance check and reminder rules, and reporting of attended vs no-show.
- `property-reservation`: property status lifecycle (`AVAILABLE`/`RESERVED`/`SOLD`/`HIDDEN`), one active contract per property, deposit-received and sold actions, deposit status labels.
- `booking-integrity`: double-booking prevention, duplicate pending booking per email and property, earlier-bookings view, rate limiting and honeypot on the public booking endpoint.
- `customer-self-service`: tokenised manage-booking page (cancel / ask to reschedule), and feedback-driven staff task groups on the admin overview.

### Modified Capabilities
- None (no specs exist yet in `openspec/specs/`).

## Impact

- **Backend (NestJS):**
  - entities `Viewing`, `Lead`, `Property`, `Contract`;
  - services `viewings`, `leads`, `contracts`, `properties`, `stats`, `feedback`;
  - a new booking-token module or endpoint;
  - `@nestjs/throttler` dependency, and `trust proxy` in `main.ts`.
  - Schema changes go through TypeORM `synchronize: true`. The new partial unique index fails at startup if production already has two active contracts on one property, so production data must be checked first.
- **n8n:**
  - `luong-2-follow-up.json` (attendance check, reminder rule, remove auto-VIEWED, Gemini credential id);
  - `luong-4-bao-cao.json` (attended / no-show counts);
  - `luong-1-dat-lich.json` and `luong-1b-chot-lich-thu-cong.json` (manage-booking link in the confirmation email);
  - `luong-6-telegram-agent.json` (relay 409 reasons to the customer).
  - Workflows must be re-imported and published on the VPS by hand, because CI does not import them.
- **Web (Next.js):**
  - `LeadActions`, the lead detail page, the admin overview, the property admin page, the public property page, the booking form, and `StatusBadge` labels;
  - a new `/lich/[token]` page.
- **API:** new endpoints for property status, deposit received, booking token and manage actions. `POST /viewings` and `PUT /viewings/:id` can return 409. `PUT /leads/:id/admin-status` gains the time guard and lost reason. `docs/api-contract.md` needs updating.
- **Production (iNET VPS):** deploy via CI, then manually re-import 5 workflows, run a dry-run of the flow 2 queries, and publish flow 2.
