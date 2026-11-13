# Proposal

## Why

The customer journey review of 13/11 (`docs/ke-hoach-hanh-trinh-va-luong-n8n.md`) found that a customer who goes quiet is dropped by the system. Observed in the current code:

- After a viewing, the only automatic action for a silent customer is in flow 2: HOT gets a Telegram nudge to the sale, WARM and COLD are sent to Mautic, and only when the customer ticked "consent to marketing" (`followup-policy.ts`, `followup-sql.ts`). Mautic is now an optional extension, so for the core system a WARM or COLD customer, or any customer without consent, gets nothing. The lead stays in `VIEWED` forever.
- A lead in `CONSULTING` (bot lead, or the customer cancelled or did not show up) has no deadline at all. The only deadline, `response_due_at`, measures the *first* sale action (`STAFF_NUDGE`), not whether the sale ever reached the customer.
- "Không mua" has only `NO_SHOW`, `NOT_INTERESTED`, `CUSTOMER_CANCELLED`, `EXPIRED`, `OTHER`, so the weekly report cannot say whether customers are lost to price, to another property, or to another seller.
- A customer who does not show up gets no invitation to book again.

The teacher's topic is "visits, document signing, lead follow-up, and sales analytics" and asks for measurable results. Lead follow-up is currently the weakest of the four, and the data needed by the report (why we lose customers, whether the sale reached them) does not exist yet.

## What Changes

- **A sale can record contact.** New "đã liên hệ được" mark on a lead and a "tried to call, no answer" log entry. The mark is the stop signal for the follow-up ladder and the data point for response-time and funnel reports.
- **Detailed "Không mua" reasons.** The web picker offers: price too high, chose another property, bought elsewhere, cannot be reached, no longer needs it, other. Older reasons stay valid for existing rows and for system-set closes. New system reason `STALE` for automatic closing.
- **New flow 9, "follow-up ladder" (n8n, hourly).** Finds leads that have not been reached (day 0, 1, 3, 7) and leads that have been silent in `CONSULTING` or `VIEWED`. For each due step an AI proposes the next action and a draft email, a guardrail checks it, the assigned sale is told and confirms or edits, and the customer is emailed only if they consented. A lead silent for 7 days gets a reminder; after 14 days with no one handling it, it is closed with reason `STALE` and the manager is told. Thresholds are constants (7 and 14 days), not per-lead settings.
- **Flow 2 stops handling silent customers.** The 3-day silent branch (`HOT_NUDGE`, `WARM_NUDGE`, `COLD_NURTURE`) and its Mautic hand-off leave flow 2; flow 9 replaces them for every level. Mautic enrolment is no longer triggered by the core flows (flows 7 and 8 stay frozen as the optional extension).
- **Flow 2 invites no-shows to book again.** When a viewing is marked no-show, the customer (if they have an email) gets one email with a link to book a new time.
- **Schema in one base PR (FE-43).** All new columns and constants land first, as the team rules require, including contract columns that later tasks (agreed price, archived signed file) will use.
- **Docs and git.** The plan, the two contradictory business docs, the gap list and the task table are updated in `docs/` and pushed through small PRs so the other developer sees them on `dev`.

Out of scope (decided): the sale's task after a feedback response, including "see another property" (already built by Hậu in PR #79, flow "L5 theo dõi sau phản hồi"; this change only counts its updates as lead activity); the per-sale and per-property report blocks (PR #78); per-lead thresholds; SMS or Zalo channels; auto-suggesting properties; negotiation stage; after-sale stage; the weekly-report metrics (FE-47); contract price, property choice and signed-file archiving behavior (FE-48, FE-49); the small items in flows 1, 6b, error workflow (FE-50); OCR of ID cards, Google Calendar sync, voice, the post-`SIGNED` exit path and per-sale double booking (kept in "làm sau nếu có time"); the Expo app (FE-27, FE-28 moved to the same list).

## Capabilities

### New Capabilities

- `lead-contact-tracking`: how a sale records that a customer was reached or not, and which reasons a lead can be closed with.
- `lead-followup-ladder`: which leads the automation reminds and when, who must confirm, when the customer is emailed, and when a lead is closed as stale.
- `missed-viewing-rebooking`: what a customer who did not show up is offered.

### Modified Capabilities

None. `openspec/specs/` holds only `bot-lead-capture`, `lead-chat-history` and `staff-customer-entry`, none of which cover follow-up; the old silent-customer rule lives only in `docs/nghiep-vu/03-cham-soc-va-marketing.md` and is rewritten there.

## Impact

- **Backend** (NestJS): `leads` (new column and endpoint, lost-reason validation; Hậu's area), `followups` (new task types, selector SQL, claim rules; Hậu's area), `viewings` (no-show hook if needed; Hoàng's area), `contracts` entity (schema only; Hoàng's area). Base PR touches Hậu's files, so it needs Hậu's review. The database uses `synchronize: true`, but the team keeps an upgrade script for production (`backend/sql/fe-33-intake.sql` is the precedent), so a new `backend/sql/fe-43-journey.sql` is added.
- **n8n:** new `luong-9-follow-up-bac.json` (Hậu) and edits to `luong-2-follow-up.json` (Hậu; read the version on `dev` first, PR #79 added a call to the feedback-work worker). Flow 5 is not edited. The sub-workflow "Thông báo nhân viên" is used as is (FE-35 contract: pass `assigneeId`).
- **Web:** lead detail page gets a "đã liên hệ được" control and the new lost-reason picker (`LeadActions.tsx`, `web/src/lib/api.ts`).
- **Docs:** `docs/ke-hoach-hanh-trinh-va-luong-n8n.md` (new), `docs/nghiep-vu/vai-tro-va-trang-thai.md`, `03-cham-soc-va-marketing.md`, `docs/danh-sach-lo-hong.md`, `docs/danh-sach-task.md`, `docs/luong/` (new page for flow 9, edit for flow 2), `docs/api-contract.md` (Hậu's file), `docs/trien-khai.md` (import order), `README.md`.
- **Release:** after `v0.4.0` (FE-33 to FE-39). Manual steps on the VPS: run `backend/sql/fe-43-journey.sql` before the new backend starts, then import flow 9 (off), then flow 2, then switch flow 9 on.
- **Behavior change for the team:** because flow 2 no longer enrols WARM and COLD customers in Mautic, the existing Mautic campaigns stop receiving new contacts until the extension is re-enabled. This is the intended core/extension split and is stated in the docs.
