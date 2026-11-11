# FE-38 — Hạn phản hồi và báo cáo theo khách

Triển khai local trên nền `dev` có FE-33/FE-34, chưa phát hành server.

## Hành vi

- Luồng 2 bỏ nhắc duyệt sau ba ngày. Khi `responseDueAt` đã tới, `firstResponseAt` còn trống và lead còn ở CONSULTING/NEW/CONFIRMED/VIEWED, báo email quản lý. Không cần email khách, điểm AI hoặc buổi xem.
- Hạn hai giờ làm việc do FE-33 tính sẵn (08:00–21:00, UTC+7). Chuyển sale tạo phiên nhận khách mới; phiên cũ không được gửi nếu chưa bắt đầu. Một phiên chỉ có một cảnh báo thành công. Backend kiểm tra lại hạn, phản hồi và phiên ngay trước khi gửi.
- Dùng loại tác vụ STAFF_NUDGE cũ để giữ tương thích, nhưng sự kiện hoàn tất mới là RESPONSE_OVERDUE. Trong giao thức nội bộ, viewingId=0 và viewingTime=assignedAt nhận diện phiên giao khách; các tác vụ lịch vẫn dùng viewingId thực. Không thêm bảng/cột hoặc đổi trạng thái lead.
- Nhắc lịch, nhắc/báo điểm danh và hỏi cảm nhận phân biệt từng viewing ID và giờ hẹn. Sự kiện/hoàn tất buổi trước không chặn buổi sau; lịch đã đổi giờ không nhận lời nhắc của giờ cũ.
- Cảm nhận có một link cho mỗi buổi ATTENDED. `POST /feedback/link/:leadId` nhận body tùy chọn `{viewingId}`; bỏ body thì lấy buổi ATTENDED gần nhất. Link mới vẫn có 128 bit ngẫu nhiên, mang ánh xạ buổi xem trong token; link hex cũ tiếp tục thuộc buổi đầu. Trang công khai lấy đúng căn/buổi của link, kể cả khách đặt thêm căn sau đó. Hai yêu cầu lấy link đồng thời nhận cùng link.
- Khách chưa có email không nhận email nhắc lịch/cảm nhận/nuôi dưỡng. Cảnh báo quản lý vẫn chạy. Tác vụ nuôi WARM/COLD/HOT sau xem giữ điều kiện đồng ý nhận tin và chưa gửi cảm nhận của đúng buổi; mỗi khách chỉ vào chiến dịch một lần.
- Báo cáo tuần dùng số lead duy nhất cho chốt lịch, đã xem, không đến, tạo hợp đồng, ký và mất khách. Phân bổ theo nguồn và người phụ trách của khách mới trong kỳ xuất hiện trên web/email. API `/stats` thêm `bySource`, `byAssignee`, `overdueResponses`; không đếm mỗi buổi xem thành khách mới.

## Tương thích và triển khai

1. Cần bản FE-33 đã nâng schema và bản FE-34. Sao lưu trước khi phát hành theo quy trình chung.
2. Build/deploy backend và web cùng bản. Không có biến môi trường mới hay migration bổ sung. Cập nhật quyền của credential readonly bằng `backend/sql/readonly-role.sql` vì báo cáo đọc thêm source, assigned_user_id và các mốc phản hồi; bảng users vẫn không được cấp quyền đọc.
3. Import/publish lại luồng 2 và 4, restart n8n. Có nhánh xử lý khách chưa chọn căn, nên cảnh báo hồ sơ tư vấn không gọi API property #0.
4. Sub-workflow thông báo hiện tại vẫn được dùng với đầu vào cũ `emailTo`. Cảnh báo STAFF_NUDGE chỉ được xác nhận thành công khi có `emailSent=true` đến email quản lý. FE-35 của Hoàng tiếp tục thay cách định tuyến thông báo cá nhân; FE-38 không đổi hợp đồng sub-workflow.
5. Các checkpoint ACTION_DONE cũ chỉ hoàn tất metadata, không gửi lại. STAFF_NUDGE cũ ghi STAFF_NUDGE_SENT, không biến thành cảnh báo phản hồi của phiên mới. FEEDBACK cũ giữ checkpoint khi trùng viewing/giờ, REVIEW vẫn cần kiểm tra nhà cung cấp trước khi xử lý.
6. Lead cũ chưa có assignedAt/responseDueAt không tự bị cảnh báo. Quản lý gán/chuyển người phụ trách để bắt đầu phiên có hạn; không suy ra hạn từ createdAt.

## Kiểm thử

- Backend lint/build/unit và integration PostgreSQL tạm: `FE33_TEST_DATABASE_URL` chỉ trỏ localhost:55433/fe33_test. Bộ FE-38 kiểm tra khách không email/không lịch, phản hồi trong lúc đang giữ việc, chuyển sale, checkpoint cũ, từng buổi xem, link cảm nhận và số liệu theo khách.
- `node scripts/check-followup-workflow.cjs`, `node scripts/check-followup-report.cjs`; chế độ `--sql` tạo fixture chạy trong transaction trên PostgreSQL. Selector và snapshot dùng chung nguồn `backend/src/followups/followup-sql.ts`; sau khi sửa SQL, build backend rồi chạy `node scripts/sync-followup-sql.cjs` để cập nhật JSON và SQL xem trước.
- Đã chạy bản sao đồ thị luồng 2 trên n8n tạm, API claim/start/action-done/complete dùng backend thật và PostgreSQL thật. Chỉ thay nút gửi bằng mock: khách không email/không lịch hoàn tất đúng một cảnh báo, không gửi email/Mautic thật. Chưa chạy gửi thật trên server.
- Kết quả 10/11: **129/129 test pass**, backend lint/build và web lint/build (webpack, 21 trang) pass; hai SQL fixture pass. JSON luồng 2 đã import/export lại bằng n8n tạm (63 node), giữ cấu hình và credential tham chiếu của bản gốc. Server và campaign thật để Hoàng thực hiện.
