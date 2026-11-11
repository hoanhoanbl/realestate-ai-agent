# Design

## Context

Observed in the repo at `dev` 5dab86c (FE-33, FE-34, FE-37 merged):

- `luong-1-dat-lich` is started by `viewing_requested` from the booking endpoint. It scores with the LLM, emails the customer, calls the `thong-bao-nhan-vien` sub-workflow, reads **all** `users.push_token`s, saves the AI result together with `$execution.resumeUrl` as `approvalUrl`, then sits in a Wait node for 24 hours. The Approve, Change-time and timeout branches all live after that Wait and each re-reads the latest viewing before acting.
- `luong-1b-chot-lich-thu-cong` (`viewing-admin-action`) already approves or confirms a reschedule by `leadId` from the web admin when the resume link is dead. It looks up the lead's latest viewing, not a given viewing.
- `thong-bao-nhan-vien` takes `emailTo` or none, and a Telegram chat from `TELEGRAM_SALE_CHAT_ID` (shared group). `luong-2` (FE-38 alerts) and `luong-3` call it with `emailTo`; FE-38 treats `emailSent=true` as the success signal, so those fields must stay.
- Users already have `telegramChatId`, `pushToken`, `acceptingLeads`; leads have `assignedUserId`. n8n's read-only database role is not granted `users`, so routing data is read through the backend.
- `leads.service.approve()` first tries the lead's `approvalUrl`, then falls back to flow 1b.

## Goals / Non-Goals

**Goals:**
- One sale is notified per lead event; manager fallback; unchanged contract for current callers.
- No execution waits on a human. Approval lives in the backend and 1b.
- Approve/Change-time links valid until the viewing time, safe against scanners, forged ids and stale viewings.

**Non-Goals:**
- Scoring leads that never book (flow 1 keeps its booking trigger).
- Editing the Telegram message after the decision.
- New columns, new SQL, new environment variables.

## Decisions

### D1. The sub-workflow resolves recipients through the backend
Add `GET /api/users/:id/notify-target` (webhook secret) returning `{ id, name, email, role, telegramChatId, pushToken }`. The sub-workflow accepts an optional `assigneeId`; when present it calls this endpoint and routes to those channels. When absent it behaves as today (`emailTo` + shared Telegram chat).
- Alternative: grant n8n's read-only role `SELECT` on `users` columns. Rejected: it widens a credential to password-adjacent table, and the existing hardening (`readonly-role.sql`) deliberately excludes `users`.
- Alternative: have the caller pass email/chat/token. Rejected: three callers would each have to fetch and keep the lookup correct.

### D2. Fallback order is assignee channels, then manager email
Resolved in one Code node inside the sub-workflow: assignee found with at least one channel → send to it; otherwise → manager email, with `fallbackToManager: true` in the result. `emailTo` callers never hit this path. The manager email stays in the sub-workflow's existing config node.

### D3. Push moves into the sub-workflow, to one token
The "read all push tokens" and "send push" nodes leave flow 1. The sub-workflow sends the Expo push to the assignee's single token. Flow 3's current hard-coded notices are not routed to a sale in this change.

### D4. Flow 1 stops waiting; backend issues the links
Flow 1 ends after "Lưu kết quả AI" + the `AI_SCORED` log. Before notifying, it asks `POST /api/viewings/:id/staff-links` (webhook secret) for `approveUrl` and `rescheduleUrl`. The token is stateless: `base64url({v: viewingId, a: action}).HMAC-SHA256(WEBHOOK_SECRET)`. The expiry is not in the token: it is checked against the viewing's *current* time when the link is opened, so rescheduling a viewing moves the deadline with it and nothing is stored.
- Alternative: extend the Wait to the viewing time (up to 14 days). Rejected: a long-lived execution per booking, lost state on n8n data wipes, and the Telegram/email buttons still die if n8n restarts. The stateless link survives restarts and works with the existing web fallback.
- Alternative: signed link straight to an n8n webhook. Rejected: n8n cannot sign without allowing `crypto` in the Code node, and state-changing GETs are scanner-prone.

### D5. Opening shows a page; confirming POSTs
Links go to a public web page `/duyet/<token>`. `GET /api/viewings/staff-links/:token` returns a summary (property, time, customer name, status); `POST …/confirm` performs the action. The backend re-checks every condition in the `staff-viewing-action-links` spec at confirm time, then calls flow 1b.
- Alternative: GET performs the action (like today's `resumeUrl`). Rejected: email scanners and chat link previews would approve viewings.
- The page needs no login; the token is the capability. Preview excludes phone and email.

### D6. Flow 1b becomes per viewing and gains `reschedule_requested`
1b's lookup query takes `viewingId` when present (falls back to the latest viewing for the existing web-admin caller). It gains a third event whose branch is the "Cần hẹn lại giờ xem nhà" email copied from flow 1. The `APPROVED` and `RESCHEDULE_REQUESTED` events are logged by 1b, so the backend confirm endpoint only validates, records the first response for the lead's assignee, and triggers 1b. 1b sends no Telegram follow-up: the confirmation page already shows the outcome.
- The first-response actor is the assigned user; the event note says "qua thông báo".

### D7. Old approval path is kept for in-flight executions
`leads.service.approve()` keeps the `approvalUrl` resume branch. New leads never get an `approvalUrl` (flow 1 stops sending it), so the branch only serves executions already waiting at deploy time; those finish on their stored definition. Removing the branch and the column is a later cleanup.

## Risks / Trade-offs

- [Telegram message keeps its buttons after the decision] → the confirm page says "đã duyệt"/"đã xử lý" when opened again; accepted loss of edit-in-place.
- [A forwarded link lets another person act] → same as today's email button; the page shows only name and property, and every action is logged.
- [`WEBHOOK_SECRET` rotation invalidates outstanding links] → acceptable; links are reissued on the next booking, and staff fall back to web-admin approval.
- [Sub-workflow change breaks flow 2 manager alerts] → `emailTo` path is untouched; a check script asserts the old input produces the same output shape (FE-38 relies on `emailSent`).
- [Import order] → backend first, then sub-workflow and 1b, then flow 1; flow 1 depends on the new endpoints and 1b's new event.
- [Rescheduled or cancelled viewing, link still unexpired] → conditions are re-checked at confirm time, never trusted from the token.

## Migration Plan

1. Merge FE-38 (#64) first; this change does not edit flow 2 but shares `docs/` files with it.
2. Deploy backend (adds endpoints; no SQL).
3. Import and publish `thong-bao-nhan-vien`, then `luong-1b`, then `luong-1` on the VPS; restart n8n.
4. Smoke test with one internal booking (see tasks 7).
Rollback: re-import the previous `luong-1` JSON; the web fallback keeps working because `approve()` still handles both paths.

## Open Questions

- Whether leads created without a viewing (bot, hotline) should be scored at creation. Left out here; revisit with FE-36.
