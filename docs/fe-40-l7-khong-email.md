# FE-40 — Đồng bộ Mautic khi khách chưa có email

Hoàn tất code và kiểm thử local ngày 10/11/2026, dựa trên `dev` có FE-33 và FE-34. Chưa import/publish trên server.

L7 chỉ nhận `leadId` từ webhook rồi đọc hồ sơ hiện tại bằng `GET /api/leads/:id/mautic-context` (bảo vệ bằng `X-Webhook-Secret`). API chỉ trả các trường phục vụ đồng bộ, không trả link duyệt hay mã bí mật. Payload webhook cũ không ghi đè thông tin mới hơn trong backend.

Số điện thoại chuẩn hoá là định danh chính, email là dữ liệu bổ sung. Khi đã có `mauticContactId`, đọc và xác minh đúng contact đó. Khi chưa liên kết, tìm theo số điện thoại chuẩn hoá, dạng `+84`, và email nếu có; chỉ chọn bản ghi khớp chính xác. Không tạo email giả, không gửi thuộc tính email rỗng, không thay email Mautic khác đã có. Bổ sung email cho contact đang trống email giữ nguyên ID.

Nhiều contact cùng khớp, email thuộc số điện thoại khác, ID liên kết mất hoặc sai, danh sách ứng viên bị cắt: dừng để kiểm tra execution và xử lý thủ công, không tự gộp khách. POST tạo contact không tự retry khi timeout. Hai execution đồng thời chưa có khoá liên hệ chung; không cam kết exactly-once cho trường hợp đó. Nếu phát sinh contact trùng, cần kiểm tra và gộp thủ công trước khi chạy lại. Không sửa cấu hình unique field toàn cục của Mautic.

## Kiểm thử

- `node scripts/check-mautic-no-email.cjs`: PASS các trường hợp không email, định dạng điện thoại, email sai, bảo toàn email cũ, ID liên kết, trùng/xung đột định danh và cấu trúc workflow.
- Backend lint/build và 119/119 test PASS, gồm HTTP context: thiếu secret bị chặn, có secret chỉ nhận projection cho phép.
- Mautic local thật: tạo không email, tìm lại bằng điện thoại, bổ sung email cùng ID, payload thiếu email không xoá email cũ.
- n8n cô lập import → execute hai lần với Mautic local → export: PASS; backend nhận ID và `MAUTIC_SYNCED` cả hai lần, chỉ một contact sau hai lần tuần tự. Contact giả đã xoá; không gửi email hay bật campaign.
- JSON triển khai đã import/export bằng n8n thật, giữ credential tham chiếu của dự án.

## Bàn giao

Deploy backend có endpoint context trước khi import L7. Gắn lại credential Basic Auth Mautic và webhook như hướng dẫn triển khai. Hoàng chạy nghiệm thu server với contact nội bộ trước khi publish; giữ nguyên các điều kiện nhận marketing, không coi việc có contact Mautic là đồng ý nhận email.

API PATCH chỉ thay các thuộc tính gửi lên: [Mautic Contacts API](https://devdocs.mautic.org/en/5.x/rest_api/contacts.html).
