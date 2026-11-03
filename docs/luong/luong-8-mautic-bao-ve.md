# Luồng 8: Mautic gửi hành vi về backend

File: `n8n-workflows/luong-8-mautic-bao-ve.json`.
Trigger: `POST /webhook/mautic-event?token=<token-rieng>`.

## Cấu hình sau khi import

1. Node Cấu hình: điền `backendUrl`, `webhookSecret`, `publicWebUrl` và `pointThreshold` (mặc định 20) của đúng môi trường.
2. **Bắt buộc** đặt `mauticWebhookSecret` thành token ngẫu nhiên dài ít nhất 24 ký tự. Có thể nhập trực tiếp trong node Cấu hình; hoặc dùng biến môi trường `MAUTIC_WEBHOOK_SECRET` nếu container đã nhận biến. Không dùng mật khẩu Mautic làm token.
3. Trong Mautic > Settings > Webhooks, đặt URL Production của L8 kèm token đó:
   - Cùng Docker network local: `http://n8n:5678/webhook/mautic-event?token=<token>`.
   - Server: `https://<n8n-domain>/webhook/mautic-event?token=<token>`.
4. Bật các event đổi điểm, page hit và mở email. Chọn sub-workflow Thông báo nhân viên thật trong node tương ứng, kiểm tra SMTP và Telegram.
5. Publish L8 sau khi cấu hình xong. Thiếu/sai token trả HTTP 403 và không cập nhật dữ liệu.

L8 không đăng nhập Mautic bằng Basic Auth. Chiều gọi là Mautic → L8 → backend. `webhookSecret` dùng header X-Webhook-Secret cho backend, còn `mauticWebhookSecret` xác thực yêu cầu từ Mautic; đây là hai cấu hình khác nhau. Không chia sẻ ảnh có token hoặc commit giá trị token đã điền.

Chọn đúng Error workflow trong Settings sau khi import; ID workflow và credential có thể khác giữa local và server.

## Thứ tự xử lý

1. Xác thực query token trước khi xử lý dữ liệu.
2. Đọc tất cả phần tử của các mảng `mautic.lead_points_change`, `mautic.page_on_hit` / `mautic.page_hit`, `mautic.email_on_open`; hỗ trợ object đơn và payload thử.
3. Loop xử lý tuần tự từng sự kiện, giữ đúng liên kết dữ liệu từng khách.
4. Tra lead qua API backend bằng contactId hoặc email. Không có contact/lead thì ghi kết quả bỏ qua.
5. Chỉ cập nhật điểm khi có số nguyên không âm hợp lệ; `0` được gửi rõ ràng vẫn hợp lệ. Thiếu/sai điểm thì giữ nguyên điểm cũ.
6. Ghi sự kiện vào timeline. Báo sale khi điểm từ dưới ngưỡng lên đạt ngưỡng, hoặc có PAGE_HIT tới đường dẫn `/nha/:id` thuộc đúng origin của `publicWebUrl`.
7. Gọi sub-workflow thông báo; kết quả phải xác nhận ít nhất email hoặc Telegram gửi được. Nếu sub-workflow báo không gửi được kênh nào, đánh dấu lỗi.
8. Có lỗi thì chỉ ghi timeline khi biết lead hợp lệ; không dùng ID lead mặc định. Tiếp tục xử lý các sự kiện còn lại.
9. Sau vòng lặp, trả **một** phản hồi tổng kết với `total`, `processed`, `skipped`, `failed`, `notified`. Có lỗi trả HTTP 500 và Stop And Error; không lỗi trả HTTP 200.

`notified` đếm số sự kiện được sub-workflow xác nhận đã gửi ít nhất một kênh, không đồng nghĩa mọi kênh đều thành công. Khi cần, xem output sub-workflow để kiểm tra từng kênh.

## Payload thử

Gửi tới URL đã có token, không gửi token trong body:

```json
{
  "mautic.lead_points_change": [
    {"contact": {"id": 2, "email": "khach@example.com"}, "points": {"old_points": 10, "new_points": 25}},
    {"contact": {"id": 3, "email": "khac@example.com"}, "points": {"old_points": 0, "new_points": 5}}
  ]
}
```

Contact phải đã liên kết với lead đúng môi trường. Dùng email và contactId dữ liệu thử của bạn.

## Giới hạn còn lại

- Chưa có chống trùng bền vững theo event ID hay timestamp để chặn webhook cũ ghi đè điểm mới.
- Một phần lô lỗi sẽ trả HTTP 500; khi Mautic retry cả lô, các sự kiện đã thành công có thể được ghi hoặc báo lại.
- Nếu cập nhật điểm thành công nhưng gửi thông báo thất bại, lần retry có thể không còn được xem là vượt ngưỡng. Cần outbox/trạng thái gửi trong backend để bảo đảm phục hồi.
- Các request đồng thời chưa có khoá theo contact. Khối lượng sự kiện lớn cần cân nhắc hàng đợi và giới hạn thời gian xử lý webhook.
- Cần import và thử trên n8n/Mautic thật; sửa JSON trong repo không tự cập nhật local hay server.
