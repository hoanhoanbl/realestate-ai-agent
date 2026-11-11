# Luồng 2: Follow-up tự động

File: `n8n-workflows/luong-2-follow-up.json`. Chạy mỗi giờ hoặc trigger Chạy tay.
Backend API mới: `/api/followups`, bảo vệ bằng `X-Webhook-Secret`.

## Chín loại tác vụ sau FE-30

| Loại | Điều kiện | Hành động |
|---|---|---|
| REMINDER | CONFIRMED + buổi xem NEW, giờ xem trong 24 giờ tới | Email nhắc lịch; HOT/WARM/COLD đều được |
| FEEDBACK | VIEWED + buổi xem ATTENDED, giờ xem qua hơn 2 giờ, chưa hỏi và chưa phản hồi | Email có link cảm nhận; không tự đổi trạng thái khách |
| WARM_NUDGE | WARM + VIEWED + buổi xem ATTENDED + đồng ý tiếp thị + được hỏi cảm nhận hơn 3 ngày + chưa phản hồi + chưa nuôi | Tìm contact đúng email, tạo/cập nhật ai_nudge_text và tag nuoi-warm |
| STAFF_NUDGE | FE-38: quá responseDueAt, chưa firstResponseAt, khách còn đang xử lý; không cần buổi xem/email/điểm | Báo email quản lý, ghi RESPONSE_OVERDUE |
| EXPIRE_LEAD | Lead NEW + buổi xem NEW + giờ hẹn đã qua, không cần AI chấm | Backend đóng LOST/EXPIRED, hủy buổi xem chờ và xóa link duyệt; báo quản lý |
| HOT_NUDGE | HOT và cùng điều kiện im lặng/đồng ý như WARM | Nhắc sale gọi khách qua Telegram; không gửi email chăm sóc cho khách |
| COLD_NURTURE | COLD và cùng điều kiện im lặng/đồng ý như WARM | Tìm contact đúng email, gắn `ban-tin-hang-thang`; không qua AI hoặc gửi email ngay |
| ATTENDANCE_CHECK | CONFIRMED + buổi xem NEW + qua giờ hẹn hơn 2 giờ, chưa nhắc trong lịch hiện tại | Nhắc nhân viên ghi nhận khách có đến hay không |
| ATTENDANCE_ESCALATE | Vẫn CONFIRMED + buổi xem NEW, đã nhắc xác nhận hơn 24 giờ và chưa báo quản lý trong lịch hiện tại | Thông báo tới email quản lý qua sub-workflow |

FE-38 phân biệt nhắc lịch/điểm danh/hỏi cảm nhận theo viewing ID và giờ hẹn; cảnh báo phản hồi theo phiên nhận khách, kể cả khi chưa có lịch. Link cảm nhận thuộc đúng buổi xem, link cũ vẫn hoạt động. Lỗi cùng tác vụ L2 mới áp dụng chờ 6 giờ; lỗi Mautic L7/L8 không chặn nhắc lịch. Chi tiết triển khai và tương thích checkpoint: [FE-38](../fe-38-han-phan-hoi.md).

## Luồng xử lý

1. SQL chọn tối đa 50 tác vụ, kèm viewing_id. Không có tác vụ thì xuất NO_TASKS và số liệu chẩn đoán.
2. Loop từng tác vụ → gọi claim. Backend khoá lead trong transaction, kiểm tra lại điều kiện và cấp token sở hữu tác vụ. Với EXPIRE_LEAD, khóa cả buổi xem và đóng lịch ngay trong transaction này; ghi `LEAD_EXPIRED` và `STATUS_CHANGED` rồi mới báo L7. Execution khác bị bỏ qua.
3. Tác vụ ACTION_DONE chỉ chạy hoàn tất database, không gửi lại. Tác vụ mới lấy nhà, chuẩn bị link và nội dung. AI lỗi/đầu ra không hợp lệ thì dùng mẫu dự phòng.
4. WARM và COLD tìm contact chính xác theo email trước khi tạo/cập nhật; không lấy tuỳ ý contact đầu tiên. COLD đi nhánh riêng, chỉ truyền địa chỉ email và tag bản tin tới API Mautic.
5. Trước khi gửi, backend kiểm tra lại lịch, trạng thái, đồng ý tiếp thị và quyền sở hữu; ghi ACTION_STARTED.
6. Gửi email / Mautic / thông báo sale. Node gửi email khách và node ghi Mautic không tự retry khi không xác định kết quả. Thông báo thường cần ít nhất một kênh thành công; HOT_NUDGE cần `telegramSent: true`, EXPIRE_LEAD cần `emailSent: true` tới email quản lý. Số đã báo và số lead đã đóng là hai chỉ số khác nhau.
7. Ghi ACTION_DONE ngay sau khi dịch vụ ngoài xác nhận. WARM/COLD phải có contactId hợp lệ.
8. Complete ghi contact ID, timeline và trạng thái tác vụ trong **một transaction**. Hoàn tất lặp lại không tạo thêm event. L2 không tự chuyển CONFIRMED → VIEWED: nhân viên ghi nhận ATTENDED qua nghiệp vụ trên web; lịch quá giờ chưa xác nhận được nhắc qua hai nhánh attendance.
9. Tổng hợp thành công, bỏ qua, lỗi và REVIEW; gửi báo cáo quản lý, gồm cả số nhắc xác nhận buổi xem và báo quá hạn.

## Chống trùng và phục hồi

Bảng `followup_tasks` có task_key duy nhất. REMINDER, ATTENDANCE_CHECK, ATTENDANCE_ESCALATE và EXPIRE_LEAD dùng loại việc + lead + viewing ID + thời gian xem (chuẩn hóa millisecond); các loại còn lại dùng loại việc + lead. Đổi giờ cho phép tạo tác vụ nhắc mới. Event REMINDER_SENT cũ vẫn được tôn trọng, nhưng chỉ trong lịch chưa đổi giờ.

Nếu lỗi trước khi báo quản lý, lead EXPIRED vẫn đóng; sau thời gian chờ chỉ tiếp tục thông báo cho đúng lịch đã đóng, không ghi lại `LEAD_EXPIRED`. Nếu đã bắt đầu gửi mà mất phản hồi thì giữ REVIEW. Thao tác duyệt/đổi giờ cũ không mở lại lead đã đóng.

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

- `delivered`: xác nhận dịch vụ ngoài đã nhận; backend chỉ hoàn tất dữ liệu. `mauticContactId` bắt buộc cho WARM/COLD, bỏ trường này với email/sale. Với HOT, kiểm tra Telegram sale đã nhận trước khi xác nhận.
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
3. Chọn credential Postgres, Gemini, SMTP và Basic Auth Mautic cho cả Tìm contact nuôi dưỡng / Gửi Mautic nuôi dưỡng.
4. Chọn sub-workflow thông báo nhân viên đã publish trong node Thông báo nhân viên, chọn đúng Error workflow trong Settings. Kiểm tra bot/chat Telegram sale thật và output `telegramSent` cho nhánh HOT.
5. Kiểm tra Cấu hình: backendUrl, webhookSecret, mauticUrl, publicWebUrl và email quản lý. Các dịch vụ phải thuộc môi trường bạn muốn dùng. Không nhập secret vào Git.
6. Mautic phải có custom field ai_nudge_text, segment nhận `nuoi-warm` và campaign đã cấu hình. Bản tin dùng segment lọc tag `ban-tin-hang-thang` của FE-22, cập nhật qua cron; gắn tag không tự gửi bản tin.
7. Thử trên database riêng bằng khách thử trước; xem task state, timeline, contact ID và báo cáo. SQL có thể xem trước các ca NEW quá hạn trước khi bật lịch. Chỉ publish sau khi credential, danh sách đối tượng bị ảnh hưởng và sub-workflow đã được kiểm tra.
8. Import L4 mới sau khi backend/L2 tương thích để báo cáo có số `EXPIRED`. Không cần SQL migration riêng cho FE-30; giá trị trạng thái/sự kiện nằm trong cột văn bản đã có.

## Kiểm tra trong repo

Từ thư mục gốc:

```powershell
node scripts/check-followup-workflow.cjs
node scripts/check-followup-report.cjs
```

Trong backend:

```powershell
npm run test:followups
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

Kiểm tra SQL bằng bảng tạm + dữ liệu giả, cuối cùng ROLLBACK (không gửi email, không sửa dữ liệu khách):

```powershell
node scripts/check-followup-workflow.cjs --sql | docker exec -i realestate-db psql -U realestate -d realestate_fe22_test_20261104 -v ON_ERROR_STOP=1
node scripts/check-followup-report.cjs --sql | docker exec -i realestate-db psql -U realestate -d realestate_fe22_test_20261104 -v ON_ERROR_STOP=1
```

Thay DB user/name nếu cấu hình của bạn khác. `backend/sql/preview-follow-up.sql` là bản chỉ đọc của câu chọn tác vụ, cần backend mới đã tạo bảng trước khi dùng trên dữ liệu thật. Kiểm tra giả lập không thay thế thử các credential và chiến dịch Mautic thật.

## Ca kiểm thử FE-30 theo từng bước

1. **Nhắc duyệt:** tạo COLD có lead và buổi xem đều NEW, đăng ký quá 3 ngày, giờ hẹn tương lai. Preview trả `STAFF_NUDGE`; khi hẹn đã qua phải ra `EXPIRE_LEAD` thay vì nhắc duyệt.
2. **Đóng quá hạn:** tạo lead NEW với giờ hẹn đã qua. Sau claim, kiểm tra lead LOST/EXPIRED, viewing CANCELLED, link duyệt bị gỡ và một event `LEAD_EXPIRED`. Chỉ khi email quản lý xác nhận mới ghi `LEAD_EXPIRED_NOTIFIED`. Thử lỗi trước gửi rồi tiếp tục sau thời gian chờ: không đóng lead lần hai. Callback duyệt cũ trả 400.
3. **Im lặng:** dùng ba lead HOT/WARM/COLD đã được điểm danh ATTENDED, có consent, lần hỏi cảm nhận mới nhất hơn 3 ngày, chưa gửi form. HOT báo sale qua Telegram, WARM gửi `ai_nudge_text` và tag `nuoi-warm`, COLD chỉ gắn tag `ban-tin-hang-thang`. Bỏ consent, thêm phản hồi hoặc hỏi mới trong 3 ngày thì không chọn. Không bỏ bộ lọc để ép chạy.
4. **Báo cáo:** chạy L4 cho kỳ có event `LEAD_EXPIRED`, đối chiếu số đếm trên email/web. Không cộng `LEAD_EXPIRED_NOTIFIED` hoặc `VIEWING_NO_SHOW` vào số EXPIRED.

Đã thử local bằng bản n8n riêng không bật lịch: chạy code node và checkpoint qua backend thử cổng `8084`, đọc selector từ PostgreSQL riêng, dùng Mautic/Telegram/email giả lập. Kiểm chứng HOT, COLD, nhắc duyệt COLD, đóng EXPIRED mới có microsecond và khôi phục thông báo sau lỗi; hai lead không consent không được gửi. Lượt chạy cuối hoàn tất hai thông báo quá hạn, không lỗi. Chưa bật L2/L4 bản mới trên môi trường dùng thật; SMTP, Telegram, Mautic và cron thật còn phải nghiệm thu với dữ liệu thử đã được phép.
