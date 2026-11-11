# Danh sách task và mã nhánh

Mỗi nhánh làm một task và có một **mã**. Bảng này là nơi duy nhất cấp mã, để Hoàng và Hậu không đặt trùng số. Quy trình Git đầy đủ: [quy-trinh-git.md](quy-trinh-git.md).

Cập nhật lần cuối: 6/11/2026.

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

Tuần hiện tại là tuần 3 (2–8/11). Phân việc chỉ ghi tại file này. Đổi người hay đổi tuần thì sửa tại đây.

Từ 4/11, mỗi quy tắc nghiệp vụ, ngoại lệ hay bước làm tay phải được ghi vào `docs/` bằng tiếng Việt, trong cùng task làm ra nó. Quy tắc chỉ nằm trong code hoặc OpenSpec thì người kia không biết. Tài liệu nghiệp vụ đặt trong `docs/nghiep-vu/` (DC-07); tài liệu luồng chỉ link sang đó, không chép lại quy tắc.

## 3. Việc đang làm và sắp tới

### Tuần 3 (2–8/11)

| Mã | Nhánh | Việc | Ai | Trạng thái |
|---|---|---|---|---|
| BF-07 | `bugfix/BF-07-mautic-tracking-va-nguong` | Chặn tracking/referrer trên các link riêng và thống nhất ngưỡng HOT từ 70 ở thẻ, ma trận và bộ lọc | Hậu | Đã merge dev PR #56 (90698b7); test `check-mautic-privacy.cjs` PASS. Chưa xác minh server |
| FE-22 | `feature/FE-22-mautic-server` | Cấu hình Mautic trên server: custom field `ai_nudge_text`, segment "Nuôi WARM", segment "Bản tin hằng tháng" (khách COLD, dùng chung với form FE-21), campaign; sau đó bật luồng 2 trên server. Cấu hình làm qua trình duyệt, nhánh chỉ chứa phần ghi lại vào `docs/mautic-setup.md` và JSON nếu có đổi. **Hạn 8/11** | Hậu | Đang làm. Tài liệu đã vào `dev` (PR #48, 05/11); trên server đã có field `ai_nudge_text`, segment "Nuôi WARM", 3 email và campaign (Inactive). PR #49 đã merge 06/11. Code và cấu hình local đã kiểm tra 10/11: [biên bản](fe-22-nghiem-thu-local.md). Người dùng bàn giao server cho Hoàng: tạo segment bản tin, nghiệm thu giao thư/DNC, xác minh worker/cron và bật campaign |
| FE-21 | `feature/FE-21-mautic-form-nhan-tin` | Form đăng ký nhận tin của Mautic trên web khách (kế hoạch 2.7) | Hậu | PR #46, đang xung đột với `dev`: kéo `dev` mới về và giải xung đột |
| BF-08 | `bugfix/FE-22-fix-mautic-server` (đặt tên trước khi có mã) | Worker và cron Mautic chạy nhầm vai trò web (thiếu `DOCKER_MAUTIC_ROLE` trong `docker-compose.mautic.yml`) từ 29/10, nên hàng đợi không được xử lý (364 tin chờ ngày 5/11), segment không rebuild, campaign không chạy. Cùng PR #49 với phần sửa tài liệu FE-22. Hoàng kiểm tra và sao lưu hàng đợi trên server **trước khi** merge release `v0.3.1`, vì CI tạo lại container là worker chạy ngay | Hậu | Xong ở `dev` (PR #49, 06/11). Hàng đợi server kiểm tra 06/11: 435 tin, đều là `PageHitNotification`, không có email; lên server khi merge release |

### Tuần 4 (9–15/11)

| Mã | Nhánh | Việc | Ai | Trạng thái |
|---|---|---|---|---|
| CH-08 | `chore/CH-08-skill-ui-ux` | Đưa skill `ui-ux-pro-max` (bản `v2.15.0`, MIT, nguồn `nextlevelbuilder/ui-ux-pro-max-skill`) vào `.claude/skills/` để cả nhóm dùng cùng một chuẩn giao diện (`docs/giao-dien-web.md`). Script tra cứu cần Python 3 | Hoàng | Xong, chưa PR |
| DC-13 | `docs/DC-13-tiep-nhan-phan-cong` | Chốt quy trình tiếp nhận khách và phân công sale (`docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md`), lập danh sách lỗ hổng theo vòng đời khách (`docs/danh-sach-lo-hong.md`), xoá kế hoạch 20/10 và 3 kịch bản demo | Hoàng | Xong, chưa PR |
| FE-30 | `feature/FE-30-l2-quy-tac-0411` | Luồng 2 theo quy tắc chốt 4/11: (1) nhắc sale cả lead COLD chưa duyệt sau 3 ngày; (2) giờ hẹn đã qua mà lead vẫn `NEW` thì chuyển `LOST` với lý do mới `EXPIRED` ("quá hạn không xử lý") và báo quản lý; (3) khách có đồng ý nhận email, im lặng 3 ngày sau buổi xem: HOT thì nhắc sale gọi qua Telegram, WARM vào "Nuôi WARM" như cũ, COLD vào segment "Bản tin hằng tháng". Luồng 4 đếm số lead `EXPIRED`. Tự thêm `EXPIRED` vào `LOST_REASONS` ở backend và nhãn trên web, không chờ Hoàng | Hậu | Xong code ở `dev` (PR #47, 06/11). Luồng 2, 4 bản mới chỉ chạy trên server sau khi import ở `v0.3.1` |
| DC-03 | `docs/DC-03-tai-lieu-luong` | Tài liệu cả 12 luồng trong `docs/luong/` cùng một khung, có mục "Triển khai lên server": viết mới luồng 1, 1b, 3, 6, 6b, Error, Thông báo nhân viên (lấy bản cũ ở nhánh `docs/luong-hoang`), sửa luồng 2, 4, 5, 7, 8 cho khớp code FE-29. Cùng PR: `api-contract.md` chuyển sang có dấu và thêm endpoint mới (việc 8.1 của OpenSpec `close-booking-to-deposit-gaps`, gộp nhánh `docs/api-contract-hoang`); cập nhật `tong-quan-du-an.md` (mục 5–7, bảng luồng, danh sách kênh đang dùng). Hậu duyệt phần luồng 2, 4, 5, 7, 8 | Hoàng | Chưa làm (~14h) |
| FE-20 | `feature/FE-20-telegram-homnay` | Telegram cho sale: lệnh `/homnay` (kế hoạch 3.2). Lùi từ tuần 3 vì tuần 3 Hoàng làm release và tài liệu | Hoàng | Chưa làm |
| FE-23 | `feature/FE-23-l4-nguon-chien-dich` | Luồng 4 thêm số liệu theo nguồn khách và chiến dịch | Hậu | Đang làm |
| FE-24 | `feature/FE-24-bo-20-lead` | Bộ 20 lead có nhãn và cách chạy đo (kế hoạch 1.5) | Hoàng | Chưa làm |
| FE-25 | `feature/FE-25-langfuse-l1` | Langfuse cho luồng 1, đo trên bộ 20 lead (kế hoạch 3.5). Việc đầu tiên bị cắt nếu tuần 4 quá tải (mức "nên có") | Hoàng | Chưa làm |
| FE-32 | `feature/FE-32-l6-guardrails` | Luồng 6 đủ 12 bước theo bài Agentic AI: Guardrails chặn jailbreak, phân loại ý định (gặp nhân viên → báo sale, ngoài phạm vi → trả lời mẫu), tool Think cho Agent, bot không trả lời được thì báo sale, ghi log hội thoại (`POST /api/chat-logs`, bảng `chat_logs`, che email/SĐT). Đường chạy chính 14 bước, đã thử 5 nhánh trên n8n local 6/11 | Hoàng | Xong code, chưa PR, chưa lên server |
| CH-07 | `chore/CH-07-to-mau-node` | Tô màu nhóm node cho cả 12 workflow n8n bằng sticky note theo quy ước chung (mục 6 của `tong-quan-du-an.md`); sắp lại vị trí node luồng 1b, 2, 8 cho gọn. Không đổi logic, tham số hay cách nối node | Hoàng | Xong code, chưa PR |

Từ 4/11 Hoàng viết toàn bộ tài liệu (DC-03, DC-07, DC-09); Hậu duyệt phần nói về luồng của Hậu. Các mã DC-04, DC-08, DC-10, DC-11, DC-12 cấp ngày 4/11 đã gộp vào ba task trên, không dùng lại: DC-04 vào DC-03 và DC-09, DC-08 và DC-10 và DC-12 vào DC-03, DC-11 vào DC-07.

Giờ ước tính tuần 3–4: Hoàng khoảng 40h (release `v0.3.0` và `v0.3.1`, BF-06 (xong), FE-20, FE-24, FE-25, FE-26 (xong), DC-03, DC-07 (xong), DC-09 (xong)), Hậu khoảng 14h (BF-07, BF-08, FE-21, FE-22, FE-23, FE-30).

Phụ thuộc: việc của Hậu không chờ Hoàng (FE-30 tự thêm `EXPIRED` vào backend và web). Các bước `v0.3.1` ở mục 9 của `docs/trien-khai.md` (DC-09), Hậu kiểm tra lại trước khi chạy.

### Quy trình 1: Tiếp nhận và phân công sale (chốt 10/11)

Chi tiết từng task, task nào đóng lỗ hổng nào: mục 7 của [nghiep-vu/01-tiep-nhan-va-phan-cong.md](nghiep-vu/01-tiep-nhan-va-phan-cong.md). **FE-33 là PR nền: merge vào `dev` trước, các task còn lại tạo nhánh sau đó** (quy định 2 ở mục 6 của [quy-trinh-git.md](quy-trinh-git.md)).

| Mã | Nhánh | Việc | Ai | Trạng thái |
|---|---|---|---|---|
| FE-33 | `feature/FE-33-nen-tiep-nhan` | PR nền: cột và trạng thái mới của lead, nhân viên, loại sự kiện; API tạo lead chung có kiểm tra trùng số điện thoại; chia sale lần lượt; chuyển sale; ghi chú; hàm mới trong `web/src/lib/api.ts` | Hậu | Đã triển khai local, chưa PR/chưa lên server. API, SQL nâng cấp và giới hạn chuyển tiếp: [FE-33](fe-33-nen-tiep-nhan.md) |
| FE-34 | `feature/FE-34-buoi-xem-khung-gio` | Khách cũ đặt thêm lịch trên cùng lead (mỗi lúc một buổi xem mở), huỷ hoặc không đến không đóng lead; API khung giờ đã kín, giới hạn giờ hẹn; bộ chọn khung giờ trên web khách; hợp đồng lấy buổi đã đến gần nhất. Change OpenSpec `fe34-repeat-viewings-time-slots` | Hoàng | Xong code ở local, chưa PR. Còn chạy thử luồng 1, 6, 7 trên n8n thật |
| FE-35 | `feature/FE-35-l1-bao-sale-phu-trach` | Luồng 1 tách chấm điểm khỏi duyệt lịch, nút Duyệt tới giờ hẹn; luồng 1b; sub-workflow thông báo gửi sale phụ trách | Hoàng | Xong code ở local 11/11, chưa PR. Chưa chạy luồng 1 đủ đường với AI thật. Change OpenSpec `fe35-assignee-notifications-approval`; xem [FE-35](fe-35-thong-bao-phu-trach.md) |
| FE-36 | `feature/FE-36-l6-tao-lead` | Luồng 6: bot lưu liên hệ khi khách để lại số, báo sale phụ trách, gắn lịch sử chat vào lead; trang lead hiện lịch sử chat | Hoàng | Xong code ở local, chưa PR. Dựa trên FE-35. Change OpenSpec `fe36-bot-lead-capture`; xem [FE-36](fe-36-bot-ghi-nhan-khach.md). Còn chạy thử luồng 6 với Gemini và Telegram thật |
| FE-37 | `feature/FE-37-them-khach` | Web admin: form "Thêm khách" cho khách ngoài hệ thống (nguồn, tra trùng số khi gõ, người phụ trách, căn quan tâm). Chưa có "Đặt lịch xem luôn". Change OpenSpec `fe37-staff-add-customer` | Hoàng | Xong code ở local, chưa PR |
| FE-38 | `feature/FE-38-l2-han-phan-hoi` | Luồng 2 báo quản lý khi quá 2 giờ làm việc, bỏ mốc 3 ngày; luồng 4 và thống kê đếm theo khách, theo nguồn, theo sale | Hậu | Xong local, chưa PR/server. Có kiểm thử PostgreSQL và n8n với dịch vụ gửi giả lập. Xem [FE-38](fe-38-han-phan-hoi.md) |
| FE-39 | `feature/FE-39-admin-phu-trach` | Web admin: người phụ trách, chuyển sale, ghi chú, công tắc "Đang nhận khách" | Hậu | Chờ FE-33 |
| FE-40 | `feature/FE-40-l7-khong-email` | Luồng 7 đồng bộ lead không có email sang Mautic | Hậu | Xong code và kiểm thử local 10/11; chưa PR/chưa lên server. [FE-40](fe-40-l7-khong-email.md) |

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
- **Chưa chốt:** script theo dõi Mautic đang chạy cho mọi khách mà không hỏi đồng ý. Theo Nghị định 13/2023 nên có banner đồng ý theo dõi (khoảng 2 giờ); nếu không làm thì ghi vào mục "hạn chế đã biết" của báo cáo.

### Mốc phát hành

| Phiên bản | Gồm | Bước làm tay trên VPS | Ai |
|---|---|---|---|
| `v0.2.1` | HF-01 | Đã xong 04/11: CI deploy `b37eb1a`, web trả 200 | Hoàng |
| `v0.3.0` | Code của FE-18 (RAG), FE-19 (close-gaps), BF-06, CH-06, DC-09, FE-29 (follow-up backend) và các task xong trước đó. PR #43 merge 05/11, CI deploy `66c5fad`. FE-31 và FE-26 merge sau bản này nên chưa lên server. **Chưa import luồng 2, 7, 8**: luồng 7, 8 trên server giữ bản cũ, luồng 2 vẫn tắt | Mục 8 của `docs/trien-khai.md`. Kiểm tra trước (10.1, 10.2) đã làm 04/11. Ngày 05/11: bước 1–5 đạt (backend, RAG, import và bật luồng 1, 1b, 4, 6, 6b, chạy 6b, kiểm tra IP qua proxy). Ngày 06/11: bước 6 đạt (web, đặt lịch, duyệt, link quản lý lịch, Telegram RAG; BF-06 chưa có lead đặt cọc để thử trên server), tag `v0.3.0` đã có | Hoàng |
| `v0.3.1` | Phần n8n của FE-29 và FE-22, BF-08, FE-31, FE-26 (đã ở `dev`, không có bước tay). FE-30 nếu merge trước 8/11; nếu không, import luồng 2 bản hiện tại. **Hạn 8/11** | Trước khi merge release: đếm và sao lưu hàng đợi `messenger_messages` của Mautic (BF-08). Sau deploy chạy mục 9 của `docs/trien-khai.md` (Hậu kiểm tra trước): tạo token luồng 8 (`MAUTIC_WEBHOOK_SECRET`) và gắn vào webhook Mautic, tạo credential Mautic, import và publish luồng 2, 7, 8, restart n8n; bật luồng 2, kiểm tra lời nhắc điểm danh của lead #4 | Hoàng chạy, Hậu kiểm tra bước |
| `v0.4.0` (dự kiến) | FE-33, FE-34 và các task còn lại của quy trình 1 (FE-35 đến FE-39). **Chỉ phát hành khi xong FE-35 và FE-38**: từ FE-33, khách cũ đã có buổi xem không đặt thêm lịch được qua luồng cũ; từ FE-34 luồng 2 chưa nhắc lịch, điểm danh, hỏi cảm nhận cho buổi xem thứ hai trên cùng lead | Sao lưu DB, chạy `backend/sql/fe-33-intake.sql` **trước** khi backend mới khởi động (FE-33). Import lại luồng 1 (guard `viewingId`), luồng 6 (mô tả công cụ đặt lịch), luồng 7 (trạng thái `CONSULTING`) (FE-34) | Hoàng |
| `v1.0.0` | Web hoàn thành | | Hoàng |
| `v1.1.0` | Bản nộp | | Hoàng |

Tag đã có: `v0.1.0` (demo 24/10, `55d99d9`), `v0.2.0` (bản chạy trên VPS 2/11, `603ecd5`), `v0.2.1` (hotfix HF-01, 4/11, `b37eb1a`).

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
| FE-19 | `feature/FE-19-close-booking-gaps` | Vá 12 lỗ hổng từ đặt lịch đến đặt cọc (OpenSpec `close-booking-to-deposit-gaps`). Còn 8.1 (chuyển sang DC-03) và 10.1–10.6 (làm khi release `v0.3.0`) | Hoàng | #35 | 03/11 |
| FE-29 | `feature/luong-2-va-mautic-web` (lần 2) | Backend follow-up (module `followups`, bảng `followup_tasks`, test), làm lại luồng 2, 7, 8, kịch bản demo phần Hậu | Hậu | (merge trực tiếp, `202d8b3`) | 03/11 |
| FE-31 | `feature/FE-31-chi-tiet-nha` | Trang chi tiết nhà đầy đủ: nhiều ảnh xem toàn màn hình, xem 360° từng phòng, khối "Thông tin cơ bản", tiện ích, nội thất, bản đồ và dịch vụ xung quanh; form nhập ở Quản lý nhà; danh sách nhà công khai trả bản gọn cho tool "Tìm nhà" của luồng 6. Cách nhập: mục 4.3 của `docs/nghiep-vu/vai-tro-va-trang-thai.md` | Hoàng | #44 | 05/11 |
| FE-26 | `feature/FE-26-web-dien-thoai` | Web khách và admin trên điện thoại theo checklist skill ui-ux-pro-max: hết tràn ngang ở 375px, vùng bấm 44px, ô nhập 16px, icon SVG, font Be Vietnam Pro tự lưu, Quản lý nhà và Phân quyền dạng thẻ. Quy ước: `docs/giao-dien-web.md` | Hoàng | #45 | 05/11 |

### Sửa lỗi (BF)

| Mã | Nhánh | Việc | Ai | PR | Merge |
|---|---|---|---|---|---|
| BF-01 | `fix/n8n-failed-callback` | Nhánh lỗi báo FAILED, URL gọi ngược sang `backend:8081` | Hoàng | #5 | 09/10 |
| BF-02 | `fix/n8n-luong-2-switch-fallback` | Luồng 2: Switch dùng fallback `extra` | Hậu | (merge trực tiếp, `7b21c70`) | 15/10 |
| BF-03 | `fix/compose-env-auth` | Truyền `JWT_SECRET`, `SEED_USER_PASSWORD` vào backend | Hoàng | #15 | 19/10 |
| BF-04 | `fix/mautic-url-env` | Luồng 7 đọc URL Mautic từ `MAUTIC_URL` | Hoàng | #26 | 29/10 |
| BF-06 | `bugfix/BF-06-chan-khong-mua-khi-dang-coc` | Chặn "Không mua" khi lead đang `DEPOSIT`: backend trả 400 ở cả `admin-status` và `PUT status` của n8n, web ẩn nút "Không mua" và hướng dẫn từ chối hợp đồng trước. Có test `leads.service.spec.ts`. Cùng PR: web admin và email báo cáo luồng 4 đổi chữ "Mất khách" thành "Không mua" cho khớp tên trạng thái | Hoàng | #40 | 04/11 |

BF-05 đã cấp cho việc nâng Next.js rồi bỏ (chuyển thành HF-01), không dùng lại. Mã BF tiếp theo là BF-09 (BF-06, BF-07, BF-08 đã cấp ở tuần 3). BF-08 cấp sau khi nhánh đã tạo nên tên nhánh không có mã.

### Sửa gấp production (HF)

| Mã | Nhánh | Việc | Ai | PR | Merge |
|---|---|---|---|---|---|
| HF-01 | `hotfix/HF-01-nang-cap-nextjs` | Nâng Next.js 16.4.0 → 16.4.4: vá lỗi RCE mức critical (Image Optimization với SVG, `use cache`) và DoS Server Actions. Tag `v0.2.1`, đồng bộ về `dev` ở PR #38 | Hoàng | #37 | 04/11 |

### Tài liệu (DC)

| Mã | Nhánh | Việc | Ai | PR | Merge |
|---|---|---|---|---|---|
| DC-01 | `docs/dong-bo-hop-dong` | Đồng bộ hợp đồng API, thêm quy tắc phối hợp | Hoàng | #2 | 09/10 |
| DC-02 | `docs/ke-hoach-tuan-2` | Kế hoạch tuần 2, tổng quan dự án | Hoàng | #6 | 12/10 |
| DC-07 | `docs/DC-07-nghiep-vu-dat-lich-den-dat-coc` | Thư mục `docs/nghiep-vu/`: `vai-tro-va-trang-thai.md`, `02-dat-lich-den-dat-coc.md`, `03-cham-soc-va-marketing.md` (quy tắc nghiệp vụ: khi nào áp dụng, hệ thống làm gì, người dùng thấy gì, ai xử lý ở đâu) | Hoàng | #39 | 04/11 |
| DC-09 | `docs/DC-09-trien-khai` | `docs/trien-khai.md`: server, CI deploy, biến `.env`, credential và id workflow n8n, cách import, kiểm tra sau deploy, bước tay của `v0.3.0` và `v0.3.1`, sự cố thường gặp. Bản đồ tài liệu trong `README.md`. Thêm biến `MAUTIC_WEBHOOK_SECRET` vào compose và `.env.example` (luồng 8 bản mới bắt buộc token). Hậu kiểm tra mục 9 trước khi chạy `v0.3.1` | Hoàng | #42 | 04/11 |

### Cấu hình, quy trình (CH)

| Mã | Nhánh | Việc | Ai | PR | Merge |
|---|---|---|---|---|---|
| CH-01 | `claude/magical-albattani-4a06ae` | Dọn tài liệu tuần cũ, sửa nhỏ `viewings.service` | Hoàng | #14 | 19/10 |
| CH-02 | `claude/source-analysis-integration-proposal-831874` | Kế hoạch tích hợp Mautic, Agentic AI và app (`ke-hoach-tich-hop.md`) | Hoàng | #16 | 20/10 |
| CH-03 | `chore/quy-trinh-git` | Chuyển sang git-flow (`dev` → `main`), CI kiểm tra PR, PR template, tài liệu quy trình | Hoàng | #31 | 03/11 |
| CH-04 | `chore/sua-quy-trinh-merge` | Mọi PR dùng "Create a merge commit" | Hoàng | #33 | 03/11 |
| CH-05 | `chore/CH-05-danh-sach-task` | File danh sách task và mã nhánh | Hoàng | #34 | 03/11 |
| CH-06 | `chore/CH-06-sua-npm-test` | Sửa `npm test` của backend (chạy Jest chế độ ESM), xoá 6 file test khung mẫu không chạy được, CI kiểm tra PR có thêm job "Backend test" chạy Node 24 (test cần Node 24.9 trở lên) | Hoàng | #41 | 04/11 |

### Nhánh cũ không có PR riêng

Đã vào `main` trước khi dùng PR cho mọi thay đổi hoặc gộp qua PR của nhánh khác, nên không cấp mã: `feature/n8n-luong-1`, `feature/n8n-luong-1-push`, `feature/n8n-luong-1b`, `feature/n8n-error-workflow`, `feature/web-khu-khach`, `feature/web-lead-detail`, `feature/contracts-luong-3`, `fix/validate-dat-lich`, `fix/viewing-lost-update`, `docs/don-tuan-1-2`, `docs/ke-hoach-tich-hop`.

### Nhánh cũ chưa merge

| Nhánh | Xử lý |
|---|---|
| `docs/luong-hoang` | Lấy nội dung ở DC-03, sau đó xoá nhánh |
| `docs/api-contract-hoang` | Xung đột `api-contract.md`; gộp vào DC-03, sau đó xoá nhánh |

Lệnh xoá nhánh cũ xem mục 8 của `quy-trinh-git.md`.
