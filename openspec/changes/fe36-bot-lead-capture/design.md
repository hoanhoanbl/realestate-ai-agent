# Design

## Context

Observed at `dev` 5dab86c plus the FE-35 commit:

- Flow 6 has an AI Agent with tools "Tìm nhà", "Đặt lịch xem nhà" (POST `/api/viewings`), "Tra cứu lịch đã đặt", "Hỏi đáp tri thức" and "Suy nghĩ". Every turn ends in "Ghi log hội thoại" → `POST /api/chat-logs` with `chatId`, route, masked text. The "customer wants a human" path alerts the shared sale group through the old sub-workflow call.
- `POST /api/leads/intake` (webhook secret) returns `{ lead, created, reopened }`, de-duplicates by normalized phone and assigns a sale. It does not take a chat id and does not notify anyone.
- `chat_logs.lead_id` exists and is nullable; nothing sets it. `ChatLogsService.create` masks email and long numbers before saving.
- FE-35's `thong-bao-nhan-vien` accepts `assigneeId` and falls back to the manager.
- The booking endpoint is public; the throttler already recognises the webhook secret header.

## Goals / Non-Goals

**Goals:** a deterministic path from "customer confirms contact" to a lead, a sale alert and a visible chat history, with no schema change.

**Non-Goals:** consent capture, email capture, reply from the web admin, backfill of old chats, changing the "wants a human" alert.

## Decisions

### D1. The save tool calls intake and carries the chat id from n8n, not from the model
The tool body takes `name`, `phone`, optional `needs` from the model (`$fromAI`), and `chatId` plus `source: 'telegram'` from the n8n expression `$('Chuẩn hoá tin nhắn')`. The model never sees or controls the chat id, so it cannot link someone else's chat.
- Alternative: link afterwards by phone when writing the log. Rejected: the phone is often said in an earlier message than the confirmation, so the log written at that turn has nothing to match on.

### D2. Linking lives in the chat-logs service and runs after the lead commit
`ChatLogsService.linkChat(chatId, leadId, channel)` does one `UPDATE chat_logs SET lead_id = $leadId WHERE channel = $c AND chat_id = $id AND lead_id IS NULL`. Intake calls it after its transaction commits, so a link failure never rolls back a lead (it is logged and the next turn's inheritance covers new logs). Intake gets the chat id as an optional DTO field, honored by the webhook-secret endpoint only; the booking endpoint reads it only when the secret header matches (controller passes a `trusted` flag, no change to its public validation).
- Alternative: new column `leads.telegram_chat_id`. Rejected: schema change and release SQL for something the link table (`chat_logs`) already expresses.

### D3. New logs inherit the lead from the chat's last linked log
In `ChatLogsService.create`, when the DTO names no lead, the service selects the `lead_id` of the newest log of the same chat where `lead_id IS NOT NULL` and uses it. One lead per chat for new logs, newest link wins; old logs are never re-pointed. This keeps the flow's log node unchanged.

### D4. Notification is a separate branch after the agent, driven by the tool result
The agent node gets `returnIntermediateSteps`. A code node after "Kiểm tra câu trả lời" reads the steps, finds the "Lưu liên hệ khách" observation, parses `{ lead, created, reopened }` and emits `{ captured, assigneeId, leadId, leadName, returning }`. If `captured`, "Báo sale khách mới" calls the FE-35 sub-workflow with `assigneeId`; the result joins the existing path to "Chuẩn bị trả lời". A failed alert does not block the customer's reply.
- Alternative: backend calls an n8n webhook on intake. Rejected: a new workflow and webhook for a single alert; and manual/hotline leads would trigger it too.
- Risk accepted: tool observations arrive as strings; the parser must tolerate non-JSON and treat it as "not captured".

### D5. Read API and display
`GET /api/leads/:id/chat-logs` (JWT) returns `[{ id, createdAt, route, question, reply, escalated }]` oldest first, max 200, no chat id or execution id. The lead page shows a collapsible "Lịch sử chat Telegram" only when the list is non-empty. Visible to any logged-in staff, matching who can already open the lead.

### D6. Prompt rules instead of code for the confirmation step
Confirmation, no email/budget, no repeated calls and no duplicate disclosure are enforced in the agent's system message and tool description. The backend still enforces phone validity and de-duplication, so a misbehaving model can at worst create a valid, de-duplicated lead.

## Risks / Trade-offs

- [Model calls the tool without confirmation] → backend validates and de-duplicates; staff see the full chat on the lead; the alert is a normal "new customer" alert.
- [Two people share one Telegram chat] → latest link wins for new logs; older logs keep their lead.
- [Chat texts contain personal data the mask misses] → shown only to logged-in staff, already masked by FE-32; no new storage.
- [Lead page conflicts with PR #63] → both add one import and one JSX line to the same file; merge #63 first or resolve by keeping both.
- [Leads without email are skipped by flow 7] → until FE-40 (#65) is merged and its backend guard fixed, bot leads are not synced to Mautic. Not part of this change.

## Migration Plan

1. Deploy backend (no SQL).
2. Import and publish flow 6, restart n8n. The sub-workflow from FE-35 must already be imported.
3. Smoke test with the internal Telegram bot: leave a number, confirm; check the lead, the alert and the chat section.
Rollback: re-import the previous flow 6; backend additions are optional fields and a read endpoint.

## Open Questions

- Whether bot bookings should also appear as "customer left a contact" alerts. Today the booking alert from flow 1 already reaches the sale; left as is.
