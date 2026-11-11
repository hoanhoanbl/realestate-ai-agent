# Luồng 1b: Chốt lịch, báo giờ mới và báo hẹn lại giờ

File: `n8n-workflows/luong-1b-chot-lich-thu-cong.json` (18 node, không tính ghi chú; id `luong1bRealestat`).
Kích hoạt: `POST /webhook/viewing-admin-action`, có header `X-Webhook-Secret` (credential Header Auth). **Chỉ backend gọi**, không ai gọi tay.

Khung chung của các tài liệu luồng: [README.md](README.md).

## 1. Làm gì trong thực tế

Sau khi [luồng 1](luong-1-dat-lich.md) báo sale, người thật quyết định. Luồng 1b là phần **gửi email cho khách** sau quyết định đó, theo ba việc:

| Việc của nhân viên | Sự kiện | Khách nhận gì |
|---|---|---|
| Duyệt lịch | `approved` | Thư "Xác nhận lịch xem nhà" có giờ xem và link quản lý lịch |
| Đổi giờ trên web admin | `rescheduled` | Thư "Lịch xem nhà đã được đổi giờ" |
| Bấm "Đổi giờ" trong thông báo | `reschedule_requested` | Thư "Cần hẹn lại giờ xem nhà": nhân viên sẽ liên hệ để hẹn giờ khác |

Tên "thủ công" vì khác luồng 1 (tự động hoàn toàn), luồng này chạy theo hành động của người.

Quy tắc nghiệp vụ: [nghiep-vu/02-dat-lich-den-dat-coc.md](../nghiep-vu/02-dat-lich-den-dat-coc.md) mục 2.1 (duyệt) và 2.2 (đổi giờ).

## 2. Ai tham gia

| Bên | Vai trò |
|---|---|
| Nhân viên | Bấm Duyệt hoặc Đổi giờ (qua link thông báo hoặc web admin) |
| Backend | Kiểm tra quyền và trạng thái, đổi trạng thái lead, rồi gọi luồng 1b |
| Khách | Nhận email |
| SMTP | Gửi email |

## 3. Từng bước

```
Backend gọi webhook (approved | rescheduled | reschedule_requested)
      |
[1 Tiếp nhận] Webhook -> Cấu hình -> Chuẩn hoá -> Lấy dữ liệu lịch -> Có khách?
      |  không -> Không tìm thấy khách (dừng, báo lỗi)
      v
[2 Kiểm tra lịch] Chuẩn bị -> Yêu cầu đổi giờ?
      |                          |
      | reschedule_requested     | approved / rescheduled
      v                          v
 Còn chờ đổi giờ?         Duyệt hay đổi giờ?
      |                     |              |
      v                 approved       rescheduled
[3] Email báo hẹn      Còn chờ duyệt?  Email báo giờ mới
    lại giờ                  |
      |                      v
 Ghi log RESCHEDULE_    Email chốt lịch -> Cập nhật CONFIRMED -> Ghi log APPROVED
 REQUESTED
```

**1. Tiếp nhận hành động duyệt.**
`Chuẩn hoá` kiểm tra `leadId` là số nguyên dương, `event` thuộc ba giá trị trên và `viewingId` hợp lệ. Sai thì luồng dừng báo lỗi. `viewingId = 0` (web admin không gửi) nghĩa là lấy buổi xem mới nhất của khách. `Lấy dữ liệu lịch` đọc trực tiếp từ database: khách, buổi xem, căn nhà, và mã buổi xem mới nhất của khách. Không có khách thì `Không tìm thấy khách`.

**2. Kiểm tra lịch.**
`Chuẩn bị` dựng nội dung email (tên, căn nhà, địa chỉ, giờ xem theo múi giờ Việt Nam, link quản lý lịch `/lich/<mã>`). Rồi mới rẽ nhánh:

- **Duyệt** đi tiếp chỉ khi lead còn "Mới" (`NEW`), buổi xem còn `NEW` **và** là buổi xem mới nhất của khách. Nút duyệt cũ không chốt nhầm buổi xem mới. Không đạt thì `Bỏ qua (lịch đã huỷ hoặc đã xử lý)`, không gửi gì.
- **Hẹn lại giờ** có cùng ba điều kiện. Không đạt thì cũng bỏ qua.
- **Báo giờ mới** (`rescheduled`) không kiểm lại ở đây; backend đã kiểm trước khi gọi.

**3. Chốt lịch, báo giờ mới hoặc báo khách hẹn lại giờ.**

- Duyệt: `Email chốt lịch`, rồi `Cập nhật CONFIRMED` (`PUT /api/leads/:id/status` với `CONFIRMED`), rồi `Ghi log APPROVED`. Ghi chú trong lịch sử là "Duyệt lịch qua link trong thông báo" nếu người duyệt là "thông báo của nhân viên", ngược lại là "Duyệt lịch từ web admin bởi <tên>".
- Đổi giờ: `Email báo giờ mới`.
- Hẹn lại: `Email báo hẹn lại giờ`, rồi `Ghi log RESCHEDULE_REQUESTED` ("Nhân viên yêu cầu đổi giờ qua link trong thông báo"). Lead vẫn "Mới", không đổi trạng thái.

Chú ý thứ tự khi duyệt: **email gửi trước, trạng thái đổi sau**. Nếu email lỗi sau 3 lần thử thì trạng thái chưa đổi sang `CONFIRMED` từ luồng này.

## 4. Nối với hệ thống

| Hướng | Gọi gì | Khi nào |
|---|---|---|
| Backend → 1b | `POST /webhook/viewing-admin-action` với `event: approved` | Duyệt từ web admin (`leads.service`) hoặc bấm xác nhận link Duyệt trong thông báo (`viewings.service`, kèm `viewingId`) |
| Backend → 1b | `event: rescheduled` | Nhân viên đổi giờ trên web admin khi lead đã "Đã chốt lịch" (`viewings.service`) |
| Backend → 1b | `event: reschedule_requested` | Bấm xác nhận link "Đổi giờ" trong thông báo (`viewings.service`, kèm `viewingId`); bấm lại trong 10 phút thì backend không gọi lần hai |
| 1b → database | Đọc trực tiếp `leads`, `viewings`, `properties` | `Lấy dữ liệu lịch` |
| 1b → backend | `PUT /api/leads/:id/status` | Đặt `CONFIRMED` |
| 1b → backend | `POST /api/leads/:id/events` | Ghi `APPROVED` hoặc `RESCHEDULE_REQUESTED` |

Body gồm `event`, `leadId`, `by` (tên người làm) và `viewingId` (có thể thiếu). Chi tiết hợp đồng: [api-contract.md](../api-contract.md). Backend gọi webhook qua `N8nService.callWebhook`; link duyệt ở thông báo xem [FE-35](../fe-35-thong-bao-phu-trach.md).

## 5. Khi lỗi thì sao

**Xử lý lỗi (nhóm cuối của workflow).** Luồng này không có nhánh lỗi riêng. Lỗi làm lần chạy thất bại, và n8n gọi Error workflow.

| Lỗi | Điều xảy ra |
|---|---|
| `leadId`, `event` hoặc `viewingId` sai | `Chuẩn hoá` ném lỗi, luồng dừng ở trạng thái lỗi, Error workflow chạy |
| Không có khách hoặc buổi xem | `Không tìm thấy khách` (dừng báo lỗi), Error workflow chạy |
| Lịch đã huỷ, đã duyệt hoặc không phải buổi xem mới nhất | Bỏ qua im lặng, luồng kết thúc thành công và không gửi thư |
| Email, cập nhật trạng thái hoặc ghi log lỗi | Mỗi node thử lại 3 lần; vẫn lỗi thì luồng dừng ở trạng thái lỗi |
| Duyệt: email đã gửi nhưng `Cập nhật CONFIRMED` lỗi | Khách đã nhận thư chốt lịch trong khi lead còn "Mới". Nhân viên duyệt lại trên web admin |

Luồng 1b không có nhánh lỗi riêng như luồng 1, nên lỗi làm lần chạy thất bại và kích hoạt [Error workflow](error-workflow.md) để quản lý được báo. Nếu email chốt lịch không đến được khách, backend vẫn coi việc duyệt là thành công: nhân viên tự báo khách (xem mục 2.2 của tài liệu nghiệp vụ).

## 6. Triển khai lên server

| Mục | Giá trị |
|---|---|
| Workflow id | `luong1bRealestat` |
| Credential | Header Auth `iYLrhsH8b8dDkZ0n`, SMTP `hfJ9bBGUGsjH8qDP`, Postgres `postgres_account_id` (chỉ đọc ở node `Lấy dữ liệu lịch`) |
| Biến `.env` | `PUBLIC_WEB_URL` (link quản lý lịch trong thư), `WEBHOOK_SECRET` |
| Error workflow | Chọn `errorWfRealestat` trong Settings |

Hiện trạng:

- **Server:** [trien-khai.md mục 4](../trien-khai.md) ghi luồng 1b đã bật (5/11), là bản trước FE-35. Bản mô tả ở đây (có `viewingId` và `reschedule_requested`) **chưa lên server**.
- **Phát hành:** cùng `v0.4.0`. Import **trước luồng 1**, vì luồng 1 phát link gọi sang các sự kiện mới. Thứ tự: `thong-bao-nhan-vien.json`, `luong-1b-chot-lich-thu-cong.json`, `luong-1-dat-lich.json`. Xem [trien-khai.md mục 9d](../trien-khai.md#9d-thông-báo-theo-sale-và-duyệt-lịch-qua-link-fe-35).
- **Đã kiểm:** `node scripts/check-approval-links-workflow.cjs` (cấu trúc luồng 1 và 1b) và import vào n8n cô lập thành công.
- **Chưa kiểm trên server:** gửi thư chốt lịch thật tới hộp thư khách sau khi duyệt bằng link.

## 7. Cách chạy thử

1. Import và bật luồng 1b trên n8n local cùng sub-workflow `thong-bao-nhan-vien` và luồng 1.
2. Đặt một lịch xem bằng email của bạn (xem [luồng 1](luong-1-dat-lich.md) mục 7), đợi thông báo tới.
3. **Duyệt:** mở link Duyệt, bấm xác nhận. Mong đợi: lead chuyển "Đã chốt lịch", bạn nhận thư "Xác nhận lịch xem nhà", lịch sử có `APPROVED`, n8n Executions của luồng 1b là success.
4. **Hẹn lại giờ:** với một lịch mới, bấm "Đổi giờ" trong thông báo. Mong đợi: thư "Cần hẹn lại giờ xem nhà", lịch sử có `RESCHEDULE_REQUESTED`, lead vẫn "Mới". Bấm lại trong 10 phút thì không gửi thư thứ hai.
5. **Đổi giờ:** trên web admin, đổi giờ của lead "Đã chốt lịch". Mong đợi: thư "Lịch xem nhà đã được đổi giờ".
6. **Bỏ qua:** duyệt lại link đã dùng. Mong đợi: backend từ chối ngay, luồng 1b không chạy (hoặc chạy và bỏ qua nếu gọi thẳng webhook).
