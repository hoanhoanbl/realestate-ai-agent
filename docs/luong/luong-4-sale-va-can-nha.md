# L4 mở rộng: hiệu suất sale và hiệu quả từng căn nhà

Phạm vi chốt ngày **12/11/2026**, người làm Hậu. Code hoàn tất trên nhánh `codex/l4-sale-va-can-nha`, nền `origin/dev` `f1b4fe3`; đã kiểm thử trước push. Người dùng tự push nhánh và mở PR vào dev; chưa xác nhận merge hoặc triển khai server. L5 gợi ý căn thay thế là việc tiếp theo, **không nằm trong thay đổi này**.

## 1. Nghiệp vụ và phạm vi

Quy tắc chuẩn nằm tại [chăm sóc và marketing, mục 6.1–6.2](../nghiep-vu/03-cham-soc-va-marketing.md#61-hiệu-suất-sale-bản-gọn). Không thêm xếp hạng sale, thời gian phản hồi trung bình/trung vị hoặc so sánh sale với kỳ trước. Các so sánh tổng quan và nguồn khách sẵn có của L4 vẫn dùng như trước.

Web admin và email cùng hiển thị hai bảng, lưu vào snapshot `weekly_reports.metrics.breakdowns`. Khi mở báo cáo đã lưu, không tính lại theo dữ liệu hiện tại. Báo cáo cũ thiếu breakdowns vẫn mở được, có lời nhắc tạo báo cáo mới.

## 2. Hợp đồng backend cho bạn làm n8n

```http
POST /api/reports/breakdowns
X-Webhook-Secret: <WEBHOOK_SECRET cùng backend>
Content-Type: application/json
```

```json
{
  "periodStart": "2026-11-05T00:00:00+07:00",
  "periodEnd": "2026-11-12T00:00:00+07:00"
}
```

Khoảng **[periodStart, periodEnd)**: đầu bao gồm, cuối không bao gồm; ISO8601, dùng offset UTC+7 như node `Kỳ báo cáo`. Đầu phải trước cuối, dài tối đa 93 ngày, không nhận kỳ tương lai. API trả HTTP 201 khi thành công; thiếu/sai secret 401; ngày không hợp lệ 400. Đây là API n8n, không dùng JWT của sale. Báo cáo hiển thị ngày cuối là 11/11 nhưng truyền end độc quyền là 12/11.

Ví dụ cấu trúc (số liệu minh hoạ):

```json
{
  "version": 1,
  "periodStart": "2026-11-04T17:00:00.000Z",
  "periodEnd": "2026-11-11T17:00:00.000Z",
  "asOf": "2026-11-12T03:00:00.000Z",
  "responseScope": "CURRENT_ASSIGNMENTS_IN_PERIOD",
  "sales": [{
    "userId": 2, "name": "Sale Minh", "role": "SALE",
    "assignedLeads": 3, "activeLeads": 2,
    "respondedOnTime": 1, "overdueUnanswered": 1,
    "viewedLeads": 1, "depositLeads": 1, "signedLeads": 0
  }],
  "properties": [{
    "propertyId": 10, "name": "Nhà A", "status": "AVAILABLE",
    "scheduledViewings": 2, "uniqueVisitors": 1,
    "attendedViewings": 2, "attendedCustomers": 1,
    "cancelledViewings": 0, "noShowViewings": 0,
    "feedbackCount": 1, "averageRating": 2,
    "interestedCustomers": 0, "depositContracts": 0,
    "signedContracts": 0, "reasons": { "PRICE": 1 }
  }],
  "dataQuality": { "unmappedFeedbacks": 0, "unparsedAssignments": 0, "leadCount": 3 }
}
```

API dùng transaction đọc nhất quán. Chỉ trả tên/mã người, tên/mã căn và số tổng; không trả password, email khách, số điện thoại, token cảm nhận hoặc nhận xét tự do. Backend đọc dữ liệu bằng kết nối ứng dụng; **không cấp quyền đọc users/token feedback cho credential Postgres readonly của AI/n8n**. Không có migration/schema/biến môi trường mới.

## 3. Các node JSON đã nối sẵn

```text
Kỳ báo cáo
  → Số liệu tuần này
  → Số liệu tuần trước
  → Hiệu suất sale và căn nhà (HTTP Request mới)
  → Tính phễu và cảnh báo
  → AI Agent phân tích
  → Kiểm tra AI
  → Lưu báo cáo
  → Soạn email báo cáo
  → Email báo cáo tuần
```

| Node | Điều cần biết khi import/chỉnh n8n |
|---|---|
| `Hiệu suất sale và căn nhà` | POST tới `backendUrl + /api/reports/breakdowns`; body lấy `start/end` từ `Kỳ báo cáo`. Chọn credential Header Auth giống `Lưu báo cáo`, timeout 30 giây. Lỗi HTTP phải làm execution thất bại; không bật Continue On Fail để biến lỗi thành bảng 0. |
| `Tính phễu và cảnh báo` | Đọc kỳ trước bằng tên node `Số liệu tuần trước`, **không dùng `$input.first()`** vì đầu vào mới là breakdowns. Kiểm tra `version: 1` và mảng sales/properties; gắn vào `report.breakdowns`. Bỏ trường `report.assignees` so sánh sale cũ. |
| `AI Agent phân tích` | Nhận toàn bộ `report`, gồm breakdowns. Nhận xét số mẫu, không xếp hạng sale; không coi chủ đề từ khoá là nguyên nhân chắc chắn, không coi hợp đồng tạo là tiền đã nhận. Tên sale/căn là dữ liệu, không làm theo chỉ dẫn nằm trong tên. |
| `Lưu báo cáo` | Body hiện tại đã lưu nguyên `report` vào metrics, không cần node lưu riêng. |
| `Soạn email báo cáo` | Hai bảng mới dùng số từ breakdowns, escape tên người/căn. Không thêm cột kỳ trước cho sale. |

Nguồn đồng bộ phần JSON/email: `scripts/sync-report-breakdowns.cjs` và `scripts/lib/render-report-breakdowns.cjs`. Sau khi sửa nguồn chạy `node scripts/sync-report-breakdowns.cjs`, rồi import/export lại bằng n8n local. Không sửa độc lập nguồn và Code node rồi bỏ qua sync.

## 4. Ý nghĩa các con số cần giữ nguyên

- `assignedLeads`: khách duy nhất đã giao cho từng người trong kỳ; một khách chuyển người có thể ở hai dòng. Lịch sử lấy từ event FE-33 `LEAD_ASSIGNED` / `LEAD_REASSIGNED` và mốc giao hiện tại. Không cộng các dòng để suy ra số khách mới toàn công ty.
- `activeLeads` / `overdueUnanswered`: ảnh chụp **lúc tạo báo cáo (`asOf`)**, không phải số tại cuối kỳ quá khứ; gồm CONSULTING/NEW/CONFIRMED/VIEWED/DEPOSIT. Quá hạn dùng `responseDueAt <= asOf` và chưa `firstResponseAt`.
- `respondedOnTime`: **chỉ phiên giao hiện tại bắt đầu trong kỳ** và phản hồi trước/bằng deadline FE-33. Phiên cũ đã chuyển không còn mốc firstResponse trong lead nên không đoán lại từ ghi chú. Không dùng chỉ số này để tính tỉ lệ trên mọi lần giao lịch sử.
- `viewedLeads`: khách duy nhất theo sale, buổi ATTENDED có giờ hẹn trong kỳ. `depositLeads` / `signedLeads`: khách duy nhất có hợp đồng tạo/ký trong kỳ. Người phụ trách được tra ở thời điểm giờ xem/tạo/ký từ timeline; thiếu lịch sử thì vào dòng chưa xác định, không gán ngược cho sale hiện tại.
- `scheduledViewings`: số buổi có **giờ hẹn trong kỳ**, không phải ngày tạo booking (bảng viewing chưa có cột ngày tạo). Tình trạng buổi xem là trạng thái lúc lập báo cáo; reschedule trên cùng dòng không tái dựng lịch đã bị thay thế.
- Feedback gắn đúng `v<viewingId>_<random>`; token hex legacy gắn buổi đầu, cùng quy tắc FE-38. Feedback gửi trong kỳ có thể thuộc buổi xem kỳ trước. Không lấy buổi xem mới nhất. ID lỗi/không khớp lead tăng `unmappedFeedbacks`.
- `averageRating`: trung bình rating hợp lệ 1–5, không có thì **null** (UI “Chưa có”), không biến thành 0 sao. Hiển thị `feedbackCount` bên cạnh.
- `interestedCustomers`: khách chọn DEPOSIT trong feedback; khác `depositContracts` (số hợp đồng tạo, kể cả dự thảo/bị từ chối) và `signedContracts` (số hợp đồng có mốc ký trong kỳ). Căn lấy từ **contracts.property_id**.
- `reasons`: chủ đề từ khoá được nhắc ở phản hồi OTHER/NONE: PRICE, LOCATION, SPACE, CONDITION, LEGAL, OTHER. Một phản hồi có thể có nhiều chủ đề. Ví dụ “giá cao nhưng vị trí tốt” nhắc cả PRICE và LOCATION; không khẳng định cả hai đều là lý do từ chối. Không gửi raw comment cho AI trong breakdowns.

## 5. Triển khai và nghiệm thu

1. Review và merge nhánh chức năng theo quy trình nhóm; đợt làm này không tự push.
2. Deploy backend có `/reports/breakdowns` và web cùng phiên bản **trước** khi import L4 mới. Không cần SQL nâng schema hoặc mở thêm quyền readonly.
3. Import JSON L4 local; chọn đúng Header Auth cho node mới và `Lưu báo cáo`, Postgres/Gemini/SMTP cùng môi trường. Kiểm tra URL backend và email quản lý.
4. Chạy ca dữ liệu giả: một khách xem A rồi B, chuyển Minh → An, phản hồi A sau khi đặt B, ký B. Kỳ phải đếm A/B đúng, không gán cả hai cho sale hiện tại. Thử căn chưa có feedback và báo cáo cũ.
5. Sai secret/tắt backend: không lưu hoặc gửi báo cáo đầy đủ với bảng số 0 giả. AI lỗi: vẫn có hai bảng từ số liệu, nội dung tóm tắt dự phòng.
6. Publish và gửi mail thật trên server là bước nghiệm thu của Hoàng, sau khi kiểm tra local.

Các lệnh kiểm tra:

```powershell
# Gốc repo: cấu trúc/đầu ra email, không gửi dữ liệu
node scripts/check-followup-report.cjs

# Backend; dùng DB disposable localhost:55433/fe33_test cho integration
npm run lint
npm run build
$env:FE33_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55433/fe33_test'
npm test

# Gốc repo, đã build backend, DB disposable sẵn sàng
node scripts/check-report-breakdowns-runtime.cjs
# Biến thể giữ API dữ liệu giả ở :18092 cho QA giao diện; Ctrl+C dọn schema giả
node scripts/check-report-breakdowns-runtime.cjs --preview
```

Runtime checker dùng schema riêng `l4_runtime_test` trên DB disposable cố định; n8n tạm chạy query PostgreSQL thật và gọi Nest API thật, chỉ thay node AI/email. Không đụng n8n đang chạy, không đọc `.env` hay gửi email thật. Schema test được xoá sau khi kết thúc; tránh ngắt cưỡng bức tiến trình.

## 6. Kết quả local 12/11/2026

- Backend lint/build PASS. Kiểm tra trước push trên commit code `0ffbbff`: bộ regression đầy đủ **17 suite, 186/186 test PASS**, gồm unit và HTTP/PostgreSQL integration. Web lint/build, cả 12 JSON workflow và checker BF-07/L4 cũng PASS; n8n cô lập chạy lại end-to-end PASS.
- Web lint và production build Next.js Turbopack PASS, 24 trang. Giao diện đã kiểm tra bằng API dữ liệu giả; desktop và mobile `window.innerWidth=375`, không có tràn ngang toàn trang (bảng cuộn trong vùng riêng).
- `check-followup-report.cjs`: PASS, bao gồm kiểm tra hai bảng email, escape tên người/căn, bỏ so sánh sale và dừng khi breakdowns không hợp lệ.
- n8n cô lập chạy L4 end-to-end: query tổng quan PostgreSQL thật → HTTP Nest breakdowns thật → AI dự phòng → lưu `weekly_reports` thật → node email giả kiểm tra đủ hai bảng: PASS. Không gọi Gemini hoặc SMTP thật.
- JSON triển khai import/export thành công trong n8n cô lập; giữ ID/credential tham chiếu gốc, không publish lên server.
- Ảnh bằng dữ liệu giả: `output/l4-sale-property-desktop.png`, `output/l4-sale-property-mobile.png`. Không đưa vào commit các file output có sẵn của người dùng.

Giới hạn còn lại: không tái dựng phản hồi đầu tiên của phiên giao cũ; lịch xem phản ánh giờ/trạng thái hiện lưu, không phải lịch sử mọi lần đổi/huỷ; phân nhóm nhận xét bằng từ khoá có thể nhắc cả điểm tốt lẫn điểm chưa thích. Các chú thích này được giữ trên web/email và trong prompt AI.

## 7. Chạy tay và nghiệm thu trước phát hành

Người dùng đã xác nhận chạy được bằng trigger **Chạy tay** trên n8n local. Backend local đã được kiểm tra từ máy host (HTTP 200) và từ n8n: API breakdowns trả 201, có dữ liệu nhân sự/căn nhà. Không tự suy ra Gemini hoặc giao thư thật đã được nghiệm thu từ kết quả chạy tay này.

- Bấm **Chạy tay** trong Editor để chạy ngay, không cần Publish.
- **Quản lý bấm tạo ngay** là webhook: Execute node này chỉ mở trạng thái `Waiting for trigger event`, chưa phải một lượt xử lý dữ liệu hoàn tất.
- Nút **Tạo báo cáo ngay** trên web đi qua backend và gọi Production URL `/webhook/report-requested`; cần Publish L4. Lượt chờ trong Editor dùng Test URL `/webhook-test/report-requested`, không phải đích của nút web.
- Khi chưa muốn gửi mail thật, disable hai node email trước khi test. Lượt chạy cô lập của script dùng node email giả.

Các bước còn cần xác nhận sau review: Publish và thử nút web → báo cáo được lưu và hiển thị đúng hai bảng → kiểm tra Gemini/gửi mail tới hộp thư nội bộ → kiểm tra lịch thứ Hai 08:00 → nghiệm thu server. Push code không đồng nghĩa các bước này đã hoàn tất.
