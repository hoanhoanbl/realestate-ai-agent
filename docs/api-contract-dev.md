> **BẢN DEV.** File này là bản sao của `api-contract.md` (giữ nguyên trên `main`), được cập nhật dần trên nhánh `dev` theo từng tính năng. Trên `dev`, đọc file này thay cho `api-contract.md`. Xem `CLAUDE.md` để biết vì sao có hai bản.
> Thay đổi so với bản `main` được ghi ở mục "Lịch sử thay đổi (dev)" cuối file.

# Hop dong API giua Backend, n8n va Web

File nay la "luat chung" cua ca nhom (n8n, backend, web). **Neu file nay va cac file ke hoach tuan (`tuan-*.md`) mau thuan nhau thi file nay thang.**

Doi gi trong file nay thi phai: (1) tao nhanh `docs/...` rieng, (2) mo Pull Request, (3) nguoi kia bam Approve roi moi merge, (4) ghi mot dong vao muc "Lich su thay doi" o cuoi file. Khong sua thang tren `main`. Quy trinh day du xem muc "Cach phoi hop" trong `tuan-1.md`.

## Quy uoc chung

- Backend NestJS chay o cong **8081**, tien to `/api` (vi du `http://localhost:8081/api/leads`). Swagger: `/api/docs`.
- n8n chay o cong `5678`. Web (Next.js) chay o cong `3000`.
- JSON dung **camelCase** (`createdAt`, `propertyId`, `automationStatus`). Ten cot trong database la snake_case, chi la chi tiet noi bo cua backend.
- `X-Webhook-Secret`: hai ben dung chung mot gia tri `WEBHOOK_SECRET`. Dat trong `.env` cua backend va trong credential Header Auth cua n8n. Khong dua len GitHub.
- Dat `WEBHOOK_SECRET` la chuoi ngau nhien dai khi dua len host (gia tri dev chi de test).

## Tong quan luong

```
Khach dang ky xem nha (web khu khach; app chi danh cho nhan vien)
  -> Backend luu lead + viewing (lead.status = NEW, automationStatus = PENDING)
  -> Backend POST webhook sang n8n (luong 1)
  -> n8n: AI cham diem, gui email "da nhan yeu cau" cho khach,
          gui email nhan vien (moi muc, kem 2 link Duyet / Doi gio)
  -> n8n goi nguoc Backend de cap nhat diem (automationStatus = COMPLETED, kem approvalUrl)
  -> Nhan vien bam Duyet -> n8n gui email chot lich, PUT status = CONFIRMED
  -> Neu n8n hong giua chung (truoc khi cap nhat diem): n8n bao Backend automationStatus = FAILED
Luong 2 (moi gio): doc DB, gui email nhac lich / hoi cam nhan / nhac khach WARM, ghi lead_events.
```

## 1. Backend -> n8n (webhook)

- Method: `POST`
- Local test: `http://localhost:5678/webhook-test/viewing-requested` (chi nhan 1 request moi lan bam Listen)
- Production (workflow da Publish): `http://localhost:5678/webhook/viewing-requested`
- Trong Docker Compose, backend goi: `http://n8n:5678/webhook/viewing-requested`
- Header: `X-Webhook-Secret: <WEBHOOK_SECRET>`; n8n kiem tra header nay, **sai thi tra 403**.
- n8n tra `200` ngay (Respond Immediately), sau do moi xu ly AI.

Body:

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

- `eventId`: UUID duy nhat moi su kien (de truy vet; chong xu ly trung la tuy chon).
- `budget`: don vi VND, so nguyen (kieu **so**).
- `needs`: chuoi rong neu khach khong nhap.
- `viewingTime`: ISO 8601, gio Viet Nam. Backend tu them `+07:00` neu web gui khong kem mui gio, nen n8n luon nhan duoc chuoi co mui gio.

## 2. n8n -> Backend (callback)

Chung cho moi callback:

- Header: `X-Webhook-Secret: <WEBHOOK_SECRET>`; **sai hoac thieu thi Backend tra 401**.
- Dev (backend chay tren may that, n8n trong Docker): `http://host.docker.internal:8081/api/...`
- Trong Docker Compose, n8n goi: `http://backend:8081/api/...` (compose da dat san bien `BACKEND_URL=http://backend:8081` cho n8n; workflow nen doc dia chi tu bien nay de khong phai sua file khi doi moi truong).

### 2.1. Ket qua AI (thanh cong)

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

- `level`: `HOT` | `WARM` | `COLD` (HOT khi score >= 70, WARM 40-69, COLD < 40)
- `score`: so nguyen 0-100
- `staffNotified`: `true` neu da thong bao nhan vien bang email; `false` neu khong gui. Tu tuan 2, luong 1 gui email nhan vien (kem link duyet) cho **moi** muc, nen thuong la `true`. (Truoc day ten la `telegramNotified`, da doi vi khong dung Telegram.)
- `approvalUrl` (tuan 2, tuy chon): gia tri `$execution.resumeUrl` cua lan chay dang cho duyet. Them `?action=approve` hoac `?action=reschedule` la duyet / doi gio, y het 2 nut trong email nhan vien. Backend luu vao cot `approval_url` nhung **khong tra ra o cac API GET** (cot dat `select: false`) cho den khi co dang nhap (cuoi ky), vi ai co link deu duyet duoc. Muc dich: sau nay web admin va app bam Duyet se goi dung link nay, de n8n van la noi duy nhat xu ly duyet (gui email chot lich, doi trang thai, ghi log).
- Backend luu cac truong tren va dat `automationStatus = COMPLETED`.

### 2.2. Bao loi (n8n hong giua chung)

`PUT /api/leads/{leadId}/automation-status`

```json
{
  "status": "FAILED",
  "error": "Gemini 503 sau 3 lan thu lai"
}
```

- `status`: n8n chi gui `FAILED`. (Backend con chap nhan `PENDING` va `COMPLETED`, nhung n8n khong dung; `COMPLETED` do `ai-result` tu dat.)
- `error`: mo ta ngan (tuy chon). Backend luu vao cot `automationError` cua lead.
- Backend dat `automationStatus = FAILED`. Neu n8n khong goi endpoint nay khi loi giua chung, lead se ket o `PENDING` mai, nen **moi nhanh loi cua workflow phai goi endpoint nay** (xem muc 5).

### 2.3. Doi trang thai ban hang cua lead (tuan 2)

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
- Dung o: luong 1 (`CONFIRMED`), luong 2 (`VIEWED`).

### 2.4. Ghi su kien cua lead (tuan 2)

`POST /api/leads/{leadId}/events`

```json
{
  "type": "REMINDER_SENT",
  "note": "Nhac lich xem 12/10 09:00"
}
```

- `type`: mot trong cac gia tri o bang `lead_events` (muc 4). Gia tri khac: `400`.
- Tra `201` va dong vua tao `{ "id", "leadId", "type", "note", "createdAt" }`. Lead khong ton tai: `404`.
- Luong 2 dua vao bang nay de **khong gui trung** email follow-up.

## 3. API backend (toi thieu cho demo)

| Method | Duong dan | Mo ta |
|---|---|---|
| POST | `/api/viewings` | Khach dang ky xem nha; tao lead + viewing, goi webhook n8n |
| GET | `/api/leads` | Danh sach khach (loc theo `?level=HOT`), moi nhat truoc |
| GET | `/api/leads/{id}` | Chi tiet mot khach. Tu tuan 2 tra them `viewing` (`{ id, propertyId, leadId, viewingTime, status }` hoac `null`) va `property` (nhu `GET /api/properties/{id}`, hoac `null`) de trang chi tiet tren web khong phai goi them |
| PUT | `/api/leads/{id}/ai-result` | n8n cap nhat ket qua AI (muc 2.1) |
| PUT | `/api/leads/{id}/automation-status` | n8n bao loi (muc 2.2) |
| GET | `/api/properties` | Danh sach bat dong san |
| GET | `/api/stats` | Dem lead theo muc, tra `{ "total": 0, "hot": 0, "warm": 0, "cold": 0 }` (lead chua cham diem chi nam trong `total`) |
| GET | `/api/viewings` | Danh sach lich xem nha (phuc vu kiem tra, web khong bat buoc dung) |
| GET | `/api/properties/{id}` | Mot bat dong san (tuan 2). Khong co: `404` |
| PUT | `/api/leads/{id}/status` | n8n doi trang thai ban hang (muc 2.3, can `X-Webhook-Secret`) |
| POST | `/api/leads/{id}/events` | n8n ghi su kien (muc 2.4, can `X-Webhook-Secret`) |
| GET | `/api/leads/{id}/events` | Dong thoi gian cua lead, cu nhat truoc (tuan 2; trang `/leads/[id]` tren web dung) |

**Web chi duoc goi cac API trong bang nay.** Can API moi thi bao backend va them vao bang truoc (xem quy tac doi hop dong o dau file).

### `POST /api/viewings`

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

- `needs` la tuy chon. `email` phai dung dinh dang. `budget` la so nguyen >= 0. `propertyId` phai ton tai. `viewingTime` la chuoi ISO 8601; neu khong kem mui gio thi backend hieu la gio Viet Nam.
- Thanh cong: `201` va tra `{ "viewing": {...}, "lead": {...} }`. Luc nay `lead.automationStatus = "PENDING"` va `score`, `level`, `reason`, `aiReply`, `emailSent`, `staffNotified` deu la `null`.
- Sai du lieu: `400` (email sai dinh dang, thieu truong). Khong tim thay bat dong san: `404`.
- Backend goi n8n **bat dong bo**: n8n loi khong lam hong viec luu lead.

## 3b. Đăng nhập và phân quyền (dev)

Có **hai cách xác thực**, dùng cho hai đối tượng khác nhau:

| Ai gọi | Cách xác thực | Dùng ở |
|---|---|---|
| n8n | Header `X-Webhook-Secret` (guard `WebhookSecretGuard`) | `PUT /leads/:id/ai-result`, `/automation-status`, `/status`, `POST /leads/:id/events` |
| Người dùng (web admin, app) | Header `Authorization: Bearer <accessToken>` (guard `JwtAuthGuard`), có thêm `@Roles('MANAGER')` nếu chỉ quản lý được dùng | `GET /leads`, `/leads/:id`, `/leads/:id/events`, `/viewings`, `/stats`, `/auth/me` |
| Công khai (không cần gì) | | `POST /viewings` (khách đặt lịch), `GET /properties`, `GET /properties/:id`, `POST /auth/login` |

`POST /api/auth/login` — body `{ "email": "...", "password": "..." }` → `200 { "accessToken": "...", "user": { "id", "email", "name", "role" } }`. Sai email hoặc mật khẩu: `401` cùng một thông báo. Token sống **8 giờ**. Thiếu hoặc sai token: `401`; đúng token nhưng sai vai: `403`.

`GET /api/auth/me` → thông tin người đang đăng nhập.

Bảng `users`: `id, email (duy nhất), name, password_hash (bcrypt, không bao giờ trả ra API), role (MANAGER | SALE), push_token, created_at`. Hai tài khoản mẫu được tạo khi backend khởi động (email `nhadn2457+quanly@gmail.com` vai MANAGER và `nhadn2457+nhanvien@gmail.com` vai SALE); mật khẩu lấy từ biến `SEED_USER_PASSWORD` trong `.env`. Ký token dùng biến `JWT_SECRET`.

## 3c. API cho web admin và app (dev)

Tất cả cần `Authorization: Bearer <token>` (xem mục 3b). Lỗi nghiệp vụ trả `400`, không tìm thấy `404`.

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/stats/funnel` | `{ total, byStatus: {NEW,CONFIRMED,VIEWED,DEPOSIT,SIGNED,LOST}, conversionRate (% đã ký / tổng), pendingApproval (NEW và AI đã chấm), failedAutomation, viewingsToday }` |
| GET | `/api/viewings/schedule` | Lịch xem kèm khách và căn nhà: `[{ id, viewingTime, leadId, leadName, leadPhone, leadLevel, leadStatus, propertyId, propertyName, propertyAddress }]`, sắp theo giờ xem |
| PUT | `/api/viewings/:id` | Đổi giờ xem. Body `{ "viewingTime": "ISO 8601" }`. Chỉ khi khách `NEW` hoặc `CONFIRMED`, giờ phải ở tương lai. Ghi `VIEWING_RESCHEDULED`. Khách `CONFIRMED` thì gọi webhook `viewing-admin-action` (`rescheduled`) để n8n báo khách |
| POST | `/api/leads/:id/approve` | Duyệt lịch. Chỉ khi khách `NEW` và AI không còn `PENDING`. Thử bấm link duyệt của luồng 1 (`via: "resume"`); link hết hạn (401/403/404/409/410) thì gọi webhook `viewing-admin-action` (`approved`, `via: "manual"`). Lỗi khác: `502`. Trả `{ "via": "resume" \| "manual" }` |
| PUT | `/api/leads/:id/admin-status` | Nhân viên đổi trạng thái. Body `{ "status": "VIEWED" \| "LOST", "note"? }`. `VIEWED` chỉ khi đang `CONFIRMED`; `LOST` không áp dụng cho khách đã `SIGNED`/`LOST`. Ghi `STATUS_CHANGED` kèm tên người làm |

**Webhook backend → n8n (mới):** `POST /webhook/viewing-admin-action` (header `X-Webhook-Secret`), body `{ "event": "approved" | "rescheduled", "leadId": 12, "by": "tên nhân viên" }`. Xem [luồng 1b](luong/luong-1b-chot-lich-thu-cong.md).

## 3d. Quản lý nhà (dev)

| Method | Đường dẫn | Ai gọi được | Mô tả |
|---|---|---|---|
| GET | `/api/properties` | Công khai | Chỉ các căn **không bị ẩn** (`status != HIDDEN`) |
| GET | `/api/properties/:id` | Công khai | Một căn, kể cả căn đã ẩn (n8n cần đọc lại căn của các lịch cũ) |
| GET | `/api/properties/admin/all` | Đã đăng nhập | Tất cả, gồm cả căn đã ẩn |
| POST | `/api/properties` | Quản lý | Thêm căn. Body `{ name, address, price (số nguyên >= 1), area (> 0), type, status? }`. `type`: `APARTMENT`, `TOWNHOUSE`, `VILLA`, `SHOPHOUSE`, `LAND` |
| PUT | `/api/properties/:id` | Quản lý | Sửa (gửi các trường cần đổi). `status`: `AVAILABLE` hoặc `HIDDEN` |
| DELETE | `/api/properties/:id` | Quản lý | Xoá mềm: chuyển `HIDDEN`, giữ nguyên các lịch xem đã đặt |

`POST /api/viewings` với căn không `AVAILABLE` trả `400`. Nhân viên (`SALE`) gọi POST/PUT/DELETE trả `403`.

## 4. Du lieu (4 bang)

| Bang | Truong chinh |
|---|---|
| `properties` | id, name, address, price, area, type, status |
| `users` (dev) | id, email, name, passwordHash, role, pushToken, createdAt |
| `leads` | id, name, email, phone, budget, needs, score, level, reason, aiReply, emailSent, staffNotified, status, automationStatus, automationError, eventId, createdAt, approvalUrl (tuan 2, khong tra ra o GET) |
| `viewings` | id, propertyId, leadId, viewingTime, status |
| `lead_events` (tuan 2) | id, leadId, type, note, createdAt (cot DB: `lead_id`, `created_at` kieu `timestamptz`) |

Gia tri `lead_events.type`:

| `type` | Ai ghi | Khi nao |
|---|---|---|
| `AI_SCORED` | Luong 1 | AI cham diem xong |
| `APPROVED` | Luong 1 | Nhan vien bam Duyet |
| `RESCHEDULE_REQUESTED` | Luong 1 | Nhan vien bam Doi gio |
| `APPROVAL_TIMEOUT` | Luong 1 | Qua 24 gio khong ai duyet |
| `REMINDER_SENT` | Luong 2 | Da nhac lich truoc 24h |
| `FEEDBACK_ASKED` | Luong 2 | Da hoi cam nhan sau buoi xem |
| `WARM_NUDGE_SENT` | Luong 2 | Da nhac khach WARM im lang |
| `STATUS_CHANGED` | Backend tu ghi | Moi lan `PUT /status` |
| `STAFF_NUDGE_SENT` (dev) | Luong 2 | Đã nhắc nhân viên về khách HOT/WARM chưa được duyệt sau 3 ngày |
| `VIEWING_RESCHEDULED` (dev) | Backend | Nhân viên đổi giờ xem |
| `FOLLOWUP_FAILED` (dev) | Luong 2 | Follow-up cho khách này bị lỗi (bỏ qua 6 giờ) |

Tat ca khoa JSON deu camelCase, ke ca doi tuong `viewing`.

**Kieu du lieu that su duoc tra ve (web phai xu ly dung):**

| Truong | Kieu tra ve | Cach xu ly o web |
|---|---|---|
| `leads.budget` | **chuoi** (`"3000000000"`, cot `bigint`) khi `GET`; trong phan hoi cua `POST /viewings` co the la **so** | Khai bao kieu `string \| number`, luon `Number(...)` truoc khi dinh dang, khong dua vao mot kieu co dinh |
| `properties.price`, `properties.area` | **chuoi** (cot `bigint`/`decimal`) | `Number(...)` truoc khi dinh dang |
| `viewings.viewingTime` | chuoi ISO gio UTC, vi du `2026-10-12T02:00:00.000Z` (cot `timestamptz`) | Hien thi theo gio Viet Nam (`Asia/Ho_Chi_Minh`), khong tu cong tru 7 gio |
| `leads.createdAt` | chuoi ISO gio UTC (cot `timestamptz`) | Hien thi theo gio Viet Nam (`Asia/Ho_Chi_Minh`) |
| `score`, `level`, `reason`, `aiReply`, `emailSent`, `staffNotified` | `null` cho den khi `automationStatus = COMPLETED` | Hien "dang xu ly" khi `PENDING`, "loi" khi `FAILED` (kem `automationError` neu co) |

Gia tri trang thai:

| Truong | Gia tri |
|---|---|
| `leads.status` | `NEW` -> `CONFIRMED` (da chot lich) -> `VIEWED` (da xem) -> `DEPOSIT` (muon dat coc) -> `SIGNED` (da ky); hoac `LOST` (khong mua). Tuan 2 moi dung `NEW`, `CONFIRMED`, `VIEWED` |
| `leads.automationStatus` | `PENDING` (vua tao, chua co ket qua AI) -> `COMPLETED` (n8n da cap nhat diem) hoac `FAILED` (khong goi duoc n8n, hoac n8n bao loi) |
| `leads.level` | `HOT` / `WARM` / `COLD` (null khi chua cham) |
| `viewings.status` | `NEW` |

## 5. Xu ly loi (can co de lay diem)

- Backend: neu goi n8n that bai, thu lai toi da 3 lan (cach nhau 2 giay), van loi thi dat `automationStatus = FAILED` va ghi log. Khong de loi n8n lam hong viec luu lead.
- n8n: bat Retry On Fail (3 lan, cho 5 giay) cho **moi** node co the loi: AI, gui email khach, thong bao nhan vien, HTTP Request. Neu mot trong cac node AI / email / thong bao nhan vien van loi sau khi thu lai, nhanh loi phai goi `PUT /api/leads/{id}/automation-status` voi `status = FAILED` va `error` mo ta ngan (muc 2.2).
- Nhanh loi khi goi nguoc Backend that bai (vi du lead khong ton tai): workflow ket thuc o node `Callback failed`, khong lam treo. (Day la truong hop duy nhat khong bao FAILED duoc, vi chinh Backend khong nhan duoc.)
- Theo doi: dung `automationStatus`, bang `lead_events` (tuan 2), log cua Backend, tab Executions cua n8n va Error workflow (gui email quan ly khi mot luong loi).

## Lich su thay doi

| Ngay | Ai sua | Noi dung |
|---|---|---|
| 09/10/2026 | Ca nhom (dong bo voi code da merge len `main`) | `viewing` da camelCase; `automation-status` da co; `viewingTime` gui sang n8n co `+07:00`; them kieu du lieu tra ve (budget/price/area la chuoi); them `GET /api/viewings`, `automationError`, `eventId`; ro rang moi nhanh loi n8n phai bao `FAILED` |
| 09/10/2026 (lan 2) | Ca nhom | Doi ten hop dong cho dung pham vi (ca Web); `leads.budget` trong phan hoi `POST` ghi la "co the la so" (chua kiem chung khi chay that); web hien `automationError` khi `FAILED` |
| 12/10/2026 | Hoang (Hau duyet) | Tuan 2: them `PUT /leads/{id}/status`, `POST`/`GET /leads/{id}/events`, `GET /properties/{id}`; bang `lead_events`; cac gia tri `leads.status`; `staffNotified` gui cho moi muc; `createdAt` da la `timestamptz`; `approvalUrl` trong `ai-result`; `PUT /status` trung trang thai thi bo qua; `GET /leads/{id}` tra them `viewing`, `property`; sua phan "Tong quan luong" cho dung luong tuan 2 |

## Lịch sử thay đổi (dev)

| Nhánh | Nội dung |
|---|---|
| `feature/quan-ly-nha` | Thêm mục 3d (thêm, sửa, ẩn nhà), `GET /properties` ẩn căn HIDDEN, đặt lịch căn không AVAILABLE trả 400 |
| `feature/web-admin` | Thêm mục 3c (funnel, schedule, đổi giờ, duyệt, đổi trạng thái), webhook `viewing-admin-action`, event `VIEWING_RESCHEDULED` |
| `feature/auth` | Thêm bảng `users`, `POST /auth/login`, `GET /auth/me`; khoá các `GET` của admin bằng JWT (mục 3b) |
| `fix/luong-1`, `fix/luong-2` | Thêm `lead_events.type`: `STAFF_NUDGE_SENT`, `FOLLOWUP_FAILED` |
| `fix/backend-web` | Kiểm tra đầu vào chặt hơn (giờ quá khứ, tên rỗng, SĐT, `:id` không phải số) |
| `docs/dev-setup` | Tạo bản sao từ `api-contract.md` (commit `7b21c70` của `main`) |
