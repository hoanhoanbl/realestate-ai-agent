# FE-39 — Người phụ trách, ghi chú và nhận khách

Triển khai local trên nền FE-33/FE-34, chưa phát hành server. Không có thay đổi schema hoặc workflow n8n.

## Giao diện

- Danh sách khách có cột người phụ trách trên bảng và nhãn trên thẻ điện thoại. Khách cũ chưa gán hiển thị “Chưa phân công”; nếu danh sách nhân viên chưa tải được vẫn hiển thị mã người phụ trách, không chặn xem khách.
- Trang chi tiết có component riêng `LeadAssignmentPanel`: tên người phụ trách, lúc nhận khách, phản hồi đầu tiên hoặc hạn phản hồi. Bản ghi cũ thiếu mốc hiển thị rõ là chưa có phiên/hạn.
- Quản lý chọn người mới, nhập lý do tùy chọn và chuyển. Sale ngừng nhận khách bị vô hiệu trong bộ chọn; chọn lại người cũ không gửi yêu cầu. Sau lưu tải lại lead và timeline.
- Người phụ trách hoặc quản lý ghi chú kết quả liên hệ, tối đa 5000 ký tự. Không cho ghi chú trắng; giữ nội dung khi lưu lỗi. Sale khác chỉ đọc thẻ, không có form chuyển sale hoặc ghi chú. Backend vẫn kiểm quyền cho mọi yêu cầu.
- Trang Tài khoản mở cho cả hai vai trò: sale chỉ thấy cấu hình cá nhân; quản lý thấy tài khoản, bảng quyền và cấu hình từng người. Sale không gọi API danh sách nhân sự của quản lý.
- Công tắc “Đang nhận khách” chỉ thay lượt chia mới, không đổi người phụ trách của các khách cũ. Telegram cá nhân là chuỗi ID số dương; để trống để xoá. Form có trạng thái đang lưu, lỗi và thông báo thành công.
- Thẻ chi tiết tự tải lại mỗi 5 giây nhưng không xoá bản nháp chuyển sale/ghi chú đang nhập.

## API

FE-33 cung cấp sẵn lookup, chuyển sale, ghi chú, bộ chọn và cập nhật routing. FE-39 chỉ thêm `GET /api/users/me/routing` có JWT, lấy id từ phiên đăng nhập và trả `{id,name,email,role,telegramChatId,acceptingLeads}`. Không trả password hash hay push token.

Hàm web mới: `getMyRouting()` và kiểu `UserRoutingInfo`. Sale sửa cấu hình người khác vẫn 403; danh sách `/users` vẫn chỉ dành quản lý. Component dùng API hiện có, không suy quyền từ việc nút có hiện hay không.

## Kiểm thử và triển khai

- Backend lint/build, kiểm thử HTTP/JWT/PostgreSQL của FE-33 được mở rộng cho GET cá nhân, không lộ hash/push token, sale không xem danh sách quản lý và không sửa routing người khác, tự tắt nhận khách/đổi Telegram được.
- Đã kiểm thử trình duyệt với API Nest thật, PostgreSQL tạm và tài khoản giả: quản lý chuyển Sale Minh → Sale An, ghi chú xuất hiện trong timeline và mốc phản hồi; sale không phụ trách không có biểu mẫu sửa; quản lý tắt nhận khách của sale; sale tự bật lại và xoá Telegram.
- Màn hình 375px: scrollWidth=clientWidth=375, không tràn ngang. Dùng Turbopack của dự án để kiểm tra CSS (Tailwind được cấu hình qua loader Turbopack). Ảnh kiểm thử local nằm trong output, không commit dữ liệu giả hoặc ảnh vào nhánh.
- Build/deploy backend và web cùng bản sau khi được duyệt. Không cần biến môi trường, SQL hoặc thao tác Mautic. FE-38 xử lý cảnh báo quá hạn; FE-39 chỉ hiển thị và chỉnh thông tin được cấp quyền.
