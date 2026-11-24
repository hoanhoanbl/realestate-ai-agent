# Design

## Context

Facts from the code on `dev` (see proposal.md for motivation):

- `followup_tasks` (Hậu's module `followups`) is the lease table behind flow 2: `claim -> start -> action-done -> complete / fail`, with `task_key` unique and `viewing_id` / `viewing_time` NOT NULL. `STAFF_NUDGE` already sets a precedent for non-viewing tasks: it uses `viewingId = 0` and `assigned_at` as its "session" time, and `claim()` rejects `viewingId = 0` for every other type. `EXPIRE_LEAD` already closes a lead *inside* `claim()` so the status change and the task are one transaction.
- `leads` has `assigned_at`, `response_due_at`, `first_response_at` (FE-33, FE-38) but nothing for "the customer was reached". `lead_events` has `type`, `note`, `actor_user_id`, no JSON payload.
- Flow 2 has 63 nodes (PR #79 added a call to the feedback-work worker). The sub-workflow "Thông báo nhân viên" routes to `assigneeId` (FE-35).
- FE-35 introduced signed staff links (`/duyet/[token]`) with a public preview and confirm endpoint. That is the pattern to copy for a human-approval step.
- The database runs with `synchronize: true`; production upgrades still use a SQL script (`backend/sql/fe-33-intake.sql`).
- Team rules (`docs/quy-trinh-git.md` §6): one base PR for entity and constant changes; the owner of a file reviews any PR that touches it; each n8n JSON is edited only by its owner.

## Goals / Non-Goals

**Goals:**
- A silent or unreached lead always ends in one of three states: contacted, handled, or closed `STALE`; never open forever.
- Flow 9 is a full course-style flow: trigger, data, AI, decision, human approval, action, log, error handling, at least 12 steps.
- Everything the weekly report will need later (reached time, detailed lost reason) is stored by this change.

**Non-Goals:**
- No new lead status. `STALE` is a lost *reason*.
- No per-lead or per-source thresholds.
- No change to the response-deadline alert (`STAFF_NUDGE`, 2 working hours).
- No SMS, Zalo or phone channel; email to the customer and existing channels to staff only.

## Decisions

### D1. Reuse `followup_tasks` for ladder steps

Add task types `LADDER_REACH`, `LADDER_QUIET`, `LADDER_STALE`. They use `viewingId = 0` and `viewing_time = anchor` (assignment time for REACH, last activity time for QUIET and STALE), exactly like `STAFF_NUDGE`. The step number (1, 3, 7) is a new optional field on the claim request and part of `task_key`: `LADDER_REACH:{leadId}:{step}:{anchorISO}`. A new anchor (reassignment, new activity) gives a new key, which is how a period "restarts". A fourth type, `LADDER_EMAIL`, carries the customer email after the sale approves (D5); it is keyed by the ladder task, not by the lead.

Why: the claim / lease / retry / REVIEW machinery, its tests and the n8n calling pattern already exist and are idempotent across overlapping runs. *Alternative:* a new `ladder_steps` table. Rejected: duplicates the lease logic and adds a table the base PR would have to carry for no gain.

### D2. The due-list lives in the backend

`GET /api/followups/ladder-due` (webhook secret) returns up to 50 due items `{leadId, kind, step, anchor, assigneeId, ...}`; the same predicate (`isLadderDue`, a pure function next to `isFollowupDue`) is re-checked inside `claim()`. Flow 9 reads this endpoint instead of embedding SQL. *Alternative:* an n8n Postgres node as flow 2 does. Rejected: that duplicates a long SQL string in JSON and cannot be unit-tested.

### D3. "Activity" is an allow-list of event types

Migration safety (FE-45 local verification): include `leads.contacted_at` itself in the activity maximum too. FE-43 backfills this field from attended viewings without inserting a CONTACTED event; an old lead reached recently must not be closed using its creation date simply because its legacy event is missing.

The quiet-period anchor is the latest of: `leads.created_at` and `lead_events` of the types `NOTE_ADDED`, `CONTACTED`, `CONTACT_ATTEMPTED`, `STATUS_CHANGED`, `LEAD_ASSIGNED`, `LEAD_REASSIGNED`, `LEAD_REOPENED`, `FEEDBACK_RECEIVED`, `APPROVED`, `VIEWING_NO_SHOW`, `VIEWING_CANCELLED`, `VIEWING_RESCHEDULED`, `CUSTOMER_RESCHEDULE_REQUESTED`, `FEEDBACK_WORK_UPDATED` (a sale recording a call result in PR #79's feedback follow-up), `LADDER_APPROVED`. An allow-list means a future automated event can never silently reset the clock. *Alternative:* "everything except automated types". Rejected for that reason.

### D4. Steps and thresholds are constants

In `followup-policy.ts`: `LADDER_REACH_DAYS = [1, 3, 7]`, `LADDER_QUIET_DAYS = 7`, `LADDER_STALE_DAYS = 14`. Day 0 is the existing `STAFF_NUDGE` (FE-38), so the plan's "0, 1, 3, 7" becomes "0 (existing), 1, 3, 7". Reach steps apply only to `CONSULTING` and `NEW` leads with `contacted_at` null (a `CONFIRMED` lead has an agreed viewing; a `VIEWED` lead is reached through D8).

**Eligible-since anchor (review point 1).** The step time is `assigned_at + N days`. A reach step is due only when `eligibleSince <= stepTime <= now < nextStepTime` (day 7 has no upper bound), so only the highest due step is sent and a step that fell inside a `CONFIRMED` period is never sent late. `eligibleSince` is the latest of:
- `leads.created_at` and `leads.assigned_at` (assignment, reassignment, and reopening all go through `setOwner()`, which resets `assigned_at`);
- `lead_events` of type `LEAD_REOPENED` (reopening sets `CONSULTING` without a `STATUS_CHANGED` event);
- `lead_events` of type `STATUS_CHANGED` whose note matches `'% -> NEW%'` or `'% -> CONSULTING%'`. Every status change writes the note as `"{old} -> {new}[: reason]"` (`leads.service.ts`, `lead-intake.service.ts`, `feedback-work.service.ts`), and `stats.service.ts` already reads `-> LOST` this way.

Example: assigned day 0, `CONFIRMED` day 1, cancelled day 2 (back to `CONSULTING`): `eligibleSince` = day 2, so day 1 is skipped and days 3 and 7 are sent.

**Quiet only for reached leads (review point 5), with one fallback (B2).** `LADDER_QUIET` applies to `CONSULTING` and `VIEWED` leads with `contacted_at` set, so an unreached lead on day 7 gets the reach step and not the quiet reminder as well. Fallback: an unreached lead whose day-7 step time is before `eligibleSince` can no longer get any reach step, so `LADDER_QUIET` applies to it too. Without this, a lead cancelled on day 10 would be closed `STALE` on day 24 with no reminder at all; with it, the sale is reminded on day 17. The two cases never overlap, because the fallback only opens once the reach chain is closed for good.

`LADDER_STALE` applies to reached and unreached leads alike.

Reminders run only 08:00 to 20:00 Asia/Ho_Chi_Minh (the schedule trigger is `0 8-20 * * *` with the workflow timezone set), so nobody is pinged at night.

### D5. AI proposes, a signed link approves

Hoàng review (21/11): ladder links now use a dedicated backend-only LADDER_LINK_SECRET (random >=32 bytes, distinct from WEBHOOK_SECRET), a purpose field and signed seven-day expiry. No fallback to the webhook key or working secret in env examples. Preview performs only SELECTs without a write-lock transaction; confirm/claim/start retain their write locks and authoritative checks. FE-56 treats tokens as opaque strings. Old `{t}` tokens signed with the webhook key are rejected; reissue through the secret endpoint when needed.

Per due item flow 9 claims the task, builds context (lead, last events, viewings), asks Gemini for a structured result `{action: CALL | SEND_EMAIL | OFFER_VIEWING | WAIT, reason, emailDraft}`, runs a guardrail Code node (same style as flow 2's "Kiểm tra nội dung AI"; rules in the spec), and stores the result in `followup_tasks.result.suggestion` (the column is jsonb; only its TypeScript type widens). The sale is notified through "Thông báo nhân viên" with a link.

The link follows FE-35: HMAC-signed token over `{taskId}` (one link, two buttons; the decision `SEND` or `SKIP` is in the confirm body), public `GET` preview and `POST` confirm under `/api/followups/ladder-links/:token` (shape fixed in `docs/api-contract.md` §3.10), page `web/src/app/duyet-thu/[token]/page.tsx`. Confirm re-checks the conditions (lead open, step current, not already sent, customer has email and consent), stores the edited text (max 1500 characters, plain text, escaped when rendered), then the backend calls flow 9's second entry, a webhook that sends the email and completes the `LADDER_EMAIL` task. One workflow, two entry points; the same pattern as flow 1b.

**Two tasks, not one (review point 8).** The ladder task (`LADDER_REACH` or `LADDER_QUIET`) completes as soon as the sale is notified: claim -> start -> action-done (suggestion stored) -> complete. Confirming the link does not reopen it. Instead it inserts a separate task `LADDER_EMAIL` with key `LADDER_EMAIL:{ladderTaskId}` (`viewingId = 0`, `viewing_time` = the ladder task's anchor), which flow 9's second entry takes through claim -> start -> action-done -> complete. Because the key is unique, two confirms (double click, two tabs) send one email: the second insert finds the key and the page answers "already handled". "The step is still current" means: no newer ladder task exists for the lead and the lead is still open. `actionDone()` today replaces `result` (`task.result = ... : {}`); it changes to merge its payload into the existing `result`, so `result.suggestion` survives.

*Alternatives:* (a) send automatically to consenting customers and only notify the sale. Rejected: no human approval, and the course topic asks for one. (b) approve from the lead page with a button. Rejected for now: the sale would need to open the web app from Telegram anyway, and a link needs no login; the lead page can show the pending suggestion later.

### D6. Stale closing happens inside `claim()`

Recovery safety (FE-45 local verification): expired ACTION_STARTED checkpoints must be selected even when a later note/contact/status change makes the original step no longer due. They become REVIEW rather than being silently abandoned; L9 reports this through Error workflow. This does not permit a duplicate send.

`LADDER_STALE` follows `EXPIRE_LEAD`: `claim()` sets `LOST` with `lostReason = 'STALE'` and writes `LEAD_STALE_CLOSED` in one transaction, guarded by "no open viewing, no live contract, no open `feedback_work` row (status not `COMPLETED`)". The same open-`feedback_work` guard applies to `LADDER_QUIET`: a sale who recorded "needs more time" with a next call 21 days away is followed by PR #79's deadline, reminder and manager alert, so the ladder stays silent instead of reminding at day 7 and closing at day 14. Completing the task writes `FEEDBACK_WORK_UPDATED`, which is in the D3 allow-list, so the quiet period restarts from that moment. Flow 9 then alerts the manager through `action-done`. The manual status endpoints reject `STALE`, `NO_SHOW`, `EXPIRED` and `CUSTOMER_CANCELLED` (new `MANUAL_LOST_REASONS` constant); only code paths that own those reasons set them.

**Recovery (review point 9).** If an execution stops after `claim()` has closed the lead but before the manager alert, the lead is already `LOST`, so the normal predicate would never select it again and the alert would be lost. As with `EXPIRE_LEAD` (`followup-policy.ts` "đã đóng bởi chính tác vụ", `followup-sql.ts`), `isLadderDue` also accepts a `LADDER_STALE` task when the lead is `LOST` with reason `STALE` and has a `LEAD_STALE_CLOSED` event whose note carries this task's key. The selector picks such tasks in `CLAIMED`, `ACTION_STARTED` or `FAILED` once the lease has expired. The re-claim does not close the lead a second time; the run continues to the manager alert, and `action-done` / `complete` make sure it is sent once.

### D7. Mautic leaves the core flows by removing selector entries, not enum values

`HOT_NUDGE`, `WARM_NUDGE`, `COLD_NURTURE` come out of `FOLLOWUP_SELECTOR_SQL` and out of flow 2's branches; the values stay in `FOLLOWUP_TYPES` and `EVENTS` so completed rows and history keep rendering. Flow 2's Mautic-only nodes (the "nuôi dưỡng" group: contact lookup, Mautic call, COLD newsletter preparation) are deleted when flow 2 is exported again; the exact list is confirmed against the file when editing. Flows 7 and 8 are untouched.

### D8. Contact tracking is one column plus events

`leads.contacted_at` (timestamptz, null). Endpoints `POST /api/leads/:id/contacted` and `POST /api/leads/:id/contact-attempts {result}` (JWT, staff). Events `CONTACTED` and `CONTACT_ATTEMPTED` carry the actor and, for attempts, the result in `note`. Both set `first_response_at` when empty. Recording "attended" on a viewing (`viewings.service.ts`, the existing attendance endpoint) also sets `contacted_at` when empty, in the same transaction, with the recording staff member and a `CONTACTED` event whose note says it came from attendance: meeting the customer at a viewing is contact, and without this every web booking would get reach reminders after the visit. `backend/sql/fe-43-journey.sql` backfills `contacted_at` with the earliest attended viewing time for existing leads (idempotent: only where `contacted_at IS NULL`). *Alternative:* a `contact_attempts` table. Rejected: nothing queries attempts beyond the history list and the ladder anchor.

### D9. Rebooking invitation is a viewing-bound flow 2 task

New scheduled type `REBOOK_INVITE`, due when the viewing status is `NO_SHOW` (plain no-show only; a no-show that the sale rescheduled immediately never reaches this status), the lead is not `LOST`, the customer has an email and no open viewing, and the type has not completed for that viewing. The email links to `/nha/{propertyId}`. It is a service message, so it ignores marketing consent (stated in the spec and the docs).

**Exclusions (review point 7).** The invitation is not due when the lead is `DEPOSIT` or `SIGNED` (a deposit contract is being made or is signed), or when the viewing's property is no longer `AVAILABLE`. `start()` re-checks these conditions just before sending, because the lead or the property can change between claim and send. An invitation skipped for any of these reasons writes an event, so the history shows why no email went out.

### D10. Base PR content (FE-43)

Entities and constants only, plus the SQL script `backend/sql/fe-43-journey.sql` and `web/src/lib/api.ts` types:
- `leads.contacted_at`; lost reasons `STALE`, `PRICE_TOO_HIGH`, `CHOSE_OTHER_PROPERTY`, `BOUGHT_ELSEWHERE`, `UNREACHABLE`, `NO_LONGER_NEEDED` and `MANUAL_LOST_REASONS`; event types `CONTACTED`, `CONTACT_ATTEMPTED`, `LADDER_STEP_SENT`, `LADDER_APPROVED`, `LEAD_STALE_CLOSED`, `REBOOK_INVITE_SENT`, `CONTRACT_PRICE_AGREED`, `CONTRACT_ARCHIVED`, `VIEWING_CONFIRMATION_SENT`; task types `LADDER_REACH`, `LADDER_QUIET`, `LADDER_STALE`, `LADDER_EMAIL` and `REBOOK_INVITE`; the activity allow-list constant.
- `VIEWING_CONFIRMATION_SENT` (review point 4) is written by flow 1b **after** the confirmation or reschedule email to the customer was sent (FE-50) and read by flow 2's reminder rule (FE-54). Flow 1 does not write it because its acknowledgement does not confirm the appointment. `lead_events` has no column for a viewing or a JSON payload, so the viewing and the appointment time go into `note` in one fixed format: `viewing=<id>;time=<ISO 8601 UTC>`, for example `viewing=42;time=2026-11-20T03:00:00.000Z`. FE-43 adds one helper that builds this note and one that parses it, next to the event constants, with a unit test. FE-54's SQL matches `note = 'viewing=' || v.id || ';time=' || to_char(date_trunc('milliseconds',v.viewing_time) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`, which gives the same string as JavaScript `toISOString()`. A rescheduled viewing (new time) therefore no longer matches the old event. `VIEWING_CONFIRMATION_SENT` is an automated event, so it is not in the D3 allow-list and does not reset any ladder clock.
- `contracts.agreed_price` (bigint, null), `signed_file_path` (varchar, null), `signed_file_sha256` (varchar 64, null), `signed_file_stored_at` (timestamptz, null). **Schema only**: nothing reads or writes them until FE-48 and FE-49, but the team rule keeps all column changes in one PR.

### D11. How the other developer follows the work

Hậu cannot see a local worktree. The visible record on git is: (1) this change folder `openspec/changes/journey-followup-ladder/` with `tasks.md` checkboxes, committed on a docs branch and merged to `dev` first (task group 1); (2) the rows in `docs/danh-sach-task.md` (FE-43 to FE-46, DC-14, CH-09) merged to `dev` by a small `chore` PR, which also reserves the codes; (3) one PR per FE code, titled with the code, with this change named in the description, and each PR ticks its own checkboxes in `tasks.md`. Hậu reviews the FE-43 PR (it edits Hậu's `leads` files) and writes FE-44 to FE-46.

## Risks / Trade-offs

- **A real customer is closed as stale** (for example one who said they want a deposit while the sale was away) → reminders at 7 days, manager alert on closing, a distinct `STALE` reason that is easy to filter and reopen, and the "no live contract / open viewing" guard.
- **Mautic campaigns stop getting new contacts** → intended; documented as "extension, off by default"; the enum values stay so re-enabling later is a selector change.
- **The base PR edits Hậu's files** → Hậu reviews it before merge; Hậu supplies the lead-side column list before it is written (task 2.1).
- **Overlap with `STAFF_NUDGE`** (both remind the sale) → day 0 stays with `STAFF_NUDGE`; ladder steps start at day 1, and the same `first_response_at` / `contacted_at` marks stop them.
- **Approval-link abuse** → HMAC token, single use, re-check on confirm, text length cap, escaped output; the link stops working once the step is no longer the current one or the lead is closed.
- **AI cost and nonsense drafts** → at most 50 items per run, one call per due step, guardrail drops bad drafts, plain reminder as fallback.
- **Work is not on the server yet** (`v0.4.0` pending) → this change is released after it; see migration plan.

## Migration Plan

1. Merge FE-43 (base). On the VPS, back up the database, run `backend/sql/fe-43-journey.sql` before merging the release PR, then run it again after the deploy (it is idempotent). The new backend creates the same columns itself at startup (`synchronize: true`; checked on a copy of the local data: the columns made by the script and by the backend are identical), so the script's real work is the `contacted_at` backfill. **Checked on 19/11:** the old backend still *starts* after the script ran, but `synchronize: true` makes it **drop all five new columns** at startup. So the second run after deploy covers an old-backend restart between the two steps.
2. Deploy backend and web (FE-44, FE-45 backend parts).
3. Import flow 9 **switched off**; test with one lead on the demo data; then import flow 2 and switch flow 9 on.
4. Rollback: switch flow 9 off and re-import the previous flow 2 export (taken first, as `docs/trien-khai.md` already describes). Do **not** roll the backend image back casually: the old backend drops the five new columns and the data in them (corrected 19/11; the earlier text said the columns stay). Rolling back then forward restores `contacted_at` for attended customers by re-running the script, but loses `contacted_at` set by hand (FE-44), agreed prices (FE-48) and archive records (FE-49), unless those columns were copied out first. Prefer a forward fix. `docs/trien-khai.md` §9f says the same.

## Open Questions

- A `CONSULTING` lead with no feedback task cannot carry a scheduled call further than 7 days ahead: the sale has to add a note again, or the lead is reminded at day 7 and closed at day 14. Accepted for now; a "next contact date" on the lead would solve it later.

- Whether the "Không mua" result in the feedback follow-up (PR #79, currently closes with the legacy reason `NOT_INTERESTED`) should use the detailed reasons of this change. Deferrable: the reasons exist after FE-43, and Hậu can switch that screen in a later PR without changing any spec here.

- Whether to show a pending suggestion on the lead detail page as well as in the link (deferrable; nothing in the specs depends on it).
- Whether an `OFFER_VIEWING` suggestion should include a one-click booking link for the customer (deferrable; the draft can name the property page for now).
