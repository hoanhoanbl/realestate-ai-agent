# Danh sách task và mã nhánh

Mỗi nhánh làm một task và có một **mã**. Bảng này là nơi duy nhất cấp mã, để Hoàng và Hậu không đặt trùng số. Quy trình Git đầy đủ: [quy-trinh-git.md](quy-trinh-git.md). Kế hoạch theo tuần: [ke-hoach-tich-hop.md](ke-hoach-tich-hop.md).

Cập nhật lần cuối: 3/11/2026.

## 1. Quy ước đặt tên

| Loại | Mã | Tên nhánh | Tạo từ → PR vào |
|---|---|---|---|
| Chức năng | `FE-nn` | `feature/FE-nn-<ten-ngan>` | `dev` → `dev` |
| Sửa lỗi trên dev | `BF-nn` | `bugfix/BF-nn-<ten-ngan>` | `dev` → `dev` |
| Sửa gấp production | `HF-nn` | `hotfix/HF-nn-<ten-ngan>` | `main` → `main` |
| Tài liệu | `DC-nn` | `docs/DC-nn-<ten-ngan>` | `dev` → `dev` |
| Cấu hình, CI, quy trình | `CH-nn` | `chore/CH-nn-<ten-ngan>` | `dev` → `dev` |

- Mỗi loại đếm số riêng, tăng dần, **không dùng lại** số đã cấp, kể cả khi task bị bỏ.
- Tên ngắn viết thường, không dấu, nối bằng gạch ngang. Ví dụ: `feature/FE-20-telegram-homnay`.
- Dùng cùng mã ở tiêu đề PR (`[FE-20] Luồng 6: lệnh /homnay`) và trong commit (`feat(FE-20): ...`).

**Nhận task mới:**
1. Lấy số tiếp theo của loại đó trong bảng (mục 3 và 4), thêm một dòng vào mục 3 với tên mình và trạng thái "Chưa làm".
2. Đưa dòng đó lên `dev` bằng một PR nhỏ riêng (`chore/CH-nn-...`), merge xong mới tạo nhánh task. Làm vậy người kia thấy số đã có chủ, không đặt trùng.
3. Khi PR của task merge, sửa dòng của task đó sang mục 4 (đã xong) với số PR và ngày merge. Việc này làm ngay trong PR của task.

Bảng chỉ liệt kê các việc có nhánh riêng. Việc nhỏ không cần nhánh (sửa lỗi chính tả, đổi một dòng cấu hình) vẫn đi qua nhánh theo quy trình nhưng không cần cấp mã nếu mất dưới 30 phút.

## 2. Mốc thời gian

| Mốc | Ngày |
|---|---|
| Web hoàn thành | 22/11 |
| Khoá code | 3/12 |
| Nộp bài | 5/12 |

Tuần hiện tại là tuần 3 (2–8/11). Phân việc bên dưới theo mục 7 và 9 của `ke-hoach-tich-hop.md`; đổi người hay đổi tuần thì sửa tại đây.

## 3. Việc đang làm và sắp tới

### Tuần 3 (2–8/11)

| Mã | Nhánh | Việc | Ai | Trạng thái |
|---|---|---|---|---|
| FE-19 | `feature/FE-19-close-booking-gaps` | Vá 12 lỗ hổng từ đặt lịch đến đặt cọc (OpenSpec `close-booking-to-deposit-gaps`): chống trùng lịch, điểm danh, giữ chỗ căn nhà, đặt cọc, link quản lý lịch cho khách | Hoàng | Code xong và đã chạy end-to-end ở local, đã commit, chờ PR vào `dev`. Còn tài liệu `api-contract.md` (việc 8.1, gộp nội dung nhánh `docs/api-contract-hoang`) và đưa lên VPS khi release `v0.3.0` (10.1–10.6) |
| FE-20 | `feature/FE-20-telegram-homnay` | Telegram cho sale: lệnh `/homnay` (kế hoạch 3.2) | Hoàng | Chưa làm |
| FE-21 | `feature/FE-21-mautic-form-nhan-tin` | Form đăng ký nhận tin của Mautic trên web khách (kế hoạch 2.7) | Hậu | Chưa làm |
| FE-22 | `feature/FE-22-mautic-server` | Cấu hình Mautic trên server: custom field `ai_nudge_text`, segment "Nuôi WARM", campaign; sau đó bật luồng 2 trên server. Cấu hình làm qua trình duyệt, nhánh chỉ chứa phần ghi lại vào `docs/mautic-setup.md` và JSON nếu có đổi | Hậu | Chưa làm |
| DC-03 | `docs/DC-03-swimlane-luong-hoang` | Đưa swimlane luồng 1, 1b, 3 và error workflow (nhánh cũ `docs/luong-hoang`, 19/10, gộp vào `dev` không xung đột) | Hoàng | Chưa làm |
| DC-04 | `docs/DC-04-tai-lieu-khop-main` | Sửa tài liệu cho khớp `main` (kế hoạch 1.4). Mục chung bàn trước khi sửa | Hậu | Chưa làm |
| HF-01 | `hotfix/HF-01-nang-cap-nextjs` | Nâng Next.js 16.4.0 → 16.4.4: vá lỗi RCE mức critical (Image Optimization với SVG, `use cache`) và DoS Server Actions. Lỗi có trên production nên làm dạng hotfix từ `main` (mã BF-05 đã cấp trước đó bỏ, không dùng lại) | Hoàng | Đã commit, chờ PR vào `main`, sau đó PR đồng bộ `main` → `dev` |
| CH-04 | `chore/sua-quy-trinh-merge` | Tài liệu quy trình: mọi PR dùng "Create a merge commit". Nhánh đã tạo trước khi có quy ước mã nên giữ tên cũ | Hoàng | Đã push, chờ PR |
| CH-05 | `chore/CH-05-danh-sach-task` | File này | Hoàng | Chờ PR |

### Tuần 4 (9–15/11)

| Mã | Nhánh | Việc | Ai | Trạng thái |
|---|---|---|---|---|
| FE-23 | `feature/FE-23-l4-nguon-chien-dich` | Luồng 4 thêm số liệu theo nguồn khách và chiến dịch | Hậu | Chưa làm |
| FE-24 | `feature/FE-24-bo-20-lead` | Bộ 20 lead có nhãn và cách chạy đo (kế hoạch 1.5) | Hoàng | Chưa làm |
| FE-25 | `feature/FE-25-langfuse-l1` | Langfuse cho luồng 1, đo trên bộ 20 lead (kế hoạch 3.5) | Hoàng | Chưa làm |
| FE-26 | `feature/FE-26-web-dien-thoai` | Kiểm tra web admin trên điện thoại, sửa chỗ vỡ, nhất là danh sách lead (kế hoạch 1.3). Menu trượt đã làm ở FE-16 | Hoàng | Làm một phần |

### Tuần 5 (16–22/11)

Tích hợp chéo, sửa lỗi theo `BF-nn`, hoàn thiện tài liệu. Mốc **web hoàn thành 22/11**. Tuần này phát hành `v1.0.0`.

### Tuần 6 (23–29/11)

| Mã | Nhánh | Việc | Ai | Trạng thái |
|---|---|---|---|---|
| FE-27 | `feature/FE-27-app-expo` | Đưa app Expo sang `main` (lấy `app/` từ commit `6a64517` của `dev` cũ), thêm nhánh Expo Push vào sub-workflow thông báo, `eas init`, chạy thử trên điện thoại thật (kế hoạch 4.1, 4.3, 4.4) | Hoàng | Chưa làm |
| FE-28 | `feature/FE-28-app-diem-mautic` | Hiển thị điểm Mautic và nguồn khách trong app (kế hoạch 4.2). Chỉ làm sau khi FE-27 vào `dev` | Hậu | Chưa làm |

### Tuần 7 (30/11–5/12)

| Mã | Nhánh | Việc | Ai | Trạng thái |
|---|---|---|---|---|
| DC-05 | `docs/DC-05-bao-cao-hoang` | Báo cáo: luồng 1, 3, 6, Agentic, đo lường | Hoàng | Chưa làm |
| DC-06 | `docs/DC-06-bao-cao-hau` | Báo cáo: luồng 2, 4, 5, 7, 8, Marketing Automation, mục framework (kế hoạch 3.6) | Hậu | Chưa làm |

Video dự phòng làm không cần nhánh. Khoá code 3/12, nộp 5/12.

### Bỏ nếu thiếu giờ (chưa cấp mã)

- Luồng 5 gắn tag Mautic cho "xem căn khác" (kế hoạch 2.9).
- Multi-agent cho luồng 4 (kế hoạch 3.7).

### Mốc phát hành

| Phiên bản | Gồm | Bước làm tay trên VPS | Ai |
|---|---|---|---|
| `v0.3.0` | FE-18 (RAG), FE-19 (close-gaps) và các task xong trước đó | RAG: kiểm tra DB có extension `vector`, chạy `backend/sql/rag-kb.sql`, import và publish luồng 6b và luồng 6, restart n8n, chạy luồng 6b một lần. Close-gaps: theo phần 10 của OpenSpec | Hoàng |
| `v1.0.0` | Web hoàn thành | | Hoàng |
| `v1.1.0` | Bản nộp | | Hoàng |

Tag đã có: `v0.1.0` (demo 24/10, `55d99d9`), `v0.2.0` (bản chạy trên VPS 2/11, `603ecd5`).

## 4. Việc đã xong

Mã cấp bổ sung cho các nhánh đã merge, theo thứ tự PR đầu tiên của nhánh. Các nhánh này đặt tên theo kiểu cũ (không có mã trong tên).

### Chức năng (FE)

| Mã | Nhánh | Việc | Ai | PR | Merge |
|---|---|---|---|---|---|
| FE-01 | `feature/n8n-workflow` | Workflow n8n đầu tiên (luồng 1 đặt lịch) | Hoàng | #1 | 08/10 |
| FE-02 | `feature/web` | Ghép web thành một bản: form, danh sách, thanh điều hướng | Hoàng | #3 | 09/10 |
| FE-03 | `feature/backend-api` | Hoàn thiện API backend, `timestamptz`, thống kê | Hậu | #4 | 09/10 |
| FE-04 | `feature/lead-events-api` | HA1: bảng `lead_events`, `PUT status`, `POST/GET event` | Hậu | #7 | 12/10 |
| FE-05 | `feature/n8n-luong-2` | HA2, HA3: luồng 2 follow-up | Hậu | #8 | 12/10 |
| FE-06 | `feature/auth-admin-foundation` | Nền tảng JWT, bảng `users`, `N8nService`, khung web admin | Hậu | #10 | 19/10 |
| FE-07 | `feature/followup-and-feedback` | Luồng 2 tự động, luồng 5 phân tích cảm nhận, module feedback | Hậu | #11 | 19/10 |
| FE-08 | `feature/sales-analytics-ai` | Luồng 4 báo cáo tuần bằng AI, quản lý nhà, trang admin hợp đồng | Hậu | #12 | 19/10 |
| FE-09 | `feature/rbac-user-management` | Giao diện quản trị tài khoản, ma trận phân quyền | Hậu | #13 | 19/10 |
| FE-10 | `feature/foundation-source-mautic` | PR-F1: cột `source` và `mautic`, webhook `lead-changed`, xử lý UTM trên web | Hậu | #17 | 21/10 |
| FE-11 | `feature/mautic-setup` | Hạ tầng Mautic 5, luồng 7 đồng bộ, sửa các lỗi phản hồi của luồng 7 | Hậu | #18, #19, #20 | 21–22/10 |
| FE-12 | `feature/thong-bao-telegram` | Sub-workflow "Thông báo nhân viên" qua Telegram | Hoàng | #21, #24 | 21/10, 28/10 |
| FE-13 | `feature/luong-8-mautic-feedback` | Luồng 8: Mautic báo về, cập nhật điểm | Hậu | #22 | 26/10 |
| FE-14 | `feature/luong-6-telegram-agent` | Luồng 6 Telegram Agent cho khách, lọc nhà, đổi DB sang pgvector | Hoàng | #23 | 27/10 |
| FE-15 | `feature/ci-cd-deploy` | GitHub Actions tự deploy lên VPS khi merge vào `main` | Hoàng | #25 | 29/10 |
| FE-16 | `feature/web-giao-dien-dot-1-2` | Làm mới giao diện web (đợt 1–5): component, ảnh và mô tả nhà, trang admin, PDF hợp đồng | Hoàng | #27, #29 | 29–30/10 |
| FE-17 | `feature/luong-2-va-mautic-web` | Luồng 2 chuyển WARM sang Mautic, tracking, hai trục điểm, ô đồng ý nhận tin | Hậu | #28 | 30/10 |
| FE-18 | `feature/rag-tri-thuc` | Luồng 6b nạp tri thức vào pgvector, tool "Hỏi đáp tri thức" cho luồng 6 | Hoàng | #32 | 03/11 |

### Sửa lỗi (BF)

| Mã | Nhánh | Việc | Ai | PR | Merge |
|---|---|---|---|---|---|
| BF-01 | `fix/n8n-failed-callback` | Nhánh lỗi báo FAILED, URL gọi ngược sang `backend:8081` | Hoàng | #5 | 09/10 |
| BF-02 | `fix/n8n-luong-2-switch-fallback` | Luồng 2: Switch dùng fallback `extra` | Hậu | (merge trực tiếp, `7b21c70`) | 15/10 |
| BF-03 | `fix/compose-env-auth` | Truyền `JWT_SECRET`, `SEED_USER_PASSWORD` vào backend | Hoàng | #15 | 19/10 |
| BF-04 | `fix/mautic-url-env` | Luồng 7 đọc URL Mautic từ `MAUTIC_URL` | Hoàng | #26 | 29/10 |

### Tài liệu (DC)

| Mã | Nhánh | Việc | Ai | PR | Merge |
|---|---|---|---|---|---|
| DC-01 | `docs/dong-bo-hop-dong` | Đồng bộ hợp đồng API, thêm quy tắc phối hợp | Hoàng | #2 | 09/10 |
| DC-02 | `docs/ke-hoach-tuan-2` | Kế hoạch tuần 2, tổng quan dự án | Hoàng | #6 | 12/10 |

### Cấu hình, quy trình (CH)

| Mã | Nhánh | Việc | Ai | PR | Merge |
|---|---|---|---|---|---|
| CH-01 | `claude/magical-albattani-4a06ae` | Dọn tài liệu tuần cũ, sửa nhỏ `viewings.service` | Hoàng | #14 | 19/10 |
| CH-02 | `claude/source-analysis-integration-proposal-831874` | Kế hoạch tích hợp Mautic, Agentic AI và app (`ke-hoach-tich-hop.md`) | Hoàng | #16 | 20/10 |
| CH-03 | `chore/quy-trinh-git` | Chuyển sang git-flow (`dev` → `main`), CI kiểm tra PR, PR template, tài liệu quy trình | Hoàng | #31 | 03/11 |

### Nhánh cũ không có PR riêng

Đã vào `main` trước khi dùng PR cho mọi thay đổi hoặc gộp qua PR của nhánh khác, nên không cấp mã: `feature/n8n-luong-1`, `feature/n8n-luong-1-push`, `feature/n8n-luong-1b`, `feature/n8n-error-workflow`, `feature/web-khu-khach`, `feature/web-lead-detail`, `feature/contracts-luong-3`, `fix/validate-dat-lich`, `fix/viewing-lost-update`, `docs/don-tuan-1-2`, `docs/ke-hoach-tich-hop`.

### Nhánh cũ chưa merge

| Nhánh | Xử lý |
|---|---|
| `docs/luong-hoang` | Gộp lại ở DC-03 |
| `docs/api-contract-hoang` | Xung đột `api-contract.md`; nội dung gộp vào việc 8.1 của FE-19, sau đó xoá nhánh |
| `docs/phoi-hop` | Quy tắc Git cũ ("làm trên main"), đã được `quy-trinh-git.md` thay thế; xoá nhánh |

Lệnh xoá nhánh cũ xem mục 8 của `quy-trinh-git.md`.
