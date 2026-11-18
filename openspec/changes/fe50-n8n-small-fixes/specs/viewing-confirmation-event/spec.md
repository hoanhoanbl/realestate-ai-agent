# Spec Delta

## Purpose

Ghi lại trong lịch sử khách thời điểm hệ thống đã gửi thành công thư xác nhận lịch xem (thư chốt lịch, thư báo giờ mới), gắn với đúng buổi xem và giờ hẹn, để các quy tắc nhắc lịch không gửi trùng thư cho khách.

## ADDED Requirements

### Requirement: Ghi sự kiện sau khi gửi thư chốt lịch thành công
Sau khi luồng chốt lịch thủ công gửi thành công thư chốt lịch hoặc thư báo giờ mới cho khách, hệ thống SHALL ghi vào lịch sử khách một sự kiện `VIEWING_CONFIRMATION_SENT` với ghi chú đúng dạng `viewing=<mã buổi xem>;time=<giờ hẹn ISO 8601 UTC, có mili giây và hậu tố Z>`. Sự kiện SHALL chỉ được ghi sau khi thư gửi thành công và SHALL NOT được ghi khi gửi thư lỗi.

#### Scenario: Thư chốt lịch gửi thành công
- **WHEN** sale duyệt buổi xem số 42 hẹn 10:00 ngày 20/11/2026 giờ Việt Nam và thư chốt lịch gửi thành công
- **THEN** lịch sử của khách có sự kiện `VIEWING_CONFIRMATION_SENT` với ghi chú `viewing=42;time=2026-11-20T03:00:00.000Z`

#### Scenario: Thư báo giờ mới gửi thành công
- **WHEN** sale đổi giờ buổi xem số 42 sang 14:00 cùng ngày và thư báo giờ mới gửi thành công
- **THEN** có một sự kiện `VIEWING_CONFIRMATION_SENT` mới với ghi chú `viewing=42;time=2026-11-20T07:00:00.000Z` và sự kiện cũ của giờ trước giữ nguyên

#### Scenario: Gửi thư lỗi
- **WHEN** gửi thư chốt lịch thất bại sau các lần thử lại
- **THEN** không có sự kiện `VIEWING_CONFIRMATION_SENT` nào được ghi cho lần gửi đó

#### Scenario: Thư không khẳng định lịch không tạo sự kiện
- **WHEN** luồng đặt lịch gửi thư "đã nhận yêu cầu" cho khách
- **THEN** không có sự kiện `VIEWING_CONFIRMATION_SENT` nào được ghi

### Requirement: Lỗi ghi sự kiện không chặn chốt lịch
Khi thư đã gửi nhưng việc ghi sự kiện `VIEWING_CONFIRMATION_SENT` thất bại sau các lần thử lại, hệ thống SHALL vẫn tiếp tục cập nhật lead sang "Đã chốt lịch" và ghi sự kiện duyệt như bình thường.

#### Scenario: Ghi sự kiện lỗi
- **GIVEN** thư chốt lịch đã gửi
- **WHEN** backend từ chối ghi sự kiện sau 3 lần thử
- **THEN** lead vẫn chuyển sang "Đã chốt lịch" và sự kiện duyệt vẫn được ghi; khách có thể nhận thêm một thư nhắc lịch, là hướng lỗi an toàn
