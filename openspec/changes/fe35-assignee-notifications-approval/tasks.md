# Tasks

## 1. Backend: recipient lookup and booking payload

- [x] 1.1 Add `GET /api/users/:id/notify-target` guarded by the webhook secret, returning `{ id, name, email, role, telegramChatId, pushToken }` and 404 for an unknown id. Verify: unit/HTTP test — 401 without secret, 200 with it, never returns `passwordHash`.
- [x] 1.2 Add `assignedUserId` to the `viewing_requested` payload built in `viewings.service.ts`. Verify: existing booking spec asserts the payload field for a lead with and without an assignee.

## 2. Backend: signed staff links

- [x] 2.1 Implement link signing and verification (viewing id and action, HMAC with the webhook secret; expiry is checked against the viewing's current time, not stored in the token), constant-time compare. Verify: unit tests for valid, tampered id/action, wrong signature, plus refusal rules incl. past viewing time.
- [x] 2.2 Add `POST /api/viewings/:id/staff-links` (webhook secret) returning `approveUrl`, `rescheduleUrl` built from `PUBLIC_WEB_URL`. Verify: HTTP test — 401 without secret, URLs contain a verifiable token, 404 for unknown viewing.
- [x] 2.3 Add public `GET /api/viewings/staff-links/:token` returning property, time, customer name, lead/viewing status and the refusal reason if any; no phone/email. Verify: HTTP test for each refusal in the spec (cancelled, not `NEW`, not the open viewing, expired, tampered) plus a PII check on the response body.
- [x] 2.4 Add public `POST /api/viewings/staff-links/:token/confirm` that re-checks every refusal condition and the AI-scoring-finished rule, records the first response for the assignee, then calls 1b with `{ event, leadId, viewingId, by }`; a second confirm is a no-op with "đã xử lý". Verify: integration test against the PostgreSQL fixture — approve once sends one 1b call, repeat sends none, scoring `PENDING` is refused.

## 3. Web: confirmation page

- [x] 3.1 Add public page `web/src/app/duyet/[token]/page.tsx` with the summary, a confirm button, and the refusal / success / already-handled states; helpers in `web/src/lib/api.ts`. Verify: `npm run lint` and `npm run build`; browser check at 375 px (no horizontal scroll) and with the API mocked for each state.

## 4. n8n: notification sub-workflow

- [x] 4.1 In `thong-bao-nhan-vien.json` add optional `assigneeId`: fetch notify-target, route email / Telegram / push to that person only, add the manager fallback and `fallbackToManager`, return per-channel sent/skipped/error. Keep the `emailTo` path byte-compatible. Verify: import into local n8n, run (a) sale with all channels, (b) sale without Telegram, (c) no assignee, (d) `emailTo` only — compare (d) to the old output shape.
- [x] 4.2 Add `scripts/check-notification-routing.cjs` that loads the JSON, runs the routing Code node for the four cases above and asserts recipients and result fields. Verify: `node scripts/check-notification-routing.cjs` prints PASS.

## 5. n8n: flow 1b per viewing

- [x] 5.1 In `luong-1b-chot-lich-thu-cong.json` accept `viewingId` (optional) in "Chuẩn hoá" and the lookup query; refuse when the viewing is not the lead's open one. Verify: run with a stale viewing id → "Bỏ qua"; run without `viewingId` → old behavior.
- [x] 5.2 Add the `reschedule_requested` event: log `RESCHEDULE_REQUESTED`, send the customer rearrangement email (copy from flow 1). Verify: local run produces the event call and one email; lead stays `NEW`.

## 6. n8n: flow 1 stops waiting

- [x] 6.1 In `luong-1-dat-lich.json` request the staff links from the backend and pass `assigneeId` plus the links into the notification; remove the push nodes, the Wait, "Kết quả duyệt" and every branch behind it (replies, customer emails, CONFIRMED update, approved/reschedule/timeout logs, Telegram status update); stop sending `approvalUrl`. Verify: `node scripts/check-*` for node references still passes and the JSON imports into local n8n with no dangling connection.
- [x] 6.2 Run flow 1 end to end on local n8n with a real booking: sale receives the notification with working links; execution finishes (no waiting execution). Verify: n8n Executions shows "success", none "waiting".
  - Ghi chú: chạy ngày 11/11 sau khi import bản repo (id `prt5invo7qugQx74`), publish, restart n8n và build lại backend từ `dev`. Đặt lịch qua `POST /api/viewings` (căn 4, lead 127, giao sale #2): execution `luong-1-dat-lich` #351 `success` sau 22 giây, không có `waitTill`; thông báo `thong-bao-nhan-vien` #352 `success`, Telegram trả `ok`, nội dung có link "Duyệt lịch" và "Đổi giờ"; lead có `AI_SCORED`, `automationStatus = COMPLETED`. Chỉ còn 1 execution "waiting" là #88 (17/10, bản flow cũ), không thuộc lần chạy này. Chưa bấm link Duyệt trong tin Telegram (phần đó đã kiểm ở các task 3 và 5.1). Dữ liệu thử đã xoá (lead 127, viewing 125); contact Mautic #3 của email thử vẫn còn.

## 7. End-to-end and release notes

- [x] 7.1 Run the link scenarios on local stack: approve; approve twice; change-time; link after cancel; link after viewing time (simulate by editing the viewing time); old link after a second booking; tampered token. Verify: each outcome matches the spec scenarios; record the results in the doc below.
- [x] 7.2 Backend `npm run lint`, `npm run build`, `npm test` pass; web lint/build pass.
- [x] 7.3 Write `docs/fe-35-thong-bao-phu-trach.md` (behavior, import order, test results) and update `docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md`, `02-dat-lich-den-dat-coc.md` (§2.1–2.3), `docs/api-contract.md`, `docs/trien-khai.md`, `docs/danh-sach-lo-hong.md` (LH-06, LH-07), `docs/danh-sach-task.md`. Verify: every endpoint added above appears in `api-contract.md`; the 24-hour wait and its manager warning are gone from the approval rules in the docs.
