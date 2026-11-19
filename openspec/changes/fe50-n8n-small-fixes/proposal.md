# Proposal

## Why

Ba việc nhỏ ở luồng n8n của Hoàng đều chặn hoặc làm yếu việc khác:

- FE-54 (luồng 2 bỏ nhắc lịch thừa) chỉ chạy đúng trên server khi luồng 1b ghi được sự kiện `VIEWING_CONFIRMATION_SENT` **sau khi thư gửi thành công** (chốt review 18/11, điểm 4). Hiện chưa ai ghi sự kiện này.
- Luồng 6b không bật thử lại khi lỗi (LH-53).
- Error workflow chỉ gửi email, quản lý không nhận Telegram (LH-52).

## What Changes

- Luồng 1b: thêm một node ghi sự kiện `VIEWING_CONFIRMATION_SENT` ngay sau `Email chốt lịch` và sau `Email báo giờ mới`, ghi chú theo định dạng `viewing=<mã buổi xem>;time=<giờ hẹn ISO UTC>`. Node ghi sự kiện lỗi thì luồng vẫn chạy tiếp.
- Luồng 1 **không** ghi sự kiện này: thư của luồng 1 là "đã nhận yêu cầu", không khẳng định lịch (xem design D1). Không có mốc gửi thư tiếp nhận chính xác; `AI_SCORED` chỉ là mốc hoàn tất xử lý của luồng 1 (ghi sau thư, báo sale và lưu AI), nên báo cáo phải gọi đúng tên đó (xem design D1).
- Luồng 6b: bật thử lại (3 lần, cách 5 giây) cho các node gọi Postgres và nhúng Gemini.
- Error workflow: thêm nhánh gửi Telegram cho nhóm quản lý song song với email; không cấu hình Telegram thì bỏ qua, không làm hỏng việc gửi email.
- Tài liệu luồng 1b, 6b, Error workflow và `docs/nghiep-vu/01-visits.md` mục 3.1 cập nhật cho khớp. Đóng LH-52, LH-53.

## Capabilities

### New Capabilities
- `viewing-confirmation-event`: ghi nhận trong lịch sử khách rằng thư chốt lịch hoặc thư báo giờ mới đã gửi thành công cho đúng buổi xem và giờ hẹn.
- `workflow-monitoring`: luồng chạy nền tự thử lại khi lỗi tạm thời và báo quản lý qua cả email và Telegram khi luồng hỏng.

### Modified Capabilities
<!-- Không đổi requirement của spec hiện có. -->

## Impact

- n8n: `luong-1b-chot-lich-thu-cong.json`, `luong-6b-nap-tri-thuc.json`, `error-workflow.json` (cả ba của Hoàng). Phải import lại ba file trên VPS (CH-12 đợt 2).
- Backend: không đổi code. Dùng `POST /api/leads/:id/events` có sẵn; loại sự kiện `VIEWING_CONFIRMATION_SENT` do FE-43 thêm vào `lead.constants.ts`, nên **FE-50 phải merge sau FE-43**.
- Biến môi trường: dùng `TELEGRAM_BOT_TOKEN` và `TELEGRAM_SALE_CHAT_ID` đã có trong `docker-compose*.yml`; không thêm biến mới.
- Phụ thuộc: FE-54 của Hậu đọc sự kiện này; test của FE-54 tự tạo sự kiện nên không cần chờ.
