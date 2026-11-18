# Design

## Context

Quy tắc nghiệp vụ đã chốt ở `docs/nghiep-vu/01-visits.md` mục 1.6 (DC-15, DC-16, Hậu duyệt). Hiện chỉ có `assertNoBookingConflict` theo căn (`booking-rules.ts`, 60 phút, khoá `pg_advisory_xact_lock(1001, propertyId)`). Chia sale nằm ở `LeadIntakeService.chooseOwner` (khoá toàn cục `ASSIGNMENT_LOCK_SQL` = `(1002, 0)`, người có `last_assigned_at` cũ nhất nhận trước).

Buổi xem mới được tạo ở hai chỗ: `ViewingsService.create` (web và bot, đi qua `intake.receive`) và `FeedbackWorkService.record` với kết quả `NEXT_VIEWING`. Giờ đổi ở `ViewingsService.reschedule`, dùng chung cho sửa giờ và hẹn lại sau khi khách không đến. Duyệt lịch đi qua `LeadsService.approve` (web admin) và `ViewingsService.confirmStaffLink` (nút trong thông báo), cả hai gọi n8n luồng 1b. Chuyển sale ở `LeadIntakeService.reassign`.

Phần backend này thuộc cả hai người giữ: `viewings.service.ts` của Hoàng, ba file còn lại của Hậu, nên Hậu duyệt PR.

## Goals / Non-Goals

**Goals:**
- Một nơi duy nhất định nghĩa "sale bận lúc T" và dùng cho mọi đường vào.
- Không thêm cột, trạng thái hay loại sự kiện (không SQL, không chờ FE-43).
- Hai thao tác đồng thời không cùng lọt qua phép kiểm tra.

**Non-Goals:**
- Không gạch khung giờ trên form đặt lịch theo lịch của sale (khách mới chưa có sale lúc chọn giờ).
- Không đổi quy tắc 60 phút theo căn, không đổi `getSlots`.
- Không có nút "bỏ qua cảnh báo" cho quản lý. Muốn xếp lịch thì đổi giờ hoặc chuyển sale.
- Không tính thời gian di chuyển thực tế giữa hai căn; 90 phút là hằng số.

## Decisions

### D1. Một hàm kiểm tra trong `booking-rules.ts`
Thêm `SALE_GAP_MINUTES = 90`, `findSaleConflict(em, saleId, time, { propertyId, excludeViewingId })` trả buổi xem gây bận (hoặc null) và `assertSaleFree(...)` ném `ConflictException` với thông báo của spec. Câu SQL tính trên các buổi xem của lead có `assigned_user_id = saleId`, `viewings.property_id <> propertyId`, `abs(chênh giờ) < 90 phút`, bỏ `excludeViewingId`:
- Buổi `ATTENDED` tính luôn, không xét trạng thái lead (bận theo giờ hẹn).
- Buổi `NEW` chỉ tính khi lead đang `NEW` hoặc `CONFIRMED`, cùng điều kiện "lịch đang chờ" của `assertNoBookingConflict`, để lead đã `LOST` (ví dụ `EXPIRED`) không giữ chỗ.
- `CANCELLED` và `NO_SHOW` không tính.

Thông báo cần tên sale, tên căn (`properties.name`) và giờ theo giờ Việt Nam (dùng lại `fmt`); `findSaleConflict` join `users` và `properties`.

Loại `property_id = $propertyId` ra khỏi phép kiểm tra là cố ý: cùng căn đã có luật 60 phút riêng. Vì vậy hai buổi cùng căn cách nhau 60 đến 89 phút không bị luật theo sale chặn.

### D2. Khoá theo sale, đặt cuối thứ tự khoá
Thêm `SALE_LOCK_NAMESPACE = 1003` và `lockSale(em, saleId)` (`pg_advisory_xact_lock(1003, saleId)`). Thứ tự khoá toàn hệ thống: căn (1001) → chia sale (1002) → lead (`FOR UPDATE`) → sale (1003). Khoá sale luôn lấy cuối, nên không tạo vòng chờ với các đường đang có.

| Đường | Khoá sale lấy khi nào |
|---|---|
| `reschedule`, `NEXT_VIEWING` | Sau khi khoá lead, trước khi kiểm tra, trên sale phụ trách lead |
| `reassign` | Sau khi khoá lead, trên sale mới |
| Chia sale lúc đặt lịch | Trong vòng lặp chọn sale: khoá từng ứng viên rồi mới kiểm tra bận |

Lý do chia sale cũng phải khoá sale: khoá `(1002, 0)` chỉ tuần tự hoá các lượt đặt lịch với nhau, không chặn một lượt đổi giờ đang chạy song song dời buổi xem của chính sale đó vào đúng giờ.

*Phương án khác:* dùng một khoá toàn cục cho mọi thao tác lịch. Đơn giản hơn nhưng làm đặt lịch của khách chờ cả lượt đổi giờ không liên quan; số lượng sale nhỏ nên khoá theo sale rẻ và đúng.

### D3. Chia sale: lặp ứng viên theo thứ tự lượt, bỏ qua sale bận
`chooseOwner(em, requestedId?, slot?)` nhận thêm `slot = { time, propertyId }`. Khi không có `requestedId` và có `slot`, lấy danh sách sale đang nhận khách theo thứ tự `lastAssignedAt ASC NULLS FIRST, id ASC` và chọn người đầu tiên không bận (D2). Chỉ người được chọn mới được cập nhật `lastAssignedAt`, nên sale bị bỏ qua giữ lượt. Không ai rảnh thì lấy người đầu danh sách như cũ; không có sale nào thì quản lý như cũ.

`IntakeOptions` thêm `slot`. `ViewingsService.create` truyền `{ time: viewingDate, propertyId }`. Đường nhập tay, mở lại lead khi không có giờ, và `requestedId` rõ ràng không truyền `slot` nên chia như cũ. Khách cũ còn sale nhận khách giữ nguyên sale (quy tắc đã có).

### D4. Duyệt: kiểm tra chỉ đọc, không khoá
Duyệt không đổi giờ hay chủ lead nên không thay đổi tập buổi xem của sale; không cần khoá. Kiểm tra đặt ở backend **trước** khi gọi n8n, ở hai chỗ: `LeadsService.approve` và nhánh `approve` của `ViewingsService.confirmStaffLink` (qua một hàm dùng chung nhận `viewingId`). Callback `PUT /leads/:id/status` của luồng 1b không kiểm lại vì đã qua cửa trên. Buổi xem được duyệt luôn là buổi `NEW` mới nhất của lead và được loại khỏi phép kiểm tra.

Đổi giờ, hẹn lại, `NEXT_VIEWING` thì gọi `assertSaleFree` trong transaction đã khoá (D2), sau `assertNoBookingConflict`, để thông báo trùng căn (cụ thể hơn) hiện trước.

### D5. Chuyển sale: kiểm tra mọi buổi xem mở của lead
Trong `reassign`, sau khi khoá lead và trước `setOwner`, lấy các buổi xem `NEW` của lead (lead đang `NEW` hoặc `CONFIRMED`) và kiểm tra sale mới với từng buổi, loại chính buổi đó. Chuyển cho chính người đang phụ trách vẫn trả sớm như cũ. Ném 409 với thông báo riêng của chuyển sale ("chọn sale khác hoặc đổi giờ trước"), nên `assertSaleFree` nhận tham số `context: 'approve' | 'reassign'` chọn câu chữ.

### D6. Web không đổi màn hình
Backend trả 409 với `message`; các trang duyệt (`/duyet/<mã>`), Lịch xem, Chi tiết lead và Đội sale đã hiển thị `message` của lỗi. Việc phải làm ở web chỉ là kiểm chứng (task 6), không thêm UI.

## Risks / Trade-offs

- [Lead đã `LOST` còn buổi `NEW` bị bỏ khỏi phép tính, nhưng sale vẫn có thể thực sự phải đi xem] → Cùng định nghĩa "đang chờ" với luật theo căn; lead `LOST` đã được quy trình đóng buổi xem. Ghi trong test.
- [Chia sale lặp nhiều ứng viên, mỗi người một lần khoá và một câu SQL] → Số sale nhỏ (vài chục); khoá chỉ giữ trong transaction đặt lịch.
- [Sale bận mà lead đã `NEW` từ trước khi FE-53 chạy sẽ bị chặn lúc duyệt] → Đúng ý: lỗi lộ ở bước duyệt thay vì ngày xem. Thông báo nêu cách xử lý (đổi giờ hoặc chuyển sale).
- [Quản lý không có cách ép xếp lịch trùng] → Cố ý (Non-Goals); nếu cần, thêm sau bằng task riêng.
- [Hằng 90 phút chung cho mọi cặp căn] → Chấp nhận; khoảng cách thật giữa các căn tại Đà Nẵng đều dưới 30 phút di chuyển.

## Migration Plan

Không có SQL, không có cột mới. Triển khai bằng release thường; rollback là chạy lại image cũ. Không cần import lại luồng n8n.

Sau khi triển khai: lead đang `NEW` mà sale bận sẽ bị chặn ở lần duyệt kế tiếp; quản lý xử lý bằng đổi giờ hoặc chuyển sale. Kiểm trước trên VPS bằng một câu SELECT chỉ đọc (xem task 7.2).
