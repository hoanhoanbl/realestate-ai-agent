# Luồng 5: Khách gửi cảm nhận, AI phân tích và theo dõi xử lý

File: `n8n-workflows/luong-5-cam-nhan.json` (18 node không tính ghi chú; id repo `luong5Realestat0`). Kích hoạt webhook `POST /webhook/feedback-submitted`, Header Auth `X-Webhook-Secret`. Có thêm workflow phụ trợ [theo dõi sau phản hồi](luong-5-theo-doi-sau-phan-hoi.md).

## 1. Làm gì trong thực tế

Khách gửi đánh giá buổi xem. Backend lưu phản hồi và tạo việc chăm sóc ngay. L5 tóm tắt bằng AI, lưu gợi ý để sale đọc trong hồ sơ, gọi workflow giao thông báo việc và gửi thư cảm ơn khi khách có email. Sale ghi kết quả gọi lại trên web, không để phản hồi chỉ dừng ở một email.

Quy tắc nghiệp vụ, trạng thái và các hạn: [chăm sóc sau buổi xem, mục 1 và 1.1](../nghiep-vu/03-cham-soc-va-marketing.md). Phần gợi ý căn thay thế chưa được chốt/triển khai trong đợt này.

## 2. Ai tham gia

Khách, web `/cam-nhan/[token]`, backend, PostgreSQL, n8n L5, Gemini, sale đang phụ trách, quản lý và SMTP. Việc chăm sóc không phụ thuộc Gemini/n8n có chạy thành công hay không.

## 3. Từng bước

1. Khách nộp form. Backend khóa lead và phản hồi; lưu phản hồi, FEEDBACK_RECEIVED và công việc trong cùng transaction. Gửi trùng cùng link trả 409.
2. Backend gọi webhook `feedback-submitted` bất đồng bộ sau commit.
3. `Cấu hình` -> `Chuẩn hoá` -> `Lấy cảm nhận`: HTTP gọi context backend thay SQL nối buổi xem mới nhất. `Có cảm nhận?` kiểm tra dữ liệu.
4. `Chuẩn bị` escape HTML -> `Basic LLM Chain`/Gemini và parser -> `Kiểm tra AI`. Prompt coi góp ý khách là dữ liệu, không làm theo chỉ dẫn trong góp ý. AI lỗi/thiếu dùng mẫu dự phòng; guard không cho 4–5 sao mang cảm xúc NEGATIVE hoặc 1–2 sao mang POSITIVE.
5. `Lưu kết quả AI` -> `Ghi log FEEDBACK_ANALYZED`.
6. `Nhắc việc sau phản hồi` gọi workflow phụ trợ; worker tự lấy việc hợp lệ và kiểm tra checkpoint, dùng workflow Thông báo nhân viên để giao đúng sale. Lỗi worker không chặn nhánh cảm ơn; L2 quét lại theo giờ.
7. `Có email khách?`: email hợp lệ -> `Email cảm ơn khách`, thiếu/sai email -> đi thẳng `Cần báo quản lý?`.
8. `Cần báo quản lý?` giữ cảnh báo phản hồi tiêu cực qua `Email cảnh báo quản lý`.

Node `Email nhân viên` gửi hộp thư chung trước đây được thay bằng `Nhắc việc sau phản hồi`. Thông báo việc chứa link hồ sơ; AI tóm tắt nằm trong hồ sơ. Không tự đổi lead theo kết quả AI và không tự soạn hợp đồng.

## 4. Nối với hệ thống

- Web khách -> backend: GET/POST `/api/feedback/{token}`. Token mới gồm ID buổi xem và 128 bit ngẫu nhiên; token cũ vẫn gắn buổi đầu. Trang công khai chỉ trả tên khách/căn/giờ xem/trạng thái đã gửi, không trả email hoặc số điện thoại.
- L5 -> backend: GET `/api/feedback-work/context/{feedbackId}`, PUT `/api/feedback/{id}/ai-result`, POST `/api/leads/{leadId}/events`.
- L5 -> `feedbackWorkNotifications`: giao thông báo việc mới/đến hạn; worker cũng được L2 gọi.
- Web admin -> `/api/feedback-work/*`: ghi kết quả, lịch sử, danh sách việc.
- NEXT_VIEWING tạo lịch thật rồi gọi L1 `viewing-requested`; quy trình duyệt lịch giữ nguyên.

Hợp đồng JSON và phân quyền: [API mục 8](../api-contract.md#8-l5-theo-dõi-sau-phản-hồi).

## 5. Khi lỗi thì sao

Lỗi làm workflow thất bại có thể báo qua Error workflow nếu đã cấu hình `errorWfRealestat` trong Settings. Khách đã nộp thành công vẫn có việc khi AI/n8n lỗi. Worker checkpoint tránh tự giao lại lần gửi chưa rõ kết quả; quản lý xử lý tại trang theo dõi. Nếu cần chạy lại AI, lưu ý nhánh email cảm ơn/cảnh báo cũ không có checkpoint giao thư; chạy lại toàn L5 có thể gửi lại hai thư này. Để test không phát thư thật, disable hoặc thay hai SMTP node bằng mock. Không tự retry SMTP khi chưa rõ nhà cung cấp đã nhận thư.

## 6. Triển khai lên server

Chưa kiểm trên server. Thực hiện backend + schema trước, import workflow phụ trợ rồi ánh xạ ID trong cả L2/L5; xem [bàn giao chi tiết](luong-5-theo-doi-sau-phan-hoi.md#6-triển-khai-lên-server). `Lấy cảm nhận` mới dùng cùng Header Auth với `Lưu kết quả AI`, không còn cần Postgres credential ở node đó. Cấu hình backendUrl, webUrl, managerEmail, Gemini và SMTP theo môi trường. Không dùng email demo trên server.

## 7. Cách chạy thử

Xem [hướng dẫn test local](luong-5-theo-doi-sau-phan-hoi.md#7-cách-chạy-thử). Kiểm tra khách không có email vẫn tạo việc, AI thất bại không làm mất việc và phản hồi buổi xem cũ không bị ghép sang căn mới. Trong editor, webhook chờ sự kiện là bình thường; chạy worker bằng node `Chạy tay` để thử nhắc việc.
