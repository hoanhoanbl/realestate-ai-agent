# Hop dong API giua Backend, n8n va Web

File nay la "luat chung" cua ca nhom (n8n, backend, web).

Doi gi trong file nay thi phai: (1) tao nhanh `docs/...` rieng, (2) mo Pull Request, (3) nguoi kia bam Approve roi moi merge, (4) ghi mot dong vao muc "Lich su thay doi" o cuoi file. Khong sua thang tren `main`.

## Quy uoc chung

**FE-33 (local, chưa triển khai server):** [Hợp đồng API tiếp nhận và phân công sale](fe-33-nen-tiep-nhan.md#hợp-đồng-api) bổ sung `POST /leads`, `POST /leads/intake`, lookup theo số điện thoại, chuyển người phụ trách, ghi chú và cấu hình nhận khách. Lead có trạng thái `CONSULTING`; email và ngân sách có thể `null` với khách chưa đặt lịch. Các API đặt lịch cũ giữ đầu vào bắt buộc; phần chuyển tiếp chống trùng số được ghi tại tài liệu FE-33.

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
- Tu FE-35 payload them `assignedUserId` (sale phu trach, `null` neu chua co); luong 1 dung de bao dung sale.

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
  "staffNotified": true
}
```

- `level`: `HOT` | `WARM` | `COLD` (HOT khi score >= 70, WARM 40-69, COLD < 40)
- `score`: so nguyen 0-100
- `staffNotified`: `true` neu da thong bao nhan vien bang email; `false` neu khong gui. Tu tuan 2, luong 1 gui email nhan vien (kem link duyet) cho **moi** muc, nen thuong la `true`.
- `approvalUrl` (tuy chon, **bo tu FE-35**): luong 1 khong con cho duyet nen khong gui nua; backend van nhan truong nay cho cac lan chay cu dang cho luc deploy.
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
| GET | `/api/properties` | Danh sach bat dong san (ban gon: khong co `images`, `panoramas`, thay bang `imageCount`, `panoramaCount`) |
| GET | `/api/stats` | Dem lead theo muc, tra `{ "total": 0, "hot": 0, "warm": 0, "cold": 0 }` |
| GET | `/api/viewings` | Danh sach lich xem nha |
| GET | `/api/viewings/slots?propertyId={id}` | Cong khai. Cac khung gio khach dat duoc cua mot can, danh dau khung da kin (muc 3.1) |
| GET | `/api/properties/{id}` | Mot bat dong san (tuan 2). Khong co: `404` |
| PUT | `/api/leads/{id}/status` | n8n doi trang thai ban hang (muc 2.3, can `X-Webhook-Secret`) |
| PUT | `/api/leads/{id}/mautic` | n8n cap nhat ID / diem Mautic (muc 2.5, can `X-Webhook-Secret`) |
| POST | `/api/leads/{id}/events` | n8n ghi su kien (muc 2.4, can `X-Webhook-Secret`) |
| GET | `/api/leads/{id}/events` | Dong thoi gian cua lead, cu nhat truoc |

### 3.1. Khung gio dat lich xem nha (FE-34)

`GET /api/viewings/slots?propertyId=5` (khong can dang nhap, khong tra du lieu khach):

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

- `date`, `time`: ngay va gio Viet Nam (UTC+7). `start`: gio bat dau dang ISO UTC, gui lai nguyen gia tri nay vao `viewingTime` khi dat lich.
- `available: false`: da co khach hen can nay trong vong duoi 60 phut.
- Can khong nhan dat lich (da giu coc, da ban, an): `400`. Khong co can: `404`. `propertyId` khong phai so: `400`.

Quy tac gio cho `POST /api/viewings` (khach, bot) va `PUT /api/viewings/{id}` (nhan vien). Sai thi tra `400`, khong luu gi:

| Quy tac | Ap dung | Thong bao |
|---|---|---|
| Trong khoang 08:00-19:00 gio Viet Nam | Moi nguoi | `Giờ xem nhà phải trong khoảng 08:00–19:00` |
| Tron gio (phut va giay bang 0) | Khach, bot | `Giờ xem nhà phải tròn giờ (ví dụ 09:00, 10:00)` |
| Dat truoc it nhat 3 gio lam viec (08:00-21:00), lam tron len gio chan | Khach, bot | `Cần đặt trước ít nhất 3 giờ làm việc. Khung sớm nhất còn đặt được: 10:00 11/11/2026` |
| Khong qua 14 ngay toi | Khach, bot | `Chỉ nhận đặt lịch trong vòng 14 ngày tới` |
| O tuong lai | Nhan vien | `viewingTime phải ở trong tương lai` |

Hai lich cung mot can van phai cach nhau it nhat 60 phut, sai thi tra `409` nhu truoc.

## 4. Du lieu (4 bang)

| Bang | Truong chinh |
|---|---|
| `properties` | id, name, address, price, area, type, status, imageUrl, description; chi tiet (FE-31): bedrooms, bathrooms, floors, landArea, floorArea, roadWidth, direction, legalStatus, furnishing, occupancy (ma trong `backend/src/properties/property-options.ts`); mang: images (link), features, furniture, nearby (`{ category, name, distance }`), panoramas (`{ title, url }`). Mang `null` = chua nhap, `[]` = da xoa het |
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

## 7. L6: ghi log hoi thoai bot Telegram

Can `X-Webhook-Secret`. Bang `chat_logs` tu tao khi backend khoi dong (TypeORM `synchronize`).

| Method | Duong dan | Noi dung |
|---|---|---|
| POST | `/api/chat-logs` | `{chatId, route, question, reply, channel?, usedFallback?, escalated?, staffNotified?, executionId?}`; tra `{id}` |

`route`: `COMMAND` (lenh /start, tin khong phai chu), `BLOCKED` (Guardrails chan), `AGENT` (AI Agent tra loi), `STAFF` (khach muon gap nhan vien), `OUT_OF_SCOPE` (ngoai pham vi). Backend che email va day so bat dau bang 0 hoac +84 dai 9-12 chu so (so dien thoai, CCCD) trong `question`, `reply` truoc khi luu.

### 3.2. Link Duyet / Doi gio cho nhan vien (FE-35)

| Method | Duong dan | Xac thuc | Ket qua |
|---|---|---|---|
| POST | `/api/viewings/{id}/staff-links` | `X-Webhook-Secret` | `{approveUrl, rescheduleUrl}` tro toi `/duyet/<ma>` tren web; 404 neu buoi xem khong co |
| GET | `/api/viewings/staff-links/{token}` | Khong (token co chu ky) | Tom tat `{action, leadName, propertyName, propertyAddress, viewingTime, leadStatus, viewingStatus, canAct, refusal}`; khong tra SDT/email, khong doi gi. Token sai: 404 |
| POST | `/api/viewings/staff-links/{token}/confirm` | Khong (token co chu ky) | `{ok, action, already?}`; 400 kem ly do khi khach da huy, da duyet, co buoi xem moi hon, qua gio hen, hoac AI chua cham (chi voi duyet); 502 neu n8n loi |
| GET | `/api/users/{id}/notify-target` | `X-Webhook-Secret` | `{id, name, email, role, telegramChatId, pushToken}` cho sub-workflow thong bao; khong tra hash |

Token la `base64url({v: viewingId, a: approve|reschedule}).HMAC-SHA256(WEBHOOK_SECRET)`; han dung tinh theo gio hen hien tai cua buoi xem luc bam, khong nam trong token. Xac nhan goi webhook `viewing-admin-action` voi `event` = `approved` | `reschedule_requested` va `viewingId` (luong 1b). Xem [FE-35](fe-35-thong-bao-phu-trach.md).

## Lich su thay doi

| Ngay | Ai sua | Noi dung |
|---|---|---|
| 09/10/2026 | Ca nhom | Dong bo code tren `main` |
| 12/10/2026 | Hoang (Hau duyet) | Tuan 2: them `PUT /leads/{id}/status`, `POST`/`GET /leads/{id}/events`, `lead_events` |
| 21/10/2026 | Hau | Them cot `source`, `mautic_contact_id`, `mautic_points`, endpoint `PUT /api/leads/{id}/mautic`, webhook `lead-changed` |
| 06/11/2026 | Hoang | FE-32: `POST /api/chat-logs`, bang `chat_logs` cho log hoi thoai luong 6 |
| 10/11/2026 | Hau (local) | FE-33: API tiep nhan/tra trung theo SDT, gan/chuyen sale, ghi chu, cau hinh nhan khach; CONSULTING, email/ngan sach nullable; chi tiet trong `fe-33-nen-tiep-nhan.md` |
| 10/11/2026 | Hoang | FE-34: `GET /api/viewings/slots`, quy tac khung gio dat lich (muc 3.1) |
| 11/11/2026 | Hoang (local) | FE-35: link Duyet/Doi gio (muc 3.2), `GET /api/users/{id}/notify-target`, payload `viewing_requested` them `assignedUserId`, bo `approvalUrl` |
