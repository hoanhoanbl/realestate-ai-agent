# Hướng dẫn thực hiện cho 2 người

Stack: **n8n + NestJS + Next.js + PostgreSQL + Docker Compose**.
Hạn demo giữa kỳ: **thứ Bảy 10/10/2026**.

Hai file tài liệu chung của nhóm:

- [api-contract.md](api-contract.md): **luật chung** về dữ liệu và API (webhook, callback, kiểu dữ liệu trả về). Nếu hai file mâu thuẫn thì file này thắng.
- File này: ai làm gì, làm thế nào, phối hợp ra sao, còn việc gì.

## Phân vai (chốt)

Mỗi file/thư mục có **đúng một chủ**. Chỉ chủ được sửa; người kia muốn sửa thì nhắn chủ (kèm file và lý do) hoặc mở Issue trên GitHub.

| Người | Nhánh gốc | Sở hữu |
|---|---|---|
| Bạn n8n | `feature/n8n-workflow` | `n8n-workflows/` (workflow, prompt AI, email khách, email nhân viên). Trên web: **form đăng ký**, **trang danh sách khách**, `web/src/lib/`, `web/src/components/`, `layout.tsx`, `globals.css`, `package.json`, `next.config.ts`, `tsconfig.json` |
| Bạn backend | `feature/backend-api` | `backend/` (NestJS, PostgreSQL, API, gọi webhook), `docker-compose.yml`, `.env.example`, `web/Dockerfile`. Trên web: **trang `/stats`** (`web/src/app/stats/`) |
| Chung (đổi qua Pull Request, người kia duyệt) | | `docs/`, `README.md`, `.gitignore` |

Hai chỗ giao nhau của hai bên, mỗi chỗ có một người gửi và một người nhận. Đổi gì ở đây thì phải sửa [api-contract.md](api-contract.md) trước:

| Điểm giao | Bên gửi | Bên nhận |
|---|---|---|
| Webhook `POST /webhook/viewing-requested` | Backend | n8n |
| Callback `PUT /api/leads/:id/ai-result` và `/automation-status` | n8n | Backend |
| API cho web (bảng ở mục 3 của hợp đồng) | Backend | Web (bạn n8n làm, trang `/stats` do backend làm) |

## Cách phối hợp (để không lộn xộn)

1. **Một việc, một chủ.** Xem bảng phân vai. Không sửa file của người kia, kể cả "sửa nhanh cho tiện".
2. **Hợp đồng đi trước code.** Muốn đổi tên field, thêm API, đổi kiểu dữ liệu: sửa `api-contract.md` trước (qua Pull Request, người kia duyệt), rồi mới sửa code.
3. **Không push thẳng vào `main`.** `main` là bản dùng để demo. Mỗi việc một nhánh `feature/<việc>` hoặc `fix/<việc>` (ví dụ `feature/web`, `fix/n8n-failed-callback`), mở Pull Request vào `main`, người kia xem nhanh và bấm Approve (hoặc nhắn "ok"), người tạo PR bấm Merge.
4. **Mỗi sáng và trước khi bắt đầu việc mới:** `git checkout main`, `git pull`, rồi tạo nhánh mới (hoặc `git merge main` vào nhánh đang làm). Không để nhánh sống lâu quá một ngày.
5. **Commit nhỏ, nói rõ làm gì**: `feat:`, `fix:`, `docs:`, `chore:`. Không commit `.env`, key, `node_modules`, file build.
6. **"Xong" nghĩa là đã merge vào `main` và chạy được từ `main`**, không phải "chạy được trên máy tôi".
7. **Đóng băng trước demo.** Sau khi hai bên chạy thử trọn luồng trên `main` bằng `docker compose up -d --build`, chỉ được sửa lỗi, không thêm tính năng.
8. **Báo ngay khi lệch.** Thấy tài liệu và code không khớp, thấy việc của mình bị chặn bởi việc của người kia: nhắn luôn, đừng tự vá thư mục của họ.

## Khoá bí mật dùng chung

- `WEBHOOK_SECRET` phải **giống nhau** trong `.env` của hai máy. Gửi cho nhau qua tin nhắn riêng, không đưa lên GitHub.
- Key Gemini, mật khẩu email (SMTP): chỉ nhập trong **n8n (Credentials)**, không để trong repo.

## Tình trạng ngày 09/10 và việc còn lại

Đã làm và đã gộp vào `main`: backend đủ API theo hợp đồng (kể cả `automation-status`, `viewing` camelCase, `staffNotified`), seed 10 bất động sản, backend gọi n8n có thử lại 3 lần, workflow n8n chấm điểm bằng Gemini + email khách + email nhân viên (lead HOT) + gọi ngược backend, `web/Dockerfile` và khối `web` trong compose, bản web đầu tiên của 3 trang.

### Việc của bạn n8n

| # | Việc | Xong khi |
|---|---|---|
| N1 | **Nhánh lỗi báo `FAILED`.** Node Basic LLM Chain, Send an Email, Notify staff hiện đã bật Retry nhưng chưa có đường ra khi lỗi: workflow dừng, lead kẹt `PENDING` mãi. Đặt On Error → *Continue (using error output)* cho 3 node này, nối nhánh lỗi vào một node HTTP Request `PUT .../api/leads/{leadId}/automation-status` với body `{"status":"FAILED","error":"..."}` | Nhập sai key Gemini, gửi 1 lead: trong chưa đầy 1 phút lead hiện `FAILED` trên web |
| N2 | **Địa chỉ gọi ngược backend.** Node HTTP Request đang cố định `host.docker.internal:8081`. Trong compose phải là `http://backend:8081`. Compose đã đặt sẵn biến `BACKEND_URL` cho n8n, dùng `{{ $env.BACKEND_URL \|\| 'http://host.docker.internal:8081' }}` để một file chạy được cả hai nơi. Nếu n8n báo chặn truy cập `$env` thì nhờ bạn backend thêm `N8N_BLOCK_ENV_ACCESS_IN_NODE: "false"` vào khối `n8n` trong compose; hoặc đơn giản hơn, sửa cứng thành `http://backend:8081` cho bản demo chạy bằng compose | Chạy bằng `docker compose up` rồi gửi 1 lead, lead đổi sang `COMPLETED` |
| N3 | Node HTTP Request: đặt *Wait Between Tries* = 5000 ms (hiện chưa đặt, mặc định 1 giây) | Mở Settings của node thấy 3 lần, 5000 ms |
| N4 | Kiểm tra bảo mật webhook: credential Header Auth có Name đúng `X-Webhook-Secret`; gọi không kèm header phải bị 403 | Thử bằng lệnh ở mục A1, nhận 403 |
| N5 | Chạy 3 ca chấm điểm (ngân sách rõ → HOT, mơ hồ → WARM, nhu cầu trống → COLD) và ghi kết quả cho báo cáo | Có bảng kết quả trong báo cáo |
| N6 | Export lại workflow vào `n8n-workflows/viewing-requested.json` sau khi sửa, kiểm tra không chứa key | PR được merge |
| N7 | **Web:** làm xong form đăng ký và trang danh sách khách trên nhánh `feature/web` (xem mục C1) | PR được merge, trang chạy trên `main` |

### Việc của bạn backend

| # | Việc | Xong khi |
|---|---|---|
| B-a | **Kiểm tra `createdAt` có lệch 7 giờ không.** Cột `created_at` là `timestamp` (không múi giờ) trong khi container backend chạy `TZ=Asia/Ho_Chi_Minh`. Tạo 1 lead lúc 15:00, xem `GET /api/leads`: nếu thấy 08:00 thì đổi sang `timestamptz` | `createdAt` đúng giờ Việt Nam |
| B-b | **Chạy thử trọn luồng trên compose từ `main` sạch** (xoá volume DB cũ): `docker compose down -v`, `docker compose up -d --build`, rồi web → backend → n8n → backend. Báo bạn n8n nếu n8n không gọi được `backend:8081` | Lead đổi sang `COMPLETED` có điểm trên trang danh sách |
| B-c | `.env.example` còn dòng nhắc "Telegram bot token", sửa thành "SMTP". Ghi chú rõ `N8N_WEBHOOK_URL` ở `.env` gốc là **URL gốc của n8n**, còn `N8N_WEBHOOK_URL` backend đọc là **URL đầy đủ của webhook** (cùng tên nhưng khác nghĩa; compose đã ghi đè cho backend nên chỉ gây nhầm khi chạy backend ngoài Docker) | Hai biến có chú thích rõ |
| B-d | Thêm `backend/.env.example` (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, N8N_WEBHOOK_URL, WEBHOOK_SECRET) để bạn kia chạy backend ngoài Docker được | File có trong repo |
| B-e | Khối `web` trong compose đặt `NEXT_PUBLIC_API_URL` ở `environment`, nhưng biến `NEXT_PUBLIC_*` được nhúng lúc **build**, nên giá trị này không có tác dụng lúc chạy. Hiện vẫn chạy đúng vì giá trị mặc định trong code trùng. Chỉ cần sửa (dùng `build.args`) khi đem lên server khác `localhost` | Ghi nhớ; sửa nếu deploy |
| B-f | Duyệt PR `feature/web` của bạn n8n (kiểm tra web chỉ gọi API có trong hợp đồng), trang `/stats`, slide, dọn dữ liệu test trong DB trước khi demo | Trước demo |

### Việc chung

- Thống nhất trước về web (10 phút, xem mục C1): giữ cấu trúc `web/src/`; bản web đầu tiên của backend là bản nền, mỗi trang có một chủ và chủ được thay bằng bản của mình qua PR.
- Cả hai chạy một lần kịch bản demo (mục C4) trên máy của người sẽ trình bày, kể cả kịch bản lỗi.
- Quay video dự phòng.

---

# PHẦN A. Bạn n8n

## A1. Webhook (đã bắt đầu)

1. Node **Webhook**: Method `POST`, Path `viewing-requested`, Authentication `Header Auth`, Respond `Immediately`, Response Code `200`.
2. Credential Header Auth: Name `X-Webhook-Secret`, Value = giá trị `WEBHOOK_SECRET` trong `.env`.
3. Test (thay `GIA_TRI_SECRET`):

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:5678/webhook-test/viewing-requested" -Headers @{ "X-Webhook-Secret" = "GIA_TRI_SECRET" } -ContentType "application/json" -Body '{"event":"viewing_requested","eventId":"b7f3c1a2-0f4e-4a55-9d1e-1c2f3a4b5c6d","leadId":12,"name":"Nguyen Van A","email":"a@example.com","phone":"0900000000","budget":3000000000,"needs":"Can ho 2 phong ngu gan Da Nang","propertyId":5,"viewingTime":"2026-10-12T09:00:00+07:00"}'
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
- emailBody: email xác nhận lịch xem nhà, thân thiện, tiếng Việt, tối đa 5 câu. Xưng hô trung tính "anh/chị", gọi khách bằng tên đầy đủ.
- staffNote: 1 đến 2 câu gợi ý hành động cho nhân viên sale (mức ưu tiên, nên gọi lại khi nào, nên hỏi thêm gì).

Chỉ trả về JSON hợp lệ, không thêm chữ nào khác:
{"score": 0, "level": "COLD", "reason": "", "emailBody": "", "staffNote": ""}
```

4. Thêm **Structured Output Parser** (hoặc dùng node Code/Edit Fields để `JSON.parse` kết quả) để các trường `score`, `level`, `reason`, `emailBody`, `staffNote` dùng được ở node sau.
5. Chạy thử với dữ liệu đã ghim. Thử 3 ca: ngân sách rõ (HOT), ngân sách mơ hồ (WARM), nhu cầu trống (COLD) để chắc AI phân loại hợp lý. Ghi lại kết quả cho phần đo lường trong báo cáo.

Giao diện n8n thay đổi tên nút theo phiên bản, nếu khác thì chụp màn hình để hỏi.

## A3. Gửi email xác nhận

Cách dễ nhất là SMTP với mật khẩu ứng dụng của Gmail:

1. Tài khoản Google bật xác minh 2 bước, rồi tạo **App password** (myaccount.google.com, mục Security).
2. Trong n8n thêm node **Send Email**, tạo credential SMTP: host `smtp.gmail.com`, port `465`, bật SSL, user là email của bạn, password là App password.
3. To: `{{ $('Webhook').item.json.body.email }}`, Subject: `Xác nhận lịch xem nhà`, nội dung: `emailBody` từ AI.

## A4. Rẽ nhánh HOT và báo nhân viên bằng email

Nhóm đã chốt **không dùng Telegram**: thông báo nhân viên gửi bằng email (cùng credential SMTP ở A3).

1. Thêm node **IF**: `{{ $('Basic LLM Chain').first().json.output.level }}` bằng `HOT`.
2. Nhánh true: node **Send Email** (tên `Notify staff`) gửi cho nhân viên, tiêu đề dạng `[HOT] Tên khách - điểm - cần gọi lại`, nội dung gồm điểm, lý do, thông tin khách, giờ xem nhà và `staffNote` do AI gợi ý. Sau đó nối tiếp sang node gọi ngược backend (A5).
3. Nhánh false: nối thẳng sang node gọi ngược backend. `staffNotified` gửi về backend là `true` chỉ khi `level` là `HOT`.

## A5. Gọi ngược về backend

Node **HTTP Request**:

- Method `PUT`
- URL: `<địa chỉ backend>/api/leads/{{ $('Webhook').item.json.body.leadId }}/ai-result`, trong đó `<địa chỉ backend>` là:
  - `http://host.docker.internal:8081` khi n8n chạy trong Docker còn backend chạy trên máy thật (lúc đang code);
  - `http://backend:8081` khi cả hai chạy trong Docker Compose (compose đã đặt sẵn biến `BACKEND_URL` cho n8n, xem việc N2 ở đầu file).
- Header: `X-Webhook-Secret` = giá trị secret (credential Header Auth)
- Body JSON: `score`, `level`, `reason`, `aiReply`, `emailSent`, `staffNotified` theo `api-contract.md`.
- Bật Retry On Fail: 3 lần, chờ 5 giây. Nếu vẫn lỗi (ví dụ lead không tồn tại) thì đi nhánh lỗi tới node `Callback failed` và kết thúc.

## A6. Xử lý lỗi (cần có để lấy điểm)

- Các node AI, Email khách, Email nhân viên, HTTP Request: mở **Settings** của node, bật **Retry On Fail** (3 lần, chờ 5 giây).
- Ba node AI, Email khách, Email nhân viên: bật thêm **On Error → Continue (using error output)**, nối nhánh lỗi vào node HTTP Request `PUT /api/leads/{leadId}/automation-status` với body `{"status":"FAILED","error":"<mô tả ngắn>"}`. Làm vậy lead mới không kẹt `PENDING`, web hiện được trạng thái lỗi. Nhiều nhánh lỗi có thể dùng chung một node báo lỗi.
- Node HTTP Request gọi ngược `ai-result`: nhánh lỗi kết thúc ở `Callback failed` (vì chính backend không nhận được nên không báo được).
- Không cần workflow "Error Handler" riêng cho bài này.

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

Chú ý: `N8N_WEBHOOK_URL` trong `backend/.env` là **URL đầy đủ của webhook** (có đuôi `/webhook/viewing-requested`). Biến cùng tên trong `.env` ở thư mục gốc là **URL gốc của n8n** (`http://localhost:5678/`) và chỉ dùng cho n8n. Đừng chép nhầm giá trị của biến này sang `backend/.env`, nếu không backend sẽ gọi sai địa chỉ và lead nào cũng thành `FAILED`.

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
| `leads` | id, name, email, phone, budget, needs, score, level, reason, aiReply, emailSent, staffNotified, status, automationStatus, automationError, eventId, createdAt |
| `viewings` | id, propertyId, leadId, viewingTime, status |

Cấu hình TypeORM với `synchronize: true` (chỉ dùng khi phát triển).

API (đầy đủ trong mục 3 của `api-contract.md`):

| Method | Đường dẫn | Việc |
|---|---|---|
| POST | `/api/viewings` | Tạo lead + viewing, rồi gọi webhook n8n |
| GET | `/api/leads` | Danh sách, lọc theo `level` |
| GET | `/api/leads/:id` | Chi tiết |
| PUT | `/api/leads/:id/ai-result` | n8n cập nhật điểm AI (kiểm tra header `X-Webhook-Secret`, sai trả 401), đặt `automationStatus = COMPLETED` |
| PUT | `/api/leads/:id/automation-status` | n8n báo `FAILED` (kiểm tra header `X-Webhook-Secret`, sai trả 401), lưu `error` vào `automationError` |
| GET | `/api/properties` | Danh sách bất động sản |
| GET | `/api/stats` | `{ total, hot, warm, cold }` |
| GET | `/api/viewings` | Danh sách lịch xem nhà (để kiểm tra) |

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

## C1. Next.js

Dự án Next.js (TypeScript, App Router, Tailwind) đã được khởi tạo sẵn trong `web/`, mã nguồn nằm trong **`web/src/`** (đường dẫn `@/...` trỏ vào `web/src/`). Không cần chạy lại `create-next-app`. Cài và chạy: `cd web`, `npm install`, `npm run dev` (cổng 3000).

Các trang và người phụ trách (mỗi trang một chủ):

| Trang / phần | Làm gì | Chủ |
|---|---|---|
| `web/src/lib/api.ts` | Một chỗ duy nhất gọi API, kiểu dữ liệu, hàm định dạng tiền/giờ. **Các trang không tự viết `fetch`.** Chỉ gọi API có trong mục 3 của hợp đồng | Bạn n8n |
| `/` **Form đăng ký xem nhà** | Tên, email, SĐT, ngân sách, nhu cầu, chọn bất động sản (`GET /api/properties`), giờ xem. Gọi `POST /api/viewings` | Bạn n8n |
| `/leads` **Danh sách khách** | Bảng, lọc HOT/WARM/COLD, điểm, mức, lý do AI, trạng thái xử lý (`automationStatus`), tự tải lại khi còn `PENDING`. Gọi `GET /api/leads` | Bạn n8n |
| `/stats` **Dashboard** | Số lead theo mức. Gọi `GET /api/stats` (trả `{ total, hot, warm, cold }`) | Bạn backend |
| `web/Dockerfile`, khối `web` trong compose | Đóng gói web | Bạn backend |

**Tình trạng và cách xử lý bản web trùng lặp (chốt):** bạn backend đã làm sẵn bản đầu của cả 3 trang trong `web/src/app/` để chạy được luồng từ sớm, và bản đó đã nằm trên `main`. Bạn n8n cũng có một bản form và danh sách riêng. Hai bản **không cùng tồn tại**:

1. Giữ cấu trúc `web/src/` đang có trên `main` (Dockerfile và compose đã build theo cấu trúc này).
2. `/stats` giữ bản của bạn backend, chỉ đổi sang gọi qua `lib/api.ts` khi `lib/api.ts` đã có trên `main`.
3. `/` và `/leads`: bạn n8n thay bản đầu bằng bản của mình qua một Pull Request từ nhánh `feature/web` (đúng như phân công ban đầu), bạn backend duyệt. Bạn n8n chuyển `lib/`, `components/` vào `web/src/` rồi sửa import cho đúng, và nên lấy điểm tốt của bản kia nếu có (ví dụ khung xem chi tiết lead).
4. Từ khi PR này merge, bạn backend không sửa `/` và `/leads` nữa; cần sửa thì nhắn bạn n8n.

Lưu ý khi viết web (đã chốt với backend, chi tiết ở mục 4 của hợp đồng):

- `budget` của lead (khi `GET`), `price` và `area` của bất động sản trả về dạng **chuỗi**; phải `Number(...)` trước khi hiển thị. Riêng `budget` trong phản hồi `POST /api/viewings` là số, nên kiểu khai báo là `string | number`.
- `score`, `level`, `reason`, `aiReply`, `emailSent`, `staffNotified` là `null` khi chưa chấm xong (`automationStatus = PENDING`). `FAILED` nghĩa là xử lý lỗi, cần hiển thị rõ cho người dùng.
- Mọi khoá JSON đều camelCase, kể cả `viewing` trong phản hồi `POST /api/viewings` (`propertyId`, `leadId`, `viewingTime`). Dùng `staffNotified`, không dùng `telegramNotified`.
- `viewingTime` trả về dạng ISO giờ UTC (`...Z`): hiển thị theo múi giờ `Asia/Ho_Chi_Minh`.
- Backend đã bật CORS.

Địa chỉ API đặt trong `web/.env.local` (file này không đưa lên Git): `NEXT_PUBLIC_API_URL=http://localhost:8081/api` (backend chạy cổng 8081, Next.js giữ cổng mặc định 3000, không bị trùng). Nếu không đặt thì code dùng đúng giá trị này làm mặc định.

## C2. Docker Compose

1. `backend/Dockerfile`, `web/Dockerfile` và các khối `db`, `n8n`, `backend`, `web` trong `docker-compose.yml` đã có (bạn backend làm).
2. URL gọi nhau theo tên service: backend gọi `http://n8n:5678/webhook/viewing-requested` (đã đặt trong compose); n8n gọi `http://backend:8081/...` (compose đã đặt biến `BACKEND_URL` cho n8n, workflow cần dùng biến này, xem việc N2).
3. Trình duyệt gọi backend qua `http://localhost:8081/api`, không phải tên service `backend`, vì trình duyệt chạy ngoài Docker.
4. Chạy `docker compose up -d --build` từ `main` sạch và thử lại toàn bộ luồng (việc B-b). Trong n8n, workflow phải ở trạng thái Active thì URL `/webhook/...` mới nhận.

## C3. Lịch

| Ngày | Bạn n8n | Bạn backend |
|---|---|---|
| Thứ Tư 7/10 | A1 đến A3 (Webhook, AI, email) | B1 đến B4 (NestJS, DB, API) |
| Thứ Năm 8/10 | Xong workflow: thông báo nhân viên (email) và email HTML. Khởi tạo Next.js, làm form đăng ký | B5, B6 (gọi webhook, test), đổi `staffNotified`, endpoint `automation-status`, Dockerfile backend |
| Thứ Sáu 9/10 | Việc N1 đến N7 ở mục "Tình trạng ngày 09/10 và việc còn lại": nhánh lỗi báo `FAILED`, gộp web, làm đẹp, quay video dự phòng | Việc B-a đến B-f: kiểm tra giờ, chạy thử compose, dọn DB, duyệt PR web, slide |
| Thứ Bảy 10/10 | Chạy thử một lần, rồi demo | Chạy thử một lần, rồi demo |

Nếu thiếu thời gian, bỏ theo thứ tự: làm đẹp, dashboard. Giữ lại: form, backend lưu DB, n8n chấm điểm AI, email, gọi ngược cập nhật, trang danh sách, nhánh lỗi báo `FAILED`, chạy được bằng `docker compose`.

## C4. Kịch bản demo (5 đến 7 phút)

1. Nói bài toán và vẽ lại sơ đồ luồng.
2. Điền form trên web, bấm gửi.
3. Mở n8n, tab **Executions** cho xem lần chạy thành công và từng node.
4. Cho xem email xác nhận trong hộp thư khách, và email thông báo nhân viên với khách HOT.
5. Quay lại web: khách vừa gửi đã có điểm và mức HOT/WARM/COLD.
6. Cho xem xử lý lỗi: chạy `docker compose stop n8n`, gửi thêm một đăng ký trên web. Khách vẫn được lưu; backend thử gọi n8n 3 lần (xem `docker compose logs backend`) rồi đặt `automationStatus = FAILED`, trang danh sách hiện trạng thái lỗi. Bật lại bằng `docker compose start n8n`. (Đừng tắt backend để thử: lúc đó chính form web không gửi được, không có gì để thấy.)
7. Cho xem `docker ps` với các container đang chạy.

Chuẩn bị sẵn video quay lại luồng này phòng khi mạng hôm demo có sự cố.
