# Proposal

## Why

Customers who reach a sale directly (hotline, a sign on the property, walk-in, the sale's personal Zalo, referrals) never enter the system: the company does not see them, reports do not count them, and they leave with the sale (LH-02). FE-33 added the backend for manual entry (`POST /api/leads`, `GET /api/leads/lookup`) but there is no screen to use it.

## What Changes

- New web admin page **"Thêm khách"** at `/admin/leads/them`, reachable from a primary button on the customer list. Available to every logged-in staff member (SALE and MANAGER).
- The form collects the fields of `docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md` §1.1: source (chosen from the manual sources), name, phone, optional email, budget, interested properties, note, and owner. "Book a viewing now" is **not** part of this change (decided: later task, after FE-34 is merged).
- **Duplicate warning while typing:** once the phone number looks complete, the page looks it up and, if a customer already has that number, shows who it is, its status and owner, with a link to open that lead, and blocks saving.
- Owner defaults to the person entering; the dropdown lists staff who accept customers (and managers). There is no "auto-assign" option, because the backend assigns manual entries to the entering user or the chosen person only.
- After saving, the page opens the new lead's detail page.
- Optional "customer agreed to receive news" checkbox, unticked by default.

Out of scope: booking a viewing from this form, AI scoring of manual leads (FE-35), Mautic sync of leads without email (FE-40).

## Capabilities

### New Capabilities

- `staff-customer-entry`: how staff add a customer who came from outside the system, how duplicates by phone number are surfaced before saving, and who owns the new customer.

### Modified Capabilities

None.

## Impact

- **Web (Hoàng's area, except as noted):** new page `web/src/app/admin/leads/them/page.tsx` and a form component; a "Thêm khách" button in the header of `web/src/app/admin/leads/page.tsx` (customer list is Hậu's page: one-line include, Hậu reviews); possibly a new icon in `components/ui/Icon.tsx`.
- **API:** none new. Uses `POST /api/leads`, `GET /api/leads/lookup`, `GET /api/users/assignees`, `GET /api/properties`, all existing in `dev`.
- **Merge order:** leads without email trigger the `lead-changed` webhook to flow 7, which rejects them. FE-34 (PR #61) makes the backend skip those leads, so this change must be merged after #61 (merged into `dev` on 10/11, condition met).
- **Docs:** `docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md` §1.1 marked running, `docs/danh-sach-lo-hong.md` LH-02, `docs/danh-sach-task.md` FE-37.
