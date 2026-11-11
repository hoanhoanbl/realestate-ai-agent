# Tasks

Task DC-03 in `docs/danh-sach-task.md` (branch `docs/DC-03-tai-lieu-luong`, owner Hoàng, about 14h). Documentation only: no code, no workflow JSON, no behaviour change. All documents are written in Vietnamese with diacritics. Rules go in `docs/nghiep-vu/` and are linked, not copied (see `docs/danh-sach-task.md` section 2). Sources of truth are `n8n-workflows/*.json` and `backend/src/**/*.controller.ts` on `dev`. The old branches `docs/luong-hoang` and `docs/api-contract-hoang` date from 19/10, before FE-29 to FE-40, so use them only as a skeleton.

Verification used below: **link check** = every relative Markdown link in the file resolves to an existing file (task 8.1 gives the command). **node check** = every group sticky note ("Nhóm n") and every webhook path / trigger in the workflow JSON is named in the document.

## 1. Common template

- [x] 1.1 Create `docs/luong/README.md` with the shared template (1. Làm gì trong thực tế, 2. Ai tham gia, 3. Từng bước, 4. Nối với hệ thống, 5. Khi lỗi thì sao, 6. Triển khai lên server, 7. Cách chạy thử) and a table of all 12 workflows (file, trigger, workflow id from `docs/trien-khai.md`, doc link); verify the table has exactly the 12 files in `n8n-workflows/` and passes the link check
- [ ] 1.2 Send the template to Hậu and wait for a reply before groups 2 to 5; verify the reply (OK or requested changes) is recorded in the PR description

## 2. Flow 1 and 1b

- [x] 2.1 Write `docs/luong/luong-1-dat-lich.md` from `luong-1-dat-lich.json` (29 nodes) covering scoring split from approval and the "Duyệt tới giờ hẹn" button (FE-35), slot rules (FE-34) and the "Triển khai lên server" section; link rules to `docs/nghiep-vu/` and `docs/fe-35-thong-bao-phu-trach.md` instead of copying; verify node check and link check, and mark anything not yet run on n8n as "chưa kiểm trên server"
- [x] 2.2 Write `docs/luong/luong-1b-chot-lich-thu-cong.md` from `luong-1b-chot-lich-thu-cong.json` (23 nodes) in the same template; verify node check and link check

## 3. Flow 6 and 6b

- [x] 3.1 Write `docs/luong/luong-6-telegram-agent.md` from `luong-6-telegram-agent.json` (46 nodes, 5 groups) covering guardrails, intent classification, tools (Tìm nhà, Đặt lịch xem nhà, Tra cứu lịch, Hỏi đáp tri thức, Think), staff handoff, contact capture (FE-36), chat logs, the two Telegram bots and the env vars `TELEGRAM_KHACH_BOT_TOKEN` and `TELEGRAM_KHACH_WEBHOOK_SECRET`; link to `docs/fe-36-bot-ghi-nhan-khach.md`; verify node check and link check
- [x] 3.2 Write `docs/luong/luong-6b-nap-tri-thuc.md` from `luong-6b-nap-tri-thuc.json` (manual and schedule triggers, pgvector load); verify node check and link check

## 4. Flow 3, Error workflow, staff notification

- [x] 4.1 Write `docs/luong/luong-3-hop-dong.md` from `luong-3-hop-dong.json` (43 nodes, three `respondToWebhook` branches); verify node check and link check
- [x] 4.2 Write `docs/luong/error-workflow.md` from `error-workflow.json`; verify node check and link check
- [x] 4.3 Write `docs/luong/thong-bao-nhan-vien.md` from `thong-bao-nhan-vien.json` covering the input fields (`mode`, `assigneeId`, `actions`, `fields`), email, Telegram and push channels, and which flows call it; verify node check and link check

## 5. Align flows 2, 4, 5, 7, 8

- [x] 5.1 Restructure `docs/luong/luong-2-follow-up.md` and `luong-4-bao-cao.md` to the template without losing existing content, add "Triển khai lên server" where missing, and update them to match FE-29 and later code; verify link check and that every section heading from the old file still exists or is merged on purpose
- [x] 5.2 Do the same for `luong-5-cam-nhan.md`, `luong-7-dong-bo-mautic.md` and `luong-8-mautic-bao-ve.md`; verify link check
- [ ] 5.3 Ask Hậu to review 5.1 and 5.2 (the owner of these flows); verify the review result is recorded in the PR description

## 6. `docs/api-contract.md`

- [x] 6.1 Convert the unaccented sections to Vietnamese with diacritics, keeping identifiers, paths and JSON as they are; verify `grep -nE '^#{1,3} ' docs/api-contract.md` shows no unaccented heading
- [x] 6.2 Renumber and reorder sections so numbering is sequential (sections 3.2 and 3.3 now sit after section 7); verify the heading list is in numeric order
- [x] 6.3 Reconcile every route in `backend/src/**/*.controller.ts` with the contract and add missing ones (for example `users/me/routing`, `users/assignees`, `users/:id/notify-target`, `leads/intake`, `leads/lookup`, `leads/:id/assignee`, `leads/:id/notes`, `followups/*`, `viewings/staff-links/*`); verify a listed route table has no controller route missing, by running the route extraction from 8.1 and comparing
- [x] 6.4 Take only still-valid text from `origin/docs/api-contract-hoang` and note in the PR which parts were taken; verify no conflict markers and no text contradicting the controllers remain
- [x] 6.5 Propose the final text of the new and changed endpoints in chat before editing, as the original task 8.1 of `close-booking-to-deposit-gaps` requires; verify the approval is in the chat

## 7. Overview and map

- [x] 7.1 Update `docs/tong-quan-du-an.md` section 5 (lead status lifecycle with `CONSULTING`, `EXPIRED` and the FE-33 states), section 6 (12 workflows with links to `docs/luong/`) and section 7 (architecture: channels in use, two Telegram bots, pgvector, Mautic); verify the status list equals the status values in the backend code and the link check passes
- [x] 7.2 Update the document map in `README.md` to include `docs/luong/README.md`; verify the link check passes

## 8. Integration check and PR

- [x] 8.1 Run a link check over `docs/` (script in the scratchpad, not committed) and a route comparison between `docs/api-contract.md` and the controllers; verify both report zero problems
- [x] 8.2 In the same PR, move the DC-03 row of `docs/danh-sach-task.md` to section 4 with the PR number and merge date; verify the table row is under "Tài liệu (DC)" and section 3 no longer lists it
- [ ] 8.3 Open the PR `docs/DC-03-tai-lieu-luong` into `dev` with title `[DC-03] Tài liệu 12 luồng, api-contract, tổng quan`; verify CI is green and Hậu has approved the parts for flows 2, 4, 5, 7, 8

## Workflow follow-up

- After the PR merges, tick task 8.1 in `openspec/changes/close-booking-to-deposit-gaps/tasks.md` (same work as 6.x here).
- After the PR merges, ask before deleting the remote branches `docs/luong-hoang` and `docs/api-contract-hoang` (command in section 8 of `docs/quy-trinh-git.md`).
- Archive this change after the PR merges.
