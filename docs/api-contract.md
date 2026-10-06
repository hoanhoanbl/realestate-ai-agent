# Hop dong API giua Backend va n8n

File nay la "luat chung" cua hai ban. Doi dinh dang o day thi phai bao ban kia.

## Tong quan luong

```
Khach dang ky xem nha (web)
  -> Backend luu lead + viewing (trang thai NEW)
  -> Backend POST webhook sang n8n
  -> n8n: AI cham diem, soan email, gui email, bao Telegram neu lead nong
  -> n8n goi nguoc Backend de cap nhat diem va trang thai
```

## 1. Backend -> n8n (webhook)

- Method: `POST`
- Local test: `http://localhost:5678/webhook-test/viewing-requested`
- Production (workflow da Active): `http://localhost:5678/webhook/viewing-requested`
- Trong Docker Compose, backend goi: `http://n8n:5678/webhook/viewing-requested`
- Header: `X-Webhook-Secret: <WEBHOOK_SECRET>`; n8n kiem tra header nay, sai thi tra 401.
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

- `eventId`: UUID duy nhat moi su kien, de n8n bo qua neu nhan trung (idempotency).
- `budget`: don vi VND.
- `viewingTime`: ISO 8601, gio Viet Nam.

## 2. n8n -> Backend (callback)

- Method: `PUT /api/leads/{leadId}/ai-result`
- Header: `X-Webhook-Secret: <WEBHOOK_SECRET>`
- Trong Docker Compose, n8n goi: `http://backend:8080/api/leads/{leadId}/ai-result`

Body:

```json
{
  "score": 85,
  "level": "HOT",
  "reason": "Ngan sach ro rang, co lich xem nha cu the",
  "aiReply": "Noi dung email xac nhan da soan",
  "emailSent": true,
  "telegramNotified": true
}
```

- `level`: `HOT` | `WARM` | `COLD`
- `score`: so nguyen 0-100

## 3. API backend can co (toi thieu cho demo)

| Method | Duong dan | Mo ta |
|---|---|---|
| POST | `/api/viewings` | Khach dang ky xem nha; tao lead + viewing, goi webhook n8n |
| GET | `/api/leads` | Danh sach khach (co loc theo `level`) |
| GET | `/api/leads/{id}` | Chi tiet mot khach |
| PUT | `/api/leads/{id}/ai-result` | n8n cap nhat ket qua AI |
| GET | `/api/properties` | Danh sach bat dong san |
| GET | `/api/stats` | So lead, ti le HOT/WARM/COLD |

## 4. Du lieu (3 bang)

| Bang | Truong chinh |
|---|---|
| `properties` | id, name, address, price, area, type, status |
| `leads` | id, name, email, phone, budget, needs, score, level, status, created_at |
| `viewings` | id, property_id, lead_id, viewing_time, status |

## 5. Xu ly loi (can co de lay diem)

- Backend: neu goi n8n that bai, thu lai toi da 3 lan, van loi thi danh dau `automationStatus = FAILED` va ghi log.
- n8n: bat Retry On Fail cho node AI, email, HTTP Request.
- Ghi log moi lan chay vao bang `automation_logs` hoac hien tren dashboard.
