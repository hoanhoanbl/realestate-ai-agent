# Luồng 1: Tiếp nhận đặt lịch và chấm điểm khách

File: `n8n-workflows/luong-1-dat-lich.json` (21 node, không tính ghi chú; id `prt5invo7qugQx74`).
Kích hoạt: `POST /webhook/viewing-requested`, có header `X-Webhook-Secret` (credential Header Auth).

Khung chung của các tài liệu luồng: [README.md](README.md).

## 1. Làm gì trong thực tế

Khi khách đặt lịch xem nhà trên web, người ta thường phải: đọc đơn, xem khách có nghiêm túc không, trả lời khách là đã nhận, rồi báo sale gọi lại. Luồng này làm thay các việc đó trong vài chục giây:

- AI chấm khách 0 đến 100 điểm và xếp **HOT / WARM / COLD**.
- Khách nhận ngay một email xác nhận đã nhận yêu cầu (chưa phải chốt lịch).
- Sale phụ trách nhận thông báo kèm điểm, gợi ý hành động và nút **Duyệt**, **Đổi giờ**.

Luồng **không chờ** ai duyệt. Từ FE-35 luồng kết thúc ngay sau khi báo sale; việc duyệt xảy ra ở backend khi sale bấm link (xem mục 4). Trước đó luồng dừng chờ tới 24 giờ.

Quy tắc nghiệp vụ (điều kiện nhận lịch, ai duyệt, quá hạn thì sao): [nghiep-vu/02-dat-lich-den-dat-coc.md](../nghiep-vu/02-dat-lich-den-dat-coc.md), mục 1 và 2.

## 2. Ai tham gia

| Bên | Vai trò |
|---|---|
| Khách | Đặt lịch trên web, nhận email xác nhận |
| Sale phụ trách | Nhận thông báo, bấm Duyệt hoặc Đổi giờ |
| Quản lý | Nhận thông báo thay khi lead chưa có sale phụ trách |
| Backend | Lưu lead và buổi xem, gọi luồng này, nhận kết quả chấm điểm |
| Gemini | Chấm điểm và soạn email khách |
| SMTP | Gửi email khách |

## 3. Từng bước

```
Backend gọi webhook
      |
      v
[1 Tiếp nhận] Webhook -> Cấu hình -> Chuẩn hoá -> Hợp lệ?
      |  không hợp lệ ---------------------------> Lỗi dữ liệu -> Report FAILED
      v
Lấy thông tin nhà -> Ghép dữ liệu
      |
      v
[2 AI chấm điểm] Basic LLM Chain (Gemini + Structured Output Parser)
      |
      v
[3 Rẽ nhánh] Mức: HOT | WARM | COLD
      |
      v
[4 Email khách] Email khách HOT / WARM / COLD
      |
      v
[5 Báo sale] Lấy link duyệt -> Dữ liệu thông báo -> Thông báo nhân viên
      |
      v
[6 Lưu kết quả] Lưu kết quả AI -> Ghi log AI_SCORED
```

**1. Tiếp nhận yêu cầu đặt lịch.**
`Chuẩn hoá` gom dữ liệu từ body (tên, email viết thường, số điện thoại chỉ giữ chữ số, ngân sách, nhu cầu, căn nhà, giờ xem). `Hợp lệ?` kiểm tra email có ký tự `@`, ngân sách từ 0 trở lên và có mã căn nhà; không đạt thì nhánh `Lỗi dữ liệu` ghi "Dữ liệu đăng ký không hợp lệ (email, ngân sách hoặc căn nhà)" và đi tới `Report FAILED`. Sau đó `Lấy thông tin nhà` gọi `GET /api/properties/{propertyId}` và `Ghép dữ liệu` tính tỷ lệ ngân sách so với giá căn.

**2. AI chấm điểm.**
`Basic LLM Chain` (dùng mô hình `Google Gemini Chat Model`) nhận tên, ngân sách, nhu cầu, giờ xem, thông tin căn và tỷ lệ ngân sách/giá. Kết quả có cấu trúc (`Structured Output Parser`): `score`, `level`, `reason`, `emailBody`, `staffNote`. Các quy tắc đặt trong lời nhắc:

- HOT từ 70 điểm, WARM từ 40 đến 69, COLD dưới 40.
- Ngân sách từ 90% giá căn trở lên cộng điểm mạnh, dưới 50% trừ điểm mạnh.
- Email khách nói nhân viên sẽ liên hệ **xác nhận** lịch, không khẳng định lịch đã chốt; xưng "anh/chị".

Ngưỡng 70 phải giống ngưỡng HOT trên web và trong ma trận (BF-07). Đổi ngưỡng thì sửa cả ba nơi.

**3. Rẽ nhánh theo mức.**
`Mức` chia ba đường HOT, WARM, COLD. Khác nhau duy nhất là email khách: HOT có tiêu đề "Đã nhận yêu cầu xem nhà, nhân viên sẽ gọi trong hôm nay", WARM và COLD là "Đã nhận yêu cầu xem nhà".

**4. Email khách theo mức.**
Ba node `Email khách HOT`, `Email khách WARM`, `Email khách COLD` gửi nội dung `emailBody` do AI soạn. Cả ba thử lại tối đa 3 lần, cách nhau 5 giây.

**5. Báo sale phụ trách.**
- `Lấy link duyệt` gọi `POST /api/viewings/{viewingId}/staff-links` để lấy link **Duyệt** và **Đổi giờ**. Nếu backend lỗi, luồng vẫn đi tiếp và thông báo chỉ còn nút "Xem chi tiết"; sale duyệt trên web admin.
- `Dữ liệu thông báo` soạn tiêu đề, bảng thông tin (khách, số điện thoại, ngân sách, nguồn khách, nhu cầu, căn nhà, giờ xem), gợi ý của AI và các nút. Nguồn khách đổi thành tên dễ đọc (Facebook, Zalo, Google, TikTok, Giới thiệu, Trực tiếp).
- `Thông báo nhân viên` gọi sub-workflow [thong-bao-nhan-vien.md](thong-bao-nhan-vien.md) với `assigneeId` lấy từ `assignedUserId` trong body. Có sale phụ trách thì chỉ gửi cho người đó; chưa có thì gửi quản lý.

**6. Lưu kết quả AI.**
`Lưu kết quả AI` gọi `PUT /api/leads/{leadId}/ai-result` với điểm, mức, lý do, nội dung email (`aiReply`), `emailSent` và `staffNotified` (đúng khi ít nhất một kênh email, Telegram hay push gửi được). Sau đó `Ghi log AI_SCORED` ghi sự kiện vào lịch sử khách. Điểm AI phải được lưu thì sale mới duyệt được: backend từ chối duyệt lead mà AI chưa chấm xong.

## 4. Nối với hệ thống

| Hướng | Gọi gì | Ghi chú |
|---|---|---|
| Backend → luồng 1 | `POST /webhook/viewing-requested` | Gọi bất đồng bộ sau khi lưu lead và buổi xem; thử 3 lần, cách 2 giây, mỗi lần chờ tối đa 5 giây. Hết 3 lần thì backend đặt `automationStatus = FAILED` cho lead |
| Luồng 1 → backend | `GET /api/properties/:id` | Lấy giá, diện tích |
| Luồng 1 → backend | `POST /api/viewings/:id/staff-links` | Cấp link Duyệt và Đổi giờ |
| Luồng 1 → backend | `PUT /api/leads/:id/ai-result` | Lưu điểm |
| Luồng 1 → backend | `POST /api/leads/:id/events` | Ghi `AI_SCORED` |
| Luồng 1 → backend | `PUT /api/leads/:id/automation-status` | Báo `FAILED` khi lỗi |
| Luồng 1 → sub-workflow | `Thông báo nhân viên` | Gửi email, Telegram, push |

Body backend gửi: `leadId`, `viewingId`, `name`, `email`, `phone`, `budget`, `needs`, `source`, `propertyId`, `viewingTime`, `manageToken`, `assignedUserId`, `eventId`. Chi tiết trường và mã lỗi: [api-contract.md](../api-contract.md).

**Sau khi sale bấm nút.** Luồng 1 đã kết thúc nên nút không chạy lại luồng này. Link `/duyet/<mã>` do backend cấp: mở link chỉ hiện tóm tắt (không có số điện thoại, email), chỉ khi bấm nút xác nhận mới duyệt, để bộ quét link của email không tự duyệt. Link dùng được tới giờ hẹn. Khi duyệt, backend gọi [luồng 1b](luong-1b-chot-lich-thu-cong.md) để gửi thư chốt lịch cho khách. Chi tiết: [FE-35](../fe-35-thong-bao-phu-trach.md).

**Bộ chống đặt lịch dồn.** Giới hạn 5 lần trên 10 phút cho mỗi địa chỉ IP ở `POST /api/viewings` do backend làm, không phải luồng này.

## 5. Khi lỗi thì sao

**Xử lý lỗi (nhóm cuối của workflow).** Các node lỗi đi về `Report FAILED`; xem bảng dưới.

| Lỗi | Điều xảy ra |
|---|---|
| Email sai, ngân sách âm hoặc thiếu căn nhà | `Lỗi dữ liệu` rồi `Report FAILED` |
| Không lấy được thông tin nhà, AI lỗi (sau 3 lần thử), email khách lỗi (sau 3 lần), thông báo nhân viên lỗi | Đi tới `Report FAILED`: `PUT /api/leads/:id/automation-status` với `status = FAILED` và nội dung lỗi (tối đa 300 ký tự) |
| `Lưu kết quả AI` lỗi | Nhánh lỗi chỉ đi tới `Callback failed` (không làm gì). Lead giữ `automationStatus` cũ và chưa có điểm, nên sale **không duyệt được** cho tới khi xử lý tay |
| `Lấy link duyệt` lỗi | Không dừng. Thông báo không có nút Duyệt và Đổi giờ |

`Report FAILED` là node cuối của nhánh lỗi, không nối tiếp node nào, và các node gọi ra ngoài (lấy thông tin nhà, AI, email, thông báo, lưu kết quả) đều bắt lỗi bằng `continueErrorOutput`. Vì vậy một lần chạy lỗi vẫn kết thúc "success" trong n8n và **không** kích hoạt Error workflow. Ghi chú trong workflow nói nhánh lỗi "dừng để Error workflow báo quản lý"; theo cách nối hiện tại thì điều đó không xảy ra (chưa kiểm trên n8n thật). Cách biết sự cố là lead có `automationStatus = FAILED` trên web admin. Error workflow xem [error-workflow.md](error-workflow.md).

Chạy lại: sửa nguyên nhân, rồi gọi lại webhook với cùng body (sao chép từ lần chạy trong n8n Executions). Lần chạy coi như thành công nên n8n không có nút "Retry" cho nó.

## 6. Triển khai lên server

| Mục | Giá trị |
|---|---|
| Workflow id | `prt5invo7qugQx74` |
| Credential | Header Auth `iYLrhsH8b8dDkZ0n`, Gemini `wU5LeG7gXaoUdMXQ`, SMTP `hfJ9bBGUGsjH8qDP` |
| Biến `.env` | `PUBLIC_WEB_URL` (link "Xem chi tiết"), `WEBHOOK_SECRET` (backend và n8n dùng chung) |
| Cấu hình trong node `Cấu hình` | `backendUrl` (`http://backend:8081`), `staffEmail`, `managerEmail`, `publicWebUrl`. Hai địa chỉ email đang ghi sẵn trong node, kiểm tra trước khi dùng thật |
| Error workflow | Chọn `errorWfRealestat` trong Settings của workflow |

Hiện trạng:

- **Server:** [trien-khai.md mục 4](../trien-khai.md) ghi luồng 1 đã bật (5/11), là bản trước FE-35. Bản mô tả ở đây (FE-35) **chưa lên server**.
- **Phát hành:** cùng `v0.4.0`, sau khi backend đã deploy. Thứ tự import: `thong-bao-nhan-vien.json`, rồi `luong-1b-chot-lich-thu-cong.json`, rồi `luong-1-dat-lich.json`, restart n8n. Không SQL, không biến `.env` mới. Các bước và chỗ cần lưu ý với lần chạy cũ đang chờ: [trien-khai.md mục 9d](../trien-khai.md#9d-thông-báo-theo-sale-và-duyệt-lịch-qua-link-fe-35).
- **Đã kiểm:** `node scripts/check-approval-links-workflow.cjs` (cấu trúc luồng 1 và 1b) và import vào n8n cô lập thành công.
- **Chưa kiểm trên server:** luồng chạy đủ đường với Gemini thật (email khách, lấy link, báo sale, lưu kết quả). Task 6.2 của change `fe35-assignee-notifications-approval` còn mở.

## 7. Cách chạy thử

1. Khởi động stack local (`docker compose up -d`), import luồng 1 và sub-workflow `thong-bao-nhan-vien`, bật cả hai.
2. Mở web khách, đặt một lịch xem nhà với email của bạn. Hoặc gọi thẳng `POST /api/viewings` (đúng 5 lần trên 10 phút cho mỗi IP).
3. Mong đợi trong n8n Executions: luồng 1 **success**, không có lần nào **waiting**.
4. Khách (email của bạn) nhận thư "Đã nhận yêu cầu xem nhà". Sale phụ trách nhận thông báo có điểm AI và nút Duyệt, Đổi giờ.
5. Trên web admin, lead có điểm AI và mức HOT, WARM hoặc COLD, và sự kiện `AI_SCORED` trong lịch sử.
6. Bấm Duyệt, mở link, xác nhận: lead chuyển "Đã chốt lịch" và khách nhận thư chốt lịch (luồng 1b).
7. Để thử nhánh lỗi, tắt SMTP (hoặc đổi khoá Gemini sai) rồi đặt lịch: lead có `automationStatus = FAILED`.
