# Hop dong API giua Backend va n8n

File nay la "luat chung" cua ca nhom (n8n, backend, web). **Neu file nay va `huong-dan-thuc-hien.md` mau thuan nhau thi file nay thang.**

Doi gi trong file nay thi phai: (1) tao nhanh `docs/...` rieng, (2) mo Pull Request, (3) nguoi kia bam Approve roi moi merge, (4) ghi mot dong vao muc "Lich su thay doi" o cuoi file. Khong sua thang tren `main`. Quy trinh day du xem muc "Cach phoi hop" trong `huong-dan-thuc-hien.md`.

## Quy uoc chung

- Backend NestJS chay o cong **8081**, tien to `/api` (vi du `http://localhost:8081/api/leads`). Swagger: `/api/docs`.
- n8n chay o cong `5678`. Web (Next.js) chay o cong `3000`.
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
  "staffNotified": true
}
```

- `level`: `HOT` | `WARM` | `COLD` (HOT khi score >= 70, WARM 40-69, COLD < 40)
- `score`: so nguyen 0-100
- `staffNotified`: `true` neu da thong bao nhan vien (hien tai bang email nhan vien, chi gui cho lead HOT); `false` neu khong gui. (Truoc day ten la `telegramNotified`, da doi vi khong dung Telegram.)
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

## 3. API backend (toi thieu cho demo)

| Method | Duong dan | Mo ta |
|---|---|---|
| POST | `/api/viewings` | Khach dang ky xem nha; tao lead + viewing, goi webhook n8n |
| GET | `/api/leads` | Danh sach khach (loc theo `?level=HOT`), moi nhat truoc |
| GET | `/api/leads/{id}` | Chi tiet mot khach |
| PUT | `/api/leads/{id}/ai-result` | n8n cap nhat ket qua AI (muc 2.1) |
| PUT | `/api/leads/{id}/automation-status` | n8n bao loi (muc 2.2) |
| GET | `/api/properties` | Danh sach bat dong san |
| GET | `/api/stats` | Dem lead theo muc, tra `{ "total": 0, "hot": 0, "warm": 0, "cold": 0 }` (lead chua cham diem chi nam trong `total`) |
| GET | `/api/viewings` | Danh sach lich xem nha (phuc vu kiem tra, web khong bat buoc dung) |

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

## 4. Du lieu (3 bang)

| Bang | Truong chinh |
|---|---|
| `properties` | id, name, address, price, area, type, status |
| `leads` | id, name, email, phone, budget, needs, score, level, reason, aiReply, emailSent, staffNotified, status, automationStatus, automationError, eventId, createdAt |
| `viewings` | id, propertyId, leadId, viewingTime, status |

Tat ca khoa JSON deu camelCase, ke ca doi tuong `viewing`.

**Kieu du lieu that su duoc tra ve (web phai xu ly dung):**

| Truong | Kieu tra ve | Cach xu ly o web |
|---|---|---|
| `leads.budget` | **chuoi** (`"3000000000"`) khi `GET`, nhung la **so** trong phan hoi cua `POST /viewings` | Luon `Number(...)` truoc khi dinh dang |
| `properties.price`, `properties.area` | **chuoi** (cot `bigint`/`decimal`) | `Number(...)` truoc khi dinh dang |
| `viewings.viewingTime` | chuoi ISO gio UTC, vi du `2026-10-12T02:00:00.000Z` (cot `timestamptz`) | Hien thi theo gio Viet Nam (`Asia/Ho_Chi_Minh`), khong tu cong tru 7 gio |
| `leads.createdAt` | chuoi ISO (cot `timestamp` khong mui gio) | Hien thi nhu nhan duoc; backend can kiem tra khong lech 7 gio (xem checklist trong `huong-dan-thuc-hien.md`) |
| `score`, `level`, `reason`, `aiReply`, `emailSent`, `staffNotified` | `null` cho den khi `automationStatus = COMPLETED` | Hien "dang xu ly" khi `PENDING`, "loi" khi `FAILED` |

Gia tri trang thai:

| Truong | Gia tri |
|---|---|
| `leads.status` | `NEW` |
| `leads.automationStatus` | `PENDING` (vua tao, chua co ket qua AI) -> `COMPLETED` (n8n da cap nhat diem) hoac `FAILED` (khong goi duoc n8n, hoac n8n bao loi) |
| `leads.level` | `HOT` / `WARM` / `COLD` (null khi chua cham) |
| `viewings.status` | `NEW` |

## 5. Xu ly loi (can co de lay diem)

- Backend: neu goi n8n that bai, thu lai toi da 3 lan (cach nhau 2 giay), van loi thi dat `automationStatus = FAILED` va ghi log. Khong de loi n8n lam hong viec luu lead.
- n8n: bat Retry On Fail (3 lan, cho 5 giay) cho **moi** node co the loi: AI, gui email khach, thong bao nhan vien, HTTP Request. Neu mot trong cac node AI / email / thong bao nhan vien van loi sau khi thu lai, nhanh loi phai goi `PUT /api/leads/{id}/automation-status` voi `status = FAILED` va `error` mo ta ngan (muc 2.2).
- Nhanh loi khi goi nguoc Backend that bai (vi du lead khong ton tai): workflow ket thuc o node `Callback failed`, khong lam treo. (Day la truong hop duy nhat khong bao FAILED duoc, vi chinh Backend khong nhan duoc.)
- Theo doi: dung `automationStatus` va log cua Backend, tab Executions cua n8n. Bang `automation_logs` la tuy chon, khong bat buoc cho demo.

## Lich su thay doi

| Ngay | Ai sua | Noi dung |
|---|---|---|
| 09/10/2026 | Ca nhom (dong bo voi code da merge len `main`) | `viewing` da camelCase; `automation-status` da co; `viewingTime` gui sang n8n co `+07:00`; them kieu du lieu tra ve (budget/price/area la chuoi); them `GET /api/viewings`, `automationError`, `eventId`; ro rang moi nhanh loi n8n phai bao `FAILED` |
