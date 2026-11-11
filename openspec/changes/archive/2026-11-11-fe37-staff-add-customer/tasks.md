# Tasks

Spec: `specs/staff-customer-entry/spec.md`. Decisions D1–D7 in `design.md`. PR #61 (FE-34) is already in `dev`.

## 1. Building blocks

- [x] 1.1 Add `phone`, `building`, `chat`, `sign` icons to `web/src/components/ui/Icon.tsx` (D6); verify `npx tsc --noEmit` passes and the icons render at 20px in the browser
- [x] 1.2 Add `normalizePhoneInput(value): string | null` to `web/src/lib/` with the same rule as `backend/src/leads/intake-rules.ts#normalizePhone` (comment pointing to it) and a `MANUAL_SOURCES` list (`hotline`, `property_sign`, `walk_in`, `personal_zalo`, `referral`, `other`) reusing `SOURCE_LABELS`; verify with a quick node check that `+84 905.123-456`, `(090) 512 3456` give `0905123456` and `123`, `abc0905` give `null`

## 2. Add customer page

- [x] 2.1 Create `web/src/app/admin/leads/them/page.tsx` with `PageHeader`, `BackLink` and the form component `web/src/components/AddCustomerForm.tsx` laid out as in D2 and D7 (four fieldsets with legends, source as native radio chips, phone then name, email, budget with formatted value, interested-property search and checkbox list, note, owner, consent, footer buttons); verify in the browser that the page loads for a logged-in sale and redirects to login when logged out
- [x] 2.2 Implement field validation (required source, name, phone; valid email; budget whole number ≥ 0; owner required) per D7: on blur and on submit, message under the field with `aria-describedby` and `aria-invalid`, focus moves to the first invalid field on failed submit; verify in the browser: submitting empty shows the required messages, focus lands on the first one, and no request is sent
- [x] 2.3 Implement the debounced duplicate lookup (D3) with the "Đang kiểm tra số…" live text, the warning with link to the existing lead, and the disabled save button; verify in the browser against the local backend: typing an existing number in another format shows the warning and link, changing to a new number clears it
- [x] 2.4 Implement the owner list and default (D5); verify: the logged-in user is preselected as "Tôi (<tên>)"; with "Đang nhận khách" turned off for that user the field starts empty and saving is blocked until chosen
- [x] 2.5 Implement submit (D4): send only filled fields, go to `/admin/leads/<id>` on success, on 409 show the server message plus the link from a fresh lookup and keep the data, on 400 show the message; verify in the browser: a walk-in customer with only source, name and phone is saved with empty email and budget, source "Đến văn phòng", owner = me; a number saved meanwhile from another tab gives the 409 warning with link
- [x] 2.6 Add the leave confirmation (D7 `sheet-dismiss-confirm`): "Huỷ" and closing the tab ask before discarding typed data; verify in the browser that an empty form leaves without asking and a typed form asks
- [x] 2.7 Add the "Thêm khách" primary button to the `PageHeader` of `web/src/app/admin/leads/page.tsx`; verify it opens the page

## 3. Quality and docs

- [x] 3.1 Check the page against `docs/giao-dien-web.md` and the D7 table at 375px and at desktop width: no horizontal scroll, all buttons and inputs ≥ 44px on phone, inputs 16px text, selected source has an icon besides colour; verify by measuring in the browser (same-origin iframe at 375px)
- [x] 3.2 Run `npx tsc --noEmit`, `npm run lint` and `npm run build` in `web`; verify all pass
- [x] 3.3 Mark §1.1 of `docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md` as running (FE-37, without "Đặt lịch xem luôn", noted as a later task), set LH-02 to done in `docs/danh-sach-lo-hong.md`, update FE-37 in `docs/danh-sach-task.md`; verify the links resolve

## Workflow follow-up

- Open the PR `[FE-37] …` into `dev`, PR #61 (FE-34) is already merged into `dev`; ask Hậu to review the one-line change on the customer list page.
- Archive the change after the PR is merged.
