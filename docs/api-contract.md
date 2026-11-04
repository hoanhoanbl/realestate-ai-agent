# Hop dong API giua Backend, n8n va Web

File nay la "luat chung" cua ca nhom (n8n, backend, web).

Doi gi trong file nay thi phai: (1) tao nhanh `docs/...` rieng, (2) mo Pull Request, (3) nguoi kia bam Approve roi moi merge, (4) ghi mot dong vao muc "Lich su thay doi" o cuoi file. Khong sua thang tren `main`.

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
Luong 7: Backend goi webhook lead-changed -> n8n dong bo sang Mautic contact -> goi PUT /leads/:id/mautic luu mauticContactId.
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
  "viewingTime": "2026-10-12T09:00:00+07:00",
  "source": "facebook"
}
```

- `eventId`: UUID duy nhat moi su kien (de truy vet; chong xu ly trung la tuy chon).
- `budget`: don vi VND, so nguyen (kieu **so**).
- `needs`: chuoi rong neu khach khong nhap.
- `viewingTime`: ISO 8601, gio Viet Nam. Backend tu them `+07:00` neu web gui khong kem mui gio, nen n8n luon nhan duoc chuoi co mui gio.
- `source`: nguon khach (`facebook`, `zalo`, `google`, `direct`...).

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
- `staffNotified`: `true` neu da thong bao nhan vien bang email; `false` neu khong gui. Tu tuan 2, luong 1 gui email nhan vien (kem link duyet) cho **moi** muc, nen thuong la `true`.
- `approvalUrl` (tuan 2, tuy chon): gia tri `$execution.resumeUrl` cua lan chay dang cho duyet. Them `?action=approve` hoac `?action=reschedule` la duyet / doi gio.
- Backend luu cac truong tren va dat `automationStatus = COMPLETED`.

### 2.2. Bao loi (n8n hong giua chung)

`PUT /api/leads/{leadId}/automation-status`

```json
{
  "status": "FAILED",
  "error": "Gemini 503 sau 3 lan thu lai"
}
```

- `status`: n8n chi gui `FAILED`.
- `error`: mo ta ngan (tuy chon). Backend luu vao cot `automationError` cua lead.
- Backend dat `automationStatus = FAILED`.

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
- Neu trang thai moi **trung** trang thai cu: khong doi gi, khong ghi `STATUS_CHANGED`, van tra `200`.
- Lead dang `DEPOSIT` khong chuyen thang sang `LOST` duoc: tra `400` (BF-06). Quan ly phai tu choi hop dong truoc, lead tu ve `VIEWED`. Ap dung ca cho `PUT /api/leads/{leadId}/admin-status` cua web admin.

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

### 2.5. Cap nhat thong tin Mautic (L7 dong bo)

`PUT /api/leads/{leadId}/mautic`

```json
{
  "mauticContactId": 12,
  "mauticPoints": 50
}
```

- Header: `X-Webhook-Secret: <WEBHOOK_SECRET>`.
- `mauticContactId`: ID contact ben Mautic sau khi L7 tao / cap nhat contact thanh cong.
- `mauticPoints`: Diem tuong tac Mautic (L8 dong bo ve).
- Tra `200` va lead sau khi cap nhat.

### 2.6. Tra cứu lead theo Mautic contact (L8 Mautic báo về)

`GET /api/leads/by-mautic/{contactId}?email={email}`

- Header: `X-Webhook-Secret: <WEBHOOK_SECRET>`.
- Query param: `email` (tùy chọn).
- Tra `200` và Object `Lead` nếu tìm thấy, hoặc `null` nếu chưa liên kết.

## 3. API backend (toi thieu cho demo)

| Method | Duong dan | Mo ta |
|---|---|---|
| POST | `/api/viewings` | Khach dang ky xem nha; tao lead + viewing, goi webhook n8n (nhan kem `source`) |
| GET | `/api/leads` | Danh sach khach (loc theo `?level=HOT`), moi nhat truoc |
| GET | `/api/leads/{id}` | Chi tiet mot khach (tra them viewing, property, source, mauticContactId) |
| GET | `/api/leads/by-mautic/{contactId}` | n8n tra cuu lead theo Mautic contact (muc 2.6, can `X-Webhook-Secret`) |
| PUT | `/api/leads/{id}/ai-result` | n8n cap nhat ket qua AI (muc 2.1) |
| PUT | `/api/leads/{id}/automation-status` | n8n bao loi (muc 2.2) |
| GET | `/api/properties` | Danh sach bat dong san |
| GET | `/api/stats` | Dem lead theo muc, tra `{ "total": 0, "hot": 0, "warm": 0, "cold": 0 }` |
| GET | `/api/viewings` | Danh sach lich xem nha |
| GET | `/api/properties/{id}` | Mot bat dong san (tuan 2). Khong co: `404` |
| PUT | `/api/leads/{id}/status` | n8n doi trang thai ban hang (muc 2.3, can `X-Webhook-Secret`) |
| PUT | `/api/leads/{id}/mautic` | n8n cap nhat ID / diem Mautic (muc 2.5, can `X-Webhook-Secret`) |
| POST | `/api/leads/{id}/events` | n8n ghi su kien (muc 2.4, can `X-Webhook-Secret`) |
| GET | `/api/leads/{id}/events` | Dong thoi gian cua lead, cu nhat truoc |

## 4. Du lieu (4 bang)

| Bang | Truong chinh |
|---|---|
| `properties` | id, name, address, price, area, type, status |
| `leads` | id, name, email, phone, budget, needs, score, level, reason, aiReply, emailSent, staffNotified, status, source, mautic_contact_id, mautic_points, automationStatus, automationError, eventId, createdAt, approvalUrl |
| `viewings` | id, propertyId, leadId, viewingTime, status |
| `lead_events` | id, leadId, type, note, createdAt |

Gia tri `lead_events.type`:
- `AI_SCORED`, `APPROVED`, `RESCHEDULE_REQUESTED`, `APPROVAL_TIMEOUT`
- `REMINDER_SENT`, `FEEDBACK_ASKED`, `WARM_NUDGE_SENT`, `WARM_NURTURE_STARTED`, `STAFF_NUDGE_SENT`, `FOLLOWUP_FAILED`
- `VIEWING_RESCHEDULED`, `FEEDBACK_RECEIVED`, `FEEDBACK_ANALYZED`
- `CONTRACT_CREATED`, `CONTRACT_DRAFTED`, `CONTRACT_SENT`, `CONTRACT_SIGNED`, `CONTRACT_REJECTED`, `CONTRACT_EXPIRED`
- `MAUTIC_SYNCED`, `MAUTIC_SCORE_CHANGED`, `STATUS_CHANGED`

## 5. Xu ly loi

- Backend: neu goi n8n that bai, thu lai toi da 3 lan (cach nhau 2 giay), van loi thi dat `automationStatus = FAILED` va ghi log.
- n8n: bat Retry On Fail (3 lan, cho 5 giay) cho **moi** node co the loi. Cac node goi Mautic bat `continueErrorOutput` de re nhanh sang node "Bao loi Backend" ghi `FOLLOWUP_FAILED`.

## 6. L2: giu tac vu va checkpoint gui

Tat ca endpoint sau can `X-Webhook-Secret`. Chi deploy workflow L2 moi sau khi backend da co module Followups va bang `followup_tasks`.

| Method | Duong dan | Noi dung |
|---|---|---|
| POST | `/api/followups/claim` | `{leadId, viewingId, viewingTime, type, owner}`; backend kiem tra dieu kien va tra `{claimed, taskId?, token?, resume?}` |
| POST | `/api/followups/{id}/start` | `{token}`; tra `{allowed}`; ghi ACTION_STARTED truoc khi goi dich vu ngoai |
| POST | `/api/followups/{id}/action-done` | `{token, mauticContactId?}`; checkpoint sau khi dich vu ngoai xac nhan; contact ID bat buoc voi WARM |
| POST | `/api/followups/{id}/complete` | `{token}`; transaction luu event, trang thai tac vu va contact ID; khong tu doi khach sang VIEWED; lap lai khong tao them event |
| POST | `/api/followups/{id}/fail` | `{token, error}`; FAILED truoc khi gui, REVIEW khi khong chac ket qua gui, giu ACTION_DONE de chi thu lai metadata |
| POST | `/api/followups/{id}/resolve` | Xu ly REVIEW sau khi kiem tra nha cung cap: `{token, resolution: "delivered" / "not-delivered", mauticContactId?}` |

`owner` la execution ID n8n. Token tac vu la bi mat quyen so huu, khong tra ve API cong khai. REMINDER, ATTENDANCE_CHECK va ATTENDANCE_ESCALATE dung khoa theo lead + viewing + thoi gian xem; cac loai con lai theo lead + loai. FEEDBACK chi chon VIEWED + viewing ATTENDED; lich qua gio chua ghi nhan duoc nhac xac nhan, khong tu xem la da den. Hai execution cung nhan mot tac vu bi chan bang row lock va unique task key. SMTP khong ho tro giao dich chung voi PostgreSQL: mat phan hoi sau khi gui thi giu REVIEW, khong tu gui lai. Chi state ACTION_DONE duoc tu tiep tuc hoan tat database.

Chi tiet cau hinh va cach kiem tra: `docs/luong/luong-2-follow-up.md`.

## Lich su thay doi

| Ngay | Ai sua | Noi dung |
|---|---|---|
| 09/10/2026 | Ca nhom | Dong bo code tren `main` |
| 12/10/2026 | Hoang (Hau duyet) | Tuan 2: them `PUT /leads/{id}/status`, `POST`/`GET /leads/{id}/events`, `lead_events` |
| 21/10/2026 | Hau | Them cot `source`, `mautic_contact_id`, `mautic_points`, endpoint `PUT /api/leads/{id}/mautic`, webhook `lead-changed` |
