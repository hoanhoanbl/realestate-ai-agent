# Luồng 2: Follow-up tự động

File: `n8n-workflows/luong-2-follow-up.json`. Chạy mỗi giờ hoặc trigger Chạy tay.
Backend API mới: `/api/followups`, bảo vệ bằng `X-Webhook-Secret`.

## Bốn loại tác vụ

| Loại | Điều kiện | Hành động |
|---|---|---|
| REMINDER | CONFIRMED, giờ xem trong 24 giờ tới | Email nhắc lịch; HOT/WARM/COLD đều được |
| FEEDBACK | VIEWED và giờ xem qua hơn 2 giờ; hoặc CONFIRMED và giờ xem qua hơn 1 ngày | Email có link cảm nhận, hoàn tất thì cập nhật VIEWED nếu khách vẫn CONFIRMED |
| WARM_NUDGE | WARM + VIEWED + đồng ý tiếp thị + được hỏi cảm nhận hơn 3 ngày + chưa phản hồi + chưa nuôi | Tìm contact đúng email, tạo/cập nhật ai_nudge_text và tag nuoi-warm |
| STAFF_NUDGE | HOT/WARM + NEW + tạo hơn 3 ngày | Gọi sub-workflow thông báo nhân viên |

Chỉ dùng lịch xem mới nhất của mỗi lead. Lỗi cùng tác vụ L2 mới áp dụng chờ 6 giờ; lỗi Mautic của L7/L8 không chặn nhắc lịch. Khách đã gửi cảm nhận không được chọn để hỏi lại hoặc nuôi theo nhánh im lặng. Segment Mautic nhận `nuoi-warm`, không nhận riêng `WARM`.

## Luồng xử lý

1. SQL chọn tối đa 50 tác vụ, kèm viewing_id. Không có tác vụ thì xuất NO_TASKS và số liệu chẩn đoán.
2. Loop từng tác vụ → gọi claim. Backend khoá lead trong transaction, kiểm tra lại điều kiện và cấp token sở hữu tác vụ. Execution khác bị bỏ qua.
3. Tác vụ ACTION_DONE chỉ chạy hoàn tất database, không gửi lại. Tác vụ mới lấy nhà, chuẩn bị link và nội dung. AI lỗi/đầu ra không hợp lệ thì dùng mẫu dự phòng.
4. WARM tìm contact chính xác theo email trước khi tạo/cập nhật; không lấy tuỳ ý contact đầu tiên.
5. Trước khi gửi, backend kiểm tra lại lịch, trạng thái, đồng ý tiếp thị và quyền sở hữu; ghi ACTION_STARTED.
6. Gửi email / Mautic / thông báo sale. Node gửi email khách và node ghi Mautic không tự retry khi không xác định kết quả. Sub-workflow sale phải xác nhận ít nhất một kênh thành công.
7. Ghi ACTION_DONE ngay sau khi dịch vụ ngoài xác nhận. WARM phải có contactId hợp lệ.
8. Complete ghi trạng thái, contact ID và timeline trong **một transaction**. Hoàn tất lặp lại không tạo thêm event. Nếu chuyển CONFIRMED → VIEWED, backend phát lead-changed sau commit để L7 đồng bộ.
9. Tổng hợp thành công, bỏ qua, lỗi và REVIEW; gửi báo cáo quản lý.

## Chống trùng và phục hồi

Bảng `followup_tasks` có task_key duy nhất. REMINDER dùng lead + viewing ID + thời gian xem; ba loại còn lại dùng loại tác vụ + lead. Đổi giờ cho phép tạo tác vụ nhắc mới. Event REMINDER_SENT cũ vẫn được tôn trọng, nhưng chỉ trong lịch chưa đổi giờ.

- CLAIMED: giữ tác vụ 30 phút. Chưa bắt đầu gửi thì execution khác có thể nhận lại sau khi hết hạn.
- ACTION_STARTED: đã cho phép gọi dịch vụ ngoài. Nếu lỗi/mất phản hồi, chuyển REVIEW hoặc execution sau đưa tác vụ hết hạn vào REVIEW. Không tự gửi lại.
- ACTION_DONE: dịch vụ ngoài đã xác nhận. Nếu cập nhật database lỗi, giữ checkpoint; lượt sau chỉ hoàn tất metadata.
- COMPLETED: đã hoàn tất, không làm lại.
- FAILED: lỗi trước khi gửi; chờ 6 giờ và kiểm tra lại điều kiện.
- REVIEW: cần kiểm tra lịch sử nhà cung cấp để biết có gửi thành công hay chưa.

Không thể bảo đảm gửi đúng một lần qua SMTP khi mất kết nối đúng thời điểm nhà cung cấp nhận email. Cơ chế này chọn giữ REVIEW thay vì tự gửi lại; retry bên trong sub-workflow thông báo vẫn cần theo dõi riêng.

Nếu lịch hoặc khách thay đổi trong lúc đang gửi, không thể thu hồi email đã gửi; checkpoint cũ vẫn được hoàn tất và không đổi ngược trạng thái khách đã tiến triển.

## Xử lý REVIEW

Chỉ người vận hành có quyền dùng webhook secret mới gọi API này, sau khi kiểm tra Gmail/Mautic/Telegram:

`POST /api/followups/{taskId}/resolve`

```json
{"token":"token-tu-node-Giu-tac-vu","resolution":"delivered","mauticContactId":42}
```

- `delivered`: xác nhận dịch vụ ngoài đã nhận; backend chỉ hoàn tất dữ liệu. `mauticContactId` bắt buộc cho WARM, bỏ trường này với email/sale.
- `not-delivered`: xác nhận chưa gửi, cho phép chuẩn bị lại sau 6 giờ. Không tự xoá event hoặc reset state để ép gửi lại.
- Token tác vụ lấy trong execution được cấp tác vụ; giữ riêng, không commit hoặc chia sẻ ảnh có token.

Có thể xem danh sách cần xử lý bằng truy vấn chỉ đọc:

```sql
SELECT id,lead_id,type,state,error,updated_at
FROM followup_tasks WHERE state='REVIEW' ORDER BY updated_at DESC;
```

## Cập nhật local/server

**Cập nhật backend trước, import L2 sau.** Không import vào hệ thống vẫn chạy backend cũ vì chưa có API claim/checkpoint.

1. Build/deploy backend mới. Module Followups đăng ký entity `followup_tasks`; cấu hình TypeORM hiện tại của dự án dùng synchronize nên tạo bảng khi backend khởi động. Không xoá volume database.
2. Tạm dừng L2 cũ, export dự phòng rồi import JSON mới. Không để hai bản khác phiên bản cùng chạy: bản cũ chưa dùng claim.
3. Chọn credential Postgres, Gemini, SMTP và Basic Auth Mautic cho cả Tìm contact nuôi dưỡng / Gửi Mautic Nuôi WARM.
4. Chọn sub-workflow thông báo nhân viên đã publish trong node Thông báo nhân viên, chọn đúng Error workflow trong Settings.
5. Kiểm tra Cấu hình: backendUrl, webhookSecret, mauticUrl, publicWebUrl và email quản lý. Các dịch vụ phải thuộc môi trường bạn muốn dùng. Không nhập secret vào Git.
6. Mautic phải có custom field ai_nudge_text, segment nhận tag nuoi-warm và campaign đã cấu hình; gắn tag không tự tạo campaign.
7. Thử với khách riêng của bạn; xem task state, timeline, contact ID và báo cáo. Publish sau khi credential và sub-workflow hợp lệ.

## Kiểm tra trong repo

Từ thư mục gốc:

```powershell
node scripts/check-followup-workflow.cjs
```

Trong backend:

```powershell
npm run test:followups
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

Kiểm tra SQL bằng bảng tạm + dữ liệu giả, cuối cùng ROLLBACK (không gửi email, không sửa dữ liệu khách):

```powershell
node scripts/check-followup-workflow.cjs --sql | docker exec -i realestate-db psql -U realestate -d realestate -v ON_ERROR_STOP=1
```

Thay DB user/name nếu cấu hình của bạn khác. `backend/sql/preview-follow-up.sql` là bản chỉ đọc của câu chọn tác vụ, cần backend mới đã tạo bảng trước khi dùng trên dữ liệu thật. Kiểm tra giả lập không thay thế thử các credential và chiến dịch Mautic thật.
