# Tasks

Specs: `specs/viewing-time-slots/spec.md`, `specs/repeat-viewings/spec.md`. Design decisions D1–D10 in `design.md`.

## 1. Time rules (backend)

- [x] 1.1 In `backend/src/leads/intake-rules.ts`, generalize `responseDeadline` into `addWorkingHours(from, hours)` and keep `responseDeadline(from) = addWorkingHours(from, 2)` (D4); verify the existing `intake-rules.spec.ts` cases still pass unchanged
- [x] 1.2 In `backend/src/viewings/viewing-time.ts`, add the constants and `earliestBookableSlot`, `assertCustomerSlot`, `assertStaffTime`, `bookableSlots` (D4); add `viewing-time.spec.ts` covering every scenario of the "Earliest bookable slot", "Viewing hours", "Customer bookings are on the hour", "Latest bookable slot" and "Staff time rules" requirements, run with `TZ=UTC` and `TZ=Asia/Ho_Chi_Minh`, and verify `npm test` passes
- [x] 1.3 Apply `assertCustomerSlot` in `viewings.create` and `assertStaffTime` in `viewings.update` and the no-show reschedule path, before any write; verify with tests that a 03:00 booking, a 10:30 bot booking and a staff move to 20:00 return 400 and save nothing

## 2. Slot list endpoint (backend)

- [x] 2.1 Add `GET /api/viewings/slots?propertyId=` (D5) with a query DTO, the `AVAILABLE` check and the taken-slot marking that reuses the open-viewing predicate of `assertNoBookingConflict`; verify with tests: a taken 09:00 marks only 09:00, today's list starts at the earliest slot, a reserved property returns 400, and the response has no lead fields
- [x] 2.2 Document the endpoint and the new 400 messages of `POST /viewings` and `PUT /viewings/:id` in `docs/api-contract.md` (Hậu's file, flag in the PR); verify the documented example matches a real response from the local backend

## 3. Repeat viewings on one lead (backend)

- [x] 3.1 Replace `firstViewingOnly` with the booking mode in `LeadIntakeService.receive` (D2: deposit block, open-viewing block with time, reopen + move to `NEW`, fill missing fields, `STATUS_CHANGED` event); extend `lead-intake.integration.spec.ts`: `VIEWED` lead books another property on the same lead, `CONSULTING` first booking, `LOST` lead reopened, `DEPOSIT` 409, open viewing 409 with the time, two concurrent bookings of the same phone save one viewing; verify all pass against the test PostgreSQL
- [x] 3.2 Add `viewingId` to the `viewing-requested` webhook payload in `viewings.service.ts` (D6); verify in a unit or integration test that the payload carries the new viewing's id
- [x] 3.3 Add `LeadsService.restoreBaseStatus` (D3) and use it in `customerCancel` and the no-show-close branch of `recordAttendance`, keeping the `VIEWING_CANCELLED` / `VIEWING_NO_SHOW` events and clearing `approvalUrl` on cancel; verify with tests: first viewing cancelled → `CONSULTING`, second viewing no-show after an attended one → `VIEWED`, lost reason empty, approval URL cleared
- [x] 3.4 Make `fireLeadChanged` skip leads without email (D7); verify with a unit test that no webhook call is made for a lead with `email = null`
- [x] 3.5 Change `contracts.create` to use the lead's most recent `ATTENDED` viewing (D8); verify with a test: attended property A, then cancelled property B → contract for A; no attended viewing → 400 with the new message
- [x] 3.6 Add `viewings` (history, newest first, with property name and status) to `leads.findDetail` (D9); verify with a test on a lead with two viewings
- [x] 3.7 Run `npm run lint`, `npm run build` and `npm test` in `backend` with `FE33_TEST_DATABASE_URL` set to a throwaway PostgreSQL container; verify all pass

## 4. Web

- [x] 4.1 Add the slots type and `getViewingSlots(propertyId)` to `web/src/lib/api.ts`, and a `viewings` field on the lead detail type; verify `npm run lint` and the TypeScript check pass
- [x] 4.2 Replace the date-time input in `BookingForm.tsx` with the day and hourly-slot picker (D10), disabled taken slots, reload on 400/409; verify in the browser against the local backend: a taken slot cannot be picked, a slot taken from another tab shows the 409 message and refreshes, and the form works at 375px width
- [x] 4.3 Add `ViewingHistory.tsx` and include it on the lead detail page; change the no-show "Đóng" choice label in `LeadActions.tsx` to say it ends the viewing (lead closing stays "Mất khách"); update the `/lich/[token]` page text after cancel; verify in the browser with a lead that has two viewings
- [x] 4.4 Run `npm run lint` and `npm run build` in `web`; verify both pass

## 5. n8n

- [x] 5.1 Flow 1: in "Kiểm tra lịch còn chờ duyệt" and the two other guard checks, also require the latest viewing id to equal the payload's `viewingId` (D6); verify locally: book, cancel, book again, then press the first cycle's Approve link → "Lịch này đã bị huỷ hoặc đã xử lý", the new viewing stays pending; export the JSON back to `n8n-workflows/`
  - Ghi chú: đã chạy thử trên n8n cục bộ ngày 10/11 (import bản repo, publish, restart). Lead có `viewingId` sai: nút Duyệt trả "Lịch này đã bị huỷ hoặc đã được xử lý", lead vẫn NEW. Lead có `viewingId` đúng: được duyệt thành CONFIRMED, email gửi đi. Webhook cũ không có `viewingId` vẫn qua được (kiểm offline). Dữ liệu thử đã xoá.
- [x] 5.2 Flow 6: update the "Đặt lịch xem nhà" tool description with the slot rules (on the hour, 08:00–19:00, at least 3 working hours ahead, up to 14 days) and make sure 400 bodies reach the agent like 409 bodies; verify locally that asking for 22:00 and for 10:30 makes the bot answer with the rule; export the JSON
  - Ghi chú: Đã sửa mô tả công cụ, lời nhắc hệ thống và JSON (CI cục bộ đạt). Đã chạy thử với bot Telegram thật (`@realestate_tuvan_bot`) ngày 11/11 sau khi đưa luồng 6 bản mới lên production: nhắn "22h" thì bot nêu khung 08:00–19:00 và giờ tròn; nhắn "8h30" thì bot trả "giờ xem nhà cần là giờ tròn" và gợi ý 08:00 hoặc 09:00.
- [x] 5.3 Flow 7: add `CONSULTING` to the accepted statuses in "Chuẩn hoá dữ liệu" (D7, Hậu reviews); verify locally that cancelling a first viewing syncs the contact without an error execution; export the JSON
  - Ghi chú: đã chạy thử trên n8n và Mautic cục bộ: webhook `lead-changed` với status CONSULTING trả `ok: true`, thêm thẻ CONSULTING và gỡ các thẻ trạng thái khác, ghi sự kiện MAUTIC_SYNCED. Đã gỡ thẻ thử khỏi contact Mautic #5.

## 6. Docs and integration check

- [x] 6.1 Update `docs/nghiep-vu/02-dat-lich-den-dat-coc.md` (booking time rules, cancel and no-show now end only the viewing, contract uses the last attended viewing) and mark the done parts of `docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md` §3 and §6 as running, noting "one open viewing per lead"; verify no section still says cancel or no-show closes the lead
- [x] 6.2 In `docs/danh-sach-lo-hong.md` set LH-05, LH-08, LH-09 to done; in `docs/danh-sach-task.md` update FE-34 and add to the release notes: run `backend/sql/fe-33-intake.sql` before the backend starts, re-import flows 1, 6, 7, and do not release before FE-35 and FE-38; verify the links resolve
- [x] 6.3 End-to-end on the local stack: a customer books property A on the slot picker, staff approve, attend; the same phone books property B on the same lead; cancel B through `/lich/<token>` → lead back to `VIEWED`; create a contract → property A; verify each step in the lead timeline and record the result in the PR "Cách test"

## Workflow follow-up

- Open the PR `[FE-34] …` into `dev`, ask Hậu to review `lead-intake.service.ts`, `leads.service.ts`, `api-contract.md` and flow 7.
- Archive the change after the PR is merged.
