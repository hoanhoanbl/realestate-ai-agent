# Tasks

## 1. Backend: link chats to leads

- [x] 1.1 Add `ChatLogsService.linkChat(chatId, leadId, channel)` (links only unlinked logs of that chat) and make `create` inherit the lead from the chat's newest linked log when none is given. Verify: unit tests with a fake repository, plus a PostgreSQL integration test: 6 logs then a link → all 6 linked; a chat already linked to lead A and a new link to lead B → old logs stay on A and later logs still follow A; unlinked chat stays unlinked.
- [x] 1.2 Accept an optional `chatId` on the intake DTO for `POST /leads/intake` (webhook secret) and call `linkChat` after the lead transaction commits; a link failure is logged, not thrown. Verify: HTTP integration test — intake with `chatId` links earlier logs; intake without it links nothing; the JWT `POST /leads` ignores a `chatId` in the body.
- [x] 1.3 Let the public booking endpoint link a chat only when the request carries the webhook secret. Verify: HTTP integration test — booking with the secret and `chatId` links; the same body without the secret books normally and links nothing.
- [x] 1.4 Add `GET /api/leads/:id/chat-logs` (JWT) returning `[{ id, createdAt, route, question, reply, escalated }]` oldest first, limit 200, no chat id or execution id. Verify: HTTP test — 401 without login, 200 ordered list, 404 for an unknown lead, body has no `chatId`/`executionId`.

## 2. Web: chat history on the lead page

- [x] 2.1 Add `getLeadChatLogs` and its type to `web/src/lib/api.ts`, and a `LeadChatHistory` component shown on `web/src/app/admin/leads/[id]/page.tsx` only when the list is non-empty (customer and bot bubbles, route label, "đã báo nhân viên" mark). Verify: `npm run lint` and `npm run build`; browser check at 375 px with a mocked API for empty, short and long (200) lists, no horizontal scroll.

## 3. n8n: flow 6 captures the contact

- [x] 3.1 In `luong-6-telegram-agent.json` add the agent tool "Lưu liên hệ khách" (POST `/api/leads/intake`, `name`/`phone`/`needs` from the model, `chatId` and `source: 'telegram'` from n8n), extend the system message (when to ask, repeat back and wait for a clear yes, no email/budget, never twice, reveal nothing about a duplicate, re-ask on a bad phone) and pass `chatId` in the "Đặt lịch xem nhà" tool body. Verify: JSON loads in a local n8n; `scripts/check-bot-lead-capture.cjs` asserts the tool exists, `chatId` comes from the `Chuẩn hoá tin nhắn` expression and not `$fromAI`, `consentMarketing` is not sent, and the prompt contains the confirmation rule.
- [x] 3.2 Turn on intermediate steps for the agent and add the branch after "Kiểm tra câu trả lời": a code node that extracts the saved lead from the tool observation (tolerating non-JSON), an IF, "Soạn báo sale khách mới" (new vs returning title, Telegram username, link to the lead) and "Báo sale khách mới" calling the FE-35 sub-workflow with `assigneeId`; its failure must not block the reply. Verify: the same check script runs the extraction node on sample observations (created, reopened, existing, error body, plain text) and asserts the title, `assigneeId` and that error/plain text yields no alert; every connection and `$('...')` reference resolves.

## 4. End to end and documentation

- [x] 4.1 Run on a local n8n with the mock backend and SMTP from FE-35's harness: the branch after the agent with a recorded observation (new customer → one mail to the assignee, returning → "Khách cũ nhắn lại", none → no mail); a save-tool call body check against the real backend intake test (chat linked, duplicates reuse the lead). Verify: results recorded in the FE-36 doc; anything not run (real Gemini, real Telegram) is listed as not verified.
- [x] 4.2 Backend `npm run lint`, `npm run build`, `npm test` and web lint/build pass; existing check scripts still pass. Verify: command output.
- [x] 4.3 Write `docs/fe-36-bot-ghi-nhan-khach.md` and update `docs/luong/` flow 6 notes (or `docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md` if no flow-6 doc exists), `docs/api-contract.md` (new field, new endpoint, link rule), `docs/danh-sach-lo-hong.md` (LH-01, LH-11), `docs/danh-sach-task.md`, and `docs/trien-khai.md` (import flow 6 after backend and FE-35). Verify: every endpoint and field added above appears in `api-contract.md`.
