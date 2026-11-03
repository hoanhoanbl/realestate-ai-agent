# Luồng 7: Đồng bộ lead sang Mautic

File: `n8n-workflows/luong-7-dong-bo-mautic.json`.
Trigger: `POST /webhook/lead-changed`, Header Auth `X-Webhook-Secret`.

## Cấu hình sau khi import

1. Chọn credential Header Auth của backend cho node Webhook. Giá trị phải khớp `WEBHOOK_SECRET` của backend.
2. Tạo credential **Basic Auth** tên dễ phân biệt, ví dụ `Mautic Local` hoặc `Mautic Server`, bằng tài khoản API của đúng môi trường. Bật API và HTTP Basic Auth trong Mautic, cấp quyền đọc/tạo/sửa contact.
3. Chọn credential này cho **cả bốn node**: Tìm Contact Mautic, Cập nhật Contact, Tạo Contact mới, Gắn Tag VIP. File JSON chỉ chứa tham chiếu credential mẫu; cần chọn credential thật sau import.
4. Node Cấu hình:
   - `mauticUrl`: URL API có `/api`, không có dấu `/` cuối. Local cùng Docker network: `http://mautic_web:80/api`; server: `https://<mautic-domain>/api`.
   - `backendUrl`: mặc định `http://backend:8081`, hoặc biến `BACKEND_URL`.
   - `webhookSecret`: secret gọi callback backend. Không phải mật khẩu Mautic.
5. Có thể nhập URL và secret trực tiếp trong node Cấu hình nếu không muốn tạo lại container. Không đưa giá trị bí mật vào Git. Các node Mautic dùng Basic Auth credential, không cần `mauticAuth` hay hai biến `MAUTIC_API_USER` / `MAUTIC_API_PASSWORD` nữa.
6. Backend phải cấu hình `N8N_LEAD_CHANGED_URL` trỏ tới Production URL của L7. Publish workflow sau khi chọn xong credential.

Chọn đúng Error workflow trong Settings sau khi import; ID workflow và credential có thể khác giữa local và server.

## Thứ tự xử lý

1. Webhook nhận thay đổi kết quả AI hoặc trạng thái lead.
2. Chuẩn hoá ID, email, tên, mức AI, trạng thái và tags. Payload không hợp lệ trả HTTP 400.
3. Tìm contact theo email, sau đó **đối chiếu chính xác email** trong kết quả. Không lấy tuỳ ý contact đầu tiên. Nhiều contact trùng email thì báo lỗi để kiểm tra.
4. Có contact thì cập nhật tên, điện thoại và tags; chưa có thì tạo mới.
5. Gỡ tags trạng thái và mức AI cũ; gỡ `vip-prospect` nếu không còn VIP. DEPOSIT / SIGNED / LOST gỡ `nuoi-warm`.
6. Kiểm tra contactId hợp lệ trước khi lưu vào backend.
7. Gắn VIP khi HOT hoặc điểm AI từ 80; lưu `mauticContactId`, ghi `MAUTIC_SYNCED`.
8. Thành công trả HTTP 200 với `ok: true`.
9. Lỗi API / response sai ghi `FOLLOWUP_FAILED`, trả HTTP 502 và dừng bằng Stop And Error để execution có trạng thái lỗi, kích hoạt Error workflow. Nếu không ghi được timeline, vẫn trả lỗi.

AI score không ghi đè `points` của Mautic. Tag `WARM` chỉ phân loại; segment nuôi dưỡng phải nhận `nuoi-warm` do L2 cấp sau khi kiểm tra đủ điều kiện.

## Kiểm tra thực tế

- Khách có email mới: tạo được đúng contact, backend lưu ID và timeline có `MAUTIC_SYNCED`.
- Chạy lại với cùng email: cập nhật contact đang có.
- Chuyển sang SIGNED: gỡ `nuoi-warm`, gỡ trạng thái cũ, giữ điểm hành vi.
- Sai Basic Auth: nhận HTTP 502, execution lỗi, timeline có lỗi nếu backend truy cập được.
- Đối chiếu local với local hoặc server với server; tránh đưa dữ liệu thử local vào Mautic server.

## Giới hạn

Chưa có hàng đợi bền vững hoặc khoá đồng bộ theo email. Hai webhook đồng thời và các lần retry cần kiểm tra thêm. Nhiều lead cùng email dùng chung contact nên cần thống nhất quy tắc nghiệp vụ. Các kiểm tra ở repo không thay thế thử với Mautic/n8n thật.
