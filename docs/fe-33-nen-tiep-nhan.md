# FE-33 — Nền tiếp nhận khách và phân công sale

Trạng thái: triển khai local trên `feature/FE-33-nen-tiep-nhan`, chưa PR, chưa triển khai server. Phạm vi nghiệp vụ: [quy trình 1](nghiep-vu/01-tiep-nhan-va-phan-cong.md). Không sửa workflow n8n trong task này.

## Dữ liệu và quy tắc đã có

- Lead có `phoneNormalized`, `assignedUserId`, `assignedAt`, `responseDueAt`, `firstResponseAt`, `interestedPropertyIds`. Email và ngân sách nhận `null` khi khách chưa cung cấp; không dùng email giả hoặc biến ngân sách chưa biết thành 0.
- Có trạng thái `CONSULTING` (Đang tư vấn). API intake tạo trạng thái này; đặt lịch qua endpoint cũ vẫn tạo `NEW` để luồng 1 hiện tại tiếp tục chạy.
- Nhân viên có `telegramChatId`, `acceptingLeads` (mặc định bật), `lastAssignedAt`. Lead mới từ kênh hệ thống chia cho sale bật nhận khách, người lâu chưa được giao nhất nhận trước; lượt ban đầu theo id. Nhập tay mặc định người nhập và cũng cập nhật lượt chia. Không có sale nhận thì giao quản lý id nhỏ nhất; thiếu cả quản lý trả 503 và không lưu khách.
- Tạo/nhận khách, đổi chủ và đổi công tắc nhận khách dùng chung khoá PostgreSQL trong transaction. Đặt lịch lưu lead và buổi xem trong cùng transaction, nên thất bại không để lại khách/nhật ký/lượt chia dở dang.
- Số điện thoại bỏ dấu cách, chấm, gạch, ngoặc, đổi `+84` thành `0`; sau đó phải có 8–15 chữ số. Mọi API tiếp nhận và tra trùng dùng cùng hàm chuẩn hoá.
- Webhook intake trùng số trả lead cũ (`created: false`), không ghi đè tên, email, consent, nguồn, điểm hoặc sale; nếu có `note` thì ghi thêm `NOTE_ADDED` cho lead cũ. Tin nhắn khách không được tính là sale đã phản hồi. Lead `LOST` quay lại mở `CONSULTING`, xoá lý do đóng và link duyệt cũ, đặt lại hạn; giữ sale cũ nếu còn nhận khách, ngược lại chia lại. Khách chưa đóng vẫn giữ sale cũ kể cả sale đang tắt nhận khách mới.
- Nhập tay trùng số trả 409 kèm `leadId` và `assignedUserId`, không sửa hay mở lại lead cũ. `lookup` trả tên và chủ để giao diện mời mở hồ sơ cũ.
- Chỉ quản lý chuyển chủ; chọn lại cùng người không gia hạn. Chuyển chủ đặt lại hạn phản hồi và `firstResponseAt`. Sale phụ trách hoặc quản lý được ghi chú; ghi chú đầu tiên, duyệt/đổi lịch/đóng lead thành công ghi nhận phản hồi đầu tiên. Callback `NEW -> CONFIRMED` và các sự kiện nhân viên `APPROVED`, `RESCHEDULE_REQUESTED`, `VIEWING_RESCHEDULED` từ n8n cũng ghi nhận thời điểm này trong cùng transaction. Ghi chú/sự kiện sau không đè thời điểm cũ; AI, nhắc lịch và timeout không được tính là phản hồi.
- Hạn phản hồi cộng hai giờ trong 08:00–21:00 hằng ngày, theo UTC+7: 09:00 → 11:00; 20:00 → 09:00 hôm sau; 23:00 → 10:00 hôm sau. Task FE-38 sẽ dùng dữ liệu này để gửi cảnh báo, FE-33 chưa đổi lịch nhắc của luồng 2.
- Nhật ký mới: `LEAD_CREATED`, `LEAD_ASSIGNED`, `LEAD_REASSIGNED`, `LEAD_REOPENED`, `NOTE_ADDED`, `RESPONSE_OVERDUE`; có `actorUserId` khi thao tác từ tài khoản. `chat_logs.lead_id` đã có cột nullable cho FE-36 gắn hội thoại.

## Hợp đồng API

Các đường dẫn dưới đây có tiền tố `/api`. Ngày giờ trả ISO UTC; số tiền bigint có thể trả chuỗi. `POST /leads/intake` cần secret; không mở tra cứu số điện thoại công khai.

| API | Xác thực | Nội dung/kết quả |
|---|---|---|
| `POST /leads` | JWT | Nhập tay. Trả `{ lead, created: true, reopened: false }`; trùng trả 409 |
| `POST /leads/intake` | `X-Webhook-Secret` | Cửa nhận cho bot/kênh hệ thống; chia sale tự động, bỏ qua `assignedUserId` do kênh gửi. Trả `{ lead, created, reopened }` |
| `GET /leads/lookup?phone=...` | JWT | `{ lead: { id, name, status, assignedUserId, assignedUserName } }` hoặc `{ lead: null }` |
| `PUT /leads/:id/assignee` | JWT quản lý | `{ assignedUserId, note? }`, trả lead |
| `POST /leads/:id/notes` | JWT chủ hoặc quản lý | `{ note }` tối đa 5000 ký tự, trả sự kiện `NOTE_ADDED` |
| `GET /users/assignees` | JWT | Mảng `{ id, name, role, acceptingLeads }`, không trả password/push token |
| `PUT /users/:id/routing` | JWT chính mình hoặc quản lý | `{ acceptingLeads?, telegramChatId? }`; `telegramChatId: null` để xoá |
| `GET /leads/:id` | JWT | Thêm `assignedUser` (id, tên, email, vai trò, Telegram cá nhân, trạng thái nhận khách); `otherBookings` tra số điện thoại thay email |

Body tạo khách dùng chung:

```json
{
  "name": "Nguyễn Bình",
  "phone": "+84 901 234 567",
  "source": "hotline",
  "email": "binh@example.com",
  "budget": 3000000000,
  "needs": "Cần nhà gần trường",
  "assignedUserId": 2,
  "interestedPropertyIds": [1, 2],
  "consentMarketing": false,
  "note": "Khách gọi hỏi giá"
}
```

Chỉ `name`, `phone`, `source` bắt buộc. Không biết email/ngân sách thì bỏ trường. Căn quan tâm phải tồn tại. Mã nguồn nhập tay dùng `hotline`, `property_sign`, `walk_in`, `personal_zalo`, `referral`, `other`; bot dùng `telegram`; web giữ UTM hoặc `direct`. Hệ thống vẫn nhận nguồn mới để không loại UTM đang dùng.

Web đã có kiểu và hàm `createLead`, `lookupLeadByPhone`, `reassignLead`, `addLeadNote`, `getAssignees`, `updateUserRouting` trong `web/src/lib/api.ts`. Chưa thêm form hay công tắc giao diện (FE-37/39).

## Ranh giới với FE-34/35/36/38

- **Đặt lịch (cập nhật FE-34):** endpoint cũ `POST /viewings` dùng chung intake với tuỳ chọn `booking`. Khách mới hoặc khách cũ (cùng số điện thoại) có buổi xem mới gắn vào lead hiện có, giữ sale, nguồn, consent và bổ sung email/ngân sách/nhu cầu còn thiếu; lead về `NEW` và chạy luồng đặt lịch hiện tại. Mỗi khách tối đa **một buổi xem đang mở**: đang có buổi mở thì 409 kèm giờ buổi đó; lead `DEPOSIT`/`SIGNED` thì 409 "Bạn đang làm hợp đồng đặt cọc…"; lead `LOST` được mở lại. Hai yêu cầu đồng thời chỉ lưu một buổi. Quy tắc đầy đủ: [02-dat-lich-den-dat-coc.md](nghiep-vu/02-dat-lich-den-dat-coc.md) mục 1.4. Nhiều buổi xem mở cùng lúc và callback theo buổi xem vẫn chờ FE-35 và FE-38.
- `POST /leads/intake` mới lưu khách và nhật ký, chưa tự gọi workflow chấm điểm/đồng bộ Mautic. Các task nối workflow cần kiểm tra `created` để không chấm lại khi khách quay lại; lead mới giữ `automationStatus=PENDING` tới khi có callback. Không tự bật đồng bộ khách không email trong FE-33 (FE-40 còn chờ chốt).
- FE-36 gắn chat vào cột `leadId` mới; chưa có endpoint gắn/đọc chat theo lead trong FE-33.
- FE-38 phát cảnh báo theo `responseDueAt` và `firstResponseAt`, thay mốc ba ngày. FE-33 chỉ cung cấp dữ liệu, hàm tính và loại sự kiện.
- Dữ liệu cũ trùng số: chọn lead id nhỏ nhất để nhận lại yêu cầu; không gộp/xoá lịch sử. Lead cũ chưa có chủ có thể được quản lý chuyển chủ hoặc được gán khi intake gặp lại. Các lead cũ khác không tự bị đổi chủ/hạn.

## Triển khai sau khi được duyệt

1. Sao lưu database; thử trên bản sao trước. Có ít nhất một tài khoản quản lý; kiểm tra sale đang nhận khách.
2. Chạy `backend/sql/fe-33-intake.sql` bằng tài khoản sở hữu bảng, với `ON_ERROR_STOP=1`, trước khi khởi động backend mới. SQL chạy lặp được, nới email/ngân sách thành nullable, thêm cột, backfill số hợp lệ và in danh sách trùng. Không ghi số điện thoại thật vào log công khai.
3. Build/deploy backend và web cùng bản (repo hiện bật TypeORM synchronize). Không cần biến `.env` hay credential mới. Chưa import n8n trong task này.
4. Kiểm tra tạo khách mới, lookup nhiều định dạng số, nhập tay trùng 409, gán/chuyển sale, ghi chú và quyền truy cập. Khách mới và hồ sơ tư vấn chưa có buổi xem đặt lịch qua workflow cũ; các lịch tiếp theo nhận thông báo chuyển tiếp ở trên. Kiểm tra callback duyệt/đổi lịch ghi `firstResponseAt` và note gửi lại qua intake không bị mất.
5. Không rollback code cũ trên database đã nhận khách email/ngân sách null: ORM cũ có thể đặt lại NOT NULL và thất bại. Phục hồi bản sao lưu hoặc làm bản sửa tương thích thay vì hạ code trực tiếp.

## Kiểm thử local

Backend: `npm run lint`, `npm run build`, `npm test` (Node >=24.9). Test thường bỏ qua bộ PostgreSQL nếu chưa bật biến riêng.

Bộ integration dùng database tạm **chỉ** ở `127.0.0.1:55433/fe33_test`, không đọc `.env` của dự án:

```powershell
docker run --rm -d --name realestate-fe33-test -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=fe33_test -p 127.0.0.1:55433:5432 pgvector/pgvector:pg16
# Trong backend/, sau khi PostgreSQL sẵn sàng:
$env:FE33_TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55433/fe33_test'
npm test
Remove-Item Env:FE33_TEST_DATABASE_URL
docker stop realestate-fe33-test
```

Test kiểm tra chia 12 khách đồng thời, 12 yêu cầu cùng số, khách cũ chưa backfill, SQL chạy lặp, mở lại khách đóng, fallback quản lý, phân quyền, nhật ký, thời điểm phản hồi, rollback và endpoint đặt lịch cũ dùng chung intake. Các ca hồi quy bổ sung: ghi chú của khách quay lại (cả lead đang mở và LOST), callback duyệt/đổi giờ n8n, bỏ qua sự kiện tự động khi tính phản hồi, hồ sơ tư vấn đặt buổi đầu, hai yêu cầu đặt buổi đầu đồng thời, rollback hồ sơ tư vấn khi lưu lịch thất bại. Web chạy lint, TypeScript và build; giao diện form và workflow thật được nghiệm thu trong các task tích hợp tương ứng.

Kết quả local 10/11/2026 sau sửa lỗi: backend lint/build đạt; **85/85 test đạt** (gồm HTTP qua guard/validation, PostgreSQL thật và các ca hồi quy). Script báo cáo FE-23 trên nền `dev` mới cũng đạt. Web lint và TypeScript đạt; production build đạt với `npm run build -- --webpack` (20 trang prerender). Build trong sandbox ban đầu bị chặn tạo thư mục `.next`, chạy ngoài sandbox đã đạt. Database kiểm thử nằm trong container tạm riêng, không dùng dữ liệu của stack đang chạy. Chưa smoke test trên server hoặc bật workflow mới.
