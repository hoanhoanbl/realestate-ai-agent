# Design

## Context

- Luồng 1b (`luong-1b-chot-lich-thu-cong.json`, 23 node) gửi `Email chốt lịch` rồi `Cập nhật CONFIRMED` rồi `Ghi log APPROVED`; nhánh đổi giờ gửi `Email báo giờ mới`. Node `Chuẩn bị` đã có `leadId`, `viewingId` và `viewing_time` (qua câu SQL ở `Lấy dữ liệu lịch`), nên không cần gọi thêm backend để biết buổi xem và giờ hẹn.
- Sự kiện ghi qua `POST /api/leads/:id/events` (`WebhookSecretGuard`), cùng node HTTP và credential mà `Ghi log APPROVED` đang dùng.
- Định dạng ghi chú và việc FE-54 đọc nó đã chốt ở design D10 của change `journey-followup-ladder`. Loại sự kiện `VIEWING_CONFIRMATION_SENT` do FE-43 thêm vào `lead.constants.ts`, nên FE-50 merge sau FE-43.
- Mọi file n8n JSON ở đây thuộc Hoàng (`docs/quy-trinh-git.md`, "Ai giữ phần nào"); export lại cả file sau khi sửa trên n8n.

## Goals / Non-Goals

**Goals:**
- Sự kiện `VIEWING_CONFIRMATION_SENT` ghi đúng một lần cho mỗi thư xác nhận gửi thành công, đúng định dạng FE-54 đọc.
- Đóng LH-52 và LH-53 với thay đổi nhỏ nhất.

**Non-Goals:**
- Không đổi nội dung thư, không đổi luồng 1.
- Không dựng kênh Telegram riêng cho quản lý; dùng nhóm đã có.
- Không thêm Langfuse hay đo lường (FE-25).

## Decisions

### D1. Chỉ luồng 1b ghi sự kiện, luồng 1 không ghi
Sổ task (`danh-sach-task.md`, FE-50) và design D10 nói "luồng 1 và 1b". Nhưng thư ở luồng 1 (`Email khách HOT/WARM/COLD`) là thư **đã nhận yêu cầu**, nói rõ chưa chốt lịch (`docs/nghiep-vu/01-visits.md` mục 1.4). Quy tắc FE-54 là "thư chốt lịch hoặc thư báo giờ mới đã là lời nhắc". Nếu luồng 1 cũng ghi sự kiện, khách đặt lịch trong vòng 24 giờ trước giờ hẹn sẽ **không** nhận nhắc lịch sau khi sale duyệt, dù chưa từng nhận thư xác nhận nào ngoài thư "đã nhận". Vì vậy chỉ luồng 1b ghi. Điểm này lệch chữ trong sổ task; ghi vào mô tả PR và nhắn Hậu xác nhận khi duyệt.

Mốc "thư tự động đầu tiên tới khách" cho báo cáo (nhắc ở sổ task) **không có mốc gửi chính xác** và change này không thêm: `AI_SCORED` (luồng 1 ghi sau khi thư khách, báo sale và lưu kết quả AI đã xong; chỉ ghi khi các bước đó chạy hết) chỉ là **mốc hoàn tất xử lý** của luồng 1, và `emailSent` trong kết quả AI là boolean không có giờ. Vì vậy `AI_SCORED` không được gọi là "mốc gửi thư"; nó thiếu khi một bước sau thư (lấy link, báo sale, lưu AI) lỗi. Báo cáo dùng nó phải ghi tên đúng là "thời gian hệ thống hoàn tất xử lý yêu cầu". Nếu sau này cần mốc gửi thư tiếp nhận chính xác thì định nghĩa riêng (ví dụ sự kiện ghi ngay sau node email khách của luồng 1), ngoài phạm vi FE-50.

### D2. Node ghi sự kiện đặt ngay sau thư, không chặn luồng
Thêm node HTTP `Ghi log VIEWING_CONFIRMATION_SENT` (bản sao `Ghi log APPROVED`: cùng credential, `retryOnFail` 3 lần cách 5 giây) với `onError: continueRegularOutput`. Đặt ở hai chỗ:

```
Email chốt lịch   --> Ghi log VIEWING_CONFIRMATION_SENT --> Cập nhật CONFIRMED --> Ghi log APPROVED
Email báo giờ mới --> Ghi log VIEWING_CONFIRMATION_SENT (bản thứ hai) --> (nối tiếp như hiện tại)
```

Ghi sự kiện lỗi thì vẫn chốt lịch: lỗi ghi sự kiện chỉ làm khách nhận thêm một thư nhắc, còn chặn chốt lịch thì khách mất lịch. `Email chốt lịch` lỗi thì nhánh lỗi hiện tại chạy và node ghi sự kiện không chạy, đúng yêu cầu "không có sự kiện khi thư lỗi".

*Phương án khác:* ghi sự kiện từ backend khi `PUT /leads/:id/status` sang `CONFIRMED`. Bị loại vì khi đó thư có thể chưa đi (đúng lỗi review điểm 4 đã loại).

### D3. Dựng ghi chú bằng biểu thức n8n, kiểm bằng script
Ghi chú: `viewing=${viewingId};time=${new Date(viewing_time).toISOString()}`, lấy từ node `Chuẩn bị`. Cần thêm `viewingTimeIso` vào đầu ra của node `Chuẩn bị` (một trường), vì node đó hiện chỉ giữ `timeText`. Thêm `scripts/check-confirmation-note.cjs` đọc JSON luồng 1b, lấy biểu thức, chạy với giờ mẫu và so với kết quả của hàm dựng ghi chú của FE-43 (nếu đã merge) hoặc chuỗi mẫu trong spec, để hai nơi không lệch nhau.

### D4. Luồng 6b: bật retry theo node
Bật `retryOnFail`, `maxTries: 3`, `waitBetweenTries: 5000` cho `Đọc căn nhà`, `Đọc tài liệu`, `Lưu vào pgvector`, `Xoá bản cũ`, `Thống kê`. Không bật cho node `Code` và các sub-node (splitter, loader, embedding không hỗ trợ cấu hình retry riêng; retry của `Lưu vào pgvector` đã bao).

Lưu ý khi thử lại `Lưu vào pgvector`: nếu bước ghi dở dang rồi lỗi thì thử lại có thể ghi trùng đoạn. Luồng đã có bước `Xoá bản cũ` (chạy theo nguồn) nên lần chạy sau dọn lại; ghi vào Rủi ro.

### D5. Error workflow: Telegram chạy song song, không cần credential mới
`Tóm tắt lỗi` nối thêm vào `Có Telegram?` (IF: `$env.TELEGRAM_BOT_TOKEN` và `$env.TELEGRAM_SALE_CHAT_ID` đều không rỗng) rồi `Gửi Telegram` (HTTP `https://api.telegram.org/bot<token>/sendMessage`, văn bản thuần, không `parse_mode` để dấu `_`, `*` trong tên node không làm hỏng tin; `onError: continueRegularOutput`). Email vẫn là nhánh chính và không phụ thuộc nhánh Telegram. Cách này giống `thong-bao-nhan-vien.json` đang gửi Telegram bằng `$env`, nên không có credential mới và không đổi `docker-compose`.

Chat id dùng `TELEGRAM_SALE_CHAT_ID` (nhóm có cả quản lý). Nếu sau này cần nhóm riêng cho quản lý thì thêm biến mới; ngoài phạm vi.

## Risks / Trade-offs

- [Ghi sự kiện lỗi nhưng thư đã gửi → khách nhận thêm một thư nhắc] → Chấp nhận, đây là hướng lỗi an toàn; nhiều hơn một thư tốt hơn không thư nào.
- [Luồng 6b thử lại có thể ghi trùng đoạn] → `Xoá bản cũ` dọn ở lần chạy sau; kiểm bằng thống kê số đoạn trước và sau khi chạy.
- [Biến `$env` bị chặn trong n8n bản mới] → Đang dùng ở `thong-bao-nhan-vien.json` và chạy được; kiểm trên n8n local trước khi merge.
- [Hậu không đồng ý D1] → Thay đổi nhỏ (thêm node ở luồng 1); nêu rõ trong PR để Hậu quyết khi duyệt.

## Migration Plan

Không có SQL. Sau khi merge: import lại `luong-1b-chot-lich-thu-cong.json`, `luong-6b-nap-tri-thuc.json`, `error-workflow.json` trên VPS (CH-12 đợt 2), mở workflow, publish, kiểm một lần chạy thử từng luồng. Rollback: import lại bản cũ từ git.
