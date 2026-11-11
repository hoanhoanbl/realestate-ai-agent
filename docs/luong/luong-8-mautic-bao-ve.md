# Luồng 8: Mautic gửi hành vi về backend

File: `n8n-workflows/luong-8-mautic-bao-ve.json` (25 node, không tính ghi chú; id `luong8Realestat0`).
Kích hoạt: `POST /webhook/mautic-event?token=<token-rieng>`. Luồng này xác thực bằng **token trong URL**, không dùng Header Auth.

Khung chung của các tài liệu luồng: [README.md](README.md). Các mục "Cấu hình sau khi import", "Thứ tự xử lý", "Payload thử" và "Giới hạn còn lại" là phần chi tiết riêng của luồng này.

## 1. Làm gì trong thực tế

Mautic theo dõi khách thực sự làm gì: mở email, xem trang một căn nhà, điểm tương tác tăng lên. Luồng 8 nhận các sự kiện đó, cập nhật điểm hành vi của lead ở backend, ghi vào lịch sử khách, và **báo sale đúng lúc khách "nóng lên"**: điểm từ dưới ngưỡng (mặc định 20) lên đạt ngưỡng, hoặc khách vừa xem trang một căn nhà (`/nha/:id`). Điểm hành vi của Mautic là một trục riêng, không thay điểm AI chấm khi đặt lịch.

Quy tắc nghiệp vụ: [nghiep-vu/03-cham-soc-va-marketing.md](../nghiep-vu/03-cham-soc-va-marketing.md) mục 4 và 5.

## 2. Ai tham gia

Mautic (gọi webhook), backend (lưu điểm và lịch sử), sale phụ trách và nhóm sale (nhận thông báo qua [sub-workflow](thong-bao-nhan-vien.md)), quản lý (nhận báo lỗi), người cấu hình Mautic (đặt URL webhook kèm token).

## 3. Từng bước

Workflow chia thành năm nhóm bằng ghi chú: **1. Nhận và xác thực webhook Mautic**, **2. Từng sự kiện: tìm lead**, **3. Cập nhật điểm và ghi event**, **4. Báo nhân viên khi vượt ngưỡng**, **5. Tổng kết lô**, và một nhóm **Xử lý lỗi**. Mô tả đầy đủ ở mục "Thứ tự xử lý" bên dưới.

## 4. Nối với hệ thống

| Hướng | Gọi gì |
|---|---|
| Mautic → luồng 8 | `POST /webhook/mautic-event?token=...` (cấu hình trong Mautic > Settings > Webhooks) |
| Luồng 8 → backend | `GET /api/leads/by-mautic/:contactId` (tìm lead), `PUT /api/leads/:id/mautic` (điểm), `POST /api/leads/:id/events` |
| Luồng 8 → sub-workflow | [Thông báo nhân viên](thong-bao-nhan-vien.md), cách gọi cũ (nhóm sale chung) |

Chiều từ backend sang Mautic (tạo contact, gắn tag) là [luồng 7](luong-7-dong-bo-mautic.md).

## 5. Khi lỗi thì sao

Thiếu hoặc sai token thì trả HTTP 403 (node `Từ chối webhook`) và không ghi gì. Lỗi ở một sự kiện không dừng cả lô: luồng ghi nhận lỗi, đi tiếp các sự kiện còn lại, rồi trả **một** phản hồi tổng kết; có lỗi thì HTTP 500 và `Stop And Error` để [Error workflow](error-workflow.md) báo quản lý. Giới hạn đã biết (chưa chống trùng theo event ID, retry cả lô có thể báo lại) ở mục "Giới hạn còn lại" bên dưới.

## 6. Triển khai lên server

| Mục | Giá trị |
|---|---|
| Workflow id | `luong8Realestat0` |
| Credential | Không dùng credential n8n. Xác thực bằng token trong URL |
| Biến `.env` | `MAUTIC_WEBHOOK_SECRET` (token, ít nhất 24 ký tự; **trống thì mọi sự kiện bị từ chối 403**), `WEBHOOK_SECRET`, `PUBLIC_WEB_URL`, `BACKEND_URL` |
| Việc làm tay | Các bước ở mục "Cấu hình sau khi import" bên dưới; đặt URL webhook kèm `?token=` trong Mautic |
| Error workflow | Chọn `errorWfRealestat` trong Settings |

Lưu ý: node `Cấu hình` đặt sẵn một giá trị dự phòng cho `webhookSecret` trong file JSON khi biến `WEBHOOK_SECRET` trống. Luôn đặt `WEBHOOK_SECRET` thật ở môi trường chạy thật, đừng dựa vào giá trị dự phòng.

Hiện trạng:

- **Server:** [trien-khai.md mục 4](../trien-khai.md) ghi luồng 8 đã bật, là **bản cũ**. Bản mô tả ở đây (có token, xử lý theo lô) **chưa lên server**.
- **Phát hành:** làm theo [trien-khai.md mục 9](../trien-khai.md) (bản `v0.3.1`): tạo `MAUTIC_WEBHOOK_SECRET`, tạo lại n8n để nhận biến, gắn token vào webhook Mautic, import luồng 8, publish, kiểm tra bằng một sự kiện thử.
- **Chưa kiểm trên server:** cả luồng với Mautic server thật (xem mục "Giới hạn còn lại").

## 7. Cách chạy thử

Dùng mục "Payload thử" bên dưới: gửi payload mẫu tới URL **đã có token**; contact trong payload phải đã liên kết với một lead đúng môi trường. Kiểm tra: lead có sự kiện điểm mới trong lịch sử, và sale nhận thông báo khi điểm vượt ngưỡng. Thử không có token để thấy HTTP 403.

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
