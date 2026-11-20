# FE-45 — Chăm khách theo bậc (local)

Nhánh làm việc: `codex/fe45-followup-ladder`, kế thừa FE-44 / PR #96. Chưa commit/push, chưa merge, chưa nghiệm thu server. Không thêm cột/bảng hoặc credential ID mới. Cần nền FE-43 và bảng `feedback_work` của luồng 5b.

## Backend

- REACH ngày 1/3/7 cho CONSULTING/NEW chưa liên hệ được; chỉ bậc cao nhất còn hợp lệ. Mốc giao lại/mở lại bắt đầu phiên mới. Hủy lịch rồi về CONSULTING chỉ cho các bậc chưa rơi vào thời gian CONFIRMED.
- QUIET sau 7 ngày, STALE sau 14 ngày hoạt động cuối. Chỉ các sự kiện trong allow-list FE-43 đặt lại đồng hồ. Note, lần gọi và cập nhật việc chăm phản hồi tính là hoạt động; AI/log tự động không tính.
- Không nhắc QUIET/đóng STALE khi có lịch mở, hợp đồng còn hiệu lực hoặc feedback_work chưa COMPLETED. Lead chưa liên hệ được chỉ vào QUIET nếu đã lỡ hẳn bậc 7; không nhận cả REACH và QUIET cùng lúc.
- Claim khóa lead rồi task; đóng STALE và ghi sự kiện trong cùng transaction. Selector khôi phục việc đã đóng nhưng chưa báo; ACTION_DONE chỉ hoàn tất DB. ACTION_STARTED hết lease vào REVIEW vì chưa biết dịch vụ ngoài đã nhận hay chưa, không tự gửi lại.
- Link HMAC theo API chốt với FE-56. Preview không đổi dữ liệu, không trả email/điện thoại/token worker, không cache. Link cũ hết hiệu lực khi có bậc mới, lead đóng/cọc/ký hoặc đổi người/phiên nhận khách.
- SEND lưu nội dung đã trim và một sự kiện LADDER_APPROVED, tạo riêng LADDER_EMAIL theo task cha. Hai confirm đồng thời không tạo hai thư. SKIP không tạo thư. WAIT, thiếu email hoặc consent đều chặn SEND ở backend; start kiểm lại trước gửi.
- Webhook lỗi trả 502. Lần thử lại dùng đúng nội dung đã duyệt lần đầu, không âm thầm thay nội dung. Preview còn OPEN khi chờ retry dispatch; worker định kỳ còn khôi phục các thư đã được nhận nhưng chưa bắt đầu. Khi giao nhận không rõ thì REVIEW, cần đối chiếu nhà cung cấp rồi resolve.
- action-done giữ result.suggestion. L2 selector nguồn không còn chọn HOT_NUDGE/WARM_NUDGE/COLD_NURTURE và không nhận checkpoint L9; enum cũ vẫn giữ cho lịch sử. JSON L2 đã đồng bộ câu SQL chọn việc, giữ nguyên mọi node và connection khác; FE-46 tiếp tục gỡ các node Mautic không còn dùng.

## Luồng 9

`n8n-workflows/luong-9-follow-up-bac.json` gồm 57 node (51 node xử lý/trigger/sub-node và 6 sticky note), import ở trạng thái tắt. Một workflow có hai lối vào:

1. Chạy tay hoặc lịch `0 8-20 * * *`, timezone Asia/Ho_Chi_Minh: lấy việc, claim, context, AI + guardrail, lưu gợi ý, tạo link, start, báo sale/quản lý qua sub-workflow, action-done, complete. Đồng thời lấy các thư đã duyệt cần khôi phục.
2. Webhook secret `ladder-email-approved`: claim LADDER_EMAIL, context nội dung đã duyệt, start kiểm lại consent/trạng thái, escape HTML, SMTP, action-done, complete.

Guardrail cố ý thận trọng: nháp tự động chỉ giữ các câu chào/hỏi nhu cầu/hướng dẫn phản hồi theo mẫu an toàn; chặn số, URL, HTML, hứa giá/giảm giá và phát biểu thông tin chưa xác minh. Nháp bị bỏ vẫn có lời nhắc và sale có thể tự soạn trên FE-56. AI lỗi ghi FOLLOWUP_FAILED rồi dùng mẫu CALL không có nháp. Thư do sale duyệt là văn bản thuần, được escape khi render HTML.

HTTP, AI, email và báo nhân viên retry tối đa 3 lần. Khi bước gửi không rõ thành công, backend giữ REVIEW thay vì tự gửi lại. Nhánh lỗi ghi fail nếu đã có checkpoint rồi Stop and Error để Error workflow nhận lỗi; không kết thúc success im lặng.

## Kiểm thử

- `cd backend; npm test` với `FE33_TEST_DATABASE_URL` trỏ đúng DB disposable localhost:55433/fe33_test. Suite FE-45 có HTTP thật, SQL/policy đối chiếu, concurrency, rollback, token giả, hết consent, đổi sale, WAIT, giới hạn text, retry 502 và stale recovery.
- `node scripts/check-ladder-guardrail.cjs`: chạy trực tiếp Code node trong JSON với nháp hợp lệ, nháp hứa giá, thông tin bịa, rỗng/dài, WAIT và AI lỗi; kiểm graph, lịch, credential IDs và escape.
- Nghiệm thu local n8n 2.42.4 + backend thật + PostgreSQL tạm + SMTP giả; Gemini và sub-workflow báo nhân viên dùng fixture (sub-workflow fixture vẫn gửi SMTP thật tới hộp thư giả). Kết quả tại `output/fe45/runtime-result.json`. Không coi đây là nghiệm thu Gemini/Telegram thật, hay bản tích hợp với trang FE-56.

## Deploy và phối hợp

1. Hoàng review nhánh sau khi FE-44 merge hoặc review trên base FE-44 rõ ràng. Giữ các thay đổi FE-44 khi tích hợp dev mới; chạy lại test tổng hợp.
2. Deploy backend có FE-43/44/45. FE-56 gọi API này được; chưa nghiệm thu end-to-end trang FE-56 thật trong PR này.
3. Hoàng xác nhận credential/sub-workflow đã có: Header Auth `iYLrhsH8b8dDkZ0n`, Gemini `wU5LeG7gXaoUdMXQ`, SMTP `hfJ9bBGUGsjH8qDP`, sub-workflow `thongBaoNhanVien`, Error workflow `errorWfRealestat`.
4. Import L9 tắt, thử lead demo với email nhóm test. Import L2 dùng selector FE-45 trước khi bật lịch L9; tránh L2 cũ và L9 cùng chăm lead im lặng. FE-46 tiếp tục phần mời hẹn lại và gỡ node Mautic.
5. Kiểm thử dịch vụ thật, lỗi SMTP, REVIEW/resolve, FE-56 đồng thời hai tab. Hoàng thực hiện bước VPS/CH-12 sau review; Codex không chạy deploy hoặc Git.

Không đưa output/, tmp/, DB SQLite, fixture credential, inbox hoặc dữ liệu test vào PR.

## Rà soát và sửa lỗi sau nghiệm thu lần đầu

Đã bổ sung 10 ca regression trên PostgreSQL thật, tái hiện lỗi trước khi sửa:

1. SEND gặp lỗi dispatch rồi sale chọn SKIP: trước đây có thể gửi lại nội dung đã duyệt. Nay SKIP huỷ thư chưa bắt đầu trong cùng khóa lead; webhook muộn không gửi được. Nếu worker đã nhận việc thì trả quyết định SEND đã xử lý, không báo huỷ giả. Task huỷ được đóng với `result.cancelled=true`, không ghi sự kiện gửi thư.
2. Worker đã gửi nhưng mất phản hồi webhook: preview trước đây còn OPEN. Nay kiểm cả checkpoint thư, hiện HANDLED khi worker đã nhận/gửi hoặc đang REVIEW; không dispatch lại. Phản hồi lỗi muộn không xoá dấu xác nhận thành công của yêu cầu khác.
3. REACH/QUIET đang gửi hết lease rồi lead có note/contact mới: selector trước đây bỏ sót checkpoint cũ. Nay vẫn lấy việc hết lease để chuyển REVIEW; hai node kiểm tra checkpoint trong L9 đưa REVIEW sang Error workflow, không tự gửi lại.
4. Dữ liệu cũ có contacted_at mới nhưng thiếu sự kiện CONTACTED: trước đây có thể đóng STALE sớm. Mốc im lặng nay tính cả contacted_at, bảo vệ dữ liệu backfill FE-43.
5. AI chép email/điện thoại vào reason/emailDraft: preview trước đây vẫn lộ qua text lồng nhau. Nay ẩn địa chỉ email và số điện thoại trong gợi ý public, kể cả email/điện thoại cũ đã đổi trên lead; không sửa suggestion gốc hoặc recipient của worker secret.
6. Đổi email sau context, trước start: workflow trước đây dùng recipient cũ. Nay start trả delivery gồm email/text đọc và kiểm dưới cùng khóa lead; Code node dựng thư dùng chính payload này. Có test DB đổi recipient giữa hai bước và script chạy Code node với context cũ/delivery mới.
7. Suggestion dạng array được ValidateNested chấp nhận, có thể lưu sai shape và làm preview lỗi. DTO nay có IsObject; array rỗng và array chứa object hợp lệ đều trả 400, không sửa result của task.

Toàn bộ backend đã PASS 344 test; suite FE-45 gồm 44 ca HTTP/PostgreSQL. Runtime n8n/SMTP giả đã kiểm thêm SKIP sau dispatch lỗi, webhook muộn và khôi phục ACTION_STARTED sau note/contact -> REVIEW + Error workflow. Build/lint và các script L9/L2/L4 đạt. Chưa nghiệm thu Gemini/Telegram thật hoặc UI FE-56 tích hợp; các giới hạn ở trên vẫn áp dụng.
