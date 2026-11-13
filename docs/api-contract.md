# Hợp đồng API giữa Backend, n8n và Web

File này là "luật chung" của cả nhóm (n8n, backend, web).

Đổi gì trong file này thì phải: (1) tạo nhánh `docs/...` riêng, (2) mở Pull Request, (3) người kia bấm Approve rồi mới merge, (4) ghi một dòng vào mục "Lịch sử thay đổi" ở cuối file. Không sửa thẳng trên `main`.

Tài liệu từng luồng n8n: [docs/luong/](luong/README.md). Quy tắc nghiệp vụ: [docs/nghiep-vu/](nghiep-vu/).

## Quy ước chung

- Backend NestJS chạy ở cổng **8081**, tiền tố `/api` (ví dụ `http://localhost:8081/api/leads`). Swagger: `/api/docs`.
- n8n chạy ở cổng `5678`. Web (Next.js) chạy ở cổng `3000`.
- JSON dùng **camelCase** (`createdAt`, `propertyId`, `automationStatus`). Tên cột trong database là snake_case, chỉ là chi tiết nội bộ của backend.
- `X-Webhook-Secret`: hai bên dùng chung một giá trị `WEBHOOK_SECRET`. Đặt trong `.env` của backend và trong credential Header Auth của n8n. Không đưa lên GitHub.
- Đặt `WEBHOOK_SECRET` là chuỗi ngẫu nhiên dài khi đưa lên host (giá trị dev chỉ để test).
- Cột "Quyền" trong các bảng bên dưới: **JWT** là header `Authorization: Bearer <accessToken>` từ `POST /api/auth/login`; **Quản lý** là JWT và vai trò `MANAGER` (sale nhận `403`); **Secret** là header `X-Webhook-Secret`; **Công khai** là không cần đăng nhập.

**Cập nhật gần đây (đã vào `dev`):**

- **FE-39:** `GET /api/users/me/routing` có JWT trả cấu hình nhận khách của chính người đăng nhập (`id, name, email, role, telegramChatId, acceptingLeads`), không trả hash hay push token. Sale vẫn không được xem `/users` hay sửa routing của người khác. Xem [FE-39](fe-39-admin-phu-trach.md).
- **FE-38:** `POST /feedback/link/:leadId` nhận body tùy chọn `{viewingId}` cho buổi ATTENDED; mỗi buổi có link riêng, link hex cũ thuộc buổi đầu. `/stats` thêm `bySource`, `byAssignee`, `overdueResponses`. `/followups/claim` dùng `type: STAFF_NUDGE, viewingId: 0, viewingTime: assignedAt` cho cảnh báo phản hồi theo phiên; lịch xem vẫn dùng ID và giờ thật. Triển khai, quyền readonly và checkpoint cũ: [FE-38](fe-38-han-phan-hoi.md).
- **FE-33:** [Hợp đồng API tiếp nhận và phân công sale](fe-33-nen-tiep-nhan.md#hợp-đồng-api) bổ sung `POST /leads`, `POST /leads/intake`, lookup theo số điện thoại, chuyển người phụ trách, ghi chú và cấu hình nhận khách. Lead có trạng thái `CONSULTING`; email và ngân sách có thể `null` với khách chưa đặt lịch. Các API đặt lịch cũ giữ đầu vào bắt buộc; phần chuyển tiếp chống trùng số được ghi tại tài liệu FE-33.

## Tổng quan luồng

```
Khách đăng ký xem nhà (web khu khách; app chỉ dành cho nhân viên)
  -> Backend lưu lead + viewing (lead.status = NEW, automationStatus = PENDING)
  -> Backend POST webhook sang n8n (luồng 1)
  -> n8n: AI chấm điểm, gửi email "đã nhận yêu cầu" cho khách,
          báo sale phụ trách (email, Telegram, push; kèm link Duyệt / Đổi giờ)
  -> n8n gọi ngược Backend để cập nhật điểm (automationStatus = COMPLETED); luồng 1 kết thúc, không chờ duyệt
  -> Nhân viên bấm Duyệt (link /duyet/<mã> hoặc web admin) -> Backend gọi luồng 1b
     -> n8n gửi email chốt lịch, PUT status = CONFIRMED
  -> Nếu n8n hỏng giữa chừng (trước khi cập nhật điểm): n8n báo Backend automationStatus = FAILED
Luồng 2 (mỗi giờ): đọc DB, gửi email nhắc lịch / hỏi cảm nhận / nhắc khách WARM, ghi lead_events.
Luồng 7: Backend gọi webhook lead-changed -> n8n đồng bộ sang Mautic contact -> gọi PUT /leads/:id/mautic lưu mauticContactId.
```

## 1. Backend → n8n (webhook)

- Method: `POST`
- Local test: `http://localhost:5678/webhook-test/viewing-requested` (chỉ nhận 1 request mỗi lần bấm Listen)
- Production (workflow đã Publish): `http://localhost:5678/webhook/viewing-requested`
- Trong Docker Compose, backend gọi: `http://n8n:5678/webhook/viewing-requested`
- Header: `X-Webhook-Secret: <WEBHOOK_SECRET>`; n8n kiểm tra header này, **sai thì trả 403**.
- n8n trả `200` ngay (Respond Immediately), sau đó mới xử lý AI.
- Từ FE-35 payload thêm `assignedUserId` (sale phụ trách, `null` nếu chưa có); luồng 1 dùng để báo đúng sale.

Body:

```json
{
  "event": "viewing_requested",
  "eventId": "b7f3c1a2-0f4e-4a55-9d1e-1c2f3a4b5c6d",
  "leadId": 12,
  "viewingId": 7,
  "name": "Nguyen Van A",
  "email": "a@example.com",
  "phone": "0900000000",
  "budget": 3000000000,
  "needs": "Can ho 2 phong ngu gan Da Nang",
  "propertyId": 5,
  "viewingTime": "2026-10-12T09:00:00+07:00",
  "source": "facebook",
  "manageToken": "…",
  "assignedUserId": 3
}
```

- `eventId`: UUID duy nhất mỗi sự kiện (để truy vết; chống xử lý trùng là tùy chọn).
- `viewingId`: buổi xem vừa tạo; luồng 1 dùng để xin link Duyệt / Đổi giờ và để nút cũ không chốt nhầm buổi xem mới.
- `budget`: đơn vị VND, số nguyên (kiểu **số**).
- `needs`: chuỗi rỗng nếu khách không nhập.
- `viewingTime`: ISO 8601, giờ Việt Nam. Backend tự thêm `+07:00` nếu web gửi không kèm múi giờ, nên n8n luôn nhận được chuỗi có múi giờ.
- `source`: nguồn khách (`facebook`, `zalo`, `google`, `direct`...).
- `manageToken`: mã link quản lý lịch của khách (`/lich/<mã>`).

Các webhook khác backend gọi sang n8n (cùng header `X-Webhook-Secret`):

| Webhook | Luồng | Khi nào |
|---|---|---|
| `viewing-admin-action` | [1b](luong/luong-1b-chot-lich-thu-cong.md) | Duyệt, đổi giờ hoặc yêu cầu hẹn lại: `{event: approved \| rescheduled \| reschedule_requested, leadId, viewingId?, by}` |
| `contract-requested` | [3](luong/luong-3-hop-dong.md) | Nhân viên lập hợp đồng: `{contractId}` |
| `feedback-submitted` | [5](luong/luong-5-cam-nhan.md) | Khách gửi cảm nhận: `{feedbackId, leadId}` |
| `report-requested` | [4](luong/luong-4-bao-cao.md) | Quản lý bấm "Tạo báo cáo ngay" |
| `lead-changed` | [7](luong/luong-7-dong-bo-mautic.md) | Lead đổi kết quả AI hoặc trạng thái: `{leadId}` |

## 2. n8n → Backend (callback)

Chung cho mọi callback:

- Header: `X-Webhook-Secret: <WEBHOOK_SECRET>`; **sai hoặc thiếu thì Backend trả 401**.
- Dev (backend chạy trên máy thật, n8n trong Docker): `http://host.docker.internal:8081/api/...`
- Trong Docker Compose, n8n gọi: `http://backend:8081/api/...` (compose đã đặt sẵn biến `BACKEND_URL=http://backend:8081` cho n8n; workflow nên đọc địa chỉ từ biến này để không phải sửa file khi đổi môi trường).

### 2.1. Kết quả AI (thành công)

`PUT /api/leads/{leadId}/ai-result`

```json
{
  "score": 85,
  "level": "HOT",
  "reason": "Ngan sach ro rang, co lich xem nha cu the",
  "aiReply": "Noi dung email xac nhan da soan",
  "emailSent": true,
  "staffNotified": true
}
```

- `level`: `HOT` | `WARM` | `COLD` (HOT khi score >= 70, WARM 40-69, COLD < 40)
- `score`: số nguyên 0-100
- `staffNotified`: `true` nếu ít nhất một kênh (email, Telegram hoặc push) báo được cho nhân viên; `false` nếu không kênh nào gửi được. Luồng 1 báo sale phụ trách ở **mọi** mức, nên thường là `true`.
- `approvalUrl` (tùy chọn, **bỏ từ FE-35**): luồng 1 không còn chờ duyệt nên không gửi nữa; backend vẫn nhận trường này cho các lần chạy cũ đang chờ lúc deploy.
- Backend lưu các trường trên và đặt `automationStatus = COMPLETED`.

### 2.2. Báo lỗi (n8n hỏng giữa chừng)

`PUT /api/leads/{leadId}/automation-status`

```json
{
  "status": "FAILED",
  "error": "Gemini 503 sau 3 lan thu lai"
}
```

- `status`: n8n chỉ gửi `FAILED`.
- `error`: mô tả ngắn (tùy chọn). Backend lưu vào cột `automationError` của lead.
- Backend đặt `automationStatus = FAILED`.

### 2.3. Đổi trạng thái bán hàng của lead (tuần 2)

`PUT /api/leads/{leadId}/status`

```json
{
  "status": "CONFIRMED",
  "note": "Nhan vien duyet lich qua email"
}
```

- `status`: `CONSULTING` | `NEW` | `CONFIRMED` | `VIEWED` | `DEPOSIT` | `SIGNED` | `LOST`. Giá trị khác: `400`.
- `note`: tùy chọn.
- Backend lưu `leads.status` và **tự ghi** một dòng `lead_events` với `type = STATUS_CHANGED`, `note = "<cũ> -> <mới>: <note>"`.
- Nếu trạng thái mới **trùng** trạng thái cũ: không đổi gì, không ghi `STATUS_CHANGED`, vẫn trả `200`.
- Lead đang `DEPOSIT` không chuyển thẳng sang `LOST` được: trả `400` (BF-06). Quản lý phải từ chối hợp đồng trước, lead tự về `VIEWED`. Áp dụng cả cho `PUT /api/leads/{leadId}/admin-status` của web admin.

### 2.4. Ghi sự kiện của lead (tuần 2)

`POST /api/leads/{leadId}/events`

```json
{
  "type": "REMINDER_SENT",
  "note": "Nhac lich xem 12/10 09:00"
}
```

- `type`: một trong các giá trị ở bảng `lead_events` (mục 4). Giá trị khác: `400`.
- Trả `201` và dòng vừa tạo `{ "id", "leadId", "type", "note", "createdAt" }`. Lead không tồn tại: `404`.

### 2.5. Cập nhật thông tin Mautic (L7 đồng bộ)

`PUT /api/leads/{leadId}/mautic`

```json
{
  "mauticContactId": 12,
  "mauticPoints": 50
}
```

- Header: `X-Webhook-Secret: <WEBHOOK_SECRET>`.
- `mauticContactId`: ID contact bên Mautic sau khi L7 tạo / cập nhật contact thành công.
- `mauticPoints`: điểm tương tác Mautic (L8 đồng bộ về).
- Trả `200` và lead sau khi cập nhật.

### 2.6. Tra cứu lead theo Mautic contact (L8 Mautic báo về)

`GET /api/leads/by-mautic/{contactId}?email={email}`

- Header: `X-Webhook-Secret: <WEBHOOK_SECRET>`.
- Query param: `email` (tùy chọn).
- Trả `200` và object `Lead` nếu tìm thấy, hoặc `null` nếu chưa liên kết.

### 2.7. Hồ sơ đồng bộ Mautic (L7, FE-40)

`GET /api/leads/{leadId}/mautic-context`

- Header: `X-Webhook-Secret: <WEBHOOK_SECRET>`.
- Trả `leadId`, `name`, `email` (có thể `null`), `phone`, `phoneNormalized`, `level`, `status`, `source`, `score`, `mauticContactId`. Không trả link duyệt hay mã bí mật.
- L7 đọc lại hồ sơ hiện tại bằng API này để đồng bộ contact kể cả khách chưa có email. Xem [FE-40](fe-40-l7-khong-email.md).

## 3. API backend

Bảng tóm tắt các API chính; chi tiết từng nhóm ở các mục 3.1 đến 3.9 và trong Swagger (`/api/docs`).

| Method | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/api/viewings` | Khách đăng ký xem nhà; tạo lead + viewing, gọi webhook n8n (nhận kèm `source`) |
| GET | `/api` | Công khai. Kiểm tra backend đang chạy |
| GET | `/api/leads` | Danh sách khách (lọc theo `?level=HOT`), mới nhất trước |
| GET | `/api/leads/{id}` | Chi tiết một khách (trả thêm viewing, property, source, mauticContactId) |
| GET | `/api/leads/by-mautic/{contactId}` | n8n tra cứu lead theo Mautic contact (mục 2.6, cần `X-Webhook-Secret`) |
| PUT | `/api/leads/{id}/ai-result` | n8n cập nhật kết quả AI (mục 2.1) |
| PUT | `/api/leads/{id}/automation-status` | n8n báo lỗi (mục 2.2) |
| GET | `/api/properties` | Danh sách bất động sản (bản gọn: không có `images`, `panoramas`, thay bằng `imageCount`, `panoramaCount`) |
| GET | `/api/stats` | Đếm lead theo mức, trả `{ "total": 0, "hot": 0, "warm": 0, "cold": 0 }` (thêm trường ở mục 3.8) |
| GET | `/api/viewings` | Danh sách lịch xem nhà |
| GET | `/api/viewings/slots?propertyId={id}` | Công khai. Các khung giờ khách đặt được của một căn, đánh dấu khung đã kín (mục 3.1) |
| GET | `/api/properties/{id}` | Một bất động sản (tuần 2). Không có: `404` |
| PUT | `/api/leads/{id}/status` | n8n đổi trạng thái bán hàng (mục 2.3, cần `X-Webhook-Secret`) |
| PUT | `/api/leads/{id}/mautic` | n8n cập nhật ID / điểm Mautic (mục 2.5, cần `X-Webhook-Secret`) |
| POST | `/api/leads/{id}/events` | n8n ghi sự kiện (mục 2.4, cần `X-Webhook-Secret`) |
| GET | `/api/leads/{id}/events` | Dòng thời gian của lead, cũ nhất trước |

### 3.1. Khung giờ đặt lịch xem nhà (FE-34)

`GET /api/viewings/slots?propertyId=5` (không cần đăng nhập, không trả dữ liệu khách):

```json
{
  "earliest": "2026-11-11T03:00:00.000Z",
  "latest": "2026-11-24T12:16:17.655Z",
  "days": [
    {
      "date": "2026-11-11",
      "slots": [
        { "time": "10:00", "start": "2026-11-11T03:00:00.000Z", "available": true },
        { "time": "11:00", "start": "2026-11-11T04:00:00.000Z", "available": false }
      ]
    }
  ]
}
```

- `date`, `time`: ngày và giờ Việt Nam (UTC+7). `start`: giờ bắt đầu dạng ISO UTC, gửi lại nguyên giá trị này vào `viewingTime` khi đặt lịch.
- `available: false`: đã có khách hẹn căn này trong vòng dưới 60 phút.
- Căn không nhận đặt lịch (đã giữ cọc, đã bán, ẩn): `400`. Không có căn: `404`. `propertyId` không phải số: `400`.

Quy tắc giờ cho `POST /api/viewings` (khách, bot) và `PUT /api/viewings/{id}` (nhân viên). Sai thì trả `400`, không lưu gì:

| Quy tắc | Áp dụng | Thông báo |
|---|---|---|
| Trong khoảng 08:00-19:00 giờ Việt Nam | Mọi người | `Giờ xem nhà phải trong khoảng 08:00–19:00` |
| Tròn giờ (phút và giây bằng 0) | Khách, bot | `Giờ xem nhà phải tròn giờ (ví dụ 09:00, 10:00)` |
| Đặt trước ít nhất 3 giờ làm việc (08:00-21:00), làm tròn lên giờ chẵn | Khách, bot | `Cần đặt trước ít nhất 3 giờ làm việc. Khung sớm nhất còn đặt được: 10:00 11/11/2026` |
| Không quá 14 ngày tới | Khách, bot | `Chỉ nhận đặt lịch trong vòng 14 ngày tới` |
| Ở tương lai | Nhân viên | `viewingTime phải ở trong tương lai` |

Hai lịch cùng một căn vẫn phải cách nhau ít nhất 60 phút, sai thì trả `409` như trước.

Chặn đặt trùng và lạm dụng cho `POST /api/viewings` (khách, bot):

| Tình huống | Mã | Thông báo (rút gọn) |
|---|---|---|
| Ô ẩn `website` (honeypot) có chữ. Form web luôn gửi rỗng; không lưu gì | `400` | `Yêu cầu không hợp lệ` |
| Căn không còn `AVAILABLE` (đã giữ cọc, đã bán, ẩn), kể cả khi vừa đổi trạng thái lúc đặt | `400` | `Căn nhà này hiện không nhận đặt lịch xem` |
| Căn đã có lịch cách dưới 60 phút (kiểm tra có khoá theo căn nên hai yêu cầu cùng lúc không cùng lọt) | `409` | `Khung giờ này đã có khách hẹn xem căn này (lúc …)` |
| Cùng email đã có lịch chờ cho căn này | `409` | `Bạn đã có lịch xem căn này lúc …` |
| Khách đang có hợp đồng cọc | `409` | `Bạn đang làm hợp đồng đặt cọc với chúng tôi…` |
| Quá giới hạn theo IP | `429` | Mặc định 5 lần mỗi 10 phút (`BOOKING_RATE_LIMIT`, `BOOKING_RATE_TTL_MS`) |

- Request có header `X-Webhook-Secret` đúng (luồng 6) được miễn giới hạn `429`, vì mọi khách Telegram đi chung IP của n8n.
- IP khách là `req.ip` sau khi backend tin `TRUST_PROXY_HOPS` proxy (mặc định 1). Đặt sai số này thì mọi khách bị tính chung một IP, hoặc IP bị giả được.
- `PUT /api/viewings/{id}` (đổi giờ) cũng kiểm tra `409` khung 60 phút, bỏ qua chính buổi xem đó.

### 3.2. Link Duyệt / Đổi giờ cho nhân viên (FE-35)

| Method | Đường dẫn | Quyền | Kết quả |
|---|---|---|---|
| POST | `/api/viewings/{id}/staff-links` | Secret | `{approveUrl, rescheduleUrl}` trỏ tới `/duyet/<mã>` trên web; 404 nếu buổi xem không có |
| GET | `/api/viewings/staff-links/{token}` | Công khai (token có chữ ký) | Tóm tắt `{action, leadName, propertyName, propertyAddress, viewingTime, leadStatus, viewingStatus, canAct, refusal}`; không trả SĐT/email, không đổi gì. Token sai: 404 |
| POST | `/api/viewings/staff-links/{token}/confirm` | Công khai (token có chữ ký) | `{ok, action, already?}`; 400 kèm lý do khi khách đã hủy, đã duyệt, có buổi xem mới hơn, quá giờ hẹn, hoặc AI chưa chấm (chỉ với duyệt); 502 nếu n8n lỗi |
| GET | `/api/users/{id}/notify-target` | Secret | `{id, name, email, role, telegramChatId, pushToken}` cho sub-workflow thông báo; không trả hash |

Token là `base64url({v: viewingId, a: approve|reschedule}).HMAC-SHA256(WEBHOOK_SECRET)`; hạn dùng tính theo giờ hẹn hiện tại của buổi xem lúc bấm, không nằm trong token. Xác nhận gọi webhook `viewing-admin-action` với `event` = `approved` | `reschedule_requested` và `viewingId` (luồng 1b). Xem [FE-35](fe-35-thong-bao-phu-trach.md).

### 3.3. Lịch sử chat Telegram của lead (FE-36)

| Method | Đường dẫn | Nội dung |
|---|---|---|
| GET | `/api/leads/{id}/chat-logs` | Cần đăng nhập (JWT). Trả `[{id, createdAt, route, question, reply, escalated}]`, cũ nhất trước, tối đa 200 log mới nhất; không có `chatId` và `executionId`. Lead không tồn tại: 404 |
| POST | `/api/leads/intake` | Thêm `chatId?` (chuỗi, tối đa 40 ký tự). Sau khi lead lưu xong, mọi log cũ của chat đó chưa thuộc lead nào được gắn vào lead. Chỉ đọc khi có `X-Webhook-Secret`; `POST /api/leads` (JWT) bỏ qua `chatId` |
| POST | `/api/viewings` | Thêm `chatId?` (chuỗi, tối đa 40 ký tự). Chỉ gắn chat khi request có `X-Webhook-Secret` (bot Telegram); form web công khai gửi `chatId` thì bị bỏ qua |

Log đã thuộc lead khác giữ nguyên. Lỗi khi gắn chỉ ghi log ở backend, không làm thất bại lead hay lịch xem.

### 3.4. Đăng nhập

| Method | Đường dẫn | Quyền | Nội dung |
|---|---|---|---|
| POST | `/api/auth/login` | Công khai | `{email, password}`; trả `200` với `{accessToken, user}` |
| GET | `/api/auth/me` | JWT | Thông tin người đang đăng nhập |

### 3.5. Khách, người phụ trách và nhân viên

Quy tắc nghiệp vụ: [nghiep-vu/01-tiep-nhan-va-phan-cong.md](nghiep-vu/01-tiep-nhan-va-phan-cong.md). Chi tiết FE-33: [fe-33-nen-tiep-nhan.md](fe-33-nen-tiep-nhan.md).

| Method | Đường dẫn | Quyền | Nội dung |
|---|---|---|---|
| POST | `/api/leads` | JWT | Nhân viên thêm khách ngoài hệ thống (FE-33, FE-37) |
| POST | `/api/leads/intake` | Secret | Bot và n8n tạo khách; tra trùng theo số điện thoại; nhận thêm `chatId?` (mục 3.3) |
| GET | `/api/leads/lookup?phone=` | JWT | Tra khách theo số điện thoại; trả `{lead}` (`null` nếu chưa có) |
| PUT | `/api/leads/{id}/assignee` | Quản lý | `{assignedUserId, note?}`: chuyển khách sang sale khác |
| POST | `/api/leads/{id}/notes` | JWT | `{note}`: ghi chú kết quả liên hệ vào dòng thời gian |
| POST | `/api/leads/{id}/approve` | JWT | Duyệt lịch từ web admin (gọi luồng 1b) |
| PUT | `/api/leads/{id}/admin-status` | JWT | Đổi trạng thái từ web admin; cùng quy tắc mục 2.3 |
| GET | `/api/users` | Quản lý | Danh sách tài khoản |
| POST | `/api/users` | Quản lý | `{email, name, password, role: MANAGER \| SALE}` tạo tài khoản |
| GET | `/api/users/assignees` | JWT | `[{id, name, role, acceptingLeads}]` danh sách người nhận khách |
| GET | `/api/users/me/routing` | JWT | Cấu hình nhận khách của chính mình (FE-39) |
| PUT | `/api/users/{id}/routing` | JWT | `{acceptingLeads?, telegramChatId?}`; chỉ sửa được của mình, quản lý sửa được của người khác (FE-39) |
| POST | `/api/users/me/push-token` | JWT | Lưu push token của app (trả `200`) |
| DELETE | `/api/users/me/push-token` | JWT | Xoá push token (trả `200`) |

### 3.6. Hợp đồng đặt cọc (luồng 3)

Quy tắc nghiệp vụ và điều kiện lập hợp đồng: [nghiep-vu/02-dat-lich-den-dat-coc.md](nghiep-vu/02-dat-lich-den-dat-coc.md) mục 4. Cách luồng n8n chạy: [luong-3-hop-dong.md](luong/luong-3-hop-dong.md).

| Method | Đường dẫn | Quyền | Nội dung |
|---|---|---|---|
| POST | `/api/contracts` | JWT | `{leadId, depositAmount}`: lập hợp đồng, gọi webhook `contract-requested`. Sai điều kiện: `400` hoặc `409` kèm lý do. Căn đã có hợp đồng còn hiệu lực (`DRAFTING`, `PENDING_APPROVAL`, `SENT`, `SIGNED`): `409` (cả khi hai người bấm cùng lúc). Căn không còn `AVAILABLE`: `400`. Tạo xong, căn chuyển sang `RESERVED` |
| GET | `/api/contracts` | JWT | Danh sách hợp đồng |
| GET | `/api/contracts/{id}` | JWT | Chi tiết hợp đồng (không trả `resumeUrl`) |
| POST | `/api/contracts/{id}/approve` | Quản lý | Duyệt (đánh thức luồng 3) |
| POST | `/api/contracts/{id}/reject` | Quản lý | `{reason}`: từ chối |
| POST | `/api/contracts/{id}/deposit-received` | Quản lý | Xác nhận đã nhận tiền cọc; chỉ khi hợp đồng đã ký, và chỉ một lần |
| PUT | `/api/contracts/{id}/draft` | Secret | Luồng 3 lưu bản nháp: `{title, content, aiReview, resumeUrl}`. Đã có bản nháp: `400` |
| POST | `/api/contracts/{id}/issue-token` | Secret | Luồng 3 phát link ký sau khi duyệt |
| PUT | `/api/contracts/{id}/rejected` | Secret | Luồng 3 đánh dấu từ chối: `{reason}` |
| PUT | `/api/contracts/{id}/expired` | Secret | Luồng 3 đánh dấu hết hạn: `{reason?}` |
| GET | `/api/sign/{token}` | Công khai | Khách xem hợp đồng để ký |
| POST | `/api/sign/{token}` | Công khai | `{signerName, signature, agree}`: khách ký; backend lưu thêm giờ ký và IP |

### 3.7. Cảm nhận sau buổi xem (luồng 5)

Cách luồng n8n chạy: [luong-5-cam-nhan.md](luong/luong-5-cam-nhan.md).

| Method | Đường dẫn | Quyền | Nội dung |
|---|---|---|---|
| GET | `/api/feedback/{token}` | Công khai | Tên khách, căn nhà, giờ xem; không lộ email, SĐT |
| POST | `/api/feedback/{token}` | Công khai | `{rating, interest, comment?}`; chỉ gửi được một lần, lần hai trả `409` |
| POST | `/api/feedback/link/{leadId}` | Secret | Luồng 2 xin link cảm nhận; body tùy chọn `{viewingId}` (FE-38) |
| PUT | `/api/feedback/{id}/ai-result` | Secret | Luồng 5 lưu `{sentiment, summary, nextAction}` |
| GET | `/api/feedback/lead/{leadId}` | JWT | Cảm nhận gần nhất của khách (thẻ trên trang chi tiết) |

### 3.8. Báo cáo và thống kê (luồng 4)

Cách luồng n8n chạy: [luong-4-bao-cao.md](luong/luong-4-bao-cao.md).

| Method | Đường dẫn | Quyền | Nội dung |
|---|---|---|---|
| POST | `/api/reports` | Secret | Luồng 4 lưu báo cáo: `{periodStart, periodEnd, metrics, analysis, alerts}` |
| POST | `/api/reports/breakdowns` | Secret | L4 mới (local 12/11): `{periodStart, periodEnd}` ISO8601, khoảng đầu gồm/cuối loại, tối đa 93 ngày và không tương lai. Trả `{version:1, periodStart, periodEnd, asOf, responseScope, sales[], properties[], dataQuality}`; thành công 201, thiếu/sai secret 401, kỳ sai 400. [Hợp đồng n8n và cách tính](luong/luong-4-sale-va-can-nha.md). Lưu nguyên kết quả tại `metrics.breakdowns`; báo cáo cũ không có trường này vẫn hợp lệ |
| GET | `/api/reports` | Quản lý | Danh sách báo cáo |
| GET | `/api/reports/{id}` | Quản lý | Một báo cáo. Không có: `404` |
| POST | `/api/reports/run` | Quản lý | Tạo báo cáo ngay (gọi webhook `report-requested`) |
| GET | `/api/stats` | JWT | `{total, hot, warm, cold, bySource, byAssignee, overdueResponses}` |
| GET | `/api/stats/tasks` | JWT | `{pendingAttendance, wantsDeposit, notInterested, reservedBackups, customerRequests}`: việc cần làm trên trang tổng quan |
| GET | `/api/stats/funnel` | JWT | `{total, byStatus, noShow, conversionRate, pendingApproval, failedAutomation, viewingsToday}`: phễu bán hàng |
| GET | `/api/stats/team?period=now\|week\|month` | Quản lý | Trang Đội sale: `{period, from, to, acceptingSales, totalSales, owners[], totals}`. Mỗi phần tử `owners`: `{id, name, role, acceptingLeads, open:{CONSULTING, NEW, CONFIRMED, VIEWED, DEPOSIT, total}, overdue, idle, assigned, attended, signed, lost}`. `now` (mặc định) điền `open`, `overdue` (quá hạn phản hồi), `idle` (khách mở không có sự kiện quá 7 ngày); `week`/`month` điền `assigned`, `attended`, `signed`, `lost` theo người đang phụ trách, mốc 00:00 thứ Hai hoặc ngày 1 giờ Việt Nam. Mọi sale đều có dòng; quản lý và `id: null` (chưa phân công) chỉ hiện khi có số. `period` khác ba giá trị trên trả `400`, sale trả `403` |

### 3.9. Lịch xem và nhà (web admin, khách tự quản lý)

| Method | Đường dẫn | Quyền | Nội dung |
|---|---|---|---|
| GET | `/api/viewings/schedule` | JWT | Lịch xem kèm khách và căn: `[{id, viewingTime, viewingStatus, leadId, leadName, leadPhone, leadLevel, leadStatus, propertyId, propertyName, propertyAddress, propertyStatus}]`, theo giờ xem tăng dần |
| PUT | `/api/viewings/{id}` | JWT | `{viewingTime}`: nhân viên đổi giờ (quy tắc mục 3.1) |
| PUT | `/api/viewings/{id}/attendance` | JWT | `{outcome: ATTENDED \| NO_SHOW, next?, viewingTime?, note?}`. Với `NO_SHOW`: `next` là `RESCHEDULE` (kèm `viewingTime`) hoặc `CLOSE`. `NO_SHOW` chỉ ghi nhận được khi khách đã chốt lịch (`CONFIRMED`). Buổi xem đã ghi nhận rồi: `400` |
| GET | `/api/viewings/manage/{token}` | Công khai | Khách xem thông tin lịch qua link trong email (`/lich/<mã>`) |
| POST | `/api/viewings/manage/{token}/cancel` | Công khai | Khách tự hủy lịch |
| POST | `/api/viewings/manage/{token}/reschedule-request` | Công khai | `{note?}`: khách xin đổi lịch |
| GET | `/api/properties/admin/all` | JWT | Mọi căn kể cả căn ẩn, cho trang Quản lý nhà |
| POST | `/api/properties` | Quản lý | Thêm căn. `status` chỉ nhận `AVAILABLE` hoặc `HIDDEN` (mặc định `AVAILABLE`); `SOLD`: `400` |
| PUT | `/api/properties/{id}` | Quản lý | Sửa căn, gồm đổi `status` (quy tắc bên dưới) |
| DELETE | `/api/properties/{id}` | Quản lý | Ẩn căn (xoá mềm, đặt `HIDDEN`); cùng quy tắc đổi trạng thái |

Trạng thái căn (`properties.status`): `AVAILABLE` (mở bán), `RESERVED` (đang giữ cọc), `SOLD` (đã bán), `HIDDEN` (ẩn). Danh sách công khai không trả căn `HIDDEN` và `SOLD`; căn `RESERVED` vẫn hiện nhưng không nhận đặt lịch.

- `RESERVED` do hợp đồng quyết định: tạo hợp đồng đặt căn sang `RESERVED`; hợp đồng bị từ chối hoặc hết hạn thì trả về `AVAILABLE` nếu không còn hợp đồng nào khác.
- Căn đang có hợp đồng còn hiệu lực không đổi trạng thái thủ công được: `409` `Căn này đang có hợp đồng #<id> (<trạng thái>), không đổi trạng thái được`.
- `SOLD` chỉ đặt được khi căn đang `RESERVED` và hợp đồng đã `SIGNED`; sai thì `400` `Chỉ đánh dấu "đã bán" được khi căn đang giữ cọc và hợp đồng đã ký`. Thành công thì ghi sự kiện `PROPERTY_SOLD` cho lead của hợp đồng.
- Những lịch xem đã đặt trước khi căn thành `RESERVED` vẫn giữ nguyên; nhân viên gọi báo khách.

## 4. Dữ liệu (bảng chính)

| Bảng | Trường chính |
|---|---|
| `properties` | id, name, address, price, area, type, status, imageUrl, description; chi tiết (FE-31): bedrooms, bathrooms, floors, landArea, floorArea, roadWidth, direction, legalStatus, furnishing, occupancy (mã trong `backend/src/properties/property-options.ts`); mảng: images (link), features, furniture, nearby (`{ category, name, distance }`), panoramas (`{ title, url }`). Mảng `null` = chưa nhập, `[]` = đã xoá hết |
| `leads` | id, name, email, phone, budget, needs, score, level, reason, aiReply, emailSent, staffNotified, status, source, mautic_contact_id, mautic_points, automationStatus, automationError, eventId, createdAt, approvalUrl; FE-33: phone_normalized, assigned_user_id, assigned_at, response_due_at, first_response_at; lost_reason (lý do mất khách, `null` nếu chưa mất) |
| `viewings` | id, propertyId, leadId, viewingTime, status, manage_token |
| `contracts` | Ngoài các trường lập và ký hợp đồng: `deposit_received_at`, `deposit_received_by` (ai nhận cọc, lúc nào). Chỉ mục duy nhất một phần `uq_contracts_active_property` trên `property_id` khi trạng thái là `DRAFTING`, `PENDING_APPROVAL`, `SENT` hoặc `SIGNED`: mỗi căn tối đa một hợp đồng còn hiệu lực |
| `lead_events` | id, leadId, type, note, createdAt |

Các bảng khác do backend tự tạo khi khởi động (TypeORM `synchronize`): `users`, `contracts`, `feedbacks`, `followup_tasks` (mục 6), `chat_logs` (mục 7), `weekly_reports`. Hai bảng `kb_documents` và `rag_chunks` phục vụ luồng 6 và 6b (xem [luong-6b-nap-tri-thuc.md](luong/luong-6b-nap-tri-thuc.md)).

Giá trị `viewings.status`: `NEW` (chờ xử lý), `ATTENDED` (khách đã đến), `NO_SHOW` (khách không đến), `CANCELLED` (đã huỷ). Lead chuyển `VIEWED` chỉ khi nhân viên ghi nhận `ATTENDED`; luồng 2 không tự chuyển.

Giá trị `leads.status`: `CONSULTING`, `NEW`, `CONFIRMED`, `VIEWED`, `DEPOSIT`, `SIGNED`, `LOST`. Lý do mất khách (`LOST`): `NO_SHOW`, `NOT_INTERESTED`, `CUSTOMER_CANCELLED`, `EXPIRED`, `OTHER`.

Giá trị `lead_events.type` (danh sách đầy đủ ở `backend/src/leads/lead.constants.ts`):
- Tiếp nhận và phân công: `LEAD_CREATED`, `LEAD_ASSIGNED`, `LEAD_REASSIGNED`, `LEAD_REOPENED`, `NOTE_ADDED`, `RESPONSE_OVERDUE`
- Luồng 1: `AI_SCORED`, `APPROVED`, `RESCHEDULE_REQUESTED`, `APPROVAL_TIMEOUT`
- Luồng 2: `REMINDER_SENT`, `FEEDBACK_ASKED`, `WARM_NUDGE_SENT`, `WARM_NURTURE_STARTED`, `HOT_NUDGE_SENT`, `COLD_NURTURE_STARTED`, `LEAD_EXPIRED`, `LEAD_EXPIRED_NOTIFIED`, `STAFF_NUDGE_SENT`, `FOLLOWUP_FAILED`, `ATTENDANCE_CHECK_SENT`, `ATTENDANCE_ESCALATED`
- Lịch xem: `VIEWING_RESCHEDULED`, `VIEWING_NO_SHOW`, `VIEWING_CANCELLED`, `CUSTOMER_RESCHEDULE_REQUESTED`
- Cảm nhận: `FEEDBACK_RECEIVED`, `FEEDBACK_ANALYZED`, `FEEDBACK_WORK_CREATED`, `FEEDBACK_WORK_UPDATED`, `FEEDBACK_ALERT_RESOLVED`
- Hợp đồng: `CONTRACT_CREATED`, `CONTRACT_DRAFTED`, `CONTRACT_SENT`, `CONTRACT_SIGNED`, `CONTRACT_REJECTED`, `CONTRACT_EXPIRED`, `DEPOSIT_RECEIVED`, `PROPERTY_RESERVED`, `PROPERTY_SOLD`
- Mautic và trạng thái: `MAUTIC_SYNCED`, `MAUTIC_SCORE_CHANGED`, `STATUS_CHANGED`

## 5. Xử lý lỗi

- Backend: nếu gọi n8n thất bại, thử lại tối đa 3 lần (cách nhau 2 giây), vẫn lỗi thì đặt `automationStatus = FAILED` và ghi log.
- n8n: bật Retry On Fail (3 lần, chờ 5 giây) cho **mọi** node có thể lỗi. Các node gọi Mautic bật `continueErrorOutput` để rẽ nhánh sang node "Báo lỗi Backend" ghi `FOLLOWUP_FAILED`. Lỗi không được bắt sẽ kích hoạt [Error workflow](luong/error-workflow.md) báo quản lý; xem cách hai cơ chế bổ trợ nhau ở tài liệu đó.

## 6. L2: giữ tác vụ và checkpoint gửi

Tất cả endpoint sau cần `X-Webhook-Secret`. Chỉ deploy workflow L2 mới sau khi backend đã có module Followups và bảng `followup_tasks`.

| Method | Đường dẫn | Nội dung |
|---|---|---|
| POST | `/api/followups/claim` | `{leadId, viewingId, viewingTime, type, owner}`; backend kiểm tra điều kiện và trả `{claimed, taskId?, token?, resume?}` |
| POST | `/api/followups/{id}/start` | `{token}`; trả `{allowed}`; ghi ACTION_STARTED trước khi gọi dịch vụ ngoài |
| POST | `/api/followups/{id}/action-done` | `{token, mauticContactId?}`; checkpoint sau khi dịch vụ ngoài xác nhận; contact ID bắt buộc với WARM |
| POST | `/api/followups/{id}/complete` | `{token}`; transaction lưu event, trạng thái tác vụ và contact ID; không tự đổi khách sang VIEWED; lặp lại không tạo thêm event |
| POST | `/api/followups/{id}/fail` | `{token, error}`; FAILED trước khi gửi, REVIEW khi không chắc kết quả gửi, giữ ACTION_DONE để chỉ thử lại metadata |
| POST | `/api/followups/{id}/resolve` | Xử lý REVIEW sau khi kiểm tra nhà cung cấp: `{token, resolution: "delivered" / "not-delivered", mauticContactId?}` |

`owner` là execution ID n8n. Token tác vụ là bí mật quyền sở hữu, không trả về API công khai. REMINDER, ATTENDANCE_CHECK và ATTENDANCE_ESCALATE dùng khóa theo lead + viewing + thời gian xem; các loại còn lại theo lead + loại. FEEDBACK chỉ chọn VIEWED + viewing ATTENDED; lịch quá giờ chưa ghi nhận được nhắc xác nhận, không tự xem là đã đến. Hai execution cùng nhận một tác vụ bị chặn bằng row lock và unique task key. SMTP không hỗ trợ giao dịch chung với PostgreSQL: mất phản hồi sau khi gửi thì giữ REVIEW, không tự gửi lại. Chỉ state ACTION_DONE được tự tiếp tục hoàn tất database.

Chi tiết cấu hình và cách kiểm tra: [luong/luong-2-follow-up.md](luong/luong-2-follow-up.md).

## 7. L6: ghi log hội thoại bot Telegram

Cần `X-Webhook-Secret`. Bảng `chat_logs` tự tạo khi backend khởi động (TypeORM `synchronize`). FE-36: log mới của một chat đã gắn lead tự mang `lead_id` của log gắn gần nhất (không cần gửi).

| Method | Đường dẫn | Nội dung |
|---|---|---|
| POST | `/api/chat-logs` | `{chatId, route, question, reply, channel?, usedFallback?, escalated?, staffNotified?, executionId?}`; trả `{id}` |

`route`: `COMMAND` (lệnh /start, tin không phải chữ), `BLOCKED` (Guardrails chặn), `AGENT` (AI Agent trả lời), `STAFF` (khách muốn gặp nhân viên), `OUT_OF_SCOPE` (ngoài phạm vi). Backend che email và dãy số bắt đầu bằng 0 hoặc +84 dài 9-12 chữ số (số điện thoại, CCCD) trong `question`, `reply` trước khi lưu. Cách luồng 6 chạy: [luong/luong-6-telegram-agent.md](luong/luong-6-telegram-agent.md).

## 8. L5: theo dõi sau phản hồi

Quy tắc: [chăm sóc mục 1.1](nghiep-vu/03-cham-soc-va-marketing.md). Bàn giao n8n và test: [L5 theo dõi](luong/luong-5-theo-doi-sau-phan-hoi.md).

Backend tạo `feedback_work` cùng transaction nhận phản hồi; một dòng duy nhất/feedback. Event mới: `FEEDBACK_WORK_CREATED`, `FEEDBACK_WORK_UPDATED`, `FEEDBACK_ALERT_RESOLVED`. Bảng `feedback_work_history` ghi kết quả; `feedback_work_alerts` giữ checkpoint giao thông báo. Không backfill phản hồi cũ.

| Method | Đường dẫn | Quyền và hợp đồng |
|---|---|---|
| GET | `/api/feedback-work?filter=OPEN` | JWT; sale chỉ thấy việc khách đang phụ trách, quản lý thấy tất cả. OPEN/PENDING/IN_PROGRESS/TODAY/OVERDUE/COMPLETED/ALL; tối đa 200 dòng, hạn cũ trước |
| GET | `/api/feedback-work/lead/{leadId}` | JWT chủ khách/quản lý; tất cả việc của khách, có lịch sử |
| POST | `/api/feedback-work/{id}/result` | JWT chủ khách/quản lý; `{version,outcome,note,complete?,nextDueAt?,propertyId?,viewingTime?}` |
| GET | `/api/feedback-work/context/{feedbackId}` | `X-Webhook-Secret`; dữ liệu phẳng phục vụ AI L5, đúng buổi xem của phản hồi |
| GET | `/api/feedback-work/alerts/due` | `X-Webhook-Secret`; mảng tối đa 200 `{workId,version,assigneeId,kind}` |
| POST | `/api/feedback-work/alerts/start` | `X-Webhook-Secret`; body một item từ due. Kiểm tra lại hạn, chủ khách, phiên bản, khóa lead/việc; trả `{allowed:false}` hoặc `{allowed:true,alertId,token,kind,leadId,assigneeId?,title,message,actions}` |
| POST | `/api/feedback-work/alerts/{id}/finish` | `X-Webhook-Secret`; `{token,delivered,error?}`. delivered chỉ true khi nhà cung cấp xác nhận; false giữ REVIEW |
| GET | `/api/feedback-work/alerts/review` | JWT MANAGER; REVIEW và STARTED hết lease, không trả token |
| POST | `/api/feedback-work/alerts/{id}/resolve` | JWT MANAGER; `{delivered,note}` sau đối soát provider. true -> SENT; false xóa checkpoint để lần quét sau thử lại nếu còn đủ điều kiện; event lưu người/lý do |

`outcome`: CONTACTED/NEXT_VIEWING/NEEDS_TIME/UNREACHABLE/NOT_BUYING. `note` bắt buộc, trim không rỗng, tối đa 2.000 ký tự; version là số nguyên dương. Ngày dùng ISO8601 có múi giờ; UI gửi +07:00. CONTACTED hoàn tất chỉ khi complete=true; còn lại cần nextDueAt tương lai. NEEDS_TIME/UNREACHABLE luôn cần hạn tương lai. NEXT_VIEWING cần propertyId và viewingTime, trả lỗi nếu không tạo được lịch thật; không nhận nextDueAt. NOT_BUYING áp dụng quy tắc đóng khách, chặn hợp đồng đang hiệu lực. Chưa có phiên bản mới nhất/đã hoàn tất: 409. Khác sale phụ trách: 403. Không lộ token cảm nhận hoặc thông tin kênh thông báo trong danh sách việc.

Danh sách trả `id,feedbackId,leadId,viewingId,version,status,dueAt,completedAt,leadName,leadStatus,assignedUserId,assignedUserName,propertyName,viewingTime,rating,interest,comment,aiSummary,submittedAt,overdue,history[]`. History gồm actorName, outcome, note, nextDueAt, nextViewingId, createdAt. Trạng thái việc khác trạng thái lead; không tự đặt cọc khi khách chọn DEPOSIT trong phản hồi.

Thông báo NEW chỉ cho phiên bản đầu trước hạn; REMIND từ hạn tới mốc escalateAt; ESCALATE sau thêm 2 giờ làm việc. Mỗi `(workId,version,kind,assigneeId)` chỉ một checkpoint. STARTED có lease 30 phút; hết lease giữ REVIEW, không nhận lại để gửi. Finish lặp lại sau SENT trả ok; token sai trả 409. Khi khách được đóng/ký, việc dừng và các lần gửi chưa bắt đầu bị chặn. Thông báo đã bắt đầu giao dịch ngoài trước thao tác đóng/chuyển sale có thể đang trên đường giao, không thể thu hồi bằng DB.

## Lịch sử thay đổi

| Ngày | Ai sửa | Nội dung |
|---|---|---|
| 09/10/2026 | Cả nhóm | Đồng bộ code trên `main` |
| 12/10/2026 | Hoàng (Hậu duyệt) | Tuần 2: thêm `PUT /leads/{id}/status`, `POST`/`GET /leads/{id}/events`, `lead_events` |
| 21/10/2026 | Hậu | Thêm cột `source`, `mautic_contact_id`, `mautic_points`, endpoint `PUT /api/leads/{id}/mautic`, webhook `lead-changed` |
| 06/11/2026 | Hoàng | FE-32: `POST /api/chat-logs`, bảng `chat_logs` cho log hội thoại luồng 6 |
| 10/11/2026 | Hậu | FE-33: API tiếp nhận/tra trùng theo SĐT, gán/chuyển sale, ghi chú, cấu hình nhận khách; CONSULTING, email/ngân sách nullable; chi tiết trong `fe-33-nen-tiep-nhan.md` |
| 10/11/2026 | Hoàng | FE-34: `GET /api/viewings/slots`, quy tắc khung giờ đặt lịch (mục 3.1) |
| 11/11/2026 | Hoàng | FE-35: link Duyệt/Đổi giờ (mục 3.2), `GET /api/users/{id}/notify-target`, payload `viewing_requested` thêm `assignedUserId`, bỏ `approvalUrl` |
| 11/11/2026 | Hoàng | FE-36: `GET /api/leads/{id}/chat-logs` (mục 3.3), `chatId?` cho `POST /api/leads/intake` và `POST /api/viewings` (chỉ đọc khi có `X-Webhook-Secret`), log mới của chat đã gắn lead tự theo lead |
| 10/11/2026 | Hậu | FE-40: `GET /api/leads/{id}/mautic-context` (mục 2.7) |
| 11/11/2026 | Hoàng | DC-03: chuyển toàn bộ sang tiếng Việt có dấu, sắp lại số mục (3.2, 3.3 lên mục 3), thêm các mục 3.4 đến 3.9 (đăng nhập, khách và người phụ trách, hợp đồng, cảm nhận, báo cáo và thống kê, lịch xem), bảng webhook backend gọi n8n, danh sách đầy đủ `lead_events.type` và trạng thái lead |
| 12/11/2026 | Hoàng | Đội sale: `GET /api/stats/team` (chỉ quản lý), số khách và kết quả theo từng người phụ trách |
| 12/11/2026 | Hậu (local, chờ review) | L4 mở rộng: `POST /api/reports/breakdowns` có webhook secret; snapshot hiệu suất sale gọn và hiệu quả căn nhà tại `metrics.breakdowns`, hiển thị web/email; không đổi schema |
