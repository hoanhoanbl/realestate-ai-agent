# Tasks

Spec: `specs/sales-team-overview/spec.md`. Decisions 1–6 in `design.md`. UI conventions: `docs/giao-dien-web.md` and the ui-ux-pro-max checklist.

## 1. Team statistics API

- [x] 1.1 Add `getTeam(period)` to `backend/src/stats/stats.service.ts` returning the shape in design §1: current-workload counts per status and owner, `overdue` and `idle` (design §3) for `now`; `assigned`, `attended`, `signed`, `lost` (design §2) for `week`/`month` with Vietnam-time boundaries (design §4); merge with every SALE account (zeros included), managers holding customers, and a `null` owner row when unassigned customers exist; verify with an integration test in `backend/src/stats/` (pattern of `followups/fe38.integration.spec.ts`) seeding two sales, one paused, and leads in several statuses
- [x] 1.2 Add `GET /api/stats/team` to `stats.controller.ts` with `JwtAuthGuard` + `RolesGuard` + `@Roles('MANAGER')` and a `period` query validated to `now|week|month` (default `now`); verify in the integration test: no token → 401, sale → 403, `period=year` → 400, manager → 200
- [x] 1.3 Extend the integration test for the edge cases in the spec: a lead assigned Sunday 23:30 VN is not in "Tuần này" on Monday; a lead marked lost via `PUT /leads/:id/admin-status` and one expired by `followups` are both counted as lost; a note older than 7 days makes a lead idle and a new note clears it; a reassigned lead counts for the new owner only; verify `npm test -- stats` passes
- [x] 1.4 Document the route and response in `docs/api-contract.md` §3.5 and add a dated line to its change log; verify the table renders and the example matches the test's response

## 2. Owner filter on the customer list

- [x] 2.1 In `web/src/app/admin/leads/page.tsx`, add the "Phụ trách" select (class `INPUT`, `aria-label`) after the search box for managers only, options "Mọi người phụ trách", "Chưa phân công", managers, then sales by name from `getAssignees()`; apply it before the chip counts so chips and list follow it; verify in the browser that selecting a sale updates the list and the "Tất cả" count, and that a sale account does not see the select
- [x] 2.2 Read `assignee` from the address on load and write it with `router.replace` on change, keeping `status`/`filter`; verify by opening `/admin/leads?assignee=<id>&status=LOST` directly and by reloading after a change
- [x] 2.3 Make the owner name on each card a link (managers only) that sets the owner filter without opening the lead (stop propagation if the card is itself a link), with a visible focus ring and 44px target on phones; verify in the browser by clicking a name on a card and by keyboard (Tab + Enter)
- [x] 2.4 Check the leads page at 375px: search, owner and status controls wrap without horizontal scroll and stay ≥ 44px tall; verify in the browser's phone mode

## 3. Team page

- [x] 3.1 Add `TeamStats` types and `getTeamStats(period)` to `web/src/lib/api.ts`; verify `npx tsc --noEmit`
- [x] 3.2 Add the sidebar entry `Đội sale` (manager only) between "Báo cáo" and "Quản lý nhà" in `web/src/components/AdminShell.tsx`, and a `team` icon in `components/ui/Icon.tsx` if none fits; verify the item shows for a manager, is hidden for a sale, and is highlighted on `/admin/doi-sale`
- [x] 3.3 Create `web/src/app/admin/doi-sale/page.tsx`: manager guard like `bao-cao/page.tsx` (sale sees the no-permission message), `PageHeader`, period segmented control (`aria-pressed`, stored in `?period=`), KPI cards per design §6, loading `Skeleton`, error `Alert` with "Thử lại", `EmptyState` when there are no sales; verify in the browser: switching period updates cards and columns, reload keeps the period, stopping the backend shows the error and retry works
- [x] 3.4 Build the desktop table (`hidden md:block`, `overflow-x-auto`): owner cell with initials, name link and "Đang nhận"/"Tạm ngừng" badge; status or result columns per period; attention badges with count and words; "Ngoài đội sale" group; zero values muted and not links; non-zero values link per design §5; verify that each link opens the customer list with the expected owner and status, and that the count shown equals the list length for status-based numbers
- [x] 3.5 Build the phone layout (`md:hidden`): one card per owner with the same numbers, flags and links, 44px targets; verify at 375px: no horizontal scroll, all links reachable and tappable
- [x] 3.6 Accessibility pass: table has `<caption>` (visually hidden) and `scope` on headers, links read as "Trần Thu Hà, 3 khách Đang tư vấn" via `aria-label`, state never by color alone, focus visible; verify with keyboard-only navigation and the browser accessibility tree

## 4. Docs and checks

- [x] 4.1 Add the "Xem trang Đội sale" row (manager only) to the permission table in `docs/nghiep-vu/vai-tro-va-trang-thai.md`, add the task to `docs/danh-sach-task.md`, and mention in `docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md` that round-robin can be checked on the team page; verify the links resolve
- [x] 4.2 Run `npx tsc --noEmit`, `npm run lint` and `npm run build` in `web/`, and `npm run lint` and `npm test` in `backend/`; verify all pass
- [x] 4.3 End-to-end check on local: create 3 customers through the booking form, confirm three different sales gain one "Đang tư vấn"/"Chờ duyệt" each on the team page, pause one sale on "Tài khoản", create another customer and confirm the paused sale's numbers do not grow; verify by screenshots of the team page before and after

## Workflow follow-up

- Open the PR into `dev`; ask Hậu to review the customer list changes (group 2).
- Archive the change after the PR is merged.
