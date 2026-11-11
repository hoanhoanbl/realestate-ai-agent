# Proposal

## Why

Only 5 of the 12 n8n workflows have a document in `docs/luong/` (flows 2, 4, 5, 7, 8). Flows 1, 1b, 3, 6, 6b, the Error workflow and the staff notification sub-workflow have none on `dev`, and the only older copies (branch `docs/luong-hoang`, 19/10) predate FE-29 to FE-40, so they no longer match the flows. The five existing documents use two different structures and mostly lack a "Triển khai lên server" section. `docs/api-contract.md` is half unaccented and half accented, has sections 3.2 and 3.3 placed after section 7, and misses routes added since FE-33. `docs/tong-quan-du-an.md` still describes the lifecycle and architecture from before FE-33.

Since 4/11 the team rule is that business rules and manual steps live in `docs/`, written in Vietnamese by the person who made them. The report is due 5/12 and code freezes 3/12, and the report tasks (DC-05, DC-06) cover these same flows, so the documents need to be right before then. Importing and enabling a workflow on the VPS is a manual step (`docs/trien-khai.md`), so each flow document needs its own "Triển khai lên server" section.

## What Changes

- New `docs/luong/README.md` with one shared template for flow documents and a table of all 12 workflows (file, trigger, workflow id, document link).
- Seven new documents in `docs/luong/`: flows 1, 1b, 3, 6, 6b, `error-workflow`, `thong-bao-nhan-vien`, written from the current workflow JSON and the code on `dev`, not from the 19/10 copies.
- Restructure the five existing flow documents (2, 4, 5, 7, 8) to the same template, keep their content, and add the missing "Triển khai lên server" section. Hậu reviews these.
- `docs/api-contract.md`: convert to accented Vietnamese, restore sequential section numbers, and reconcile every route in the backend controllers with the contract. Final text of new and changed endpoints is proposed in chat before editing.
- `docs/tong-quan-du-an.md`: update the lead lifecycle (section 5), the workflow table (section 6) and the architecture (section 7); update the document map in `README.md`.
- In the same PR, move the DC-03 row in `docs/danh-sach-task.md` to the finished table with the PR number.

Out of scope: any change to workflow JSON, backend, web or database; business rules (they stay in `docs/nghiep-vu/` and are linked, not copied); documents for FE-20 (dropped), FE-24 and FE-25 (not built); the report itself (DC-05, DC-06); deleting the old branches (asked about after merge).

## Capabilities

### New Capabilities

None. This change documents existing behaviour and changes none, so `skip_specs: true` is set in `.openspec.yaml`.

### Modified Capabilities

None.

## Impact

- **Files:** `docs/luong/*` (8 new, 5 edited), `docs/api-contract.md`, `docs/tong-quan-du-an.md`, `README.md`, `docs/danh-sach-task.md`. No source code, no `.env`, no n8n import.
- **Reviewers:** Hậu approves the parts on flows 2, 4, 5, 7, 8 (his flows).
- **Dependencies:** the documents describe `dev` as of the PR that merges FE-38 (#64) and later, so the branch is created from the current `dev`. Parts not yet run on real n8n or the server (FE-34 task 5.2, FE-35 task 6.2, FE-36) are written as "chưa kiểm trên server" rather than as fact.
- **Related work:** closes task 8.1 of `close-booking-to-deposit-gaps` (API contract); `docs/trien-khai.md` (DC-09) is linked for server steps and not rewritten.
- **Effort:** about 14 hours for Hoàng, which is the largest remaining task of week 4.
