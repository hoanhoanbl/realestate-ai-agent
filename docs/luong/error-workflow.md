# Error workflow: báo quản lý khi luồng khác lỗi

File: `n8n-workflows/error-workflow.json` (5 node, không tính ghi chú, id `errorWfRealestat`).
Kích hoạt: **Error Trigger**. n8n tự chạy workflow này khi một workflow khác kết thúc ở trạng thái lỗi. Không có webhook và không ai gọi tay.

Khung chung của các tài liệu luồng: [README.md](README.md).

## 1. Làm gì trong thực tế

Hệ thống chạy tự động nên sẽ có lúc hỏng: hết hạn mức Gemini, SMTP từ chối, database mất kết nối. Nếu không ai biết thì khách bị bỏ rơi mà không ai hay. Workflow này là **chuông báo động**: bất kỳ luồng nào lỗi thì quản lý nhận ngay một email `[LỖI] <tên luồng>` có link mở đúng lần chạy lỗi trong n8n, và (từ FE-50) một tin Telegram cùng nội dung vào nhóm đã cấu hình.

## 2. Ai tham gia

| Bên | Vai trò |
|---|---|
| Quản lý | Nhận email, vào n8n xem và xử lý |
| n8n | Tự gọi workflow này |
| SMTP | Gửi email (credential `hfJ9bBGUGsjH8qDP`) |
| Telegram | Gửi tin vào nhóm `TELEGRAM_SALE_CHAT_ID` bằng bot `TELEGRAM_BOT_TOKEN` (biến môi trường, không credential) |

## 3. Từng bước

```
[1 Bắt lỗi]     Error Trigger -> Tóm tắt lỗi
[2 Báo quản lý] Email báo lỗi          (song song)
                Có Telegram? -> Gửi Telegram
```

**1. Bắt lỗi.**
`Error Trigger` nhận thông tin lần chạy lỗi. `Tóm tắt lỗi` lấy bốn thứ: tên workflow, node chạy cuối cùng (`execution.lastNodeExecuted`), thông báo lỗi và link lần chạy.

**2. Báo quản lý.**
`Email báo lỗi` gửi từ `nhadn2457@gmail.com` tới `nhadn2457+quanly@gmail.com` với tiêu đề `[LỖI] <tên workflow>`. Thân thư là bảng Workflow, Node lỗi, Thông báo và nút mở lần chạy.

`Có Telegram?` kiểm cả hai biến `TELEGRAM_BOT_TOKEN` và `TELEGRAM_SALE_CHAT_ID` có giá trị; thiếu một biến thì bỏ qua nhánh này, Error workflow vẫn chạy bình thường. `Gửi Telegram` gọi `sendMessage` với văn bản thuần (không `parse_mode`, để dấu `_`, `*` trong tên node không làm hỏng tin): `[LỖI] Luồng n8n bị lỗi`, tên workflow, node lỗi, thông báo (cắt 500 ký tự) và link lần chạy. Thử lại 3 lần, cách 3 giây. Hai nhánh độc lập: cả hai node gửi đều đặt `onError: continueRegularOutput`, nên email hỏng không chặn Telegram và ngược lại. Chat dùng chung nhóm với thông báo cho sale; muốn nhóm riêng cho quản lý thì thêm biến mới (chưa làm).

## 4. Nối với hệ thống

Workflow nào muốn được giám sát phải chọn "Error workflow" = `errorWfRealestat` trong **Settings** của workflow đó (trường `settings.errorWorkflow` trong file JSON). Hiện 10 workflow đã gắn: luồng 1, 1b, 2, 3, 4, 5, 6, 6b, 7, 8. Hai workflow không gắn là chính Error workflow và sub-workflow `Thông báo nhân viên`; sub-workflow chạy trong lần chạy của workflow gọi nó, nên lỗi của nó chỉ được báo khi workflow gọi để lỗi nổi lên (ví dụ luồng 1 đặt `Thông báo nhân viên` ở chế độ bắt lỗi nên không nổi lên).

Chỉ lần chạy **kết thúc ở trạng thái lỗi** mới kích hoạt. Nhiều node có nhánh lỗi riêng nên "bắt" lỗi và đi tiếp; những lỗi đó không báo quản lý. Ví dụ ở [luồng 1](luong-1-dat-lich.md), lỗi gọi AI đi vào `Report FAILED` và lần chạy vẫn thành công, nên quản lý không nhận email này mà chỉ thấy lead có `automationStatus = FAILED`. Hai bên bổ trợ nhau: nhánh lỗi riêng cho lỗi đã lường trước, Error workflow cho lỗi bất ngờ.

Người nhận và người gửi email ghi sẵn trong node `Email báo lỗi`, không đọc từ biến môi trường. Telegram thì đọc từ biến môi trường.

## 5. Khi lỗi thì sao

Workflow này đơn giản nên ít lỗi, nhưng nếu **cả** `Email báo lỗi` và `Gửi Telegram` thất bại (hoặc Telegram chưa cấu hình mà SMTP hỏng) thì **không có ai được báo**, vì không còn lớp nào phía sau. Đây là lý do cần xem định kỳ trang Executions của n8n, và lý do SMTP phải được kiểm tra sau mỗi lần đổi mật khẩu.

Workflow này phải ở trạng thái **bật (published)**. Nếu tắt, các luồng khác vẫn chạy nhưng lỗi không được báo.

## 6. Triển khai lên server

| Mục | Giá trị |
|---|---|
| Workflow id | `errorWfRealestat` |
| Credential | SMTP `hfJ9bBGUGsjH8qDP` |
| Biến `.env` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SALE_CHAT_ID` (đã có cho thông báo nhân viên; không thêm biến mới). Thiếu thì chỉ gửi email |
| Việc làm tay | Import trước các luồng khác, bật. Các luồng khác chọn nó ở Settings; nếu id đổi giữa môi trường thì chọn lại sau import |

Hiện trạng:

- **Server:** [trien-khai.md mục 4](../trien-khai.md) ghi đã bật (5/11).
- **Đã chạy thử trên n8n cô lập (20/11, Telegram giả ở `api.telegram.org`, SMTP giả):** gây lỗi bằng webhook luồng 1b với `event` sai. (a) Có `TELEGRAM_BOT_TOKEN` và `TELEGRAM_SALE_CHAT_ID`: một thư `[LỖI]` và một tin Telegram có tên luồng, node lỗi, thông báo và link lần chạy. (b) Bỏ hai biến: chỉ có thư, Error workflow không lỗi. (c) Token sai (Telegram trả 401): thư vẫn đi, tin Telegram thử lại 3 lần. Link trong tin dùng `WEBHOOK_URL` của n8n.
- **Chưa kiểm trên server:** chưa có ghi nhận thử gửi email `[LỖI]` và tin Telegram thật trên server sau khi import bản mới. Đã kiểm cấu trúc bằng `node scripts/check-workflow-monitoring.cjs`.

## 7. Cách chạy thử

1. Bảo đảm Error workflow đang bật và luồng thử đã chọn nó ở Settings.
2. Làm một luồng lỗi **thật** (không phải nhánh lỗi đã bắt): ví dụ tắt SMTP rồi gọi [luồng 1b](luong-1b-chot-lich-thu-cong.md) bằng một sự kiện duyệt hợp lệ, vì luồng 1b không có nhánh lỗi riêng.
3. Mong đợi: quản lý nhận email `[LỖI] luong-1b-chot-lich-thu-cong`, có tên node lỗi và nút mở lần chạy, **và** nhóm Telegram nhận tin `[LỖI] Luồng n8n bị lỗi` cùng nội dung; n8n Executions có thêm một lần chạy của Error workflow.
   - Bỏ `TELEGRAM_SALE_CHAT_ID` khỏi môi trường n8n rồi gây lỗi lại: chỉ có email, Error workflow không lỗi.
   - Đặt token Telegram sai: email vẫn gửi.
4. Ngược lại, khi tắt Gemini rồi đặt lịch, luồng 1 **không** gửi email này (xem mục 4).
