## Context

The system tracks a customer's journey almost entirely through `leads.status` (`NEW → CONFIRMED → VIEWED → DEPOSIT → SIGNED`, `LOST` at any point before `SIGNED`). Other parts of the data model are either unused or too coarse:
- `viewings.status` exists but is always `NEW`.
- `properties.status` only knows `AVAILABLE` and `HIDDEN`.

A new lead row is created for every booking. In practice there is exactly one viewing per lead, and many places rely on that:
- `leads.findDetail`;
- `contracts.create`, which picks the latest viewing of the lead;
- the SQL in flows 2, 5 and 6, and `stats.getFunnel`.

Six-status lists are hard-coded in several places: flow 6 (Telegram agent status text), flow 7 (Mautic status tags), `stats.getFunnel`, the web `StatusBadge` and `LeadStatusBadge`, and the flow 4 report.

Runtime facts that shape the design:
- TypeORM runs with `synchronize: true`. There are no migrations, so entity changes apply on backend start.
- Production is an iNET VPS behind a shared `javis-proxy` (caddy-docker-proxy).
- CI deploys code, but n8n workflow JSON must be re-imported and published by hand.
- Flow 2 is currently unpublished on the VPS. Its JSON references a Gemini credential id that does not exist there.
- Flow 6 calls `POST /api/viewings` without `X-Webhook-Secret`.
- Flow 1 approval email links resume n8n directly. The backend is not involved, so the backend cannot block a stale approval.

## Goals / Non-Goals

**Goals:**
- Close the 12 gaps listed in the proposal with the smallest change to existing contracts.
- Make the outcome of a viewing (attended / no-show / cancelled) and the reservation state of a property first-class data.
- Keep every existing consumer of the six lead statuses working unchanged.
- Enforce the critical rules (one active contract per property, no double booking) in the backend and, where cheap, in the database.

**Non-Goals:**
- Merging duplicate leads into one customer record, or a customer account concept.
- Payment collection, notarization or handover after the deposit.
- Customers choosing a new viewing time themselves.
- CAPTCHA or third-party bot protection.
- Multiple viewings per lead.

## Decisions

### D1. Viewing outcome lives on `viewings.status`; no new lead status
`viewings.status` ∈ `NEW | ATTENDED | NO_SHOW | CANCELLED`. New nullable column `leads.lost_reason` ∈ `NO_SHOW | NOT_INTERESTED | CUSTOMER_CANCELLED | OTHER`.

- *Why:* adding a `NO_SHOW` lead status would require edits in at least six hard-coded places (flows 4, 6 and 7, stats, two web badges) and in Mautic tags. A reason column keeps the funnel intact and still lets reports separate no-shows.
- *Alternative:* a new lead status `NO_SHOW`. Rejected because of that wide blast radius.

### D2. Keep exactly one viewing row per lead
A no-show followed by "reschedule" updates the same viewing row: new time, status stays `NEW`, and two events are written (`VIEWING_NO_SHOW`, then `VIEWING_RESCHEDULED`). A no-show followed by "close" sets the viewing to `NO_SHOW` and the lead to `LOST` with `lost_reason = NO_SHOW`.

No-show counts are taken from `VIEWING_NO_SHOW` events, so a no-show that was later rescheduled is still counted.

- *Why:* creating a second viewing row would break every `JOIN viewings v ON v.lead_id = l.id`. For example, flow 2 would email feedback requests twice.
- *Alternative:* a new row per attempt. Rejected for that reason.

### D3. One attendance endpoint instead of overloading `admin-status`
New endpoint `PUT /viewings/:id/attendance` (JWT) with body `{ outcome: ATTENDED | NO_SHOW, next?: RESCHEDULE | CLOSE, viewingTime?, note? }`:
- `ATTENDED`: viewing `ATTENDED`, lead `VIEWED`.
- `NO_SHOW` + `CLOSE`: viewing `NO_SHOW`, lead `LOST` with `lost_reason = NO_SHOW`.
- `NO_SHOW` + `RESCHEDULE`: same row gets the new time, status stays `NEW`, lead stays `CONFIRMED`. Flow 1b is called with `rescheduled` so the customer is emailed the new time.

Time guard: the call is rejected while `now < viewing_time − 30 min`. It also requires the lead to be `CONFIRMED` and the viewing to be `NEW`.

`PUT /leads/:id/admin-status` keeps working:
- `VIEWED` delegates to the same logic as `ATTENDED`, including the time guard.
- `LOST` accepts an optional `reason` (default `OTHER`). If the viewing is still `NEW`, it is set to `CANCELLED`.

### D4. Property reservation is driven by contracts
`properties.status` ∈ `AVAILABLE | RESERVED | SOLD | HIDDEN`.

| Event | Property status |
|---|---|
| `contracts.create` succeeds | `RESERVED` (same DB transaction as the contract insert) |
| Contract becomes `REJECTED` or `EXPIRED` | `AVAILABLE`, only if the property is still `RESERVED` and has no other active contract |
| Manager marks sold | `SOLD`, allowed only from `RESERVED` with a `SIGNED` contract |

Manual changes through `PUT /properties/:id`:
- Allowed values are `AVAILABLE`, `HIDDEN` and `SOLD`.
- `RESERVED` cannot be set by hand.
- Setting `AVAILABLE` or `HIDDEN` while an active contract exists returns 409.

Public listing excludes `HIDDEN` and `SOLD`. `RESERVED` is listed with a badge, and its detail page shows no booking form. `viewings.create` already rejects any status other than `AVAILABLE`.

### D5. One active contract per property, enforced twice
- **Service check:** count contracts with this `property_id` and status in `DRAFTING, PENDING_APPROVAL, SENT, SIGNED`. If any exist, return 409 naming the contract and the lead.
- **Database:** partial unique index `uq_contracts_active_property` on `contracts(property_id) WHERE status IN (...)`, declared with `@Index(..., { unique: true, where })` on the entity. A unique-violation error from a race is mapped to the same 409.

### D6. Double booking and duplicate bookings are checked in the backend, inside a transaction
This replaces the 19/10 plan to check in flows 1 and 1b. That plan only kept the backend untouched for Hậu, which no longer applies. Checking in the backend rejects the booking at form time, before any lead or email is created.

`viewings.create` and `viewings.update` run in one transaction that first takes `pg_advisory_xact_lock(property_id)`, then checks two things:
- **Conflict:** another viewing of the same property with status `NEW`, whose lead is `NEW` or `CONFIRMED`, and whose time is less than 60 minutes away. Result: 409 "Khung giờ này đã có khách hẹn xem căn này".
- **Duplicate** (create only): the same `lower(email)` and the same property, with a viewing `NEW` and a lead `NEW` or `CONFIRMED`. Result: 409 "Bạn đã có lịch xem căn này lúc …".

`GET /leads/:id` adds `otherBookings: [{ id, status, createdAt, propertyName, viewingTime }]`, matched by `lower(email)` and excluding the lead itself.

### D7. Rate limit and honeypot on `POST /viewings`
- Add `@nestjs/throttler`. A custom `BookingThrottlerGuard` is applied only to `POST /viewings`. It skips the limit when `X-Webhook-Secret` matches. It tracks by `req.ip`, which already honours the `trust proxy` hop count. `req.ips[0]` is not used because the client can forge the left-most `X-Forwarded-For` entry.
- Default limit: 5 requests per 10 minutes, overridable by env `BOOKING_RATE_LIMIT` / `BOOKING_RATE_TTL_MS`.
- `main.ts` sets `trust proxy` from env `TRUST_PROXY_HOPS` (default `1`).
- Flow 6 adds the `X-Webhook-Secret` header to its booking tool. Its tool description tells the agent to relay 409 messages.
- `CreateViewingDto` gains an optional `website` field, hidden in `BookingForm`. A non-empty value returns 400 without saving anything.

### D8. Customer manage-booking page via token
- New column `viewings.manage_token` (unique, 32 hex), created at booking.
- The backend includes `manageToken` in the `viewing-requested` webhook payload.
- Flow 1b reads `v.manage_token` in its SQL.
- Both flows put `${publicWebUrl}/lich/<token>` in the confirmation and new-time emails.

Public endpoints:
- `GET /viewings/manage/:token`
- `POST /viewings/manage/:token/cancel`: viewing `CANCELLED`, lead `LOST` with `CUSTOMER_CANCELLED`, event `VIEWING_CANCELLED`, clears `approval_url`.
- `POST /viewings/manage/:token/reschedule-request` with body `{ note }`: event `CUSTOMER_RESCHEDULE_REQUESTED`, no status change.

Both POST endpoints only work while the lead is `NEW` or `CONFIRMED`, the viewing is `NEW`, and the viewing time has not passed.

**Flow 1 confirmation time:** the confirmation email takes the viewing time from the database (the guard query), not from the original webhook payload, because staff may have changed the time while the approval was pending.

**Flow 1 stale-approval guard:** right after the approval Wait resumes, and before the approve / reschedule / timeout switch, a step reads the lead and its latest viewing. Each of the three branches continues only if the lead and the viewing are still `NEW`. Otherwise approve and reschedule reply "Lịch này đã bị huỷ hoặc đã xử lý" and stop, and timeout skips the manager alert. Flow 1b's approved branch gets the same check.

### D9. Flow 2 rules
- **Remove** the "Chuyển VIEWED" node. `FEEDBACK` now selects only `l.status = 'VIEWED' AND v.status = 'ATTENDED' AND v.viewing_time < now() - 2h`.
- **`REMINDER`** is skipped only if a `REMINDER_SENT` event exists *after* the latest `VIEWING_RESCHEDULED` (compare with `COALESCE(max(created_at), '-infinity')`). It also requires `v.status = 'NEW'`.
- **New `ATTENDANCE_CHECK`:** `l.status = 'CONFIRMED' AND v.status = 'NEW' AND v.viewing_time < now() - 2h`, and no `ATTENDANCE_CHECK_SENT` since the last reschedule. It notifies staff through `thong-bao-nhan-vien` with a link to the lead page, then logs `ATTENDANCE_CHECK_SENT`.
- **New `ATTENDANCE_ESCALATE`:** same pending condition plus an `ATTENDANCE_CHECK_SENT` older than 24 hours, and no `ATTENDANCE_ESCALATED` since the last reschedule. It emails the manager, then logs `ATTENDANCE_ESCALATED`.
- The two new types reuse the existing staff branch (the one `STAFF_NUDGE` uses, with no AI step). That branch's "Chuẩn bị thông báo NV" and "Ghi log" nodes become type-driven.
- The Gemini credential reference already points to the VPS id in the repo, so it needs no change.

### D10. Admin task list from one endpoint
New endpoint `GET /stats/tasks` (JWT) returns lists, each capped at 20:
- `pendingAttendance`: `CONFIRMED`, viewing `NEW`, time already passed;
- `wantsDeposit`: feedback with interest `DEPOSIT`, lead `VIEWED`;
- `notInterested`: feedback with interest `NONE`, lead not `LOST`/`SIGNED`;
- `reservedBackups`: lead `NEW`/`CONFIRMED` whose viewing property is `RESERVED`;
- `customerRequests`: a `CUSTOMER_RESCHEDULE_REQUESTED` event in the last 7 days, lead still `NEW`/`CONFIRMED`.

The overview page renders these as extra `TaskGroup`s. The funnel adds `noShow`, counted from `VIEWING_NO_SHOW` events.

### D11. Deposit semantics
- New column `contracts.deposit_received_at`, plus `deposit_received_by`.
- New endpoint `POST /contracts/:id/deposit-received` (MANAGER), only when the contract is `SIGNED`. Logs event `DEPOSIT_RECEIVED`.
- Labels only: `DEPOSIT` = "Đang làm hợp đồng cọc", `SIGNED` = "Đã ký hợp đồng cọc".
- New event types added to `LEAD_EVENT_TYPES`: `VIEWING_NO_SHOW`, `VIEWING_CANCELLED`, `CUSTOMER_RESCHEDULE_REQUESTED`, `ATTENDANCE_CHECK_SENT`, `ATTENDANCE_ESCALATED`, `DEPOSIT_RECEIVED`, `PROPERTY_RESERVED`, `PROPERTY_SOLD`.

## Risks / Trade-offs

- **[Startup failure]** `synchronize` creates the partial unique index on start. If production already has two active contracts on one property, the backend will not start. → Before deploying, run the duplicate check query on the VPS and resolve any duplicates by hand.
- **[Real IP unknown]** If `javis-proxy` does not forward the client IP, every visitor shares one IP and legitimate users get 429. → Verify with a request log after deploy, tune `TRUST_PROXY_HOPS`, or temporarily raise `BOOKING_RATE_LIMIT`.
- **[Flow 2 email burst]** Publishing flow 2 makes it pick up every old row that matches. → Run its SELECT read-only first, then mark stale demo leads `LOST` or log `REMINDER_SENT`/`FEEDBACK_ASKED` for them before publishing.
- **[Advisory lock scope]** The lock covers concurrent bookings of the same property within one database only. That is acceptable: there is one backend instance.
- **[Agent error relay]** It is unverified whether the n8n `httpRequestTool` passes a 409 body back to the agent. → Test on the local stack. If it does not, enable "Never error" with the full response, so the agent reads `statusCode` and `message`.
- **[One viewing per lead]** D2 keeps the invariant but loses the old time after a no-show reschedule. → The old time is kept in the `VIEWING_RESCHEDULED` event note.
- **[Status fan-out]** Existing rows have viewing status `NEW` and lost leads have a null `lost_reason`, so old no-shows are not counted. Accepted: reports only cover new data.

## Migration Plan

1. Local: implement, then run `npm run lint` and `npm run build` in `backend` and `web`. Bring up the stack. Import the changed workflows. Run end-to-end scenarios (book, conflict 409, approve, attendance, no-show reschedule, contract lock, cancel via link).
2. VPS pre-check (read-only):
   - active-contract duplicate query;
   - flow 2 dry-run SELECT;
   - current property statuses.
3. Merge to `main`, then CI deploys the backend and web. `synchronize` adds the columns and the index.
4. On the VPS: re-import flows 1, 1b, 2, 4 and 6, publish them, and restart n8n (see the n8n 2.x notes).
5. Verify on production: a booking with the real IP, a test lead through attendance, then publish flow 2.
6. **Rollback:** redeploy the previous commit. New columns are nullable or have defaults, so older code ignores them. Drop `uq_contracts_active_property` if the old code must create duplicate contracts. Re-import the old workflow JSON from git.

## Open Questions

- Defaults 2–6 from the plan review were taken without explicit confirmation from Hoàng (see the proposal). Change them before implementation if needed.
- Should "no longer interested" in feedback auto-close the lead (`LOST` with `NOT_INTERESTED`) instead of only showing a task? Current choice: show a task only.
