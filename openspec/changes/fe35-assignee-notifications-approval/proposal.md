# Proposal

## Why

FE-33 gives every lead an assigned sale, but the n8n flows still ignore it (LH-06). The staff-notification sub-workflow sends every alert to one hard-coded email and one shared Telegram group, and flow 1 pushes to every staff member with the mobile app, so the assigned sale gets no more attention than anyone else. Flow 1 also keeps one execution waiting 24 hours on the Approve button (LH-07): after that the button in the notification dies, a manager warning mail goes out, and a second path (flow 1b) has to exist. FE-38 now alerts the manager after 2 working hours of silence, which makes the 24-hour wait and its manager mail redundant.

## What Changes

- **Notifications go to the assigned sale.** The staff-notification sub-workflow accepts an assignee id and sends to that person's own email, personal Telegram chat and push token only. No shared group, no broadcast. If the lead has no assignee, or the assignee has no usable channel, the alert falls back to the manager email; the result still reports which channels succeeded. Callers that pass only `emailTo` (flow 2 manager alerts, flow 3 contract notices) keep working unchanged.
- **Approve and "Change time" are links valid until the viewing time.** Flow 1 stops waiting. After scoring it sends the notification and ends. The buttons in the email and Telegram message open a confirmation page on the web app; confirming approves the viewing or records a reschedule request through flow 1b. A link stops working at the viewing time, after the viewing is cancelled, or once the lead is no longer waiting for approval. **BREAKING (business behavior): the 24-hour expiry and the "over 24 hours unapproved" manager email are removed**; FE-38's response-deadline alert replaces them.
- **Flow 1b works per viewing.** It receives the viewing id so an old link can never confirm a newer viewing, and it gains a third event, `reschedule_requested`, which carries the "we need to arrange another time" email that flow 1 used to send.
- **Backend** adds a read endpoint for a user's notification targets (webhook secret), an endpoint that issues signed staff links for a viewing, and public preview and confirm endpoints for those links. The booking webhook payload to flow 1 now includes the assigned user id.
- **Telegram messages are no longer edited after approval.** Flow 1 no longer lives long enough to edit its own message; the approval page confirms the outcome instead.

Out of scope (decided): scoring leads that never book a viewing (flow 1 still starts from a booked viewing; leads created by bot or by hand are not scored until they book); notifying the sale about a new bot lead (FE-36 uses the routing contract delivered here); routing of flow 3 and flow 5 notices to the sale; several open viewings per lead.

## Capabilities

### New Capabilities

- `assignee-notification-routing`: who receives an alert about a lead, through which channels, what happens when a recipient or channel is missing, and what the sending result reports.
- `staff-viewing-action-links`: how staff approve a viewing or ask to reschedule it from a notification, how long those links work, which conditions make a link refuse to act, and what the link exposes.

### Modified Capabilities

None. `openspec/specs/` is empty; the earlier rules for the Approve button (24 hours, resume link) live only in `docs/` and are rewritten there.

## Impact

- **n8n** (Hoàng's area): `thong-bao-nhan-vien.json` (recipient routing, push), `luong-1-dat-lich.json` (remove Wait branch, call new notification, fetch links), `luong-1b-chot-lich-thu-cong.json` (viewing id, `reschedule_requested`). Flow 2 and flow 3 are not edited; the sub-workflow stays input-compatible with them.
- **Backend** (NestJS): `users` (notify-target read), `viewings` (staff-link issue, preview, confirm; payload field in the booking trigger), `leads.service` approve path keeps the old resume link only for executions already waiting at deploy time (Hậu's file: needs a review request). No new column, no SQL script.
- **Web**: new public page for the confirmation (Hoàng's area), API helpers in `web/src/lib/api.ts`.
- **Docs**: `docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md`, `02-dat-lich-den-dat-coc.md` (§2.1–2.3), `docs/api-contract.md` (Hậu's file), `docs/trien-khai.md` (import order), `docs/danh-sach-lo-hong.md` (LH-06, LH-07), `docs/danh-sach-task.md`.
- **Release**: gates `v0.4.0` together with FE-38. Manual steps on the VPS: deploy backend, then import and publish the sub-workflow, flow 1b, then flow 1; executions already waiting in the old flow 1 finish on the old definition.
