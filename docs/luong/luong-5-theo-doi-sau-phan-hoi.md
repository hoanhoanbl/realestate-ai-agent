# L5 phụ trợ: Theo dõi sau phản hồi

File `n8n-workflows/luong-5-theo-doi-phan-hoi.json`, ID repo `feedbackWorkNotifications`. Kích hoạt bởi Execute Workflow từ L2/L5; có node `Chạy tay` để test, không có webhook/schedule riêng. Bản code local ngày 12/11/2026, nhánh `feature/l5-theo-doi-sau-phan-hoi`. Chưa push hoặc triển khai server. Backend local đã được rebuild ngày 13/11 để bổ sung API L5; web local chưa rebuild trong lần sửa API này.

## 1. Làm gì trong thực tế

Giao thông báo việc mới, nhắc sale khi chưa xử lý tới hạn, báo quản lý khi quá hạn tiếp. Backend tạo việc cùng lúc khách nộp phản hồi; AI chỉ hỗ trợ tóm tắt. Quy tắc nguồn duy nhất: [nghiệp vụ chăm sóc mục 1.1](../nghiep-vu/03-cham-soc-va-marketing.md#11-theo-dõi-sau-khi-khách-đã-phản-hồi-l5). Gợi ý căn thay thế chưa được chốt; không nằm trong code đợt này.

## 2. Ai tham gia

Sale đang phụ trách, quản lý, backend, PostgreSQL và workflow [Thông báo nhân viên](thong-bao-nhan-vien.md). Khách không nhận thư từ worker này.

## 3. Từng bước

1. `Khi được gọi` hoặc `Chạy tay` -> `Cấu hình` -> `Lấy việc đến hạn` (backend lựa chọn và loại checkpoint đã gửi).
2. `Từng việc` chạy batch 1 -> `Bắt đầu thông báo`. Backend kiểm tra lại chủ khách/hạn/phiên bản và tạo checkpoint STARTED trước khi gửi.
3. `Được gửi?` false: bỏ qua, quay vòng. True: `Chuẩn bị người nhận`.
4. NEW/REMIND dùng `assigneeId` hiện tại, ESCALATE dùng `emailTo` quản lý. `Thông báo nhân viên` gọi workflow dùng chung.
5. `Kiểm tra giao thông báo`: ít nhất một kênh được xác nhận; riêng báo quản lý cần emailSent=true.
6. `Xác nhận đã gửi` lưu SENT; gửi lỗi hoặc không kênh nào xác nhận -> `Giữ lại để đối soát` lưu REVIEW. Nếu ghi checkpoint lỗi, lần STARTED hết lease sẽ cần đối soát, không tự gửi lại.
7. Tiếp tục việc kế tiếp -> `Kết thúc`. Không có việc thì HTTP trả mảng rỗng và lần chạy kết thúc bình thường.

Mỗi lỗi trước khi nhận được alertId có thể quét lại; lỗi sau khi cấp alertId phải đi qua checkpoint. L2 gọi nhánh này độc lập từ `Cấu hình` bên cạnh chín tác vụ cũ. L5 thay node email sale chung bằng Execute Workflow `Nhắc việc sau phản hồi`, sau khi lưu AI; không cần AI thành công để L2 tìm thấy việc.

## 4. Nối với hệ thống

| Thành phần | Tệp/endpoint |
|---|---|
| Backend nhận phản hồi | `backend/src/feedback/feedback.service.ts`: transaction lưu phản hồi + FEEDBACK_RECEIVED + việc |
| Nghiệp vụ việc, phân quyền, thông báo | `backend/src/feedback/feedback-work.service.ts` |
| Schema bổ sung | `backend/sql/l5-feedback-work.sql` (idempotent, không sửa/backfill dữ liệu cũ) |
| Backend cho n8n | GET `/api/feedback-work/alerts/due`, POST `/alerts/start`, POST `/alerts/{id}/finish`, GET `/context/{feedbackId}`; tất cả có X-Webhook-Secret |
| Giao diện | `/admin/theo-doi-phan-hoi`, phần Theo dõi sau phản hồi trong `/admin/leads/{id}` |
| Sale ghi kết quả | POST `/api/feedback-work/{id}/result`, JWT chủ khách/quản lý |
| Quản lý đối soát | GET `/api/feedback-work/alerts/review`, POST `/alerts/{id}/resolve`, JWT MANAGER |

Hợp đồng chi tiết: [API mục 8](../api-contract.md#8-l5-theo-dõi-sau-phản-hồi). Không gộp các trạng thái việc vào `followup_tasks` của L2, vì đó là checkpoint giao dịch tự động khác.

## 5. Khi lỗi thì sao

- n8n/Gemini ngừng: phản hồi và việc vẫn lưu; sale xem trên web. L2 chạy lại sẽ lấy việc đủ điều kiện.
- STARTED/SENT/REVIEW là checkpoint giao thông báo, khác trạng thái PENDING/IN_PROGRESS/COMPLETED của việc sale.
- Mất phản hồi từ kênh gửi: dừng tự gửi lại, quản lý mở “Thông báo cần đối soát” ở trang theo dõi. Kiểm tra provider rồi ghi bằng chứng: đã gửi -> SENT; chắc chắn chưa gửi -> cho phép thử lại nếu việc/hạn/chủ vẫn hợp lệ.
- Lưu kết quả cùng phiên bản từ hai trình duyệt: một bên 409, tải lại để xem người kia đã ghi gì.
- Lịch xem không tạo được vì trùng/không còn mở bán: rollback cả kết quả lẫn lịch sử; sale chọn lại. Gọi L1 lỗi sau commit: giữ lịch thật, lead automation FAILED để duyệt từ admin, không tạo lịch thứ hai để thử lại.
- Đổi sale/đóng việc sau khi request đã bắt đầu gửi ra ngoài không thu hồi được request đó. Trước khi bắt đầu, backend luôn kiểm tra lại điều kiện.

## 6. Triển khai lên server

**Chưa kiểm trên server.** Không tự publish hoặc gửi email thật trong đợt phát triển này.

Thứ tự bàn giao cho bạn làm n8n:

1. Đưa backend mới lên trước. TypeORM hiện bật synchronize; với quy trình migration riêng, chạy `backend/sql/l5-feedback-work.sql` trước. Web/backend phải cùng phiên bản. Không tạo lại database hoặc volume.
2. Import `luong-5-theo-doi-phan-hoi.json` thành workflow phụ trợ trong cùng project với L2/L5 và Thông báo nhân viên.
3. Trong worker, chọn đúng workflow đích ở node `Thông báo nhân viên`. Sửa `Cấu hình`: backendUrl mà n8n truy cập được, WEBHOOK_SECRET trùng backend, managerEmail thật, PUBLIC_WEB_URL thật. Chưa có người phụ trách dùng managerEmail cấu hình bên workflow Thông báo nhân viên; phải kiểm tra cả hai nơi. Không giữ email demo.
4. **Publish workflow Thông báo nhân viên và workflow phụ trợ.** n8n 2.42.4 từ chối Execute Workflow khi workflow con chưa publish (“Workflow is not active and cannot be executed”). Chỉ Save không đủ.
5. Import/cập nhật L2 và L5, ánh xạ cả hai node `Nhắc việc sau phản hồi` sang ID worker vừa import. L5 `Lấy cảm nhận` mới là HTTP, chọn Header Auth cùng `Lưu kết quả AI`. L2 cũ vẫn có credential Postgres/Mautic/SMTP riêng; không thay chúng bằng credential test.
6. L5 giữ Gemini và hai SMTP node cảm ơn/cảnh báo. Test ban đầu disable/thay SMTP và các kênh thông báo bằng mock. Kiểm tra không có lời gọi nhà cung cấp thật rồi mới chạy thử.
7. Nghiệm thu test xong mới publish L2/L5 trên môi trường đích theo quy trình nhóm. L2 quét mỗi giờ; worker không cần schedule riêng.
8. Không backfill phản hồi cũ. Nếu muốn chăm sóc lại dữ liệu trước ngày triển khai, thống nhất phạm vi/hạn với nhóm trước để không phát nhắc hàng loạt.

Cấu hình worker trong repo dùng `$env` giống L2. Nếu n8n chặn truy cập env trong node, dùng giá trị môi trường được quản trị viên cấu hình hoặc Header Auth credential tương ứng; không ghi secret thật vào JSON để commit.

## 7. Cách chạy thử

### Kiểm thử tự động, không gửi tin thật

Từ thư mục dự án, cần Docker, Node >=24.9 và dependency đã cài:

```powershell
docker run --rm -d --name realestate-l5-test-db -p 127.0.0.1:55433:5432 -e POSTGRES_PASSWORD=local-test-only -e POSTGRES_DB=fe33_test postgres:16
$env:FE33_TEST_DATABASE_URL='postgres://postgres:local-test-only@127.0.0.1:55433/fe33_test'
Push-Location backend
npm run lint
npm run build
npm test
Pop-Location
node scripts/check-feedback-work.cjs
node scripts/check-feedback-work-runtime.cjs
Push-Location web
npm run lint
npm run build
Pop-Location
docker stop realestate-l5-test-db
Remove-Item Env:FE33_TEST_DATABASE_URL
```

Nếu tên container/cổng đã dùng, kiểm tra trước; không xóa container hoặc volume đang phục vụ demo. Bộ test chỉ chấp nhận localhost:55433/fe33_test. Integration test có TRUNCATE trên DB test; không đổi URL sang DB ứng dụng. Runtime dùng schema riêng `l5_runtime_test`, container `realestate-l5-test-engine`, mock workflow giao tin và dọn tài nguyên test khi xong. Không cần credential SMTP/Gemini thật.

### Test bằng giao diện sau khi cập nhật stack local và import workflow

1. Đăng nhập sale đang phụ trách. Với một khách có buổi xem ATTENDED và link cảm nhận mới chưa gửi, nộp phản hồi từ trang khách. Trong hồ sơ và menu Theo dõi phản hồi phải có đúng một việc; hạn đầu là +2 giờ làm việc.
2. Chọn Đã liên hệ, để chưa hoàn tất: bắt buộc chọn hạn tương lai. Hoặc chọn Cần thêm thời gian/Chưa liên hệ được: ghi lý do + hạn. Xem lịch sử phải có người, giờ, kết quả và hạn mới.
3. Đã liên hệ + tick hoàn tất: việc vào bộ lọc Đã hoàn tất, worker không gửi tiếp.
4. Hẹn xem tiếp: chọn căn đang bán và giờ. Lưu phải có viewing NEW thật trong lịch sử xem, lead NEW chờ duyệt. Thử căn bị giữ cọc, giờ trùng, khách đã có lịch mở: API từ chối và việc không bị hoàn tất.
5. Không mua: khi không còn hợp đồng hiệu lực, lead LOST/NOT_INTERESTED và lịch chờ bị hủy. Khi còn hợp đồng/DEPOSIT, API từ chối và giữ nguyên dữ liệu.
6. Mở cùng việc ở hai trình duyệt, lưu lần lượt: lần thứ hai dùng phiên bản cũ phải 409. Đổi sale: người cũ không sửa được, người mới thấy việc với hạn giữ nguyên.
7. Để test nhắc/quản lý nhanh, dùng DB test hoặc chế độ preview ở dưới; không sửa hạn của khách demo thật. Với mock đã publish, bấm `Chạy tay` trong worker: kiểm tra NEW, REMIND, ESCALATE. Chạy lại không gửi trùng. Thiếu email khách vẫn có việc.
8. Giả lập kênh trả lỗi/không xác nhận: checkpoint REVIEW. Quản lý đối soát, ghi lý do và cho phép thử lại khi provider xác nhận chưa giao.

### Kết quả kiểm thử của đợt phát triển

Đã chạy ngày 12/11/2026:

- Backend lint/build PASS. Toàn bộ **17 suites, 201 tests PASS**, gồm 25 ca mới cho quyết định nghiệp vụ, transaction/HTTP/ownership, rollback, tạo lịch, hợp đồng còn hiệu lực và tranh chấp tạo hợp đồng với kết quả chăm sóc.
- Web lint và production build Turbopack PASS (25 routes). Cache build cũ từng làm tiến trình CSS dừng; build sạch đã qua, không sửa cấu hình Next/Tailwind.
- `check-feedback-work.cjs`, `check-followup-workflow.cjs`, `check-mautic-privacy.cjs`, `check-followup-report.cjs` PASS; parse đủ 13 workflow JSON.
- Runtime n8n 2.42.4 thật -> Nest thật -> PostgreSQL test: NEW/REMIND/ESCALATE đúng người nhận; 3 mốc xác nhận SENT, 2 trường hợp lỗi/không xác nhận giữ REVIEW; chạy lại không giao trùng; việc hoàn tất không được gửi. Migration chạy hai lần và không lệch entity sau synchronize.
- Kiểm tra trình duyệt bằng API và dữ liệu giả: danh sách/bộ lọc, mở biểu mẫu, lưu Đã liên hệ + hoàn tất và mở lịch sử đúng người/thời gian. Hạn hẹn lại và lịch xem được kiểm bằng integration API; chưa nghiệm thu chọn ngày trên mọi trình duyệt/thiết bị.
- Runtime CLI test dùng `N8N_USE_WORKFLOW_PUBLICATION_SERVICE=false` **chỉ trong container tạm**: CLI publish của image này ghi activeVersion theo cơ chế cũ; không đổi biến này ở n8n local/server thật. Khi triển khai, publish từ giao diện n8n và xác minh gọi workflow con.

Không coi test mock là nghiệm thu giao thư thật. Ngày 13/11 đã rebuild backend local để xử lý 404 của node Lấy việc đến hạn; API gọi từ n8n trả HTTP 200, 0 việc. Giữ lại API báo cáo L4 từ nhánh local `feature/l4-sale-va-can-nha` để không làm mất chức năng đã chạy trước đó; endpoint breakdowns trả 201/version=1. Web local chưa rebuild trong lần sửa này. Người dùng tự import/publish workflow; chưa nghiệm thu giao thông báo thật hoặc kiểm trên server. SMTP/Telegram/push thật và campaign Mautic không thuộc nghiệm thu local này. Code giữ local, không commit/push; dữ liệu demo và thư mục `output/` không nằm trong phần phát hành.

Có thể xem UI giả riêng bằng `node scripts/check-feedback-work-runtime.cjs --preview-only` (sau khi đặt FE33_TEST_DATABASE_URL như trên), chạy web dev ở cổng khác với NEXT_PUBLIC_API_URL=http://localhost:18095/api, đăng nhập manager@example.invalid / demo. POST `http://localhost:18095/api/test-stop-preview` để dọn schema preview. Đây là API test, không đưa endpoint giả vào backend sản phẩm.


### Xử lý 404 ở Lấy việc đến hạn (13/11)

Nguyên nhân thực tế: backend container còn bản cũ, không có `/api/feedback-work/alerts/due`; URL workflow đúng. Đã sao lưu database trước khi bổ sung schema, rebuild bằng `docker compose up -d --build --no-deps backend`, không thay/xóa volume database. Bản sao lưu local nằm ngoài repo, trong thư mục Temp của người dùng.

Sau rebuild, gọi từ container n8n với X-Webhook-Secret trả 200 và mảng rỗng. Mảng rỗng là chưa có việc hợp lệ, không phải lỗi. Phản hồi cũ không được backfill; muốn test tạo việc cần nộp một phản hồi mới. Khi test kết nối, chỉ Execute step Lấy việc đến hạn; không cần chạy qua các node giao thông báo. Không sửa WEBHOOK_SECRET hoặc bỏ guard để xử lý 404.

Nhánh L5 đang giữ cả phần backend L4 đã làm ở nhánh riêng nhằm tương thích stack local; khi mở PR cần đối chiếu/merge nhánh L4 trước để tránh đưa lại phần thay đổi đã có. Không tự push.

Regression sau khi giữ tương thích L4 ngày 13/11: backend lint/build PASS; 19 suites, 211 tests PASS trên PostgreSQL tạm riêng. Container test đã dọn, không gửi thông báo thật.
