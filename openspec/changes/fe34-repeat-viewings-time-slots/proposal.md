# Proposal

## Why

Since FE-33, a customer is one lead identified by phone number. The booking endpoint still allows only the first viewing on a lead: any customer whose phone already has a viewing (or whose lead is not `CONSULTING`) gets a 409 and cannot book another property, which blocks releasing `dev`. Separately, customers pick the viewing time in a free date-time box: they learn about a taken slot only after submitting (LH-08), and they can book 3 a.m., one minute from now, or two years ahead (LH-09). Cancelling or missing a viewing also closes the whole lead (LH-05), although the business rule (`docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md` §3.2) says only the viewing ends.

## What Changes

- **Repeat viewings on one lead.** A returning customer (same normalized phone) books a new viewing on the existing lead instead of getting a 409. Rule decided for this change: **at most one open viewing per lead** (an open viewing is `viewings.status = 'NEW'`, pending approval or confirmed). A second booking while one is open is rejected with a message giving the open viewing's time. Leads in `DEPOSIT` or `SIGNED` cannot book by themselves.
- **Lead status follows the current viewing cycle.** Booking a new viewing moves the lead to `NEW` (pending approval) and restarts flow 1 for it, as today's first booking does. Earlier viewings keep their own status as history.
- **BREAKING (business behavior): ending a viewing no longer closes the lead.** Customer cancel (link `/lich/<token>`) and staff "no-show, close" end only the viewing. The lead returns to its base status: `VIEWED` if any earlier viewing of the lead was attended, otherwise `CONSULTING`. Closing the lead stays an explicit staff action ("Mất khách").
- **Contracts use the last attended viewing**, not the last viewing row, so a cancelled second viewing cannot change the property of the deposit contract.
- **Bookable time slots.** Customer and bot bookings must be on the hour between 08:00 and 19:00 (Vietnam time), no earlier than 3 working hours from now (working hours 08:00–21:00, rounded up to the next full hour) and no later than 14 days ahead. Staff reschedules must be in the future and between 08:00 and 19:00, without the 3-hour and 14-day limits. The 60-minute gap between viewings of the same property stays.
- **New public endpoint listing slots** for a property over the bookable window, each marked available or taken, with no customer data.
- **Booking form uses a day and slot picker** instead of the free date-time box; taken slots are shown as unavailable before submitting.
- **Flow 6 (Telegram bot) tool description** tells the agent the slot rules and relays the backend's rejection message.

Out of scope (decided): several open viewings at the same time per lead, per-viewing approval, scoring once per lead instead of per booking (FE-35), per-viewing reminders and response deadlines in flow 2 (FE-38, Hậu).

## Capabilities

### New Capabilities

- `viewing-time-slots`: which times a viewing can be booked or moved to, the slot list a customer sees, and how the rules differ for customers, the bot and staff.
- `repeat-viewings`: how a lead holds a history of viewings, when a new viewing can be booked on an existing lead, how the lead status moves when a viewing is booked or ends, and which viewing a deposit contract uses.

### Modified Capabilities

None. `openspec/specs/` is empty; the related rules from `close-booking-to-deposit-gaps` (double-booking gap, customer self-service cancel, attendance) were never archived into main specs. The cancel and no-show behavior changes are stated as requirements in `repeat-viewings`.

## Impact

- **Backend (NestJS)**
  - `viewings`: `viewing-time.ts` (slot and window rules), `booking-rules.ts`, `viewings.service.ts` (create, reschedule, customer cancel, no-show close), `viewings.controller.ts` (slots endpoint), DTOs.
  - `leads/lead-intake.service.ts` (Hậu's area): replace the `firstViewingOnly` option with the repeat-booking rule. Needs Hậu's review.
  - `leads/leads.service.ts` (Hậu's area): base-status helper used when a viewing ends.
  - `contracts/contracts.service.ts`: pick the last attended viewing.
  - No new column, no SQL script.
- **Web**: `BookingForm.tsx` (slot picker), `web/src/lib/api.ts` (slots type and call), `LeadActions.tsx` labels for the no-show choice (lead detail is Hậu's area, label change only), `/lich/[token]` page text after cancel.
- **n8n**: flow 6 tool description and handling of 400/409 for "Đặt lịch xem nhà". Flows 1, 1b, 2 are not edited; they keep working because the lead is `NEW` again when a new viewing is booked.
- **Docs**: `docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md`, `02-dat-lich-den-dat-coc.md`, `docs/api-contract.md` (Hậu's file), `docs/danh-sach-lo-hong.md` (LH-05, LH-08, LH-09).
- **Release**: no manual step of its own. `dev` still must not go to `main` before FE-35; the FE-33 SQL step must be recorded for the release.
