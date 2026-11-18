# Proposal

## Why

Hệ thống chỉ chống trùng lịch xem **theo căn** (`BOOKING_GAP_MINUTES`, 60 phút). Một sale có thể bị chia hai buổi xem cùng giờ ở hai căn khác nhau và chỉ biết khi đã tới ngày xem (LH-24). Quy tắc nghiệp vụ đã được viết và Hậu đã review ở `docs/nghiep-vu/01-visits.md` mục 1.6 (DC-15, DC-16); change này đưa nó vào code.

## What Changes

- Thêm hằng `SALE_GAP_MINUTES = 90` và khái niệm "sale bận lúc T": sale đang phụ trách lead có buổi xem ở **căn khác** cách T dưới 90 phút, trừ buổi `CANCELLED` và `NO_SHOW`. Buổi `ATTENDED` vẫn tính bận (bận theo giờ hẹn, không theo trạng thái).
- Chia sale lần lượt (khách mới, lead mở lại, lead cũ chưa có người phụ trách) bỏ qua sale đang bận lúc giờ khách chọn; sale bị bỏ qua giữ nguyên lượt. Mọi sale đều bận thì chia như cũ. Khách không bao giờ bị từ chối vì lịch của sale.
- Chặn (409, có tên sale, căn, giờ) khi: duyệt lịch, đổi giờ, hẹn lại sau khi khách vắng, hẹn xem tiếp trong theo dõi phản hồi mà sale phụ trách bận.
- Chặn chuyển sale khi sale mới bận với bất kỳ buổi xem đang mở nào của lead. Lead không có buổi xem mở thì chuyển như cũ.
- Khoá giao dịch theo sale (`pg_advisory_xact_lock`) ở các thao tác làm đổi tập buổi xem của một sale: tạo buổi xem, đổi giờ, hẹn xem tiếp, chuyển sale.
- Cập nhật `docs/nghiep-vu/01-visits.md` (bỏ nhãn "Sắp làm FE-53") và `docs/danh-sach-lo-hong.md` (đóng LH-24).
- Không thêm cột, trạng thái hay loại sự kiện: không cần SQL, không phụ thuộc FE-43.

## Capabilities

### New Capabilities
- `sale-schedule-conflict`: một sale không bị xếp hai buổi xem ở hai căn cách nhau dưới 90 phút; áp dụng khi chia sale, duyệt, đổi giờ, hẹn lại, hẹn xem tiếp và chuyển sale.

### Modified Capabilities
<!-- Không đổi requirement của spec hiện có: bot-lead-capture, lead-chat-history, staff-customer-entry không nói về lịch của sale. -->

## Impact

- Backend: `viewings/booking-rules.ts` (hằng, hàm kiểm tra, khoá), `viewings/viewings.service.ts` (Hoàng), `leads/lead-intake.service.ts`, `leads/leads.service.ts`, `feedback/feedback-work.service.ts` (Hậu giữ nên Hậu duyệt). Thêm test đơn vị và test tích hợp PostgreSQL.
- Web: thông báo lỗi 409 hiện sẵn theo cơ chế hiện có; kiểm tra các trang duyệt, đổi giờ, chuyển sale hiển thị đúng thông báo, không thêm màn hình.
- n8n: không đổi. Luồng 1b gọi lại backend khi sale đã duyệt nên việc chặn nằm ở backend, trước khi gọi n8n.
- Dữ liệu và triển khai: không có SQL. Quy tắc áp dụng ngay khi backend mới chạy.
- Thứ tự merge: nên merge trước FE-44 của Hậu vì cùng sửa `leads.service.ts`.
