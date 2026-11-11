# Proposal

## Why

The Telegram bot (flow 6) can only create a lead when a customer books a viewing. A customer who asks about houses and leaves a phone number, or who asks to be called, is lost: the bot's own fallback message invites them to "leave a phone number" but no tool stores it, and staff must open n8n Executions to read what the customer asked (LH-01, LH-11). FE-33 already provides the intake API with phone de-duplication and sale assignment, and FE-32 already logs every bot turn into `chat_logs` with a `lead_id` column that nothing fills. FE-36 connects the two ends.

## What Changes

- **Bot can save a contact.** Flow 6 gets a tool "Lưu liên hệ khách" that creates (or reuses, by normalized phone) a lead through the existing intake API with source `telegram`, no marketing consent, and the Telegram chat id. The agent asks for name and phone, repeats them back, and calls the tool only after the customer confirms. Invalid phone numbers are rejected by the backend and the bot asks again.
- **The assigned sale is told.** When the tool created, reopened or found a lead, flow 6 notifies the lead's assigned sale through the FE-35 routing (email, personal Telegram, push; manager if there is no assignee). A returning customer gets a different title ("Khách cũ nhắn lại").
- **Chat is attached to the lead.** Intake and the bot's booking call accept the Telegram chat id (only from callers holding the webhook secret). The backend links every earlier log of that chat to the lead, and later logs of the same chat inherit the lead automatically. A chat is followed by the first lead it was linked to: a later contact in the same chat links only logs not yet attached to any lead, and new logs keep following the first lead (decided: changing this would need a schema change, and a second number in one chat is rare).
- **Staff can read the chat.** New `GET /api/leads/{id}/chat-logs` for logged-in staff, and a "Lịch sử chat Telegram" section on the lead detail page. Texts are the already-masked ones (email and long numbers replaced), so the phone number shown in the lead is the only place it appears.
- Docs: flow 6 notes, API contract, lead rules in `docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md`.

Out of scope (decided): marketing consent from the bot (stays false; consent is collected on the web form), email capture, Mautic sync for bot leads without email (FE-40, #65), routing the existing "customer wants a human" alert to the assigned sale, backfilling chats of leads that existed before this change, a chat reply composer in the web admin.

## Capabilities

### New Capabilities

- `bot-lead-capture`: when and how the Telegram bot records a customer's contact as a lead, what it must confirm first, how duplicates and bad input behave, and who is notified.
- `lead-chat-history`: how bot conversations are linked to a lead, which logs are linked, and who can read them and in what form.

### Modified Capabilities

None. `openspec/specs/` is empty; the `chat_logs` rules from FE-32 live in `docs/` only and are extended there.

## Impact

- **n8n** (Hoàng's area): `luong-6-telegram-agent.json` (new tool, system prompt, intermediate steps, notification branch, `chatId` on the booking tool). Sub-workflow `thong-bao-nhan-vien` is called as delivered by FE-35.
- **Backend**: `chat-logs` (link service, inherit on create, read endpoint), `leads` controller (read endpoint), intake DTO and `viewings` booking (optional `chatId`, honored only with the webhook secret). Intake and chat-log code is Hậu's area: needs a review request. No new column, no SQL (`chat_logs.lead_id` exists).
- **Web**: lead detail page gets `LeadChatHistory` (Hoàng's area); `web/src/lib/api.ts`. Touches the same page that PR #63 (FE-39) edits, so merge order matters.
- **Docs**: `docs/luong/` flow 6 note, `docs/api-contract.md` (Hậu's file), `docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md`, `docs/danh-sach-lo-hong.md` (LH-01, LH-11), `docs/danh-sach-task.md`.
- **Release**: part of `v0.4.0`; import flow 6 after the backend deploy.
