# Design

## Context

See proposal.md. Backend and client functions already exist in `dev` (FE-33):

- `createLead(input)` → `POST /api/leads` (JWT). With a logged-in actor the owner is `assignedUserId ?? actor.id`; the chosen owner must exist and be accepting customers unless they are a manager, else 400 "Người phụ trách không tồn tại hoặc đang ngừng nhận khách". A duplicate phone returns 409 with `{ message, leadId, assignedUserId }`. The lead is saved as `CONSULTING`; no workflow is triggered.
- `lookupLeadByPhone(phone)` → `GET /api/leads/lookup` (JWT): `{ id, name, status, assignedUserId, assignedUserName }` or `null`; 400 for an invalid number.
- `getAssignees()` → `{ id, name, role, acceptingLeads }[]`; `getProperties()` → public list (excludes hidden and sold).
- `request()` turns error bodies into `ApiError(message, status)`; the 409's `leadId` is dropped.
- UI kit: `Field`, `INPUT`, `Button`, `PageHeader`, `Alert`, `BackLink`, `Icon`, `CARD`. Rules in `docs/giao-dien-web.md` (the project's version of the ui-ux-pro-max checklist).
- Session: `useSession()` gives `{ user: { id, name, role } }`.

## Goals / Non-Goals

**Goals:**
- A form a sale can fill during or right after a phone call in under a minute, on a phone.
- Make duplicates obvious before the sale types the rest.

**Non-Goals:**
- Booking a viewing from the form; editing an existing lead from this page; AI scoring of manual leads.

## Decisions

### D1. Separate page, not a modal
Route `/admin/leads/them` (static segment, wins over `[id]`). A full page works better on phones than a modal, survives a reload, and can be linked from elsewhere later. The customer list gets a primary "Thêm khách" button (`buttonClass('primary')` + `Icon plus`) in its `PageHeader` actions; the page has `BackLink` to the list.

### D2. Layout: phone field first, sections in one card
Order follows the call: **who called and how → is this person already known → details**.

```
Thêm khách                                   [< Danh sách khách]
Khách gọi hotline, đến văn phòng, ... nhập vào đây để có người phụ trách.

+----------------------------------------------------------------+
| Khách đến từ đâu *                                             |
| [Gọi hotline] [Biển treo tại căn] [Đến văn phòng]              |
| [Zalo cá nhân] [Người quen giới thiệu] [Khác]   (chip, 1 chọn) |
|                                                                |
| Số điện thoại *            Họ tên *                            |
| [0905 123 456      ] (o)   [Trần Thị Bình            ]         |
|  ! Số này đã có: lead #42 Trần Thị Bình · Đang tư vấn          |
|    · đang do Minh phụ trách.  [Mở hồ sơ #42 >]                 |
|----------------------------------------------------------------|
| Email (không bắt buộc)     Ngân sách (VND)                     |
| [binh@gmail.com    ]       [3000000000 ]  = 3 tỷ               |
| Căn quan tâm               [Tìm căn...                   ]     |
|  [x] Căn hộ Sơn Trà 2PN   [ ] Nhà phố Hải Châu  ... (cuộn)     |
| Ghi chú cuộc gọi                                               |
| [Cần 2PN gần trường, muốn xem cuối tuần              ]         |
|----------------------------------------------------------------|
| Người phụ trách *          [x] Khách đồng ý nhận tin          |
| [Tôi (An)          v]                                          |
|                                         [Huỷ]  [Lưu khách]     |
+----------------------------------------------------------------+
```

- Two columns from `sm` up (`grid grid-cols-1 sm:grid-cols-2`, every column `min-w-0`), one column on phones. Phone is the first text field so the duplicate check runs before the rest is typed.
- Source chips: native `<input type="radio">` inside `<label>` styled as chips, grouped in a `<fieldset>` with a `<legend>` (keyboard arrows and screen readers work without custom code). Icon + text, `min-h-11`, 8px gap, visible `focus-visible` ring. Selected chip uses brand colour **and** a check icon (colour is not the only signal).
- Lookup indicator inside the phone field: small spinner text "Đang kiểm tra số…" under the field (`aria-live="polite"`), then either nothing (new number) or the warning `Alert tone="warning"` with the link.
- Budget shows the formatted value (`formatVnd`) under the field, like the booking form.
- Interested properties: a search box filtering a scrollable checkbox list (max height ~ 12rem, `overflow-y-auto`), selected ones shown first as removable chips. Few properties exist, so client-side filtering is enough.
- Sticky-free footer with secondary "Huỷ" (back to list) and primary "Lưu khách"; on phones the buttons are full width, stacked, primary first.

### D3. Duplicate lookup
Normalize on the client with the same rule as the backend (`normalizePhone` in `intake-rules.ts`): strip spaces, dots, dashes, brackets; `+84` → `0`; valid when 8–15 digits. When valid and changed, wait 400 ms (debounce), call `lookupLeadByPhone`, and ignore answers for an older number (compare with the latest normalized value). Lookup 400 or network error: show nothing and let the server decide on submit. Save is disabled while a duplicate is shown or a lookup for the current number is pending.

### D4. Save and the 409 race
Submit sends only filled fields (`email`, `budget`, `needs`… omitted when empty, `note` from the note box, `interestedPropertyIds` when any). On `ApiError` 409, call `lookupLeadByPhone` again to get the existing lead and show the same warning with the link; keep the form. On 400 show the message in an `Alert` above the footer. On success `router.push('/admin/leads/' + lead.id)`.

### D5. Owner list
Load `getAssignees()`. Options: users with `acceptingLeads` or `role === 'MANAGER'`. The current user appears first as "Tôi (<tên>)". Default = current user if they are in the options, else empty with a required error. The backend accepts any accepting user or manager, so no extra permission rule is added for sales choosing a colleague.

### D6. Icons
Add `phone`, `building`, `chat` and `sign` paths to `Icon.tsx` (24×24 stroke icons, same style as the existing set) for the source chips. Referral reuses `users`; "Khác" is a text-only chip. Existing `plus`, `alert`, `check`, `search` cover the rest of the page.

### D7. Review against ui-ux-pro-max (web rules, `references/quick-reference.md` v2.15.0)

The skill's web rules (sections 1 Accessibility, 2 Touch, 8 Forms) were checked against D2–D5. Added:

| Skill rule | Applied |
|---|---|
| `field-grouping` | Four `<fieldset>` groups with visible legends: "Khách đến từ đâu", "Liên hệ", "Nhu cầu", "Phụ trách" |
| `required-indicators` | Required labels end with `*`; one line under the title: "Mục có * là bắt buộc" |
| `inline-validation`, `error-placement` | Validate a field on blur and again on submit, not on every keystroke. Error text under the field, linked with `aria-describedby`, field gets `aria-invalid` |
| `error-clarity` | Messages say what to fix, e.g. "Nhập số điện thoại 8–15 chữ số", not "Không hợp lệ" |
| `focus-management` | Failed submit moves focus to the first invalid field |
| `input-type-keyboard` | Phone `type="tel"`, email `type="email"`, budget `inputMode="numeric"`. `autoComplete="off"` on customer fields, because the browser would otherwise fill in the **staff member's own** name and phone |
| `loading-buttons`, `submit-feedback` | Save button shows "Đang lưu…" and is disabled while sending; on success it shows "Đã lưu" briefly while the lead page opens |
| `disabled-states`, `error-recovery` | When save is blocked by a duplicate, the reason and the "Mở hồ sơ #…" link sit next to the button, not only on the phone field |
| `aria-live-errors`, `contextual-live-badge-updates` | Lookup progress and the duplicate warning are in one `role="status"` region; server errors use `role="alert"` |
| `sheet-dismiss-confirm` | "Huỷ" (and leaving the page) asks for confirmation when something was typed |

Rules not applicable here: dark mode (admin has no dark theme), animation presets, charts, native-app rules in `pro-rules.md`.

## Risks / Trade-offs

- [Leads without email hit flow 7] → Merge after PR #61, whose backend skips `lead-changed` when email is empty.
- [Manual leads are not AI-scored] → Level stays empty until FE-35; the lead list already shows "chưa chấm" for missing level.
- [Client and server normalization drift] → Same rule written in both places with a comment pointing to `intake-rules.ts`; the server stays the authority (409 path).

## Migration Plan

Web-only change; no data or workflow step. Deploy with the release that contains FE-34.
