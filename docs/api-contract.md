# Hop dong API giua Backend va n8n

File nay la "luat chung" cua hai ban. Doi dinh dang o day thi phai bao ban kia.

## Quy uoc chung

- Backend NestJS chay o cong **8081**, tien to `/api` (vi du `http://localhost:8081/api/leads`). Swagger: `/api/docs`.
- n8n chay o cong `5678`.
- JSON dung **camelCase** (`createdAt`, `propertyId`, `automationStatus`). Ten cot trong database la snake_case, chi la chi tiet noi bo cua backend.
- `X-Webhook-Secret`: hai ben dung chung mot gia tri `WEBHOOK_SECRET`. Dat trong `.env` cua backend va trong credential Header Auth cua n8n. Khong dua len GitHub.
- Dat `WEBHOOK_SECRET` la chuoi ngau nhien dai khi dua len host (gia tri dev chi de test).

## Tong quan luong

```
Khach dang ky xem nha (web / app)
  -> Backend luu lead + viewing (lead.status = NEW, automationStatus = PENDING)
  -> Backend POST webhook sang n8n
  -> n8n: AI cham diem, soan email, gui email, thong bao nhan vien neu lead nong
  -> n8n goi nguoc Backend de cap nhat diem (automationStatus = COMPLETED)
  -> Neu n8n hong giua chung: n8n bao Backend automationStatus = FAILED
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
  "viewingTime": "2026-10-12T09:00:00"
}
```

- `eventId`: UUID duy nhat moi su kien (de truy vet; chong xu ly trung la tuy chon).
- `budget`: don vi VND, so nguyen.
- `needs`: chuoi rong neu khach khong nhap.
- `viewingTime`: ISO 8601, gio Viet Nam (UTC+7).

## 2. n8n -> Backend (callback)

Chung cho moi callback:

- Header: `X-Webhook-Secret: <WEBHOOK_SECRET>`; **sai thi Backend tra 401**.
- Dev (backend chay tren may that, n8n trong Docker): `http://host.docker.internal:8081/api/...`
- Trong Docker Compose, n8n goi: `http://backend:8081/api/...`

### 2.1. Ket qua AI (thanh cong)

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
- `score`: so nguyen 0-100
- `staffNotified`: `true` neu da thong bao nhan vien (hien tai bang email nhan vien, chi gui cho lead HOT); `false` neu khong gui. (Truoc day ten la `telegramNotified`, da doi vi khong dung Telegram.)
- Backend luu cac truong tren va dat `automationStatus = COMPLETED`.

### 2.2. Bao loi (n8n hong giua chung) — **can Backend them**

`PUT /api/leads/{leadId}/automation-status`

```json
{
  "status": "FAILED",
  "error": "Gemini 503 sau 3 lan thu lai"
}
```

- `status`: hien chi dung `FAILED`.
- `error`: mo ta ngan (tuy chon).
- Backend dat `automationStatus = FAILED` (va luu `error` neu co cot). Neu khong co endpoint nay, lead se ket o `PENDING` khi n8n loi giua chung.

## 3. API backend (toi thieu cho demo)

| Method | Duong dan | Mo ta |
|---|---|---|
| POST | `/api/viewings` | Khach dang ky xem nha; tao lead + viewing, goi webhook n8n |
| GET | `/api/leads` | Danh sach khach (loc theo `?level=HOT`), moi nhat truoc |
| GET | `/api/leads/{id}` | Chi tiet mot khach |
| PUT | `/api/leads/{id}/ai-result` | n8n cap nhat ket qua AI (muc 2.1) |
| PUT | `/api/leads/{id}/automation-status` | n8n bao loi (muc 2.2) — **can them** |
| GET | `/api/properties` | Danh sach bat dong san |
| GET | `/api/stats` | So lead, ti le HOT/WARM/COLD |

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

- `needs` la tuy chon. `email` phai dung dinh dang. `propertyId` phai ton tai.
- Thanh cong: `201` va tra `{ "viewing": {...}, "lead": {...} }`.
- Sai du lieu: `400` (email sai dinh dang, thieu truong). Khong tim thay bat dong san: `404`.
- Backend goi n8n **bat dong bo**: n8n loi khong lam hong viec luu lead.

## 4. Du lieu (3 bang)

| Bang | Truong chinh |
|---|---|
| `properties` | id, name, address, price, area, type, status |
| `leads` | id, name, email, phone, budget, needs, score, level, reason, aiReply, emailSent, staffNotified, status, automationStatus, createdAt |
| `viewings` | id, propertyId, leadId, viewingTime, status |

Luu y: hien `POST /api/viewings` tra doi tuong `viewing` voi khoa snake_case (`property_id`, `lead_id`, `viewing_time`), trong khi `lead` da la camelCase. Backend nen doi `viewing` sang camelCase cho dong nhat; truoc khi doi, web dung ten snake_case.

Gia tri trang thai:

| Truong | Gia tri |
|---|---|
| `leads.status` | `NEW` |
| `leads.automationStatus` | `PENDING` (vua tao, chua co ket qua AI) -> `COMPLETED` (n8n da cap nhat diem) hoac `FAILED` (khong goi duoc n8n, hoac n8n bao loi) |
| `leads.level` | `HOT` / `WARM` / `COLD` (null khi chua cham) |
| `viewings.status` | `NEW` |

## 5. Xu ly loi (can co de lay diem)

- Backend: neu goi n8n that bai, thu lai toi da 3 lan (cach nhau 2 giay), van loi thi dat `automationStatus = FAILED` va ghi log. Khong de loi n8n lam hong viec luu lead.
- n8n: bat Retry On Fail (3 lan, cho 5 giay) cho node AI, email, HTTP Request. Nhanh loi goi `PUT /api/leads/{id}/automation-status` voi `status = FAILED` (muc 2.2).
- Nhanh loi khi goi nguoc Backend that bai (vi du lead khong ton tai): workflow ket thuc o node `Callback failed`, khong lam treo.
- Theo doi: dung `automationStatus` va log cua Backend, tab Executions cua n8n. Bang `automation_logs` la tuy chon, khong bat buoc cho demo.
