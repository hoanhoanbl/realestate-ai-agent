# Luồng 7: Đồng bộ lead sang Mautic

> **Mở rộng, phát triển sau.** Luồng này thuộc Marketing Automation (Mautic), không nằm trong bốn vế của đề tài. Xem [tong-quan-du-an.md](../tong-quan-du-an.md), mục "Phạm vi".

File: `n8n-workflows/luong-7-dong-bo-mautic.json` (21 node, không tính ghi chú; id `luong7Realestat0`).
Kích hoạt: `POST /webhook/lead-changed`, Header Auth `X-Webhook-Secret`.

Khung chung của các tài liệu luồng: [README.md](README.md). Các mục "Cấu hình sau khi import", "Thứ tự xử lý", "Kiểm tra thực tế" và "Giới hạn" là phần chi tiết riêng của luồng này. Phần "Thứ tự xử lý" đã cập nhật theo FE-40 (đồng bộ cả khách chưa có email); chi tiết FE-40: [fe-40-l7-khong-email.md](../fe-40-l7-khong-email.md).

## 1. Làm gì trong thực tế

Văn phòng dùng Mautic để chăm sóc khách bằng email và để chấm điểm hành vi. Mautic phải biết khách nào là ai, mức tiềm năng nào, đang ở trạng thái nào. Mỗi khi kết quả AI hoặc trạng thái của lead đổi, luồng 7 tìm (hoặc tạo) contact Mautic tương ứng, gắn tag trạng thái và mức AI, gắn `vip-prospect` khi khách nóng, rồi lưu `mauticContactId` về backend. Luồng này **không** gửi email và **không** quyết định ai nhận marketing: việc đó do đồng ý của khách và luồng 2.

Quy tắc nghiệp vụ: [nghiep-vu/03-cham-soc-va-marketing.md](../nghiep-vu/03-cham-soc-va-marketing.md) mục 3 và 4.

## 2. Ai tham gia

Backend (gọi webhook mỗi khi lead đổi), Mautic (nhận contact và tag), quản lý (nhận báo qua Error workflow khi đồng bộ lỗi). Không có khách hay sale tham gia trực tiếp.

## 3. Từng bước

Workflow chia thành ba nhóm bằng ghi chú: **1. Tiếp nhận thay đổi lead**, **2. Đồng bộ contact sang Mautic**, **3. Ghi lại backend và phản hồi**, và một nhóm **Xử lý lỗi**. Mô tả đầy đủ ở mục "Thứ tự xử lý" bên dưới.

## 4. Nối với hệ thống

| Hướng | Gọi gì |
|---|---|
| Backend → luồng 7 | `POST /webhook/lead-changed` (địa chỉ ở biến `N8N_LEAD_CHANGED_URL`), chỉ cần `leadId` |
| Luồng 7 → backend | `GET /api/leads/:id/mautic-context`, `PUT /api/leads/:id/mautic`, `POST /api/leads/:id/events` (`MAUTIC_SYNCED`, `FOLLOWUP_FAILED`) |
| Luồng 7 → Mautic | `GET /contacts`, `PATCH /contacts/:id/edit`, `POST /contacts/new` |
| Mautic → backend | Chiều ngược lại (điểm, hành vi) là [luồng 8](luong-8-mautic-bao-ve.md) |

## 5. Khi lỗi thì sao

Payload hoặc hồ sơ sai trả HTTP 400. Lỗi API Mautic hoặc phản hồi sai thì ghi `FOLLOWUP_FAILED` vào lịch sử khách, trả HTTP 502 và dừng bằng `Stop And Error`, để lần chạy có trạng thái lỗi và [Error workflow](error-workflow.md) báo quản lý. Nhiều contact trùng định danh thì dừng để kiểm tra bằng tay.

## 6. Triển khai lên server

| Mục | Giá trị |
|---|---|
| Workflow id | `luong7Realestat0` |
| Credential | Header Auth `iYLrhsH8b8dDkZ0n` (cho node Webhook), Basic Auth Mautic `mautic_api_credential` (chọn cho cả năm node gọi Mautic) |
| Biến `.env` | `MAUTIC_URL` (`https://mautic.<PUBLIC_HOST>/api`; trống hoặc `http://mautic_web` trên server sẽ bị chuyển hướng 301 và luồng lỗi), `N8N_LEAD_CHANGED_URL` (cho backend), `WEBHOOK_SECRET` |
| Việc làm tay | Các bước ở mục "Cấu hình sau khi import" bên dưới |
| Error workflow | Chọn `errorWfRealestat` trong Settings |

Hiện trạng:

- **Server:** [trien-khai.md mục 4](../trien-khai.md) ghi luồng 7 đã bật, là **bản cũ**. Credential Mautic `mautic_api_credential` **chưa có** trên server, tạo ở `v0.3.1`.
- **Phát hành:** import theo [trien-khai.md mục 9](../trien-khai.md). Bản FE-40 cần **backend có `/mautic-context` deploy trước**, rồi gắn lại credential Basic Auth Mautic.
- **Đã kiểm:** `node scripts/check-mautic-no-email.cjs`, và n8n cô lập với Mautic local (FE-40).
- **Chưa kiểm trên server:** nghiệm thu với contact nội bộ trước khi publish (Hoàng chạy theo FE-40).

## 7. Cách chạy thử

Làm theo mục "Kiểm tra thực tế" bên dưới trên **Mautic local**, và chạy `node scripts/check-mautic-no-email.cjs` cho các ca không email, định dạng điện thoại và xung đột định danh. Đối chiếu local với local, server với server.

## Cấu hình sau khi import

1. Chọn credential Header Auth của backend cho node Webhook. Giá trị phải khớp `WEBHOOK_SECRET` của backend.
2. Tạo credential **Basic Auth** tên dễ phân biệt, ví dụ `Mautic Local` hoặc `Mautic Server`, bằng tài khoản API của đúng môi trường. Bật API và HTTP Basic Auth trong Mautic, cấp quyền đọc/tạo/sửa contact.
3. Chọn credential này cho **cả năm node**: Tìm Contact Mautic, Cập nhật Contact, Tạo Contact mới, Gắn Tag VIP, Đọc Contact đã liên kết. File JSON chỉ chứa tham chiếu credential mẫu; cần chọn credential thật sau import.
4. Node Cấu hình:
   - `mauticUrl`: URL API có `/api`, không có dấu `/` cuối. Local cùng Docker network: `http://mautic_web:80/api`; server: `https://<mautic-domain>/api`.
   - `backendUrl`: mặc định `http://backend:8081`, hoặc biến `BACKEND_URL`.
   - `webhookSecret`: secret gọi callback backend. Không phải mật khẩu Mautic.
5. Có thể nhập URL và secret trực tiếp trong node Cấu hình nếu không muốn tạo lại container. Không đưa giá trị bí mật vào Git. Các node Mautic dùng Basic Auth credential, không cần `mauticAuth` hay hai biến `MAUTIC_API_USER` / `MAUTIC_API_PASSWORD` nữa.
6. Backend phải cấu hình `N8N_LEAD_CHANGED_URL` trỏ tới Production URL của L7. Publish workflow sau khi chọn xong credential.

Chọn đúng Error workflow trong Settings sau khi import; ID workflow và credential có thể khác giữa local và server.

## Thứ tự xử lý

1. Webhook nhận thay đổi kết quả AI hoặc trạng thái lead. Từ FE-40 luồng chỉ dùng `leadId` trong payload.
2. `Đọc hồ sơ Backend` lấy hồ sơ hiện tại bằng `GET /api/leads/:id/mautic-context` (không trả link duyệt hay mã bí mật), nên payload webhook cũ không ghi đè thông tin mới hơn. Hồ sơ không đọc được thì trả HTTP 400.
3. Chuẩn hoá ID, tên, email (có thể trống), số điện thoại chuẩn hoá, mức AI, trạng thái và tags. Số điện thoại là định danh chính, email là dữ liệu bổ sung. Payload không hợp lệ trả HTTP 400.
4. Đã có `mauticContactId` thì `Đọc Contact đã liên kết` để xác minh đúng contact đó. Chưa liên kết thì `Tìm Contact Mautic` theo số điện thoại (dạng `+84`) và email nếu có; `Chọn Contact đúng định danh` chỉ chọn bản ghi **khớp chính xác**, không lấy tuỳ ý contact đầu tiên. Nhiều contact cùng khớp, email thuộc số điện thoại khác, hoặc quá 100 ứng viên thì dừng để kiểm tra, không tự gộp khách. Không tạo email giả và không ghi đè email Mautic đã có.
5. Có contact thì cập nhật tên, điện thoại và tags; chưa có thì tạo mới.
6. Gỡ tags trạng thái và mức AI cũ; gỡ `vip-prospect` nếu không còn VIP. DEPOSIT / SIGNED / LOST gỡ `nuoi-warm`.
7. Kiểm tra contactId hợp lệ trước khi lưu vào backend.
8. Gắn VIP khi HOT hoặc điểm AI từ 80; lưu `mauticContactId`, ghi `MAUTIC_SYNCED`.
9. Thành công trả HTTP 200 với `ok: true`.
10. Lỗi API / response sai ghi `FOLLOWUP_FAILED`, trả HTTP 502 và dừng bằng Stop And Error để execution có trạng thái lỗi, kích hoạt Error workflow. Nếu không ghi được timeline, vẫn trả lỗi.

AI score không ghi đè `points` của Mautic. Tag `WARM` chỉ phân loại; segment nuôi dưỡng phải nhận `nuoi-warm` do L2 cấp sau khi kiểm tra đủ điều kiện.

## Kiểm tra thực tế

- Khách có email mới: tạo được đúng contact, backend lưu ID và timeline có `MAUTIC_SYNCED`.
- Chạy lại với cùng email: cập nhật contact đang có.
- Chuyển sang SIGNED: gỡ `nuoi-warm`, gỡ trạng thái cũ, giữ điểm hành vi.
- Sai Basic Auth: nhận HTTP 502, execution lỗi, timeline có lỗi nếu backend truy cập được.
- Đối chiếu local với local hoặc server với server; tránh đưa dữ liệu thử local vào Mautic server.

## Giới hạn

Chưa có hàng đợi bền vững hoặc khoá đồng bộ theo email. Hai webhook đồng thời và các lần retry cần kiểm tra thêm. Nhiều lead cùng email dùng chung contact nên cần thống nhất quy tắc nghiệp vụ. Các kiểm tra ở repo không thay thế thử với Mautic/n8n thật.
