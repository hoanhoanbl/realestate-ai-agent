# Spec Delta

## Purpose

Đảm bảo các luồng chạy nền không bỏ dở vì lỗi tạm thời và quản lý biết ngay khi một luồng hỏng, bằng cả email và Telegram.

## ADDED Requirements

### Requirement: Luồng nạp tri thức tự thử lại
Luồng nạp tri thức SHALL thử lại tối đa 3 lần, cách nhau 5 giây, ở các bước gọi cơ sở dữ liệu và bước nhúng văn bản, trước khi coi là lỗi.

#### Scenario: Lỗi tạm thời được thử lại
- **WHEN** một lần gọi Gemini nhúng văn bản thất bại do lỗi mạng tạm thời rồi thành công ở lần thử thứ hai
- **THEN** luồng tiếp tục chạy và hoàn tất, không báo lỗi

#### Scenario: Lỗi kéo dài
- **WHEN** bước nhúng văn bản thất bại cả 3 lần
- **THEN** lần chạy kết thúc ở trạng thái lỗi và Error workflow báo quản lý

### Requirement: Báo lỗi luồng qua email và Telegram
Khi một luồng kết thúc ở trạng thái lỗi, Error workflow SHALL gửi email cho quản lý và, khi đã cấu hình Telegram, SHALL gửi thêm tin Telegram cho nhóm quản lý với tên luồng, node lỗi cuối, thông báo lỗi và link lần chạy. Telegram chưa cấu hình hoặc gửi lỗi SHALL NOT ngăn email được gửi.

#### Scenario: Luồng lỗi, Telegram đã cấu hình
- **GIVEN** `TELEGRAM_BOT_TOKEN` và `TELEGRAM_SALE_CHAT_ID` đã có
- **WHEN** luồng "Luồng 3 hợp đồng" lỗi ở node "Email khách ký"
- **THEN** quản lý nhận email `[LỖI] ...` và nhóm Telegram nhận tin cùng nội dung tóm tắt có link lần chạy

#### Scenario: Telegram chưa cấu hình
- **GIVEN** `TELEGRAM_SALE_CHAT_ID` để trống
- **WHEN** một luồng lỗi
- **THEN** chỉ email được gửi và Error workflow không báo lỗi riêng

#### Scenario: Telegram gửi lỗi
- **GIVEN** Telegram đã cấu hình nhưng API Telegram từ chối
- **WHEN** một luồng lỗi
- **THEN** email vẫn được gửi
