# FE-44: ghi nhận liên hệ và lý do không mua

Ngày cập nhật: 20/11/2026. **Đã tích hợp local; chưa commit/push/PR, chưa nghiệm thu server.** Nền FE-43 do người dùng tự pull về từ #89. Assistant không chạy lệnh Git hoặc thao tác GitHub trong phần triển khai này.

## Hành vi đã làm

- Hai API JWT `POST /api/leads/:id/contacted` và `POST /api/leads/:id/contact-attempts`; chỉ người phụ trách hoặc quản lý được ghi liên hệ. Lead LOST/SIGNED bị từ chối, người khác được xem như trước.
- Bấm đã liên hệ: giữ mốc đầu tiên và một event CONTACTED. Ghi lần gọi NO_ANSWER/BUSY/CALL_BACK/WRONG_NUMBER chỉ thêm CONTACT_ATTEMPTED. Actor lấy từ JWT, thời gian lấy tại server; cả hai thao tác đặt first_response_at khi trống.
- Khoá lead FOR UPDATE và lưu lead/event cùng transaction. Hai yêu cầu đồng thời chỉ tạo một CONTACTED.
- Điểm danh Có đến trong LeadsService.markAttended (được ViewingsService gọi): đọc lại lead/lịch có khoá, kiểm điều kiện, đặt ATTENDED/VIEWED, mốc liên hệ và nhật ký trong một transaction. Không đến không đánh dấu liên hệ. Giữ quyền điểm danh hiện có; first response vẫn theo người phụ trách/quản lý như trước.
- Hai đường admin-status và PUT status chặn lý do hệ thống/mã cũ; chấp nhận sáu nhóm MANUAL_LOST_REASONS. Huỷ buổi xem mở, đóng việc chăm sóc và đổi trạng thái/nhật ký cùng transaction; không cho DEPOSIT chuyển thẳng LOST. Các đường hệ thống ghi STALE/EXPIRED trong transaction riêng vẫn giữ nguyên.
- Trang chi tiết khách dùng LeadContactSection/LeadContactPanel: quyền sửa, mốc đã liên hệ, ghi lần gọi, lỗi/đang lưu/thành công; refresh lịch sử sau khi ghi. Ô Không mua dùng sáu nhóm từ API. ContactButtons gọi điện/mailto được giữ nguyên.

## Kiểm tra

- Toàn bộ backend với PostgreSQL disposable localhost:55433/fe33_test: **22 suite, 280 test pass, không skip**.
- Bộ contact.integration.spec.ts: 22 test cho JWT/quyền, input giả, chuyển sale, lead đóng, hai yêu cầu đồng thời, attendance và rollback thực tế khi DB từ chối event, lý do đóng và chặn DEPOSIT.
- Backend và web lint/build đạt; Next.js đang dùng báo cảnh báo bảo mật trong build, dependency chưa thay đổi.
- Kiểm tra lại bằng Chrome headless có profile riêng: **20 kiểm tra UI đạt**, viewport thực tế 375px trong iframe. Dùng component thật LeadContactPanel, LeadActions và CSS production; router/callback được giả lập, không gọi API ghi thật. Các trạng thái chưa liên hệ, đã liên hệ, chỉ xem, lỗi/thử lại và picker sáu lý do không tràn ngang. Đã kiểm bấm đúp chỉ gọi callback một lần, ghi lần gọi không đặt mốc liên hệ, lỗi không báo thành công.
- Bằng chứng: `output/fe44-browser-test/result.json`, `fe44-375px.png`. Bộ test/build/server/runner nằm cùng thư mục; tất cả là artifact test local, không phải file cần đưa vào PR. Lần đầu IAB/native UI bị chặn; lần kiểm lại này dùng tiến trình Chrome headless riêng và fixture loopback ngoài sandbox, không điều khiển trình duyệt của người dùng.

## Còn trước khi coi FE-44 hoàn tất

1. QA 375px với component thật/callback giả đã đạt. Quyền, actor, lịch sử và transaction được kiểm riêng qua API/PostgreSQL thật. Trước deploy vẫn cần smoke test trang admin và API cùng chạy trên bản build đã tích hợp (không coi fixture giao diện là nghiệm thu server).
2. Hoàng review phần attendance/phối hợp với FE-53 (#90); bản local này chưa tự đưa code #90 vào. Không ghi đè thay đổi nền của Hoàng bằng cách sao chép file từ snapshot.
3. Người dùng tự thực hiện mọi thao tác Git (status, commit, đồng bộ dev, push, mở PR). Task 3.1–3.4 đã có code/kiểm thử local, gồm QA trình duyệt cho 3.3; review và merge vẫn do người dùng/nhóm thực hiện.
4. Deploy server theo đợt CH-12 sau review/merge; giữ bước SQL FE-43. FE-44 không thêm cột hay workflow n8n mới, không gửi thư/Telegram trong các API liên hệ.

Chưa triển khai FE-45/46/47/54 trong phần này. Không sửa sổ danh-sach-task.md của Hoàng; CH-13 cập nhật trạng thái sau khi có PR.

## Lần kiểm lại theo yêu cầu người dùng

Backend 22 suite / 280 test pass với PostgreSQL disposable, không skip; backend/web lint và build đều đạt. Web build vẫn báo cảnh báo bảo mật Next.js hiện có; dependency không thay đổi. Không sửa code sản phẩm trong lần kiểm lại, chỉ thêm fixture/runner và cập nhật kết quả. DB test và server fixture đã được dừng. Không chạy lệnh Git hoặc thao tác GitHub.
