# Hợp đồng API giữa Backend, n8n và Web (bản `dev`)

> Đây là **luật chung** của cả nhóm (n8n, backend, web, app). Đổi tên field, thêm API, đổi kiểu dữ liệu thì **sửa file này trước**, rồi mới sửa code. Trên `dev` file này thay cho `api-contract.md` của `main`; xem `CLAUDE.md`.

## 1. Quy ước chung

- Backend NestJS cổng **8081**, tiền tố `/api` (ví dụ `http://localhost:8081/api/leads`). Swagger: `/api/docs`. n8n cổng `5678`, web cổng `3000`.
- JSON dùng **camelCase** (`createdAt`, `propertyId`). Tên cột trong database là snake_case, chỉ là chi tiết nội bộ của backend.
- Thời gian trả ra là chuỗi ISO giờ UTC (cột `timestamptz`); web luôn hiển thị theo giờ Việt Nam (`Asia/Ho_Chi_Minh`).
- Có **ba cách xác thực**:

| Ai gọi | Cách xác thực | Ví dụ |
|---|---|---|
| Khách (không đăng nhập) | không cần gì, dùng **token riêng trong link** khi cần | `POST /viewings`, `/feedback/:token`, `/sign/:token` |
| Nhân viên, quản lý (web admin, app) | `Authorization: Bearer <accessToken>` (JWT, 8 giờ), có phân vai `SALE` / `MANAGER` | `GET /leads`, `POST /contracts` |
| n8n | header `X-Webhook-Secret: <WEBHOOK_SECRET>` | `PUT /leads/:id/ai-result` |

- `WEBHOOK_SECRET` dùng chung hai chiều: backend gọi n8n và n8n gọi backend. Đặt trong `.env` và trong credential Header Auth của n8n. Không đưa lên GitHub. Khi đưa lên server phải đổi thành chuỗi ngẫu nhiên dài.
- Trong Docker Compose: backend gọi n8n bằng `http://n8n:5678`, n8n gọi backend bằng `http://backend:8081`.

## 2. Các luồng nối với nhau thế nào

```
Khách đặt lịch (web)  ->  Backend lưu khách (NEW)  ->  webhook viewing-requested  ->  LUỒNG 1
LUỒNG 1: AI chấm điểm -> email khách + email nhân viên -> CHỜ nhân viên duyệt -> CONFIRMED
Nhân viên (web admin/app) duyệt hoặc đổi giờ  ->  Backend  ->  bấm link duyệt của luồng 1
                                                          \->  hoặc webhook viewing-admin-action  ->  LUỒNG 1b
LUỒNG 2 (mỗi giờ): đọc DB, nhắc lịch, xin link cảm nhận + hỏi cảm nhận, nhắc nhân viên
Khách gửi cảm nhận (web)  ->  webhook feedback-submitted  ->  LUỒNG 5 (AI phân tích, báo nhân viên)
Nhân viên tạo hợp đồng  ->  webhook contract-requested  ->  LUỒNG 3: soạn, AI rà soát, quản lý duyệt, khách ký
LUỒNG 4 (thứ Hai 8:00 hoặc webhook report-requested): số liệu tuần, AI Agent, báo cáo cho quản lý
Mọi luồng lỗi -> Error workflow gửi email quản lý
```

Chi tiết từng luồng (kèm sơ đồ swimlane): thư mục [luong/](luong/).

### 2.0. Backend gọi n8n (webhook)

Tất cả là `POST`, có header `X-Webhook-Secret` (sai thì n8n trả `403`). Luồng nào cũng phải **Publish** thì địa chỉ `/webhook/...` mới chạy (địa chỉ `/webhook-test/...` chỉ nhận một lần mỗi khi bấm Listen).

| Webhook | Ai gọi, khi nào | Body | Luồng |
|---|---|---|---|
| `viewing-requested` | Khách đặt lịch (`POST /viewings`) | xem mục 2.0.1 | 1 |
| `viewing-admin-action` | Nhân viên duyệt khi link hết hạn, hoặc đổi giờ khách đã chốt | `{ event: "approved" \| "rescheduled", leadId, by }` | 1b |
| `feedback-submitted` | Khách gửi cảm nhận | `{ feedbackId, leadId }` | 5 |
| `contract-requested` | Nhân viên tạo hợp đồng | `{ contractId }` | 3 |
| `report-requested` | Quản lý bấm "Tạo báo cáo ngay" | `{ by }` | 4 |

Backend còn **bấm link tiếp tục** (`resumeUrl`) của các lần chạy n8n đang chờ: duyệt lịch (luồng 1), quản lý duyệt hợp đồng và khách ký xong (luồng 3). Địa chỉ n8n lấy từ `N8N_WEBHOOK_URL`; link công khai `localhost:5678` được đổi sang địa chỉ nội bộ trước khi gọi.

#### 2.0.1. Body của `viewing-requested`

```json
{
  "event": "viewing_requested",
  "eventId": "b7f3c1a2-0f4e-4a55-9d1e-1c2f3a4b5c6d",
  "leadId": 12,
  "name": "Nguyen Van A",
  "email": "a@example.com",
  "phone": "0900000000",
  "budget": 3000000000,
  "needs": "Can ho 2 phong ngu gan Da Nang",
  "propertyId": 5,
  "viewingTime": "2026-10-12T09:00:00+07:00"
}
```

- `eventId`: UUID duy nhất mỗi sự kiện (để truy vết). `budget`: VND, số nguyên (kiểu **số**). `needs`: chuỗi rỗng nếu khách không nhập.
- `viewingTime`: ISO 8601 giờ Việt Nam. Backend tự thêm `+07:00` nếu web gửi không kèm múi giờ.
- n8n trả `200` ngay (Respond Immediately) rồi mới xử lý. Backend gọi bất đồng bộ, thử lại tối đa 3 lần cách nhau 2 giây; vẫn lỗi thì đặt `automationStatus = FAILED`.

### 2.1 đến 2.4. n8n gọi ngược Backend (callback)

Header `X-Webhook-Secret`; sai hoặc thiếu thì Backend trả `401`. Các callback của luồng 1 và 2 ở dưới; callback của luồng 3, 4, 5 nằm ở các mục 7 đến 9.

### 2.1. Kết quả AI (thành công)

`PUT /api/leads/{leadId}/ai-result`

```json
{
  "score": 85,
  "level": "HOT",
  "reason": "Ngan sach ro rang, co lich xem nha cu the",
  "aiReply": "Noi dung email xac nhan da soan",
  "emailSent": true,
  "staffNotified": true,
  "approvalUrl": "http://<dia-chi-n8n>/webhook-waiting/123"
}
```

- `level`: `HOT` | `WARM` | `COLD`. n8n **tự tính lại từ `score`** (>= 70 HOT, 40 đến 69 WARM, < 40 COLD) chứ không tin cấp độ AI trả về.
- `score`: so nguyen 0-100
- `staffNotified`: `true` nếu đã gửi email cho nhân viên (luồng 1 gửi cho mọi mức).
- `approvalUrl` (tùy chọn): giá trị `$execution.resumeUrl` của lần chạy đang chờ duyệt. Backend lưu vào cột `approval_url` nhưng **không trả ra bất kỳ API GET nào** (ai có link đều duyệt được). Nút **Duyệt** trên web admin và app gọi `POST /api/leads/:id/approve`, backend dùng link này bấm thay nhân viên, để n8n vẫn là nơi duy nhất xử lý duyệt (gửi email chốt lịch, đổi trạng thái, ghi log). Thêm `&action=approve` hoặc `&action=reschedule` vào link (link đã có `?signature=...` nên dùng `&`).
- Backend luu cac truong tren va dat `automationStatus = COMPLETED`.

### 2.2. Báo lỗi (n8n hỏng giữa chừng)

`PUT /api/leads/{leadId}/automation-status`

```json
{
  "status": "FAILED",
  "error": "Gemini 503 sau 3 lan thu lai"
}
```

- `status`: n8n chi gui `FAILED`. (Backend con chap nhan `PENDING` va `COMPLETED`, nhung n8n khong dung; `COMPLETED` do `ai-result` tu dat.)
- `error`: mo ta ngan (tuy chon). Backend luu vao cot `automationError` cua lead.
- Backend dat `automationStatus = FAILED`. Neu n8n khong goi endpoint nay khi loi giua chung, lead se ket o `PENDING` mai, nen **moi nhanh loi cua workflow phai goi endpoint nay** (xem mục 12).

### 2.3. Đổi trạng thái bán hàng của khách

`PUT /api/leads/{leadId}/status`

```json
{
  "status": "CONFIRMED",
  "note": "Nhan vien duyet lich qua email"
}
```

- `status`: `NEW` | `CONFIRMED` | `VIEWED` | `DEPOSIT` | `SIGNED` | `LOST`. Gia tri khac: `400`.
- `note`: tuy chon.
- Backend luu `leads.status` va **tu ghi** mot dong `lead_events` voi `type = STATUS_CHANGED`, `note = "<cu> -> <moi>: <note>"`.
- Neu trang thai moi **trung** trang thai cu: khong doi gi, khong ghi `STATUS_CHANGED`, van tra `200` (de luong 2 goi `VIEWED` nhieu lan khong sinh log rac).
- Tra ve lead sau khi cap nhat. Lead khong ton tai: `404`.
- Dùng ở: luồng 1 và 1b (`CONFIRMED`), luồng 2 (`VIEWED`).

### 2.4. Ghi sự kiện của khách

`POST /api/leads/{leadId}/events`

```json
{
  "type": "REMINDER_SENT",
  "note": "Nhac lich xem 12/10 09:00"
}
```

- `type`: mot trong cac gia tri o bang `lead_events` (mục 11). Gia tri khac: `400`.
- Tra `201` va dong vua tao `{ "id", "leadId", "type", "note", "createdAt" }`. Lead khong ton tai: `404`.
- Luồng 2 dựa vào bảng này để **không gửi trùng** email follow-up.

### 2.5. Khách đặt lịch: `POST /api/viewings`

Công khai, dùng ở trang chi tiết nhà.

Request:

```json
{
  "name": "Nguyen Van A",
  "email": "a@example.com",
  "phone": "0900000000",
  "budget": 3000000000,
  "needs": "Can ho 2 phong ngu gan Da Nang",
  "propertyId": 5,
  "viewingTime": "2026-10-12T09:00:00"
}
```

- `needs` tùy chọn. `name` không rỗng. `email` đúng định dạng. `phone` 8 đến 15 ký tự (số, `+`, dấu cách, `.`, `-`). `budget` số nguyên >= 0. `propertyId` phải tồn tại và đang `AVAILABLE`. `viewingTime` ISO 8601, **phải ở tương lai**; không kèm múi giờ thì hiểu là giờ Việt Nam.
- Thành công: `201` và `{ "viewing": {...}, "lead": {...} }`. Lúc này `lead.automationStatus = "PENDING"` và các trường AI đều `null`.
- Sai dữ liệu: `400`. Không tìm thấy bất động sản: `404`.
- Backend gọi n8n **bất đồng bộ**: n8n lỗi không làm hỏng việc lưu khách.

## 3. Danh sách API theo nhóm người dùng

| Nhóm | API |
|---|---|
| **Công khai** | `POST /viewings`, `GET /properties`, `GET /properties/:id`, `POST /auth/login`, `GET` và `POST /feedback/:token`, `GET` và `POST /sign/:token` |
| **Đã đăng nhập** (`SALE` hoặc `MANAGER`) | `GET /auth/me`, `GET /leads`, `GET /leads/:id`, `GET /leads/:id/events`, `POST /leads/:id/approve`, `PUT /leads/:id/admin-status`, `GET /viewings`, `GET /viewings/schedule`, `PUT /viewings/:id`, `GET /stats`, `GET /stats/funnel`, `GET /properties/admin/all`, `POST` và `GET /contracts`, `GET /contracts/:id`, `GET /feedback/lead/:leadId`, `POST` và `DELETE /users/me/push-token` |
| **Chỉ quản lý** (`MANAGER`) | `POST`, `PUT`, `DELETE /properties`, `POST /contracts/:id/approve`, `POST /contracts/:id/reject`, `GET /reports`, `GET /reports/:id`, `POST /reports/run` |
| **n8n** (`X-Webhook-Secret`) | `PUT /leads/:id/ai-result`, `PUT /leads/:id/automation-status`, `PUT /leads/:id/status`, `POST /leads/:id/events`, `POST /feedback/link/:leadId`, `PUT /feedback/:id/ai-result`, `PUT /contracts/:id/draft`, `POST /contracts/:id/issue-token`, `PUT /contracts/:id/rejected`, `PUT /contracts/:id/expired`, `POST /reports` |

Mọi `:id` phải là số nguyên, sai thì `400`. **Web và app chỉ được gọi các API trong bảng này.** Cần API mới thì thêm vào bảng trước.

`GET /leads/:id` trả thêm `viewing` (`{ id, propertyId, leadId, viewingTime, status }` hoặc `null`) và `property` (như `GET /properties/:id`, hoặc `null`) để trang chi tiết không phải gọi thêm.

`GET /stats` trả `{ total, hot, warm, cold }` (khách chưa chấm điểm chỉ nằm trong `total`).


## 4. Đăng nhập và phân quyền

Ba cách xác thực (khách, nhân viên và quản lý, n8n) xem ở mục 1. Danh sách API theo nhóm ở mục 3.

`POST /api/auth/login` — body `{ "email": "...", "password": "..." }` → `200 { "accessToken": "...", "user": { "id", "email", "name", "role" } }`. Sai email hoặc mật khẩu: `401` cùng một thông báo. Token sống **8 giờ**. Thiếu hoặc sai token: `401`; đúng token nhưng sai vai: `403`.

`GET /api/auth/me` → thông tin người đang đăng nhập.

Bảng `users`: `id, email (duy nhất), name, password_hash (bcrypt, không bao giờ trả ra API), role (MANAGER | SALE), push_token, created_at`. Hai tài khoản mẫu được tạo khi backend khởi động (email `nhadn2457+quanly@gmail.com` vai MANAGER và `nhadn2457+nhanvien@gmail.com` vai SALE); mật khẩu lấy từ biến `SEED_USER_PASSWORD` trong `.env`. Ký token dùng biến `JWT_SECRET`.

## 5. API cho web admin và app

Tất cả cần `Authorization: Bearer <token>` (xem mục 4). Lỗi nghiệp vụ trả `400`, không tìm thấy `404`.

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/stats/funnel` | `{ total, byStatus: {NEW,CONFIRMED,VIEWED,DEPOSIT,SIGNED,LOST}, conversionRate (% đã ký / tổng), pendingApproval (NEW và AI đã chấm), failedAutomation, viewingsToday }` |
| GET | `/api/viewings/schedule` | Lịch xem kèm khách và căn nhà: `[{ id, viewingTime, leadId, leadName, leadPhone, leadLevel, leadStatus, propertyId, propertyName, propertyAddress }]`, sắp theo giờ xem |
| PUT | `/api/viewings/:id` | Đổi giờ xem. Body `{ "viewingTime": "ISO 8601" }`. Chỉ khi khách `NEW` hoặc `CONFIRMED`, giờ phải ở tương lai. Ghi `VIEWING_RESCHEDULED`. Khách `CONFIRMED` thì gọi webhook `viewing-admin-action` (`rescheduled`) để n8n báo khách |
| POST | `/api/leads/:id/approve` | Duyệt lịch. Chỉ khi khách `NEW` và AI không còn `PENDING`. Thử bấm link duyệt của luồng 1 (`via: "resume"`); link hết hạn (401/403/404/409/410) thì gọi webhook `viewing-admin-action` (`approved`, `via: "manual"`). Lỗi khác: `502`. Trả `{ "via": "resume" \| "manual" }` |
| PUT | `/api/leads/:id/admin-status` | Nhân viên đổi trạng thái. Body `{ "status": "VIEWED" \| "LOST", "note"? }`. `VIEWED` chỉ khi đang `CONFIRMED`; `LOST` không áp dụng cho khách đã `SIGNED`/`LOST`. Ghi `STATUS_CHANGED` kèm tên người làm |

**Webhook backend → n8n:** `POST /webhook/viewing-admin-action` (header `X-Webhook-Secret`), body `{ "event": "approved" | "rescheduled", "leadId": 12, "by": "tên nhân viên" }`. Xem [luồng 1b](luong/luong-1b-chot-lich-thu-cong.md).

## 6. Quản lý nhà

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| GET | `/api/properties` | Công khai | Chỉ các căn **không bị ẩn** (`status != HIDDEN`) |
| GET | `/api/properties/:id` | Công khai | Một căn, kể cả căn đã ẩn (n8n cần đọc lại căn của các lịch cũ) |
| GET | `/api/properties/admin/all` | Đã đăng nhập | Tất cả, gồm cả căn đã ẩn |
| POST | `/api/properties` | Quản lý | Thêm căn. Body `{ name, address, price (số nguyên >= 1), area (> 0), type, status? }`. `type`: `APARTMENT`, `TOWNHOUSE`, `VILLA`, `SHOPHOUSE`, `LAND` |
| PUT | `/api/properties/:id` | Quản lý | Sửa (gửi các trường cần đổi). `status`: `AVAILABLE` hoặc `HIDDEN` |
| DELETE | `/api/properties/:id` | Quản lý | Xoá mềm: chuyển `HIDDEN`, giữ nguyên các lịch xem đã đặt |

`POST /api/viewings` với căn không `AVAILABLE` trả `400`. Nhân viên (`SALE`) gọi POST/PUT/DELETE trả `403`.

## 7. Cảm nhận sau buổi xem (luồng 5)

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| POST | `/api/feedback/link/:leadId` | n8n (`X-Webhook-Secret`) | Luồng 2 xin link. Trả `{ token, url }`; mỗi khách chỉ có một link (gọi lại trả link cũ). `url = PUBLIC_WEB_URL + /cam-nhan/ + token` |
| GET | `/api/feedback/:token` | Công khai | `{ leadName, propertyName, viewingTime, submitted }`. Không lộ email, SĐT. Token sai: `404` |
| POST | `/api/feedback/:token` | Công khai | Body `{ rating (1-5), interest (DEPOSIT \| OTHER \| NONE), comment? (tối đa 1000 ký tự) }`. Lưu, ghi `FEEDBACK_RECEIVED`, gọi webhook `feedback-submitted`. Đã gửi rồi: `409` |
| PUT | `/api/feedback/:id/ai-result` | n8n | Body `{ sentiment (POSITIVE \| NEUTRAL \| NEGATIVE), summary, nextAction }` |
| GET | `/api/feedback/lead/:leadId` | Đã đăng nhập | Cảm nhận mới nhất của khách, hoặc rỗng nếu chưa có |

**Webhook backend → n8n:** `POST /webhook/feedback-submitted`, body `{ "feedbackId": 1, "leadId": 84 }`. Xem [luồng 5](luong/luong-5-cam-nhan.md).

Bảng `feedbacks`: `id, lead_id, token (duy nhất), rating, interest, comment, submitted_at, ai_sentiment, ai_summary, ai_next_action, created_at`.
Biến môi trường mới: `PUBLIC_WEB_URL` (địa chỉ web mà khách mở được từ email; backend và n8n đều dùng).

## 8. Hợp đồng đặt cọc (luồng 3)

Trạng thái `contracts.status`: `DRAFTING` (chờ n8n soạn) → `PENDING_APPROVAL` (chờ quản lý duyệt) → `SENT` (đã gửi khách ký) → `SIGNED`; hoặc `REJECTED`, `EXPIRED`.

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| POST | `/api/contracts` | Đã đăng nhập | Tạo hợp đồng. Body `{ leadId, depositAmount }`. Khách phải `VIEWED`, chưa có hợp đồng đang xử lý, cọc không lớn hơn giá nhà. Khách chuyển `DEPOSIT`, gọi webhook `contract-requested`. Sai điều kiện: `400`; đã có hợp đồng: `409` |
| GET | `/api/contracts` | Đã đăng nhập | Danh sách kèm tên khách, căn nhà |
| GET | `/api/contracts/:id` | Đã đăng nhập | Chi tiết: nội dung, `aiReview` (JSON `{riskLevel, notes, aiUsed}`), chữ ký (khi đã ký), `signUrl` (khi `SENT`). Không bao giờ trả `resumeUrl` và `signToken` |
| POST | `/api/contracts/:id/approve` | Quản lý | Bấm link tiếp tục của n8n với `action=approve`. Không ở `PENDING_APPROVAL`: `400`; link đã quá hạn: `409` |
| POST | `/api/contracts/:id/reject` | Quản lý | Body `{ reason }` (bắt buộc, tối đa 300 ký tự) |
| PUT | `/api/contracts/:id/draft` | n8n | Body `{ title, content, aiReview, resumeUrl }` → `PENDING_APPROVAL` |
| POST | `/api/contracts/:id/issue-token` | n8n | Cấp token ký (hạn 7 ngày), trả `{ token, signUrl, expiresAt }` → `SENT` |
| PUT | `/api/contracts/:id/rejected` | n8n | Body `{ reason }` → `REJECTED`, khách về `VIEWED` |
| PUT | `/api/contracts/:id/expired` | n8n | Body `{ reason? }` → `EXPIRED`, khách về `VIEWED` |
| GET | `/api/sign/:token` | Công khai | Nội dung hợp đồng cho khách đọc. Không lộ email, SĐT. Token sai: `404` |
| POST | `/api/sign/:token` | Công khai | Body `{ signerName, signature (data URL PNG, tối đa 90000 ký tự), agree: true }`. Lưu chữ ký, `SIGNED`, khách `SIGNED`, báo n8n. Đã ký: `409`; hết hạn hoặc không còn ký được: `400` |

**Webhook backend → n8n:** `POST /webhook/contract-requested`, body `{ "contractId": 2 }`. Xem [luồng 3](luong/luong-3-hop-dong.md).

Bảng `contracts`: `id, lead_id, property_id, title, content, deposit_amount, property_price, status, ai_review, reject_reason, resume_url (ẩn), sign_token (duy nhất), expires_at, approved_by, created_by, signer_name, signature (ẩn ở danh sách), signed_at, signed_ip, created_at, updated_at`.

## 9. Báo cáo kinh doanh (luồng 4)

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| POST | `/api/reports` | n8n | Body `{ periodStart, periodEnd (yyyy-MM-dd), metrics (object), analysis (object), alerts (string[]) }` |
| GET | `/api/reports` | Quản lý | 52 báo cáo mới nhất: `[{ id, periodStart, periodEnd, createdAt, headline, alertCount }]` |
| GET | `/api/reports/:id` | Quản lý | Đầy đủ `metrics`, `analysis`, `alerts` |
| POST | `/api/reports/run` | Quản lý | Gọi webhook `report-requested` để n8n tạo báo cáo ngay. Trả `{ ok: true }` ngay, báo cáo xuất hiện sau 30 đến 60 giây |

`analysis` = `{ headline, insights[], recommendations[], aiUsed }`. `metrics` = `{ period, cur, prev, delta, funnel }`.

**Webhook backend → n8n:** `POST /webhook/report-requested`, body `{ "by": "tên quản lý" }`. Xem [luồng 4](luong/luong-4-bao-cao.md).

Bảng `weekly_reports`: `id, period_start (date), period_end (date), metrics (jsonb), analysis (jsonb), alerts (jsonb), created_at`.
Tài khoản database chỉ đọc cho AI Agent: `backend/sql/readonly-role.sql`.

## 10. Thông báo đẩy cho app nhân viên

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| POST | `/api/users/me/push-token` | Đã đăng nhập | Body `{ "token": "ExponentPushToken[...]" }`. Sai định dạng: `400`. Lưu vào `users.push_token` |
| DELETE | `/api/users/me/push-token` | Đã đăng nhập | Gỡ token (khi đăng xuất khỏi app) |

n8n (luồng 1) đọc `users.push_token` rồi gọi Expo Push API. Xem [app/README.md](../app/README.md).


## 11. Dữ liệu

| Bảng | Trường chính |
|---|---|
| `properties` | id, name, address, price, area, type, status (`AVAILABLE`, `HIDDEN`) |
| `users` | id, email, name, passwordHash (không bao giờ trả ra API), role (`MANAGER`, `SALE`), pushToken, createdAt |
| `leads` | id, name, email, phone, budget, needs, score, level, reason, aiReply, emailSent, staffNotified, status, automationStatus, automationError, eventId, createdAt, approvalUrl (ẩn, không trả ra GET) |
| `viewings` | id, propertyId, leadId, viewingTime, status |
| `lead_events` | id, leadId, type, note, createdAt: dòng thời gian của khách, đồng thời là chốt chống gửi trùng của luồng 2 |
| `feedbacks` | id, leadId, token (ẩn), rating, interest, comment, submittedAt, aiSentiment, aiSummary, aiNextAction |
| `contracts` | id, leadId, propertyId, title, content, depositAmount, propertyPrice, status, aiReview, rejectReason, resumeUrl (ẩn), signToken (ẩn), expiresAt, approvedBy, createdBy, signerName, signature, signedAt, signedIp |
| `weekly_reports` | id, periodStart, periodEnd, metrics, analysis, alerts, createdAt |

### Trạng thái

| Trường | Giá trị |
|---|---|
| `leads.status` | `NEW` → `CONFIRMED` (đã chốt lịch) → `VIEWED` (đã xem) → `DEPOSIT` (đang làm hợp đồng cọc) → `SIGNED` (đã ký); hoặc `LOST` (không mua). Hợp đồng bị từ chối hoặc hết hạn thì khách quay về `VIEWED` |
| `leads.automationStatus` | `PENDING` (vừa tạo, chưa có kết quả AI) → `COMPLETED` hoặc `FAILED` (không gọi được n8n, hoặc n8n báo lỗi) |
| `leads.level` | `HOT` / `WARM` / `COLD` (`null` khi chưa chấm) |
| `contracts.status` | `DRAFTING` → `PENDING_APPROVAL` → `SENT` → `SIGNED`; hoặc `REJECTED`, `EXPIRED` |
| `viewings.status` | luôn `NEW` (khách đã chốt lịch hay chưa xem ở `leads.status`) |

### Giá trị `lead_events.type`

| `type` | Ai ghi | Khi nào |
|---|---|---|
| `AI_SCORED` | Luồng 1 | AI chấm điểm xong |
| `APPROVED` | Luồng 1, 1b | Nhân viên duyệt lịch |
| `RESCHEDULE_REQUESTED` | Luồng 1 | Nhân viên bấm Đổi giờ trong email |
| `APPROVAL_TIMEOUT` | Luồng 1 | Quá 24 giờ không ai duyệt |
| `REMINDER_SENT` | Luồng 2 | Đã nhắc lịch trước 24 giờ |
| `FEEDBACK_ASKED` | Luồng 2 | Đã hỏi cảm nhận sau buổi xem |
| `WARM_NUDGE_SENT` | Luồng 2 | Đã nhắc khách WARM im lặng |
| `STAFF_NUDGE_SENT` | Luồng 2 | Đã nhắc nhân viên về khách chưa được duyệt sau 3 ngày |
| `FOLLOWUP_FAILED` | Luồng 2 | Follow-up cho khách này bị lỗi (bỏ qua 6 giờ) |
| `STATUS_CHANGED` | Backend tự ghi | Mỗi lần đổi `leads.status` |
| `VIEWING_RESCHEDULED` | Backend | Nhân viên đổi giờ xem |
| `FEEDBACK_RECEIVED` | Backend | Khách gửi cảm nhận |
| `FEEDBACK_ANALYZED` | Luồng 5 | AI phân tích xong cảm nhận |
| `CONTRACT_CREATED`, `CONTRACT_DRAFTED`, `CONTRACT_SENT`, `CONTRACT_SIGNED`, `CONTRACT_REJECTED`, `CONTRACT_EXPIRED` | Backend | Các mốc của hợp đồng |

### Kiểu dữ liệu thật sự được trả về (web và app phải xử lý đúng)

| Trường | Kiểu | Cách xử lý |
|---|---|---|
| `leads.budget`, `properties.price`, `properties.area`, `contracts.depositAmount` | **chuỗi** khi `GET` (cột `bigint`/`decimal`); phản hồi của `POST` có thể là **số** | Khai báo `string \| number`, luôn `Number(...)` trước khi định dạng |
| `viewings.viewingTime`, `createdAt`, `signedAt` | chuỗi ISO giờ UTC | Hiển thị theo giờ Việt Nam, không tự cộng trừ 7 giờ |
| `score`, `level`, `reason`, `aiReply`, `emailSent`, `staffNotified` | `null` cho đến khi `automationStatus = COMPLETED` | Hiện "đang xử lý" khi `PENDING`, "lỗi" khi `FAILED` (kèm `automationError`) |

## 12. Xử lý lỗi

- **Backend gọi n8n:** thử lại tối đa 3 lần (cách 2 giây); vẫn lỗi thì đặt `automationStatus = FAILED` và ghi log. Lỗi n8n **không** làm hỏng việc lưu dữ liệu của khách.
- **n8n:** bật Retry On Fail (3 lần, chờ 5 giây) cho mọi node có thể lỗi. Node AI, email hoặc thông báo nhân viên vẫn lỗi thì **nhánh lỗi phải gọi `PUT /leads/:id/automation-status` với `FAILED`**, để khách không kẹt ở `PENDING`.
- **Gọi ngược Backend lỗi** (ví dụ khách không tồn tại): workflow kết thúc ở node `Callback failed`, không làm treo.
- **Lỗi ngoài dự kiến:** mọi luồng gắn **Error workflow**, gửi email cho quản lý.
- **Theo dõi:** `automationStatus`, bảng `lead_events`, log backend, tab Executions của n8n, Error workflow.

## 13. Biến môi trường liên quan

| Biến | Dùng cho |
|---|---|
| `WEBHOOK_SECRET` | Chìa khóa chung backend và n8n |
| `JWT_SECRET`, `SEED_USER_PASSWORD` | Ký token đăng nhập; mật khẩu hai tài khoản mẫu |
| `PUBLIC_WEB_URL` | Địa chỉ web mà khách mở được từ email (link cảm nhận, link ký) |
| `N8N_WEBHOOK_URL` | Địa chỉ webhook luồng 1; backend suy ra địa chỉ n8n từ đây |
| `N8N_READONLY_DB_PASSWORD` | Mật khẩu tài khoản DB chỉ đọc cho AI Agent (luồng 4) |

Giá trị mẫu: `.env.example`. Không commit `.env`.
