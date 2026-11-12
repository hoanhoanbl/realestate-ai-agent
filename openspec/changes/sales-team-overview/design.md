# Design

## Context

See proposal.md for motivation and specs/sales-team-overview/spec.md for behavior.

What exists today:
- `GET /api/leads` returns every lead (all statuses) to any logged-in user; the customer list (`web/src/app/admin/leads/page.tsx`) filters on the client by status (`?status=`), level chips (`?filter=`/`?level=`) and a search box. Owner names come from `GET /api/users/assignees`.
- `leads` has `assigned_user_id`, `assigned_at` (reset on every assignment, including reassignment), `response_due_at`, `first_response_at`, `status`, `lost_reason`.
- `lead_events` records `LEAD_ASSIGNED`, `LEAD_REASSIGNED`, `NOTE_ADDED`, `STATUS_CHANGED` (note text like `VIEWED -> LOST: …`), etc. Event notes are free text; the new owner of an assignment is not stored as a column.
- `viewings.status` = `ATTENDED` when the customer came; contracts have `status = 'SIGNED'` and `signed_at`.
- The overdue rule already used by `/api/stats` (`overdueResponses`): open status, `first_response_at IS NULL`, `response_due_at <= now()`.
- Manager-only routes use `RolesGuard` + `@Roles('MANAGER')`; manager-only pages check `session.user.role` (as `bao-cao/page.tsx` does) and the sidebar hides items through `roles` in `AdminShell.tsx`.
- UI conventions: `docs/giao-dien-web.md` (components in `components/ui`, 44px targets, table → cards below `md`, no color-only state, Be Vietnam Pro, brand tokens).

## Goals / Non-Goals

**Goals:**
- One request per period returns everything the team page needs.
- Every number on the team page equals the length of the customer list it links to (for "Hiện tại" and status-based numbers).
- No schema migration.

**Non-Goals:**
- Historical credit for customers moved to another sale (counts follow the current owner).
- Charts, targets, rankings or exports.
- Restricting what sales can see in `GET /api/leads`.

## Decisions

### 1. One aggregate endpoint, computed in SQL
`GET /api/stats/team?period=now|week|month` returns:
```
{
  period, from, to,                         // from/to ISO, null for "now"
  owners: [{ id|null, name, role, acceptingLeads|null,
             open: {CONSULTING, NEW, CONFIRMED, VIEWED, DEPOSIT, total},
             overdue, idle,                  // "now" only, else 0
             assigned, attended, signed, lost }],   // period only, else 0
  totals: { ...same numeric fields summed }
}
```
Each metric is one `GROUP BY assigned_user_id` query, merged in the service with the user list so sales with no customers still appear. *Alternative:* reuse `GET /api/leads` and count on the client. Rejected: it cannot see viewings, contracts or event times, and ships every lead to compute a dozen numbers.

### 2. Period metrics follow the current owner
- assigned: `leads.assigned_at` in `[from, to)` grouped by current owner. Because `assigned_at` resets on reassignment, a customer moved from Hà to Bảo this week counts for Bảo only.
- attended: distinct leads with a `viewings` row `status='ATTENDED'` and `viewing_time` in range.
- signed: contracts `status='SIGNED'` with `signed_at` in range.
- lost: leads currently `LOST` with a `STATUS_CHANGED` event whose note matches `-> LOST` in range (latest such event).

*Alternative:* attribute by the owner at event time, parsing `LEAD_ASSIGNED`/`LEAD_REASSIGNED` notes. Rejected for now: notes are free text, and a structured owner column on `lead_events` is a migration this change avoids. Recorded as a known limitation in the spec (results are per current owner).

### 3. Attention flags
- overdue: the existing `/api/stats` overdue rule, grouped by owner.
- idle: open leads where `GREATEST(assigned_at, max(lead_events.created_at))` is older than 7 days. Automated events (follow-up emails written by n8n) also count as activity; this is accepted because they are visible on the timeline and the threshold is a nudge, not a KPI.

### 4. Period boundaries in Vietnam time
`from` = Monday 00:00 or the 1st 00:00 in `Asia/Ho_Chi_Minh`, computed in SQL with `date_trunc('week'|'month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh'`, so results do not depend on the server TZ. `to` = `now()`.

### 5. Drill-down uses the existing customer list
Links go to `/admin/leads?assignee=<id|none>&status=<STATUS>`. For "Hiện tại" totals and flags the list cannot express "open only", "overdue" or "idle" with today's filters, so:
- the total and flags link to the owner filter only (`?assignee=<id>`), and the list shows all of that owner's customers;
- period numbers link to owner + status where a status exists (signed → `SIGNED`, lost → `LOST`), and to owner only for assigned/attended.

*Alternative:* add `open`/`overdue`/`idle` filters to the customer list now. Deferred: it widens Hậu's page beyond one select; can be added later without changing the API.

The customer list reads `assignee` from `useSearchParams` like `status`, filters on `lead.assignedUserId` on the client, and updates the address with `router.replace` when the select changes.

### 6. UI structure (ui-ux-pro-max + project conventions)
- `PageHeader` with title "Đội sale" and a short subtitle; period switch as a segmented control of three `<button aria-pressed>` (44px on phones), stored in `?period=`.
- KPI row: four `CARD`s, `grid-cols-2 md:grid-cols-4`, number large, label in `text-slate-500`; warning cards use red text plus an icon, not color alone.
- Table (`hidden md:block`, wrapper `overflow-x-auto`): first column owner (initials avatar + name link + "Đang nhận"/"Tạm ngừng" `Badge`), status columns grouped under a header, total column with a neutral background, "Cần chú ý" column with red/amber `Badge`s that include the count and words. Zero shown as a muted "0" that is not a link.
- Phone (`md:hidden`): one `CARD` per owner, name + badge on top, a 3-column grid of label/number pairs, flags below; whole number cells are 44px link targets.
- "Ngoài đội sale" rows separated by a labelled subheading in both layouts.
- Loading: `Skeleton` rows with the same shape; error: `Alert` with "Thử lại"; no sales: `EmptyState` pointing to "Tài khoản".
- New sidebar entry `{ href: "/admin/doi-sale", label: "Đội sale", icon: "team", roles: ["MANAGER"] }`; add a `team` path to `Icon.tsx` if no existing icon fits.

## Risks / Trade-offs

- [Counts follow the current owner, so a sale who hands customers over looks worse in period results] → state it in the page's helper text ("Tính theo người đang phụ trách") and revisit with a structured owner column on `lead_events` if managers rely on it.
- [Lost time is read from event note text] → match the fixed prefix written by `leads.service.ts` and `followups.service.ts` (`-> LOST`); add an integration test that marks a lead lost through each path and checks it is counted.
- [`GET /api/leads` returns all leads, so the client-side owner filter scales with the total number of leads] → acceptable at current volume (tens to hundreds); server-side filtering can come with pagination later.
- [Numbers on the team page and the filtered list can differ for "Hiện tại" totals because the list also shows closed customers] → link totals to the owner filter and say "đang mở" in the column header; flags open the same list for now.

## Migration Plan

No database change. Deploy backend and web together; the new route and page are additive. Rollback: revert the web change (sidebar item and page disappear) and the route.
