# Design

## Context

See proposal.md for the problem. Current state that shapes the approach (branch `feature/FE-34-buoi-xem-khung-gio`, based on `dev` with FE-33):

- `viewings.create` calls `LeadIntakeService.receive(em, dto, { status: 'NEW', firstViewingOnly: true })` inside the property-locked transaction. `firstViewingOnly` throws 409 for any existing lead that is not `CONSULTING` or already has a viewing.
- Everything downstream is lead-scoped and reads "the latest viewing" (`ORDER BY id DESC LIMIT 1`): `leads.findDetail`, `adminSetStatus`, `contracts.create`, `feedback`, `stats`, flow 2's `latest_viewings`. Approval is lead-scoped too: `leads.approval_url` holds the flow 1 resume URL, and flows 1/1b call back with `leadId`.
- `viewing-time.ts#parseViewingTime` only checks "future". `booking-rules.ts#assertNoBookingConflict` enforces the 60-minute gap on open viewings (`v.status = 'NEW'` and lead `NEW`/`CONFIRMED`).
- `customerCancel` and `recordAttendance(NO_SHOW, CLOSE)` set the lead `LOST` (`CUSTOMER_CANCELLED` / `NO_SHOW`) through `leadsService.updateStatus`, which fires the `lead-changed` webhook (flow 7 → Mautic).
- `intake-rules.ts#responseDeadline` already adds 2 working hours in the 08:00–21:00 window (UTC+7).
- Flow 7 rejects payloads whose status is not one of the six old statuses and payloads without a valid email.

## Goals / Non-Goals

**Goals:**
- Keep the "latest viewing = current viewing" assumption true everywhere by allowing only one open viewing per lead, so flows 1, 1b and 2 and the lead-scoped approval keep working without a rewrite.
- One place for time rules, used by the booking endpoint, the slot list, staff reschedules and the bot.

**Non-Goals:**
- Per-viewing approval, several open viewings at once, scoring once per lead (FE-35).
- Per-viewing reminders, attendance checks and feedback in flow 2 (FE-38).
- Picker UI for staff reschedule in web admin: staff keep the date-time input; only the backend rules change.

## Decisions

### D1. "Open viewing" = `viewings.status = 'NEW'`; no new column
Open = pending approval or confirmed and not yet ended; the lead status (`NEW` vs `CONFIRMED`) tells which. While at most one viewing per lead is open, the latest viewing row is always the current one, so existing "latest viewing" queries stay correct.
*Alternative:* a viewing-level confirmation column (`confirmed_at`) or status `CONFIRMED`. Needed only for several open viewings; rejected with that scope.

### D2. Replace `firstViewingOnly` with a booking mode in `LeadIntakeService.receive`
Rename the option to `booking: true`. With an existing lead:
1. `DEPOSIT`/`SIGNED` → 409 "Bạn đang làm hợp đồng đặt cọc với chúng tôi, vui lòng liên hệ nhân viên…".
2. Has a viewing with `status = 'NEW'` → 409 "Bạn đang có lịch xem lúc … Nếu cần đổi giờ, hãy dùng link trong email xác nhận hoặc liên hệ nhân viên." (reuses the old duplicate-booking wording).
3. Otherwise: run the existing reopen logic for `LOST`, then set `NEW`, new `eventId`, `automationStatus = PENDING`, clear `approvalUrl`, fill missing email/budget/needs, add the property to `interestedPropertyIds`, log `STATUS_CHANGED` "<old> -> NEW: Đặt buổi xem mới".
The check runs after `ASSIGNMENT_LOCK_SQL` and the lead row lock (already taken in `receive`), and `viewings.create` already holds the property lock, so two concurrent bookings of the same customer serialize on the assignment lock and the second one sees the first viewing.
*Ownership:* `lead-intake.service.ts` is Hậu's file; the PR asks Hậu to review this part.

### D3. Base status helper for ending a viewing
Add `LeadsService.restoreBaseStatus(leadId, note)`: base = `VIEWED` if the lead has another viewing with status `ATTENDED`, else `CONSULTING`; calls `updateStatus` (so `STATUS_CHANGED` and `lead-changed` fire as for any status change) and clears `lostReason`. `customerCancel` and the no-show-close branch call it instead of `updateStatus(LOST, …)`. They keep logging `VIEWING_CANCELLED` / `VIEWING_NO_SHOW`, so stats that count no-shows from events are unaffected.
`adminSetStatus(LOST)` is unchanged (it already cancels a `NEW` viewing).
*Alternative:* keep `LOST` and let staff reopen. Rejected: contradicts business rule §3.2 and loses returning customers.

### D4. Time rules in `viewing-time.ts`, shared working-hours helper
- Generalize `responseDeadline` into `addWorkingHours(from, hours)` in `intake-rules.ts` (keep `responseDeadline = addWorkingHours(from, 2)`; Hậu's file, behavior unchanged, covered by its existing tests).
- `viewing-time.ts` gets constants (`VIEWING_FIRST_HOUR = 8`, `VIEWING_LAST_HOUR = 19`, `BOOKING_LEAD_HOURS = 3`, `BOOKING_MAX_DAYS = 14`) and:
  - `earliestBookableSlot(now)`: `addWorkingHours(now, 3)` → round up to the full hour → if hour > 19, next day 08:00.
  - `assertCustomerSlot(date, now)` (hours, on the hour, earliest, 14 days) and `assertStaffTime(date, now)` (future, hours).
  - `bookableSlots(now)`: hourly slots from earliest to now + 14 days, grouped by Vietnam date.
- `parseViewingTime` keeps parsing and the future check; callers add the right assert. All arithmetic in UTC+7 by offset, independent of the server TZ (same approach as `responseDeadline`).

### D5. Slot list endpoint: `GET /api/viewings/slots?propertyId=<id>`
Public (no JWT), same throttling as other public reads. Checks the property is `AVAILABLE`, computes `bookableSlots(now)`, loads open viewing times of the property in that window with the same predicate as `assertNoBookingConflict` (viewing `NEW`, lead `NEW`/`CONFIRMED`), and marks a slot taken when an open viewing is less than 60 minutes away. Response: `{ earliest, latest, days: [{ date: 'YYYY-MM-DD', slots: [{ time: 'HH:mm', start: ISO, available: boolean }] }] }`. No lead data.
Placed on `viewings` (Hoàng's area) rather than `properties` because it reuses booking rules.

### D6. Flow 1 guard compares the viewing id
After a cancel and a quick re-booking, the old flow 1 execution of cycle 1 is still waiting; its Approve button would pass today's guard (lead `NEW`, latest viewing `NEW`) and confirm the new viewing. Fix: add `viewingId` to the `viewing-requested` payload; flow 1's "Kiểm tra lịch còn chờ duyệt" checks that the latest viewing id equals it. Clearing `approval_url` on cancel already stops web admin from resuming the old execution.

### D7. Flow 7 and leads without Mautic data
`CONSULTING` now reaches flow 7 through `lead-changed` (cancel/no-show of a first viewing). Add `CONSULTING` to flow 7's accepted statuses (one-line change in Hậu's flow, Hậu reviews). Also `fireLeadChanged` skips leads without email (no Mautic contact can be matched), which FE-36/37 will need anyway.

### D8. Contracts pick the last attended viewing
`contracts.create` loads `findOne({ where: { leadId, status: 'ATTENDED' }, order: { viewingTime: 'DESC' } })`. Error when none: "Khách chưa có buổi xem nào đã đến, chưa lập hợp đồng được".

### D9. Lead detail viewing history
`leads.findDetail` adds `viewings: [{ id, propertyId, propertyName, viewingTime, status }]` newest first. Web shows it as a small list on the lead page (new component `ViewingHistory.tsx`, so Hậu's page gets a one-line include).

### D10. Booking form
`BookingForm.tsx` loads `/viewings/slots`, renders day chips then hour chips (taken ones disabled), sends the slot's `start`. On 409/400 it shows the message and reloads slots. The honeypot, consent and other fields stay.

## Risks / Trade-offs

- [Flow 2 is lead-scoped by events] Reminder, attendance check and feedback skip a lead that already has `REMINDER_SENT` / `ATTENDANCE_CHECK_SENT` / `FEEDBACK_ASKED` from an earlier viewing, so a returning customer's second viewing gets no reminder or feedback request. → Documented as a FE-38 requirement; `dev` → `main` release is gated on FE-35 and FE-38, not only FE-35.
- [Flow 1 scores again on each booking] AI re-scores the lead and emails the customer again on every new viewing. → Accepted until FE-35 (matches today's per-booking behavior).
- [Lead status of a viewed customer goes back to `NEW`] Funnel counts by current lead status drop a `VIEWED` customer while their new viewing is pending. → Viewing history keeps the attended viewing; stats by events are unaffected. Revisit if FE-38 reports need it.
- [`EXPIRE_LEAD` in flow 2] An unapproved second viewing whose time passes still closes the lead `LOST/EXPIRED` (business rule §5 keeps this). → Accepted; staff can reopen by booking again.
- [Bot sends half-hour or out-of-window times] → Tool description lists the rules; the backend rejects with a readable message the agent relays.
- [Server timezone] → All slot math uses fixed UTC+7 offsets; tests cover server TZ = UTC.

## Migration Plan

- No schema change, no SQL. Existing leads keep their status. Leads closed as `LOST/CUSTOMER_CANCELLED` or `LOST/NO_SHOW` before this change stay closed; booking again reopens them through D2.
- Deploy with the next release after FE-35 and FE-38: re-import flow 1 (D6), flow 6 (tool description) and flow 7 (D7) on the VPS (`import:workflow` → `publish:workflow`), as in `docs/trien-khai.md`.
- Rollback: revert the PR. No data to undo; viewings booked on existing leads stay valid rows.
