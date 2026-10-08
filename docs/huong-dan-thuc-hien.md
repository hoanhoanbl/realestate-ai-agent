# Hướng dẫn thực hiện cho 2 người

Stack: **n8n + NestJS + Next.js + PostgreSQL + Docker Compose**.
Hạn demo giữa kỳ: **thứ Bảy 10/10/2026**.

Hợp đồng dữ liệu hai bên: xem [api-contract.md](api-contract.md). Đổi gì trong đó thì báo bạn kia.

## Phân vai

| Người | Nhánh Git | Phụ trách | Thư mục |
|---|---|---|---|
| Bạn n8n | `feature/n8n-workflow` | Workflow n8n, prompt AI, email, Telegram | `n8n-workflows/` |
| Bạn backend | `feature/backend-api` | NestJS, PostgreSQL, API, gọi webhook | `backend/` |
| Cả hai | | Next.js (chia nhau), Docker, báo cáo, demo | `web/` |

Quy tắc: mỗi người chỉ sửa thư mục của mình để không xung đột. Mỗi sáng chạy `git checkout main`, `git pull`, rồi quay lại nhánh mình và `git merge main`.

## Khoá bí mật dùng chung

- `WEBHOOK_SECRET` phải **giống nhau** trong `.env` của hai máy. Gửi cho nhau qua tin nhắn riêng, không đưa lên GitHub.
- Key Gemini, token Telegram, mật khẩu email: chỉ nhập trong **n8n (Credentials)**, không để trong repo.

---

# PHẦN A. Bạn n8n

## A1. Webhook (đã bắt đầu)

1. Node **Webhook**: Method `POST`, Path `viewing-requested`, Authentication `Header Auth`, Respond `Immediately`, Response Code `200`.
2. Credential Header Auth: Name `X-Webhook-Secret`, Value = giá trị `WEBHOOK_SECRET` trong `.env`.
3. Test (thay `GIA_TRI_SECRET`):

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:5678/webhook-test/viewing-requested" -Headers @{ "X-Webhook-Secret" = "GIA_TRI_SECRET" } -ContentType "application/json" -Body '{"event":"viewing_requested","eventId":"b7f3c1a2-0f4e-4a55-9d1e-1c2f3a4b5c6d","leadId":12,"name":"Nguyen Van A","email":"a@example.com","phone":"0900000000","budget":3000000000,"needs":"Can ho 2 phong ngu gan Da Nang","propertyId":5,"viewingTime":"2026-10-12T09:00:00"}'
```

4. Ghim dữ liệu (Pin data) ở Output để làm các node sau không cần gửi lại.
5. Gọi thiếu header phải bị từ chối (403).

## A2. Node AI chấm điểm (Gemini)

1. Lấy API key tại https://aistudio.google.com/apikey (đăng nhập Google, bấm Create API key).
2. Trong n8n, thêm node sau Webhook: **Basic LLM Chain**, gắn **Google Gemini Chat Model**. Tạo credential bằng API key vừa lấy.
3. Prompt gợi ý:

```
Bạn là trợ lý bán bất động sản. Dựa vào thông tin khách hàng, hãy chấm điểm mức độ tiềm năng.

Khách: {{ $json.body.name }}
Ngân sách (VND): {{ $json.body.budget }}
Nhu cầu: {{ $json.body.needs }}
Giờ xem nhà: {{ $json.body.viewingTime }}

Quy tắc:
- score từ 0 đến 100.
- level: HOT nếu score >= 70, WARM nếu 40 đến 69, COLD nếu dưới 40.
- Có ngân sách rõ ràng và nhu cầu cụ thể thì điểm cao.
- reason: 1 câu ngắn bằng tiếng Việt.
- emailBody: email xác nhận lịch xem nhà, thân thiện, tiếng Việt, tối đa 5 câu.

Chỉ trả về JSON hợp lệ, không thêm chữ nào khác:
{"score": 0, "level": "COLD", "reason": "", "emailBody": ""}
```

4. Thêm **Structured Output Parser** (hoặc dùng node Code/Edit Fields để `JSON.parse` kết quả) để các trường `score`, `level`, `reason`, `emailBody` dùng được ở node sau.
5. Chạy thử với dữ liệu đã ghim. Thử 3 ca: ngân sách rõ (HOT), ngân sách mơ hồ (WARM), nhu cầu trống (COLD) để chắc AI phân loại hợp lý. Ghi lại kết quả cho phần đo lường trong báo cáo.

Giao diện n8n thay đổi tên nút theo phiên bản, nếu khác thì chụp màn hình để hỏi.

## A3. Gửi email xác nhận

Cách dễ nhất là SMTP với mật khẩu ứng dụng của Gmail:

1. Tài khoản Google bật xác minh 2 bước, rồi tạo **App password** (myaccount.google.com, mục Security).
2. Trong n8n thêm node **Send Email**, tạo credential SMTP: host `smtp.gmail.com`, port `465`, bật SSL, user là email của bạn, password là App password.
3. To: `{{ $('Webhook').item.json.body.email }}`, Subject: `Xác nhận lịch xem nhà`, nội dung: `emailBody` từ AI.

## A4. Rẽ nhánh HOT và báo Telegram

1. Thêm node **IF**: `{{ $json.level }}` bằng `HOT`.
2. Tạo bot: nhắn `@BotFather` trên Telegram, gửi `/newbot`, lấy **token**. Nhắn bot vài chữ rồi lấy chat ID (nhắn `@userinfobot` để thấy ID của bạn).
3. Nhánh true: node **Telegram → Send Message**, tạo credential bằng token, chat ID của bạn, nội dung ví dụ: `Lead nóng: {{ name }} - điểm {{ score }}. Xem nhà lúc {{ viewingTime }}`.

## A5. Gọi ngược về backend

Node **HTTP Request**:

- Method `PUT`
- URL: `http://host.docker.internal:8081/api/leads/{{ $('Webhook').item.json.body.leadId }}/ai-result`
  (n8n chạy trong Docker, backend chạy trên máy thật khi đang code. Khi backend vào Docker Compose thì đổi thành `http://backend:8081/...`.)
- Header: `X-Webhook-Secret` = giá trị secret
- Body JSON: `score`, `level`, `reason`, `aiReply`, `emailSent`, `telegramNotified` theo `api-contract.md`.

Chưa có backend thì tạm tắt node này (Deactivate).

## A6. Xử lý lỗi (cần có để lấy điểm)

- Các node AI, Email, Telegram, HTTP: mở **Settings** của node, bật **Retry On Fail** (3 lần, chờ 5 giây).
- Một nhánh lỗi: bật **On Error → Continue (using error output)** rồi ghi log hoặc báo Telegram `Workflow lỗi`.
- Có thể tạo workflow riêng "Error Handler" dùng node **Error Trigger** và chọn nó ở Settings của workflow chính.

## A7. Xuất và lưu vào Git

1. Menu `...` của workflow, chọn **Download**, lưu vào `n8n-workflows/viewing-requested.json`.
2. Kiểm tra file không chứa key thật (credential trong n8n chỉ xuất tên, không xuất giá trị).
3. Lệnh:

```powershell
git add .
git commit -m "feat: workflow cham diem lead"
git push
```

4. Khi workflow hoàn chỉnh, bấm **Publish** (hoặc Active) và test lại bằng URL `/webhook/viewing-requested` (không có `-test`).

---

# PHẦN B. Bạn backend (NestJS)

## B1. Chuẩn bị

1. Cài **Node.js LTS** từ nodejs.org, kiểm tra:

```powershell
node -v
npm -v
```

2. Lấy file khởi đầu về nhánh mình:

```powershell
git checkout feature/backend-api
git merge origin/main
git rm backend-test.txt
git commit -m "chore: xoa file test"
```

3. Tạo `.env` ở thư mục gốc từ `.env.example`, rồi bật database:

```powershell
Copy-Item .env.example .env
docker compose up -d db
```

## B2. Tạo dự án NestJS

```powershell
cd backend
npx @nestjs/cli new . --package-manager npm --skip-git
```

`--skip-git` quan trọng: không dùng thì NestJS tạo thêm một repo Git lồng trong repo chính.

Cài thư viện:

```powershell
npm i @nestjs/config @nestjs/typeorm typeorm pg @nestjs/axios class-validator class-transformer @nestjs/swagger
```

Tạo file `backend/.env` (đã bị `.gitignore` bỏ qua):

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=realestate
DB_USER=realestate
DB_PASSWORD=<giống .env gốc>
N8N_WEBHOOK_URL=http://localhost:5678/webhook-test/viewing-requested
WEBHOOK_SECRET=<giống bạn n8n>
```

Dùng `webhook-test` khi bạn n8n đang bấm Listen, đổi sang `webhook` khi workflow đã Publish.

## B3. Cấu hình `main.ts`

- `app.setGlobalPrefix('api')`
- `app.enableCors()` để Next.js gọi được
- `app.useGlobalPipes(new ValidationPipe({ whitelist: true }))`
- Swagger tại `/api/docs` để thử API nhanh

## B4. Dữ liệu và API

Tạo 3 module bằng `npx nest g resource properties`, `leads`, `viewings` (chọn REST API). Entity theo bảng trong `api-contract.md`:

| Bảng | Trường |
|---|---|
| `properties` | id, name, address, price, area, type, status |
| `leads` | id, name, email, phone, budget, needs, score, level, status, automationStatus, createdAt |
| `viewings` | id, propertyId, leadId, viewingTime, status |

Cấu hình TypeORM với `synchronize: true` (chỉ dùng khi phát triển).

API tối thiểu:

| Method | Đường dẫn | Việc |
|---|---|---|
| POST | `/api/viewings` | Tạo lead + viewing, rồi gọi webhook n8n |
| GET | `/api/leads` | Danh sách, lọc theo `level` |
| GET | `/api/leads/:id` | Chi tiết |
| PUT | `/api/leads/:id/ai-result` | n8n cập nhật điểm AI (kiểm tra header `X-Webhook-Secret`, sai trả 401) |
| GET | `/api/properties` | Danh sách bất động sản |
| GET | `/api/stats` | Tổng số lead, số HOT/WARM/COLD |

Nhập sẵn khoảng 10 bất động sản mẫu (seed) để demo.

## B5. Gọi webhook sang n8n

Khi `POST /api/viewings` thành công, gọi `POST` tới `N8N_WEBHOOK_URL` với:

- Header `X-Webhook-Secret`
- Body theo `api-contract.md`, `eventId` là UUID mới mỗi lần (`crypto.randomUUID()`)
- Nếu lỗi: thử lại tối đa 3 lần, vẫn lỗi thì ghi `automationStatus = FAILED` và log. **Không để lỗi n8n làm hỏng việc lưu lead của khách.**

## B6. Kiểm thử

Chạy `npm run start:dev`, mở `http://localhost:8081/api/docs` thử từng API. Hoặc dùng Postman. Thử luồng: tạo viewing, backend gọi n8n (bạn n8n đang Listen), kiểm tra n8n gọi ngược cập nhật `score`.

## B7. Lưu vào Git

```powershell
git add .
git commit -m "feat: khung NestJS va API leads"
git push
```

Mỗi khi xong một phần (API leads, gọi webhook, stats) thì commit một lần.

---

# PHẦN C. Làm chung

## C1. Next.js (thứ Năm đến thứ Sáu)

```powershell
cd web
npx create-next-app@latest . --typescript --app --use-npm
```

Các trang cần có:

1. **Form đăng ký xem nhà:** tên, email, SĐT, ngân sách, nhu cầu, chọn bất động sản, giờ xem. Gọi `POST /api/viewings`.
2. **Danh sách khách:** bảng, lọc HOT/WARM/COLD, thấy điểm và lý do AI.
3. **Dashboard:** số lead theo mức, gọi `GET /api/stats`.

Địa chỉ API đặt trong `web/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8081/api` (backend chạy cổng 8081, Next.js giữ cổng mặc định 3000, không bị trùng).

## C2. Docker Compose (thứ Sáu)

1. Thêm `backend/Dockerfile` và `web/Dockerfile`.
2. Bỏ comment khối `backend` trong `docker-compose.yml`, thêm khối `web`.
3. Đổi URL gọi nhau theo tên service: backend gọi `http://n8n:5678/...`, n8n gọi `http://backend:8081/...` (đúng cổng backend).
4. Chạy `docker compose up -d --build` và thử lại toàn bộ luồng.

## C3. Lịch

| Ngày | Bạn n8n | Bạn backend |
|---|---|---|
| Thứ Tư 7/10 | A1 đến A3 (Webhook, AI, email) | B1 đến B4 (NestJS, DB, API) |
| Thứ Năm 8/10 | A4 đến A6 (Telegram, nối backend, retry), bắt đầu web | B5, B6 (gọi webhook, test), bắt đầu web |
| Thứ Sáu 9/10 | Web, Docker, quay video dự phòng | Web, Docker, slide |
| Thứ Bảy 10/10 | Chạy thử một lần, rồi demo | |

Nếu thiếu thời gian, bỏ theo thứ tự: Docker cho web, dashboard, Telegram. Giữ lại: form, backend lưu DB, n8n chấm điểm AI, email, gọi ngược cập nhật.

## C4. Kịch bản demo (5 đến 7 phút)

1. Nói bài toán và vẽ lại sơ đồ luồng.
2. Điền form trên web, bấm gửi.
3. Mở n8n, tab **Executions** cho xem lần chạy thành công và từng node.
4. Cho xem email xác nhận trong hộp thư, tin nhắn Telegram với khách HOT.
5. Quay lại web: khách vừa gửi đã có điểm và mức HOT/WARM/COLD.
6. Tắt backend, gửi tiếp để thấy retry và log lỗi.
7. Cho xem `docker ps` với các container đang chạy.

Chuẩn bị sẵn video quay lại luồng này phòng khi mạng hôm demo có sự cố.
