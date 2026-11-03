## 1. Data model (backend entities)

- [x] 1.1 Add `viewings.status` constants (`NEW`, `ATTENDED`, `NO_SHOW`, `CANCELLED`) and a unique nullable `viewings.manage_token` (varchar 64) to `Viewing`; generate the token in `viewings.create`
- [x] 1.2 Add nullable `leads.lost_reason` (varchar 30) to `Lead` with constants `NO_SHOW`, `NOT_INTERESTED`, `CUSTOMER_CANCELLED`, `OTHER`
- [x] 1.3 Extend `PROPERTY_STATUSES` with `RESERVED`, `SOLD`; define the manager-settable subset (`AVAILABLE`, `HIDDEN`, `SOLD`)
- [x] 1.4 Add `deposit_received_at` and `deposit_received_by` to `Contract`, and the partial unique index `uq_contracts_active_property` on `property_id` where status is `DRAFTING`, `PENDING_APPROVAL`, `SENT` or `SIGNED`
- [x] 1.5 Add the new event types to `LEAD_EVENT_TYPES`: `VIEWING_NO_SHOW`, `VIEWING_CANCELLED`, `CUSTOMER_RESCHEDULE_REQUESTED`, `ATTENDANCE_CHECK_SENT`, `ATTENDANCE_ESCALATED`, `DEPOSIT_RECEIVED`, `PROPERTY_RESERVED`, `PROPERTY_SOLD`
- [x] 1.6 Start the local backend against the existing DB volume and confirm `synchronize` adds the columns and index without errors (needed closing local test contracts #9 and #10 first; startup also backfills RESERVED for properties with an active contract)

## 2. Booking integrity (backend)

- [x] 2.1 Wrap `viewings.create` in a transaction with `pg_advisory_xact_lock(property_id)`, add the 60-minute conflict check (409), and add the duplicate email + property check (409 with the existing time)
- [x] 2.2 Apply the same conflict check (excluding the viewing itself) in `viewings.update`
- [x] 2.3 Add optional `website` to `CreateViewingDto`; reject non-empty values with 400 before any write
- [x] 2.4 Add `@nestjs/throttler`, create `BookingThrottlerGuard` (skips when `X-Webhook-Secret` is valid, tracks `req.ip`, which honours `trust proxy` hops; `req.ips[0]` is client-spoofable), apply it to `POST /viewings` only, with env `BOOKING_RATE_LIMIT` / `BOOKING_RATE_TTL_MS`
- [x] 2.5 Set Express `trust proxy` in `main.ts` from env `TRUST_PROXY_HOPS` (default 1); document the new env vars in `.env.example`
- [x] 2.6 Include `manageToken` in the `viewing-requested` webhook payload
- [x] 2.7 Add `otherBookings` (same lower(email), excluding self, with property name and viewing time) to `leads.findDetail`

## 3. Viewing attendance (backend)

- [x] 3.1 Add `PUT /viewings/:id/attendance` (JWT) with a DTO `{ outcome, next?, viewingTime?, note? }`. Guards: lead `CONFIRMED`, viewing `NEW`, time guard `now >= viewing_time - 30 min`
- [x] 3.2 Implement `ATTENDED` (viewing `ATTENDED`, lead `VIEWED`), `NO_SHOW`+`CLOSE` (viewing `NO_SHOW`, lead `LOST`/`NO_SHOW`, `VIEWING_NO_SHOW` event), and `NO_SHOW`+`RESCHEDULE` (event, conflict-checked new time on the same row, flow 1b `rescheduled` call)
- [x] 3.3 Make `adminSetStatus` `VIEWED` delegate to the attendance logic; make `LOST` accept an optional `reason` (default `OTHER`), store `lost_reason`, and cancel a `NEW` viewing
- [x] 3.4 Add `viewingStatus` to `findSchedule` rows, and `lostReason` and viewing status to the lead detail response

## 4. Property reservation and deposit (backend)

- [x] 4.1 In `contracts.create`: add the per-property active-contract check (409 naming the contract and lead), set the property `RESERVED` and log `PROPERTY_RESERVED` in the same transaction, and map unique-index violations to 409
- [x] 4.2 In `markRejected` / `markExpired`: release the property to `AVAILABLE` only if it is `RESERVED` and has no other active contract
- [x] 4.3 In `properties.update`: reject `RESERVED`; reject `AVAILABLE`/`HIDDEN` while an active contract exists (409); allow `SOLD` only from `RESERVED` with a `SIGNED` contract and log `PROPERTY_SOLD`
- [x] 4.4 Exclude `SOLD` from the public `properties.findAll` (`HIDDEN` is already excluded)
- [x] 4.5 Add `POST /contracts/:id/deposit-received` (MANAGER, `SIGNED` only), storing the timestamp and the manager's name and logging `DEPOSIT_RECEIVED`

## 5. Customer self-service and admin tasks (backend)

- [x] 5.1 Add public `GET /viewings/manage/:token` returning property name, address, time, lead status, viewing status, and whether changes are allowed
- [x] 5.2 Add `POST /viewings/manage/:token/cancel` (viewing `CANCELLED`, lead `LOST`/`CUSTOMER_CANCELLED`, clear `approval_url`, `VIEWING_CANCELLED` event) with the NEW/CONFIRMED + NEW + future guard
- [x] 5.3 Add `POST /viewings/manage/:token/reschedule-request` `{ note? }` logging `CUSTOMER_RESCHEDULE_REQUESTED`, with the same guard
- [x] 5.4 Add `GET /stats/tasks` (JWT) returning `pendingAttendance`, `wantsDeposit`, `notInterested`, `reservedBackups`, `customerRequests` (max 20 each)
- [x] 5.5 Add `noShow` (count of `VIEWING_NO_SHOW` events) to `GET /stats/funnel`
- [x] 5.6 Run `npm run lint` and `npm run build` in `backend`; fix all errors

## 6. n8n flows

- [x] 6.1 Flow 2: remove "Chuyển VIEWED" and route the `FEEDBACK` branch straight to "Gom kết quả"; restrict `FEEDBACK` to `VIEWED` + `ATTENDED`
- [x] 6.2 Flow 2: change `REMINDER` to require `v.status = 'NEW'` and to skip only when `REMINDER_SENT` exists after the latest `VIEWING_RESCHEDULED`
- [x] 6.3 Flow 2: add `ATTENDANCE_CHECK` and `ATTENDANCE_ESCALATE` to the query; send them through the staff branch ("Cần qua AI?" false); make "Chuẩn bị thông báo NV" and "Ghi log STAFF_NUDGE" type-driven (title, message, recipient = manager for the escalation, event type); count them in "Tổng hợp"
- [x] 6.4 Flow 2: point the Gemini node to the VPS credential id `wU5LeG7gXaoUdMXQ` (already correct in the repo; no change needed)
- [x] 6.5 Flow 1: add a guard step on the approve branch (read lead + latest viewing; continue only if both are `NEW`, else reply "Lịch này đã bị huỷ hoặc đã xử lý"); add the `/lich/<manageToken>` link to "Email chốt lịch"
- [x] 6.6 Flow 1b: select `v.status` and `v.manage_token`; for `approved`, stop unless lead `NEW` and viewing `NEW`; add the manage link to both emails
- [x] 6.7 Flow 4: add a weekly `no_show` count from `VIEWING_NO_SHOW` events, for this week and last week, and show it in the report email
- [x] 6.8 Flow 6: add the `X-Webhook-Secret` header to "Đặt lịch xem nhà"; update the tool description to relay 409 messages; verify the agent receives the 409 body (enable full response / never error if needed)

## 7. Web

- [x] 7.1 `api.ts`: add types and functions for attendance, `lostReason`, `otherBookings`, property statuses, deposit received, manage-booking endpoints, `getTasks`, and `noShow` in `Funnel`
- [x] 7.2 `LeadActions`: replace the "Đã xem nhà" / "Khách không đến" buttons with attendance actions (hidden before `viewing_time - 30 min`, with a "Chưa đến giờ hẹn" note); a no-show dialog with "Hẹn lại" (time picker) or "Đóng"; a reason choice for "Mất khách"
- [x] 7.3 Lead detail page: show the lost reason, viewing status, and the "Khách này đã đặt N lần khác" list with links
- [x] 7.4 `StatusBadge` / `LeadStatusBadge`: label `DEPOSIT` "Đang làm hợp đồng cọc" and `SIGNED` "Đã ký hợp đồng cọc"; add viewing-status and lost-reason labels
- [x] 7.5 Admin overview: load `getTasks()` and add task groups "Buổi xem chờ xác nhận", "Khách muốn đặt cọc", "Khách báo không còn nhu cầu", "Khách có lịch xem căn đã có người cọc", "Khách xin đổi lịch" (customer cancellations already show as LOST with reason); show `noShow` in the funnel
- [x] 7.6 Admin properties page: show the four statuses; replace the hide toggle with actions valid for the current status (including "Đã bán"); show the 409 messages
- [x] 7.7 Admin contract detail: a "Đã nhận tiền cọc" button for managers on `SIGNED` contracts, and display of who received it and when
- [x] 7.8 Admin schedule page: show the viewing status per row
- [x] 7.9 Public property card and detail: a "Đã có người đặt cọc" badge for `RESERVED`, no booking form
- [x] 7.10 `BookingForm`: hidden `website` honeypot field; show 409 and 429 messages
- [x] 7.11 New page `/lich/[token]`: show the booking, "Huỷ lịch" (with confirm) and "Xin đổi lịch" (with note), and the states for invalid / no-longer-changeable bookings
- [x] 7.12 Run `npm run lint` and `npm run build` in `web`; fix all errors

## 8. Docs

- [ ] 8.1 Update `docs/api-contract.md` with the new and changed endpoints, status values and 409/429 responses (propose the text in chat first)

## 9. Local end-to-end verification

- [x] 9.1 Rebuild backend and web with `--no-deps`; import flows 1, 1b, 2, 4, 6 into the local n8n and publish
- [x] 9.2 Booking: conflict 409 (same property within 60 min), duplicate 409 (same email + property), honeypot 400, 6th request 429, Telegram agent conflict message (all API cases passed on 30/10; the live Telegram chat check is still for Hoàng)
- [x] 9.3 Approval and cancel: approve, then cancel via `/lich/<token>`; pressing the old approval link sends no email
- [x] 9.4 Attendance: early attempt rejected; `ATTENDED` → `VIEWED`; no-show reschedule emails the new time; no-show close → `LOST`/`NO_SHOW`
- [x] 9.5 Flow 2 (manual trigger): reminder resent after reschedule; attendance check and escalation sent once; feedback only for `ATTENDED`; no lead moved to `VIEWED`
- [x] 9.6 Contract: property becomes `RESERVED`; second contract on the same property gets 409; reject releases to `AVAILABLE`; sign → deposit received → sold hides the property
- [x] 9.7 Overview task groups and funnel `noShow` show the test data; flow 4 manual run shows the no-show count

## 10. Production rollout (iNET VPS, ask before each server step)

- [ ] 10.1 Read-only pre-checks on the VPS: active contracts per property (must be ≤ 1), current property statuses, flow 2 dry-run SELECT
- [ ] 10.2 Clean up stale demo rows that flow 2 would email (agree on the list with Hoàng first)
- [ ] 10.3 Hoàng merges to `main`; CI deploys; confirm the backend starts and the new columns and index exist
- [ ] 10.4 Re-import and publish flows 1, 1b, 2, 4, 6; restart n8n; confirm flow 2 is active
- [ ] 10.5 Check the client IP seen by the backend through `javis-proxy`; set `TRUST_PROXY_HOPS` if needed
- [ ] 10.6 Production smoke test with one test lead: book, approve, attendance, manage link
