# Luồng 2: Follow-up tự động

> **Lõi và mở rộng trong cùng một luồng.** Nhắc lịch, nhắc điểm danh, hỏi cảm nhận, nhắc sale gọi khách HOT là phần lõi (vế Lead follow-up). Nhánh nuôi khách WARM và COLD qua Mautic (tag `nuoi-warm`, `ban-tin-hang-thang`) là **mở rộng Marketing Automation, phát triển sau**.

File: `n8n-workflows/luong-2-follow-up.json` (51 node, không tính ghi chú; id `luong2Realestat0`).
Kích hoạt: **mỗi giờ** (node `Mỗi giờ`) hoặc nút `Chạy tay` trong n8n. Không có webhook.
Backend API: `/api/followups/*`, bảo vệ bằng `X-Webhook-Secret`.

Khung chung của các tài liệu luồng: [README.md](README.md). Các mục từ "Chín loại tác vụ" trở xuống là phần chi tiết riêng của luồng này.

## 1. Làm gì trong thực tế

Sau khi khách đặt lịch, nhiều việc nhỏ dễ bị quên: nhắc khách trước giờ xem, hỏi cảm nhận sau buổi xem, nhắc sale ghi nhận khách có đến không, nhắc sale duyệt, đóng lead hẹn quá giờ mà không ai xử lý, chăm lại khách im lặng. Luồng 2 chạy mỗi giờ, tìm các việc đến hạn (chín loại, xem bảng bên dưới) và làm **mỗi việc đúng một lần**: gửi email, chuyển khách sang Mautic để nuôi dưỡng, hoặc nhắc nhân viên. Cuối mỗi lượt, một báo cáo tổng hợp gửi quản lý.

Quy tắc nghiệp vụ: [nghiep-vu/02-dat-lich-den-dat-coc.md](../nghiep-vu/02-dat-lich-den-dat-coc.md) mục 2.3 và 3, [nghiep-vu/03-cham-soc-va-marketing.md](../nghiep-vu/03-cham-soc-va-marketing.md) mục 1, 2 và 7.

## 2. Ai tham gia

| Bên | Vai trò |
|---|---|
| Khách | Nhận email nhắc lịch, hỏi cảm nhận |
| Sale phụ trách | Nhận nhắc điểm danh, nhắc gọi khách HOT (Telegram) |
| Quản lý | Nhận cảnh báo quá hạn và báo cáo tổng hợp mỗi lượt |
| Backend | Cấp, giữ và ghi checkpoint tác vụ (`followup_tasks`) |
| Mautic | Nhận contact và tag nuôi dưỡng |
| Gemini, SMTP | Soạn nội dung nuôi dưỡng; gửi email |

## 3. Từng bước

Workflow chia thành mười nhóm bằng ghi chú: **1. Lấy việc đến hạn**, **2. Giữ tác vụ (chống gửi trùng)**, **3. Chuẩn bị theo loại việc**, **4. AI soạn nội dung**, **5. Tìm contact Mautic**, **6. Xác nhận trước khi gửi**, **7. Gửi email khách, chuyển Mautic**, **8. Báo nhân viên**, **9. Hoàn tất tác vụ**, **10. Báo cáo quản lý**, và một nhóm **Xử lý lỗi**. Mô tả đầy đủ từng bước ở mục "Luồng xử lý" bên dưới.

## 4. Nối với hệ thống

| Hướng | Gọi gì |
|---|---|
| Luồng 2 → database | `Lấy lead cần follow-up`: một câu SQL chọn tối đa 50 tác vụ đến hạn (bản chỉ đọc: `backend/sql/preview-follow-up.sql`) |
| Luồng 2 → backend | `POST /api/followups/claim`, `/:id/start`, `/:id/action-done`, `/:id/complete`, `/:id/fail`; `POST /api/followups/:id/resolve` (người vận hành gọi tay khi tác vụ `REVIEW`) |
| Luồng 2 → backend | `POST /api/feedback/link/:leadId` (link cảm nhận, xem [luồng 5](luong-5-cam-nhan.md)); `GET /api/properties/:id`; `POST /api/leads/:id/events` |
| Luồng 2 → Mautic | `GET /contacts`, rồi `PATCH` hoặc `POST` contact kèm tag `nuoi-warm` hoặc `ban-tin-hang-thang` |
| Luồng 2 → sub-workflow | [Thông báo nhân viên](thong-bao-nhan-vien.md) |
| Luồng 4 đọc kết quả | Số lead `EXPIRED` và số nhắc/báo quá hạn nằm trong [báo cáo tuần](luong-4-bao-cao.md) |

## 5. Khi lỗi thì sao

Luồng 2 dùng **checkpoint** để không bao giờ gửi một việc hai lần: `CLAIMED`, `ACTION_STARTED`, `ACTION_DONE`, `COMPLETED`, `FAILED`, `REVIEW`. Lỗi trước khi gửi thì tác vụ `FAILED` và chờ 6 giờ rồi kiểm tra lại điều kiện. Đã bắt đầu gửi mà mất phản hồi thì giữ `REVIEW`, **không tự gửi lại**, và người vận hành xử lý bằng `POST /api/followups/{id}/resolve`. Chi tiết ở hai mục "Chống trùng và phục hồi" và "Xử lý REVIEW" bên dưới. Lỗi cuối cùng làm lần chạy thất bại thì [Error workflow](error-workflow.md) báo quản lý.

## 6. Triển khai lên server

| Mục | Giá trị |
|---|---|
| Workflow id | `luong2Realestat0` |
| Credential | Postgres `postgres_account_id`, Gemini `wU5LeG7gXaoUdMXQ`, SMTP `hfJ9bBGUGsjH8qDP`, Basic Auth Mautic `mautic_api_credential` (chọn đúng môi trường Local hoặc Server) |
| Biến `.env` | `MAUTIC_URL` (`https://mautic.<PUBLIC_HOST>/api`), `PUBLIC_WEB_URL`, `WEBHOOK_SECRET`, `BACKEND_URL` (có mặc định) |
| Cấu hình trong node `Cấu hình` | `backendUrl`, `mauticUrl`, `publicWebUrl`, `webhookSecret`, `staffEmail`, `managerEmail` (hai email đang ghi sẵn trong node, kiểm tra trước khi dùng thật) |
| Error workflow | Chọn `errorWfRealestat` trong Settings |

Hiện trạng:

- **Server:** [trien-khai.md mục 4](../trien-khai.md) ghi luồng 2 **tắt, bản cũ**. Bản mô tả ở đây (checkpoint FE-29, chín loại tác vụ của FE-30, hạn phản hồi FE-38) **chưa lên server**.
- **Phát hành:** làm theo [trien-khai.md mục 9](../trien-khai.md) (bản `v0.3.1`): deploy backend trước, tạo credential Mautic, import luồng 2, rồi **chỉ bật ở bước cuối** sau khi đã kiểm tra lead mẫu. Không import vào hệ thống còn chạy backend cũ vì chưa có API `claim`.
- **Đã kiểm:** hai script `check-followup-workflow.cjs`, `check-followup-report.cjs`, kiểm thử backend `test:followups`, và ca thử local ở mục "Ca kiểm thử FE-30" bên dưới.
- **Chưa kiểm trên server:** cả luồng với Mautic server thật. Hướng dẫn từng bước: mục "Cập nhật local/server" bên dưới.

## 7. Cách chạy thử

1. Chạy hai script kiểm tra cấu trúc và SQL ở mục "Kiểm tra trong repo" bên dưới (không gửi email, không sửa dữ liệu).
2. Nạp dữ liệu mẫu bằng `backend/sql/demo-follow-up.sql`, rồi trong n8n bấm `Chạy tay` của luồng 2 trên bản n8n **local**, không bật lịch.
3. Làm theo "Ca kiểm thử FE-30 theo từng bước" để thử nhắc duyệt, đóng quá hạn, khách im lặng và báo cáo.

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
