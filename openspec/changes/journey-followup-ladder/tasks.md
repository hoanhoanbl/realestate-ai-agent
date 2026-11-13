# Tasks

Owners follow `docs/quy-trinh-git.md` ("Ai giữ phần nào"). Codes FE-43 to FE-46, DC-14 and CH-09 are tentative until group 1 merges. Group 1 comes first so the other developer sees the plan, the task rows and this folder on `dev`.

## 1. Plan, task table and docs on git (CH-09, DC-14) — Hoàng

- [ ] 1.1 Branch `chore/CH-09-cap-ma-hanh-trinh` from `origin/dev` (not from this worktree's older base): in `docs/danh-sach-task.md` add rows for FE-43 to FE-50 (FE-47 to FE-50 as "Chưa làm", own change later; FE-47 is now only reached time, lost-reason breakdown and by-source figures, because PR #78 already reports by sale and by property), DC-14 and CH-09, and register Hậu's two finished local works that have no code yet as FE-51 (L4 sale and property report, PR #78) and FE-52 (L5 follow-up after feedback, PR #79), marked for Hậu to confirm in the review, and fold the two "chờ đăng ký mã" paragraphs Hậu left in that file into those rows with owner, branch name and status; move FE-27 and FE-28 (Expo app) to "Bỏ nếu thiếu giờ" with the reason and keep their codes reserved (FE-25 stays as it is); add "làm sau nếu có time" for OCR CCCD, Google Calendar sync, Voice, gaps 4 and 5, cleaning standby customers when a property turns `SOLD`. Open the PR, ask Hậu to review. Verify: the PR diff touches only `danh-sach-task.md`; after merge `git show origin/dev:docs/danh-sach-task.md` lists every new code once.
- [ ] 1.2 Branch `docs/DC-14-ke-hoach-hanh-trinh` from `origin/dev` (independent of 1.1; touch no row of `danh-sach-task.md`): copy `docs/ke-hoach-hanh-trinh-va-luong-n8n.md` from the planning worktree, update its status line and §9 and §10 with the decisions taken (7 and 14 days, FE-43 owner, Expo app moved to "làm sau"), keep §7.1 consistent with `design.md` D1 to D6. Verify: every code in the plan matches `danh-sach-task.md`; the links in §11 still open.
- [x] 1.3 Fix the contradiction in `docs/nghiep-vu/vai-tro-va-trang-thai.md` §1 and §2 (the team is not "no assignment": leads have an assigned sale). The matching fix in `03-cham-soc-va-marketing.md` §1 ("see another property" is the same lead) was already made by PR #79; only confirm it. Verify: `grep -n "không chia" docs/nghiep-vu/*.md` returns nothing that contradicts `01-tiep-nhan-va-phan-cong.md`.
- [x] 1.4 Add the gaps 1 to 6 of the plan (§3) to `docs/danh-sach-lo-hong.md` for processes 2 and 3 with level, "Xong khi" and the task that closes each; update `README.md` document map for the new plan file. Verify: each new LH row names an FE code that exists in `danh-sach-task.md`, or says "làm sau nếu có time" (gaps 4 and 5 have no code by decision).
- [ ] 1.5 Commit this change folder `openspec/changes/journey-followup-ladder/` in the same DC-14 PR and send Hậu the PR link. Verify: after merge, Hậu can open `openspec/changes/journey-followup-ladder/tasks.md` on `dev`; the PR has Hậu as reviewer.

## 2. Base PR: schema and constants (FE-43) — Hoàng, Hậu reviews

- [ ] 2.1 Agree the column list with Hậu in writing (message or PR comment): confirm `leads.contacted_at`, the lost reasons, event types and task types of design D10. Verify: Hậu's reply is linked in the PR description.
- [ ] 2.2 In `backend/src/leads/lead.constants.ts` add the new `LOST_REASONS`, `MANUAL_LOST_REASONS`, event types and the activity allow-list; in `followup-task.entity.ts` add `LADDER_REACH`, `LADDER_QUIET`, `LADDER_STALE`, `REBOOK_INVITE` and the optional `suggestion` shape of `result`; in `followup-policy.ts` add `LADDER_REACH_DAYS`, `LADDER_QUIET_DAYS`, `LADDER_STALE_DAYS`. Verify: `cd backend && npm test` passes and a unit test asserts `MANUAL_LOST_REASONS` excludes `STALE`, `NO_SHOW`, `EXPIRED`, `CUSTOMER_CANCELLED`.
- [ ] 2.3 Add `contacted_at` to `lead.entity.ts` and the four archive/price columns to `contract.entity.ts` (schema only). Verify: backend starts against a fresh local database and `\d leads`, `\d contracts` show the columns.
- [ ] 2.4 Write `backend/sql/fe-43-journey.sql` (additive, idempotent, `IF NOT EXISTS`). Verify: run it twice on a copy of the local database taken from `dev` data; the second run changes nothing; the old backend image still starts afterwards.
- [ ] 2.5 Update `web/src/lib/api.ts`: `LostReason` type, `LOST_REASON_LABELS` (Vietnamese labels), event labels, `Contract` optional new fields. Verify: `cd web && npm run lint && npm run build` pass.
- [ ] 2.6 Document the SQL step for the release in `docs/trien-khai.md` (order: back up, run script, deploy). Verify: the commands in the doc run as written on the local database.

## 3. Contact tracking (FE-44) — Hậu, after 2 merges

- [ ] 3.1 Add `POST /api/leads/:id/contacted` and `POST /api/leads/:id/contact-attempts` in `leads.controller.ts` and `leads.service.ts` (JWT, staff), with the rules of the `lead-contact-tracking` spec including first-response handling. Verify: `leads.service.spec.ts` covers first mark, repeat mark, `LOST` refusal, unknown result, and first response set by an attempt.
- [ ] 3.2 Make the manual status endpoints (`admin-status`, `PUT status`) validate against `MANUAL_LOST_REASONS` and refuse system-only reasons. Verify: tests for `STALE`, `EXPIRED`, `NO_SHOW` refused and `PRICE_TOO_HIGH` accepted; BF-06 behavior (no close while `DEPOSIT`) still passes.
- [ ] 3.3 Web: in `LeadActions.tsx` and a new small component add the "Đã liên hệ được" button, the attempt control with the four results, and the new lost-reason picker; show the new event types in the history. Verify: `npm run lint`, `npm run build`, and a browser check at 375 px (no horizontal scroll) for the three controls.
- [ ] 3.4 Docs: `docs/api-contract.md` (two routes, new reasons), `docs/nghiep-vu/vai-tro-va-trang-thai.md` (the "đã liên hệ được" mark and the reason list). Verify: each documented route exists in the controller.

## 4. Ladder backend (FE-45) — Hậu

- [ ] 4.1 Implement `isLadderDue` in `followup-policy.ts` with the activity anchor of design D3 and the rules of the `lead-followup-ladder` spec (reach steps, quiet reminder, stale; open-viewing and live-contract guards). Verify: unit tests for each scenario of the spec, with fake clocks at day 0, 1, 3, 7, 14 and for "note resets the clock".
- [ ] 4.2 Add the SQL and `GET /api/followups/ladder-due` (webhook secret, limit 50). Verify: `fe45.integration.spec.ts` against the PostgreSQL fixture (same style as `fe38.integration.spec.ts`): seeded leads return the expected `kind`, `step`, `anchor`; a lead with a contract or open viewing is not returned for stale.
- [ ] 4.3 Extend `claim()` and `ClaimFollowupDto` for ladder types: `viewingId = 0` allowed for them, optional `step`, key `LADDER_REACH:{leadId}:{step}:{anchor}`, snapshot re-check, and the atomic stale close for `LADDER_STALE` with event `LEAD_STALE_CLOSED`. Verify: tests for double claim from two owners (one wins), re-claim after complete returns not claimed, stale close writes status, reason and event in one transaction.
- [ ] 4.4 Add the approval link: sign and verify tokens, `POST /api/followups/:id/ladder-link` (webhook secret), public `GET` and `POST confirm` under `/api/followups/ladder-links/:token`, checks of design D5, call to flow 9's second webhook, event `LADDER_APPROVED`. Verify: HTTP tests for valid, tampered, used twice, lead closed, no consent, no email, text over 1500 characters.
- [ ] 4.5 Remove `HOT_NUDGE`, `WARM_NUDGE`, `COLD_NURTURE` from `FOLLOWUP_SELECTOR_SQL` and its values list; keep the enum values. Verify: updated `followups.service.spec.ts` and `fe38.integration.spec.ts` pass; a WARM, no-consent `VIEWED` lead is not selected by flow 2's selector.
- [ ] 4.6 Docs: `docs/api-contract.md` (four routes), `docs/nghiep-vu/03-cham-soc-va-marketing.md` (silent customers handled by the ladder, thresholds 7 and 14 days, `STALE`). Verify: documented routes match controllers; the rule text matches the constants.

## 5. Approval page (FE-45) — Hậu writes, Hoàng reviews (customer-web area)

- [ ] 5.1 Add `web/src/app/duyet-thu/[token]/page.tsx` with: lead summary, AI action and reason, editable draft, "Gửi cho khách" and "Bỏ qua", and the states already handled / expired / no consent; helpers in `web/src/lib/api.ts`. Verify: `npm run lint`, `npm run build`, browser check at 375 px with the API mocked for each state, no customer phone or email shown.

## 6. Flow 9 in n8n (FE-45) — Hậu

- [ ] 6.1 Build `n8n-workflows/luong-9-follow-up-bac.json`: schedule trigger (08:00 to 20:00), config, `ladder-due` call, loop, claim, start, context, Gemini with structured output parser, guardrail Code node, store suggestion, notify the sale (or the manager), action-done, complete; stale branch with manager alert; second webhook entry "sale đã duyệt" with email send and complete; retry 3 times on HTTP, email and AI nodes; failure branch to `fail` and the Error workflow. Count at least 12 distinct steps and write the count in the doc. Verify: import into local n8n; JSON parses; no credential ids are committed beyond what other flows already use.
- [ ] 6.2 Add `scripts/check-ladder-guardrail.cjs` that loads the Code node from the JSON and asserts: price promise dropped, empty and over-long drafts dropped, valid draft kept, `WAIT` action produces no email option. Verify: `node scripts/check-ladder-guardrail.cjs` prints PASS.
- [ ] 6.3 Run locally with a stub mail server and the demo data: (a) reach step 1 sent once across two runs, (b) quiet lead gets a reminder with suggestion, (c) approval link sends the edited text once, (d) 14-day lead is closed `STALE` and the manager is alerted, (e) AI failure gives a plain reminder. Verify: each case's `lead_events` rows and the stub inbox match the spec scenarios; record the results in `docs/luong/`.
- [ ] 6.4 Write `docs/luong/luong-9-follow-up-bac.md` with the frame from `docs/luong/README.md` (inputs, steps, "Triển khai lên server"); colour the nodes per the convention of `tong-quan-du-an.md` §6; add the flow to `tong-quan-du-an.md` and `docs/trien-khai.md` (import order). Verify: the document lists the same nodes as the JSON.

## 7. Flow 2 (FE-46) — Hậu, after 4 and 6 merge

- [ ] 7.1 Read `luong-2-follow-up.json` as it is on `dev` (PR #79 added a call to the feedback-work worker; keep it). Then in the file remove the silent-customer branch and the Mautic-only nodes of design D7 (confirm the exact node list against the file first) and add the `REBOOK_INVITE` path: selector value, claim, email to the customer with the property page link, event `REBOOK_INVITE_SENT`. Add `REBOOK_INVITE` due rules to `isFollowupDue` and the selector SQL with tests. Verify: unit tests for the scenarios of `missed-viewing-rebooking`; local run: plain no-show sends one email, rescheduled no-show sends none, second run sends none.
- [ ] 7.2 Docs: update the `docs/luong/` page for flow 2, `docs/nghiep-vu/02-dat-lich-den-dat-coc.md` (no-show invitation) and the "Mautic is an extension" note in `docs/tong-quan-du-an.md`. Verify: no remaining text says flow 2 enrols WARM or COLD customers in Mautic.

## 8. Integration and wrap-up

- [ ] 8.1 Run three end-to-end journeys locally: (a) bot lead never reached, (b) viewed customer silent for 14 days, (c) no-show then new booking. Verify: lead history reads correctly on the lead page in each case and nothing is sent twice.
- [ ] 8.2 After each PR merges, move its row in `docs/danh-sach-task.md` to "Việc đã xong" with PR number and date, tick the matching boxes here, and update the LH rows added in 1.4. Verify: `openspec status --change journey-followup-ladder` shows all tasks done; the task table has no FE-43 to FE-46 rows left in "đang làm".

## Workflow follow-up

- Release with `v0.4.0` or later using the migration plan in `design.md`.
- After the PRs merge and the review requirements are met, archive the change.
