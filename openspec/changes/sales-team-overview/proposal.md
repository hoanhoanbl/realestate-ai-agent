# Proposal

## Why

Now that customers are split round-robin across 11 sales (LH-04, FE-33/FE-41), the manager has no way to see how each sale is doing. The customer list shows "Phụ trách: X" on each card but cannot be filtered by owner, so answering "which customers does Hà hold, which did she lose, which did she sign" means scanning every card. `GET /api/stats` already computes `byAssignee`, but no page shows it. The manager cannot spot a sale who is overloaded, ignoring customers, or losing many of them, and cannot check that the round-robin is even.

## What Changes

- **Customer list (`/admin/leads`): "Phụ trách" filter.** A select next to "Mọi trạng thái" listing every sale, the manager, and "Chưa phân công". It combines with the existing status filter, level chips and search; chip counts follow it. The choice is kept in the URL (`?assignee=<id>` or `?assignee=none`) so other pages can link to a pre-filtered list. The owner name on each card becomes a link that applies this filter. Shown to managers only.
- **New manager-only page "Đội sale" (`/admin/doi-sale`)**, a new item in the QUẢN LÝ group of the sidebar, between "Báo cáo" and "Quản lý nhà". One row per sale (plus the manager and "Chưa phân công" in a separate "Ngoài đội sale" group), with a period switch:
  - **Hiện tại:** open customers per stage (Đang tư vấn, Chờ duyệt, Đã chốt lịch, Đã xem nhà, Đang cọc, total), whether the sale is accepting customers, and "Cần chú ý" flags: overdue first response, and open customers nobody has touched for more than 7 days.
  - **Tuần này / Tháng này:** new customers assigned, customers who attended a viewing, signed deposits, customers lost, and signed ÷ new.
  - KPI cards summarise the whole team for the selected period.
  - Every name, number and flag links to the customer list pre-filtered to that sale (and status where it applies).
- **New API `GET /api/stats/team?period=now|week|month`**, manager only, returning the per-owner numbers above in one request.
- The layout follows the project's UI conventions (`docs/giao-dien-web.md`) and the ui-ux-pro-max checklist: table on desktop, one card per sale on phones, 44px tap targets, state shown by text or icon as well as color, loading skeleton and empty state.

Out of scope: a per-sale detail page with charts, targets or commission, crediting a sale for customers later moved to someone else (see design), changing whether sales can see each other's customers, and notifications.

## Capabilities

### New Capabilities

- `sales-team-overview`: how a manager sees the workload and results of each sale (team page, per-owner numbers and attention flags over a chosen period) and drills down to the customers behind each number through an owner filter on the customer list.

### Modified Capabilities

None.

## Impact

- **Backend:** new `getTeam(period)` in `backend/src/stats/stats.service.ts` and route `GET /api/stats/team` in `stats.controller.ts`, guarded by `RolesGuard` + `@Roles('MANAGER')`. Read-only SQL over `leads`, `lead_events`, `viewings`, `contracts`, `users`. No migration.
- **Web:** new page `web/src/app/admin/doi-sale/page.tsx` and component(s); new nav entry in `web/src/components/AdminShell.tsx` (+ an icon in `components/ui/Icon.tsx` if none fits); owner filter and owner link in `web/src/app/admin/leads/page.tsx` (customer list is Hậu's page: Hậu reviews); `getTeamStats()` and types in `web/src/lib/api.ts`.
- **Docs:** `docs/api-contract.md` (new route), `docs/nghiep-vu/vai-tro-va-trang-thai.md` (manager permission row), `docs/danh-sach-task.md` (new task id).
