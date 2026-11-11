# FE-35 — Thông báo gửi sale phụ trách và nút Duyệt tới giờ hẹn

Triển khai local trên nền FE-33/FE-34, chưa phát hành server. Phạm vi nghiệp vụ: [quy trình 1](nghiep-vu/01-tiep-nhan-va-phan-cong.md) và [duyệt lịch](nghiep-vu/02-dat-lich-den-dat-coc.md#2-duyệt-lịch). Đóng LH-06, và phần "nút Duyệt tới giờ hẹn" của LH-07 (báo quản lý sau 2 giờ làm việc là FE-38). Change OpenSpec: `fe35-assignee-notifications-approval`.

## Hành vi

- **Thông báo đúng người.** Sub-workflow `thong-bao-nhan-vien` nhận thêm `assigneeId`. Có khoá này (kể cả `0` = chưa có người phụ trách) thì chỉ gửi cho người đó bằng email, Telegram cá nhân và push của riêng họ, lấy qua `GET /api/users/{id}/notify-target`. Thiếu Telegram hoặc push thì bỏ qua kênh đó (báo `telegramSkipped`/`pushSkipped`, không coi là lỗi). Chưa có sale, không tìm thấy người, hoặc người đó không có kênh nào dùng được thì gửi email cho quản lý và trả `fallbackToManager: true`. Công tắc "Đang nhận khách" không ảnh hưởng việc nhận thông báo của khách đã giao.
- **Không còn nhóm Telegram chung và push cho mọi người** với lead có sale. Luồng 2 và 3 vẫn gọi bằng `emailTo` như cũ (nhóm chung, kết quả `emailSent`/`telegramSent`, email lỗi vẫn báo lỗi cho luồng gọi).
- **Mỗi kênh độc lập.** Kiểu gọi mới: kênh nào lỗi cũng không dừng kênh khác; kết quả có `emailSent/emailError`, `telegramSent/telegramError`, `pushSent/pushError`.
- **Luồng 1 không còn chờ 24 giờ.** Sau khi chấm điểm, báo khách và báo sale, luồng kết thúc. Bỏ: node chờ, các nhánh duyệt/đổi giờ/quá 24 giờ, cập nhật tin Telegram, đọc push token của mọi nhân viên, và `approvalUrl` gửi về backend. Backend vẫn nhận `approvalUrl` để các lần chạy cũ đang chờ lúc deploy không hỏng.
- **Nút Duyệt / Đổi giờ là link `/duyet/<mã>` do backend cấp** (luồng 1 gọi `POST /api/viewings/{id}/staff-links`). Mở link chỉ hiện tóm tắt (khách, căn, giờ, không có SĐT/email); đổi lịch khi bấm nút xác nhận, để bộ quét link của email không tự duyệt. Link dùng được tới giờ hẹn hiện tại của buổi xem; đổi giờ hẹn thì hạn dời theo. Trang từ chối khi: khách đã huỷ, lịch đã duyệt, khách có buổi xem mới hơn, đã tới giờ hẹn, hoặc (chỉ với Duyệt) AI chưa chấm xong. Backend lỗi lúc cấp link thì thông báo chỉ còn nút "Xem chi tiết".
- **Luồng 1b theo từng buổi xem.** Nhận `viewingId` (web admin không gửi thì lấy buổi xem mới nhất) và từ chối nếu không phải buổi xem mới nhất của khách. Thêm sự kiện `reschedule_requested`: gửi khách thư "Cần hẹn lại giờ xem nhà" và ghi `RESCHEDULE_REQUESTED`, lead vẫn "Mới". Bấm "Đổi giờ" lặp lại trong 10 phút chỉ gửi một thư.
- Nhật ký: duyệt qua link ghi `APPROVED` với ghi chú "Duyệt lịch qua link trong thông báo", và ghi nhận phản hồi đầu tiên cho sale phụ trách (link không đăng nhập nên không biết ai bấm).
- Đã đổi so với trước: không còn email cảnh báo quản lý "quá 24 giờ" và tin Telegram không tự sửa sau khi duyệt (trang xác nhận cho biết kết quả). Các sự kiện `APPROVAL_TIMEOUT` cũ vẫn hiện trong nhật ký cũ.

## API mới

Xem [api-contract.md mục 3.2](api-contract.md#32-link-duyet--doi-gio-cho-nhan-vien-fe-35). Link được ký bằng `WEBHOOK_SECRET`; đổi secret thì link cũ chết, nhân viên duyệt trên web admin.

## Triển khai

[trien-khai.md mục 9d](trien-khai.md#9d-thông-báo-theo-sale-và-duyệt-lịch-qua-link-fe-35): deploy backend, rồi import theo thứ tự thông báo nhân viên → luồng 1b → luồng 1. Không SQL, không biến `.env` mới. Sale muốn nhận Telegram cá nhân nhập chat id ở trang Tài khoản (FE-39).

## Kiểm thử (11/11)

- Backend: `npm run lint`, `npm run build`, `npm test` **142/142** (có `fe35.integration.spec.ts` trên PostgreSQL tạm `localhost:55433/fe33_test`: notify-target, cấp link, xem trước không lộ SĐT/email, duyệt sau 48 giờ, đã duyệt rồi, AI chưa chấm, đã huỷ, qua giờ hẹn, buổi xem mới hơn, đổi giờ không gửi lặp, n8n lỗi trả 502). Web lint và build pass; trang `/duyet/<mã>` kiểm tra ở 375 px với API giả, không tràn ngang, đủ các trạng thái thành công / từ chối / lỗi.
- `node scripts/check-notification-routing.cjs` và `node scripts/check-approval-links-workflow.cjs`: PASS (người nhận, kênh thiếu, dự phòng quản lý, cách gọi cũ, cấu trúc luồng 1 và 1b).
- **n8n 2.46.6 cô lập** (container tạm, PostgreSQL tạm, máy chủ SMTP và backend giả, không gửi thư thật): import cả ba workflow thành công. Sub-workflow qua workflow bọc: sale có email nhận một thư tại địa chỉ của mình; người không có kênh, id không tồn tại và `assigneeId: 0` đều báo email quản lý với `fallbackToManager`; gọi kiểu cũ chỉ `emailTo` vẫn đi đúng người. Luồng 1b: duyệt qua link đúng buổi xem (thư khách, cập nhật CONFIRMED, ghi `APPROVED`); link cũ của buổi xem đã huỷ và yêu cầu đổi giờ khi đã CONFIRMED không làm gì; yêu cầu đổi giờ hợp lệ gửi một thư và ghi `RESCHEDULE_REQUESTED`; duyệt từ web admin không có `viewingId` vẫn chạy.

## Chưa kiểm chứng

- **Luồng 1 đủ đường** (AI Gemini chấm điểm, email khách, lấy link, báo sale, lưu kết quả): chưa chạy vì cần khoá Gemini; mới kiểm bằng script cấu trúc và import thành công. Task 6.2 của change còn mở.
- Telegram và push thật: chỉ kiểm bằng script (không dùng token thật); kênh Telegram/push của sub-workflow chạy trong n8n thật mới ở trạng thái "bỏ qua".
- Chưa chạy trên server; lần chạy cũ đang chờ lúc deploy chưa thử.
- Lead không đặt lịch (bot, nhập tay) chưa được chấm điểm: luồng 1 vẫn chỉ chạy khi có buổi xem. Báo sale về lead bot mới thuộc FE-36, dùng `assigneeId` của sub-workflow.
