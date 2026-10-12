# Tuần 2 (từ 12/10/2026): mỗi người một luồng n8n ≥ 12 bước

Không có ngày demo cố định: làm xong và chạy thử được **mốc** nào (mục 2.3) thì demo tới mốc đó.

Các file liên quan:

- [tong-quan-du-an.md](tong-quan-du-an.md): mục tiêu, bài toán, 4 luồng của cả dự án, lộ trình.
- [api-contract.md](api-contract.md): **luật chung** về API. Đã bổ sung các API của tuần này (mục 2.1, 2.3, 2.4, 3, 4). Nếu file này mâu thuẫn với hợp đồng thì hợp đồng thắng.
- [tuan-1.md](tuan-1.md): kế hoạch tuần trước. Mục "Cách phối hợp" vẫn áp dụng, phần Git được nhắc lại cụ thể ở mục 3 bên dưới.

## 0. Tóm tắt một trang

| | **Hoàng** | **Hậu** |
|---|---|---|
| Vai trò | Chủ **luồng 1: Tiếp nhận và chốt lịch xem nhà** + Error workflow + trang chi tiết lead trên web | Chủ **luồng 2: Follow-up tự động** + API backend mà hai luồng và web cần + dữ liệu mẫu |
| Luồng n8n | 18 bước trên đường dài nhất, có bước nhân viên duyệt (Wait) | 17 bước trên đường dài nhất, chạy theo lịch, có vòng lặp và guardrail AI |
| File sở hữu | `n8n-workflows/luong-1-dat-lich.json`, `n8n-workflows/error-workflow.json`, `web/` (trừ `web/Dockerfile` và `web/src/app/stats/`) | `n8n-workflows/luong-2-follow-up.json`, `backend/`, `docker-compose.yml`, `.env.example`, `web/Dockerfile`, `web/src/app/stats/` |
| Giờ công ước tính | ≈ 15 giờ | ≈ 15,5 giờ |
| Phải chờ người kia? | Chờ API của Hậu (HA1). Trong lúc chờ thì ghim dữ liệu giả, không bị chặn | **Không.** Mọi thứ Hậu cần đều do Hậu làm hoặc đã có trên `main` |

**Nguyên tắc tuần này:**

1. **Mỗi người chạy toàn bộ dự án trên máy mình** bằng Docker Compose (DB, n8n, backend, web), theo mục 4.4. Code vẫn là một bản chung trên GitHub: ai sửa thì merge vào `main`, người kia `git pull` rồi build lại.
2. Hai người chỉ gặp nhau qua **Git** (code, file workflow JSON) và **`api-contract.md`**. Không cần dùng chung một n8n.
3. Việc xếp theo **mốc chạy được** (mục 2.3), không theo ngày.
4. Không làm app. Web chỉ thêm trang chi tiết lead (HO4).
5. Việc chung duy nhất: **ghép hai luồng trên một máy** trước khi demo (mục 10).

## 1. Hiện trạng đầu tuần (đã đọc từ source trên `main`)

**n8n** (`n8n-workflows/viewing-requested.json`, 10 node):

```
Webhook → Basic LLM Chain (+ Gemini 3.5 Flash Lite, Structured Output Parser) → Send an Email → If (HOT?)
  ├─ true  → Notify staff → HTTP Request (PUT ai-result)
  └─ false → HTTP Request (PUT ai-result)
Nhánh lỗi: AI / Send an Email / Notify staff → Report FAILED ; HTTP Request → Callback failed
```

- Đường chính mới có **6 bước**, còn thiếu ít nhất 6 bước.
- Dữ liệu webhook nằm ở `$('Webhook').first().json.body.*`. URL backend đang ghi cứng `http://backend:8081`.
- Credential đang dùng: `Header Auth account`, `Google Gemini(PaLM) Api account`, `SMTP account`.
- **Cần sửa:** `fromEmail` đang là `nhunhuhoangg@gmail.com` và `toEmail` của Notify staff là `hoangnpn.24it@vku.udn.vn`, tức mail cá nhân của Hoàng **đang nằm trên GitHub**. Tuần này đổi sang mail nhóm.

**Backend** (NestJS):

- Đủ 8 API theo hợp đồng. Gọi n8n bất đồng bộ, thử lại 3 lần.
- `createdAt` đã là `timestamptz`. `synchronize: true` nên thêm entity hay thêm cột là DB tự cập nhật, không cần xoá dữ liệu cũ.
- `leads.status` là `varchar`, hiện chỉ dùng giá trị `NEW`.
- Hai endpoint callback tự kiểm tra `X-Webhook-Secret` bằng đoạn code lặp lại trong `leads.controller.ts`.
- **Chưa có:** `GET /api/properties/:id`, bảng `lead_events`, API đổi trạng thái và ghi sự kiện.
- 10 căn nhà mẫu (seed), `id` từ 1 đến 10: TP.HCM (id 1, 2, 5), Đà Nẵng (3, 4, 9), Hà Nội (6, 7, 10), Phú Quốc (8). Seed chỉ chạy khi bảng trống, nên các `id` này đúng với DB mới.
- `GET /api/leads` và `GET /api/leads/:id` không cần đăng nhập. Chấp nhận ở tuần này, đăng nhập làm sau cùng web admin.

## 2. Bảng việc, mốc và tiêu chí "Xong khi"

### 2.1. Việc của Hoàng

| # | Việc | Giờ | Xong khi |
|---|---|---|---|
| HO1 | Chạy dự án trên máy mình, tạo credential (mục 4.4) | 0,5 | Gửi 1 form trên `http://localhost:3000` → lead `COMPLETED` |
| HO2 | **Luồng 1** (mục 5) | 8 | 3 ca HOT/WARM/COLD đều nhận đúng email "đã nhận yêu cầu". Bấm Duyệt → khách nhận email chốt lịch, lead `CONFIRMED`, có `APPROVED` trong `lead_events`. Sai key Gemini → lead `FAILED` |
| HO3 | **Error workflow** (mục 6) | 1,5 | Làm hỏng node `Ghi log AI_SCORED` → `+quanly` nhận email báo lỗi |
| HO4 | **Web: cột trạng thái + trang chi tiết lead** (mục 7) | 3 | Bấm tên khách ở `/leads` mở `/leads/[id]`. Bấm Duyệt trong email → vài giây sau trang tự hiện `APPROVED` |
| HO5 | Chạy thử luồng 2 của Hậu trên máy mình (import JSON, nạp dữ liệu mẫu), ghi lỗi vào nhóm chat | 1 | Có danh sách lỗi hoặc xác nhận "ok" |
| HO6 | Export JSON, PR, viết kịch bản demo luồng 1 (mục 11) | 1 | PR `feature/n8n-luong-1`, `feature/n8n-error-workflow`, `feature/web-lead-detail` đã merge |

### 2.2. Việc của Hậu

| # | Việc | Giờ | Xong khi |
|---|---|---|---|
| HA0 | Chạy dự án trên máy mình, tạo credential (mục 4.4) | 0,5 | Gửi 1 form trên `http://localhost:3000` → lead `COMPLETED` |
| HA1 | **API backend cho tuần 2** (mục 8). **Làm đầu tiên**, vì luồng 1 và trang web của Hoàng dùng các API này | 4 | Swagger gọi được 4 API mới. Thiếu secret → `401`. `status` sai → `400`. `GET /leads/1` có `viewing`, `property`. Gửi `approvalUrl` trong `ai-result` thì DB lưu nhưng `GET` không trả ra. PR `feature/lead-events-api` đã merge |
| HA2 | **Luồng 2** (mục 9) | 8 | Nạp dữ liệu mẫu, bấm chạy: 3 khách nhận đúng 3 loại email, nhân viên nhận email nhắc gọi khách WARM, quản lý nhận email tổng kết. **Chạy lại lần 2 không gửi thêm email nào** |
| HA3 | File dữ liệu mẫu `backend/sql/demo-follow-up.sql` (mục 9.4) | 0,5 | Chạy file nhiều lần không lỗi, mỗi lần tạo lại đúng 3 lead mẫu |
| HA4 | Duyệt PR tài liệu tuần 2. Chạy thử luồng 1 của Hoàng trên máy mình, ghi lỗi vào nhóm chat | 1,5 | PR `docs/ke-hoach-tuan-2` đã merge. Có danh sách lỗi luồng 1 hoặc "ok" |
| HA5 | Export JSON, PR, viết kịch bản demo luồng 2 và phần mở đầu backend (mục 11) | 1 | PR `feature/n8n-luong-2` đã merge |

Hoàng có sẵn 6 bước ở luồng 1 nên nhận thêm Error workflow và trang web. Hậu làm luồng 2 từ đầu nên phần thêm là API backend (vốn là phần Hậu sở hữu) và dữ liệu mẫu.

### 2.3. Mốc chạy được (dùng để biết demo tới đâu)

Làm theo thứ tự mốc. Mỗi mốc xong thì push, mở PR nếu đã trọn một việc. Đến lúc demo, mốc nào đã chạy được thì trình bày tới mốc đó.

| Mốc | Hoàng | Hậu | Demo được gì |
|---|---|---|---|
| 1 | HO1. Luồng 1 bước 1–12 (ghim dữ liệu giả nếu HA1 chưa merge) | HA0. **HA1 merge** | Hoàng: chấm điểm, 3 loại email khách, email nhân viên. Hậu: 4 API mới trên Swagger, bảng `lead_events` |
| 2 | Luồng 1 bước 13–18: duyệt qua email | HA3. Luồng 2 bước 1–11 | Hoàng: bấm Duyệt → email chốt lịch, lead `CONFIRMED`. Hậu: đọc DB, AI soạn email, guardrail, gửi email, ghi log |
| 3 | HO3 Error workflow. HO4 trang chi tiết lead | Luồng 2 bước 12–17 | Hoàng: email báo lỗi, dòng thời gian trên web. Hậu: vòng lặp, nhắc nhân viên, báo cáo quản lý, chạy lần 2 không trùng |
| 4 (chung) | HO5, HO6 | HA4, HA5 | Ghép hai luồng trên một máy (mục 10), chạy trọn kịch bản demo |

## 3. Git: nhánh, thứ tự merge, cách làm hằng ngày

### 3.1. Danh sách nhánh tuần này

Mỗi việc một nhánh ngắn, tách từ `main` mới nhất. Không push thẳng vào `main`.

| # | Nhánh | Chủ | Nội dung | File được sửa | Người duyệt |
|---|---|---|---|---|---|
| 1 | `docs/ke-hoach-tuan-2` | Hoàng | 3 file kế hoạch + hợp đồng API tuần 2 | `docs/`, `README.md` | Hậu |
| 2 | `feature/lead-events-api` | Hậu | HA1 | `backend/src/` | Hoàng |
| 3 | `feature/n8n-luong-1` | Hoàng | HO2 | `n8n-workflows/luong-1-dat-lich.json` (đổi tên từ `viewing-requested.json`) | Hậu |
| 4 | `feature/n8n-error-workflow` | Hoàng | HO3 | `n8n-workflows/error-workflow.json` | Hậu |
| 5 | `feature/web-lead-detail` | Hoàng | HO4 | `web/src/lib/api.ts`, `web/src/components/`, `web/src/app/leads/` | Hậu |
| 6 | `feature/n8n-luong-2` | Hậu | HA2, HA3 | `n8n-workflows/luong-2-follow-up.json`, `backend/sql/demo-follow-up.sql` | Hoàng |

- Hai người **không bao giờ sửa cùng một file**, nên các nhánh không xung đột.
- Nhánh 1 và 2 nên merge sớm nhất. Hậu **không cần chờ** nhánh 1 merge mới làm HA1: cứ làm theo nội dung hợp đồng trong PR.
- Nhánh 5 cần nhánh 2 đã merge mới gọi được API thật (trong lúc chờ thì dùng dữ liệu giả, mục 7). Các nhánh còn lại không phụ thuộc nhau, xong lúc nào merge lúc đó.
- Người duyệt cố gắng duyệt trong ngày, để người kia không phải chờ.

### 3.2. Lệnh mẫu cho một việc

```powershell
git checkout main
git pull
git checkout -b feature/lead-events-api      # tên nhánh theo bảng trên

# ... làm việc ...
git add backend/src
git commit -m "feat(backend): them lead_events, PUT status, POST events, GET property by id"
git push -u origin feature/lead-events-api
```

Sau đó mở Pull Request vào `main` trên GitHub, nhắn người duyệt. Người duyệt xem và bấm Approve (hoặc nhắn "ok"), **người tạo PR bấm Merge**, rồi xoá nhánh.

### 3.3. Riêng với workflow n8n

- Mỗi người sửa workflow trên **n8n ở máy mình**. File JSON trên Git là bản lưu và là cách để người kia lấy workflow về chạy thử. Cuối mỗi buổi: menu `...` → **Download** → ghi đè file JSON trong nhánh của mình → commit → push (chưa cần mở PR).
- Lấy workflow của người kia: trong n8n chọn **Create workflow → menu `...` → Import from File** → chọn file JSON. Credential không đi theo file. Node nào báo thiếu credential thì mở ra chọn lại credential cùng tên trên máy mình (mục 4.2).
- Trước khi commit, kiểm tra file không chứa key hay mail cá nhân:

```powershell
Select-String -Path n8n-workflows\*.json -Pattern "nhunhuhoangg|hoangnpn|AIza|apiKey|password"
```

  Lệnh không in ra gì là sạch. (Credential trong n8n chỉ xuất tên và id, không xuất giá trị.)
- Đổi tên file luồng 1 bằng `git mv` để Git giữ lịch sử:

```powershell
git mv n8n-workflows/viewing-requested.json n8n-workflows/luong-1-dat-lich.json
```

### 3.4. Mỗi sáng và trước khi bắt đầu việc mới

```powershell
git checkout main
git pull
git checkout <nhánh đang làm>
git merge main
```

Nếu vừa có người merge thay đổi backend, chạy lại `docker compose up -d --build` để có API mới.

Không để nhánh sống quá 2 ngày. **Ngoại lệ:** `feature/n8n-luong-1` và `feature/n8n-luong-2` được sống tới khi luồng xong, vì file JSON chỉ là bản lưu; vẫn push mỗi buổi (mục 3.3). Bị chặn thì báo ngay trong nhóm, không tự sửa file của người kia.

## 4. Thông tin dùng chung

### 4.1. Gmail nhóm

- Tài khoản: `nhadn2457@gmail.com`. **Mật khẩu không ghi vào repo**, hai người giữ riêng.
- n8n gửi mail bằng **mật khẩu ứng dụng** (App password), không dùng mật khẩu đăng nhập. **Mỗi người tự tạo một App password riêng** cho n8n trên máy mình: đăng nhập Gmail nhóm → myaccount.google.com → Security → bật **2-Step Verification** (nếu chưa bật) → tìm **App passwords** → tạo tên `n8n-hoang` hoặc `n8n-hau` → chép chuỗi 16 ký tự.
- Mail nhận dùng **bí danh dấu cộng**. Tất cả đều về chung một hộp thư nên cả hai cùng xem được:

| Vai | Địa chỉ |
|---|---|
| Gửi đi (SMTP, `fromEmail`) | `nhadn2457@gmail.com` |
| Quản lý | `nhadn2457+quanly@gmail.com` |
| Nhân viên sale | `nhadn2457+nhanvien@gmail.com` |
| Khách test của Hoàng | `nhadn2457+khach1@gmail.com`, `+khach2`, `+khach3`... |
| Khách mẫu của Hậu | `nhadn2457+demo1@gmail.com`, `+demo2`, `+demo3` (do file SQL tạo) |

### 4.2. Credential trong n8n trên máy mỗi người

Mỗi người tự tạo trên n8n của mình. Giữ **đúng tên** dưới đây, để khi import workflow của nhau thì các node dễ nhận credential:

| Tên credential | Loại | Cấu hình | Dùng ở |
|---|---|---|---|
| `Header Auth account` | Header Auth | Name `X-Webhook-Secret`, Value = `WEBHOOK_SECRET` trong `.env` **của máy mình** | Webhook luồng 1, mọi HTTP Request gọi backend |
| `Google Gemini(PaLM) Api account` | Google Gemini (PaLM) API | **Mỗi người tự tạo key** bằng tài khoản Google của mình tại aistudio.google.com/apikey (để không dùng chung hạn mức miễn phí) | Node AI cả 2 luồng |
| `SMTP account` | SMTP | Host `smtp.gmail.com`, Port `465`, SSL bật, User `nhadn2457@gmail.com`, Password = App password **của mình** (mục 4.1) | Mọi node Send Email |
| `Postgres account` (mới, Hậu cần) | Postgres | Host `db`, Port `5432`, Database/User/Password lấy từ `.env` (`DB_NAME`, `DB_USER`, `DB_PASSWORD`), SSL `disable` | Luồng 2 |

### 4.3. Quy tắc dựng node chung cho cả hai luồng

1. Node thứ hai của mỗi luồng là **Edit Fields `Cấu hình`** gồm 3 trường: `backendUrl = http://backend:8081`, `staffEmail = nhadn2457+nhanvien@gmail.com`, `managerEmail = nhadn2457+quanly@gmail.com`. Các node sau đọc bằng `{{ $('Cấu hình').first().json.backendUrl }}`. Không gõ cứng ở node khác. (Nếu đang chạy backend bằng `npm run start:dev` thay vì Docker thì tạm đổi `backendUrl` thành `http://host.docker.internal:8081`.)
2. Node có thể lỗi (AI, Send Email, HTTP Request, Postgres): Settings → **Retry On Fail = bật, Max Tries = 3, Wait Between Tries = 5000 ms**.
3. Node AI, Send Email và HTTP gọi backend ở luồng 1 (trước bước lưu kết quả AI): Settings → **On Error = Continue (using error output)**, nối nhánh lỗi vào `Report FAILED`.
4. Đặt tên node bằng tiếng Việt, đúng như trong bảng của từng luồng. Biểu thức `$('Tên node')` phụ thuộc tên, đổi tên sau sẽ hỏng.
5. Chưa có API thật thì chạy node một lần với dữ liệu giả, rồi bấm **Pin data** để làm tiếp. Khi API đã merge thì bỏ ghim.

### 4.4. Chạy dự án trên máy mình (HO1, HA0)

Cần Docker Desktop. Từ thư mục gốc repo:

```powershell
git checkout main
git pull
Copy-Item .env.example .env     # chỉ lần đầu
docker compose up -d --build
```

- Trong `.env`: `DB_PASSWORD`, `WEBHOOK_SECRET`, `N8N_ENCRYPTION_KEY` đặt giá trị bất kỳ trên máy mình, **không cần giống máy người kia**. `N8N_ENCRYPTION_KEY` không đổi sau khi đã tạo credential. `N8N_WEBHOOK_URL=http://localhost:5678/`.
- Nếu máy đã có DB từ tuần 1 thì giữ nguyên, không cần xoá. Backend tự thêm bảng và cột mới khi khởi động.
- Mở n8n `http://localhost:5678`, tạo tài khoản (chỉ trên máy mình), tạo các credential ở mục 4.2.
- Import workflow đang có `n8n-workflows/viewing-requested.json` (mục 3.3), chọn credential cho các node, bấm **Publish/Active**. Backend gọi n8n qua địa chỉ `/webhook/...`, nên workflow phải Active thì form mới chạy được.
- Kiểm tra: gửi 1 form trên `http://localhost:3000`, vài giây sau lead ở `/leads` chuyển `COMPLETED`.
- Mỗi khi có người merge thay đổi backend: `git pull` rồi `docker compose up -d --build`.
- Riêng Hậu khi đang sửa backend: có thể chạy `npm run start:dev` trong `backend/` cho nhanh, nhưng trước đó tắt backend trong Docker (`docker compose stop backend`) vì trùng cổng 8081, và đổi `backendUrl` như quy tắc 4.3.1.

### 4.5. Cách dựng node AI và Send Email (cho người chưa làm)

Cách nhanh nhất là **xem mẫu từ luồng 1 đang có**: import `viewing-requested.json` (mục 4.4), mở node `Basic LLM Chain` và `Send an Email` để xem cấu hình. Có thể chọn node rồi Ctrl+C, sang workflow của mình Ctrl+V, rồi sửa lại.

Tự dựng từ đầu:

1. **Node AI:** thêm node **Basic LLM Chain**. Phần Prompt chọn **Define below**, dán prompt vào. Bật **Require Specific Output Format**, bấm dấu `+` ở chân **Output Parser** → **Structured Output Parser** → dán JSON mẫu (ví dụ `{"subject": "...", "body": "..."}`). Bấm dấu `+` ở chân **Chat Model** → **Google Gemini Chat Model** → chọn credential `Google Gemini(PaLM) Api account`, model `models/gemini-3.5-flash-lite` (giống luồng 1). Kết quả AI nằm ở `$json.output.<tên trường>`.
2. **Node Send Email:** credential `SMTP account`. From `nhadn2457@gmail.com`, To / Subject dùng biểu thức, Email Format **HTML**. Trong Options tắt **Append n8n Attribution**.
3. Tab **Settings** của mỗi node: làm theo quy tắc 4.3.2.
4. Chạy thử từng node bằng **Execute step**, đúng thì **Pin data** để làm node sau.

Kẹt quá 30 phút thì nhắn nhóm, kèm ảnh chụp node và lỗi.

---

# PHẦN A. Hoàng

## 5. HO2: Luồng 1, tiếp nhận và chốt lịch xem nhà

File: `n8n-workflows/luong-1-dat-lich.json`. **Sửa tiếp trên workflow đang có**, không làm lại.

### 5.1. Sơ đồ

Tên trong sơ đồ là **tên node thật**, đặt đúng từng chữ (quy tắc 4.3.4).

```
Webhook → Cấu hình → Chuẩn hoá → Hợp lệ? ──sai──→ Lỗi dữ liệu → Report FAILED
                                     └─đúng→ Lấy thông tin nhà → Ghép dữ liệu → Basic LLM Chain
→ Mức ─┬ HOT  → Email khách HOT  ┐
       ├ WARM → Email khách WARM ┼→ Email nhân viên → Lưu kết quả AI → Ghi log AI_SCORED
       └ COLD → Email khách COLD ┘
→ Chờ duyệt → Kết quả duyệt
     ├ approve    → Trả lời duyệt   → Email chốt lịch   → Cập nhật CONFIRMED → Ghi log APPROVED
     ├ reschedule → Trả lời đổi giờ → Email báo đổi giờ → Ghi log RESCHEDULE_REQUESTED
     └ hết giờ    → Email cảnh báo quản lý → Ghi log APPROVAL_TIMEOUT
```

### 5.2. Từng bước

| # | Tên node | Loại | Cấu hình chính | Mới / có sẵn |
|---|---|---|---|---|
| 1 | `Webhook` | Webhook | Giữ nguyên (POST `viewing-requested`, Header Auth) | Có sẵn |
| 2 | `Cấu hình` | Edit Fields | 3 trường ở mục 4.3 | Mới |
| 3 | `Chuẩn hoá` | Code | Đoạn code 5.3 | Mới |
| 4 | `Hợp lệ?` | IF | `{{ $json.email }}` contains `@` **và** `{{ $json.budget }}` ≥ 0 **và** `{{ $json.propertyId }}` > 0. Nhánh false → `Lỗi dữ liệu` (Edit Fields, 1 trường `error = Dữ liệu đăng ký không hợp lệ (email, ngân sách hoặc căn nhà)`) → `Report FAILED`, để lead hiện đúng lý do thay vì "Loi khong ro" | Mới |
| 5 | `Lấy thông tin nhà` | HTTP Request | GET `{{ $('Cấu hình').first().json.backendUrl }}/api/properties/{{ $json.propertyId }}`, không cần auth. Retry + error output → `Report FAILED` | Mới |
| 6 | `Ghép dữ liệu` | Code | Đoạn code 5.3 | Mới |
| 7 | `Basic LLM Chain` (+ Gemini + Parser) | LLM Chain | Sửa prompt theo 5.4 (đọc `$json.*` thay vì `$json.body.*`) | Có sẵn, sửa |
| 8 | `Mức` | Switch | Mode Rules, giá trị `{{ $('Basic LLM Chain').first().json.output.level }}`, 3 rule: equals `HOT` / `WARM` / `COLD`. **Xoá node `If` cũ** | Mới |
| 9 | `Email khách HOT` / `WARM` / `COLD` | Send Email ×3 | Nhân bản từ `Send an Email`. Đổi `fromEmail` = `nhadn2457@gmail.com`. Email này **chưa chốt lịch** (nhân viên chưa duyệt), nên đổi tiêu đề và dòng đầu HTML từ "Xác nhận lịch xem nhà" thành "Đã nhận yêu cầu xem nhà". HOT: tiêu đề "Đã nhận yêu cầu xem nhà, nhân viên sẽ gọi trong hôm nay". WARM: "Đã nhận yêu cầu xem nhà". COLD: như WARM, thêm câu mời bổ sung nhu cầu và ngân sách. Có thể đổi màu đầu email theo mức. Lịch chỉ được chốt ở `Email chốt lịch` (bước 16). Error output → `Report FAILED` | Có sẵn, tách 3 |
| 10 | `Email nhân viên` | Send Email | Đổi tên từ `Notify staff`. To = `{{ $('Cấu hình').first().json.staffEmail }}`. Gửi cho **mọi mức**, tiêu đề và 2 nút ở 5.5. Error output → `Report FAILED` | Có sẵn, sửa |
| 11 | `Lưu kết quả AI` | HTTP Request | Đổi tên từ `HTTP Request`. Giữ PUT `ai-result`, đổi URL dùng `backendUrl`, `staffNotified: true`, thêm `"approvalUrl": $execution.resumeUrl` vào body (hợp đồng mục 2.1). Gửi trước khi HA1 merge cũng không lỗi: backend đang bỏ qua trường lạ. Nhánh lỗi giữ `Callback failed` | Có sẵn, sửa |
| 12 | `Ghi log AI_SCORED` | HTTP Request | POST `.../api/leads/{{ $('Webhook').first().json.body.leadId }}/events`, credential `Header Auth account`, body ở 5.6 | Mới |
| 13 | `Chờ duyệt` | Wait | Resume: **On Webhook Call**. HTTP Method `GET`. **Limit Wait Time**: bật, 24 giờ. Respond: **Using 'Respond to Webhook' Node** | Mới |
| 14 | `Kết quả duyệt` | Switch | Rule 1: `{{ $json.query?.action }}` equals `approve`. Rule 2: equals `reschedule`. Bật **Fallback Output** cho trường hợp hết giờ (không có `query`) | Mới |
| 15 | `Trả lời duyệt` / `Trả lời đổi giờ` | Respond to Webhook ×2 | Respond With: Text, nội dung HTML ngắn: "Đã ghi nhận. Hệ thống đã gửi email cho khách." | Mới |
| 16 | `Email chốt lịch` / `Email báo đổi giờ` / `Email cảnh báo quản lý` | Send Email ×3 | Chốt lịch: gửi khách, nêu nhà + địa chỉ + giờ. Đổi giờ: gửi khách, báo nhân viên sẽ gọi lại để hẹn giờ khác. Hết giờ: gửi `managerEmail`, nêu lead chưa được duyệt sau 24 giờ | Mới |
| 17 | `Cập nhật CONFIRMED` | HTTP Request | PUT `.../api/leads/{id}/status`, body `{ "status": "CONFIRMED", "note": "Nhân viên duyệt qua email" }` | Mới |
| 18 | `Ghi log APPROVED` / `Ghi log RESCHEDULE_REQUESTED` / `Ghi log APPROVAL_TIMEOUT` | HTTP Request ×3 | POST `.../events` với `type` đúng như tên node | Mới |
| 19 | `Report FAILED`, `Callback failed` | HTTP Request, NoOp | Giữ nguyên, đổi URL `Report FAILED` dùng `backendUrl` | Có sẵn |

Đường dài nhất (duyệt): 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18, tức **18 bước**.

Mọi URL có `{id}` ở luồng 1 đều dùng `{{ $('Webhook').first().json.body.leadId }}`.

Lỗi xảy ra **sau** bước 11 (lead đã `COMPLETED`) thì không báo `FAILED` nữa, mà để Error workflow (HO3) gửi email cho quản lý.

### 5.3. Code cho bước 3 và 6

`Chuẩn hoá` (Mode: Run Once for All Items):

```js
const b = $('Webhook').first().json.body;
return [{
  json: {
    leadId: b.leadId,
    name: String(b.name ?? '').trim(),
    email: String(b.email ?? '').trim().toLowerCase(),
    phone: String(b.phone ?? '').replace(/\D/g, ''),
    budget: Number(b.budget) || 0,
    needs: String(b.needs ?? '').trim(),
    propertyId: Number(b.propertyId) || 0,
    viewingTime: b.viewingTime,
  },
}];
```

`Ghép dữ liệu`:

```js
const k = $('Chuẩn hoá').first().json;
const p = $json; // kết quả GET /api/properties/:id (price, area là chuỗi)
const price = Number(p.price);
return [{
  json: {
    ...k,
    property: { name: p.name, address: p.address, price, area: Number(p.area), type: p.type },
    budgetRatio: price > 0 ? Math.round((k.budget / price) * 100) : null, // % ngân sách so với giá
  },
}];
```

### 5.4. Prompt mới cho bước 7

Thay 4 dòng thông tin khách cũ bằng:

```
Khách: {{ $json.name }}
Ngân sách (VND): {{ $json.budget }}
Nhu cầu: {{ $json.needs || '(không ghi)' }}
Giờ xem nhà: {{ $json.viewingTime }}
Căn khách chọn: {{ $json.property.name }}, {{ $json.property.address }}, {{ $json.property.area }} m², giá {{ $json.property.price }} VND
Ngân sách so với giá căn: {{ $json.budgetRatio }}%
```

Trong phần "Quy tắc", **thay** dòng `emailBody` cũ ("email xác nhận lịch xem nhà...") bằng:

```
- emailBody: email báo đã nhận yêu cầu xem nhà, nói rõ nhân viên sẽ liên hệ để xác nhận lịch (KHÔNG khẳng định lịch đã chốt), thân thiện, tiếng Việt, tối đa 5 câu. Xưng hô trung tính "anh/chị" (không đoán giới tính), gọi khách bằng tên đầy đủ. Phải nhắc tên căn nhà khách chọn.
```

Rồi thêm:

```
- Ngân sách từ 90% giá căn trở lên: cộng điểm mạnh. Dưới 50%: trừ điểm mạnh.
```

Giữ nguyên `Structured Output Parser` (score, level, reason, emailBody, staffNote).

### 5.5. Email nhân viên có link duyệt (bước 10)

Tiêu đề:

```
={{ $('Basic LLM Chain').first().json.output.level === 'HOT' ? '[ƯU TIÊN] ' : '' }}{{ $('Webhook').first().json.body.name }} - {{ $('Basic LLM Chain').first().json.output.score }} điểm - cần duyệt lịch xem
```

Giữ bảng thông tin khách như cũ, thêm `staffNote` và 2 nút vào cuối phần nội dung HTML:

```html
<p><b>Gợi ý của AI:</b> {{ $('Basic LLM Chain').first().json.output.staffNote }}</p>
<p style="margin-top:20px">
  <a href="{{ $execution.resumeUrl }}?action=approve"
     style="background:#16a34a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Duyệt lịch</a>
  &nbsp;
  <a href="{{ $execution.resumeUrl }}?action=reschedule"
     style="background:#6b7280;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Đổi giờ</a>
</p>
```

`$execution.resumeUrl` là địa chỉ để đánh thức đúng lần chạy đang dừng ở node `Chờ duyệt`. Địa chỉ này được tạo từ `N8N_WEBHOOK_URL` trong `.env` (`http://localhost:5678/`), nên link bấm được khi mở email **trên chính máy đang chạy n8n**. Như vậy là đủ để làm và demo.

### 5.6. Body JSON cho các node ghi log

```
={{ {
  "type": "AI_SCORED",
  "note": $('Basic LLM Chain').first().json.output.level + " " + $('Basic LLM Chain').first().json.output.score + " điểm: " + $('Basic LLM Chain').first().json.output.reason
} }}
```

Các node ghi log sau bước duyệt chỉ đổi `type` và `note`.

### 5.7. Thứ tự làm và cách thử

1. Bước 2 đến 12 (mốc 1). Trong lúc HA1 chưa merge, ghim dữ liệu giả (Pin data) cho `Lấy thông tin nhà` và `Ghi log AI_SCORED`.
2. Bước 13 đến 18 (mốc 2).
3. Thử 3 ca bằng form web (email khách dùng `+khach1`, `+khach2`, `+khach3`):

| Ca | Ngân sách | Nhu cầu | Căn | Kỳ vọng |
|---|---|---|---|---|
| HOT | 3.000.000.000 | Căn hộ 2PN, cần mua trong tháng | Căn giá ~2,8 tỷ (id 1) | ≥ 70 điểm |
| WARM | 3.000.000.000 | (để trống) | Căn giá ~5,2 tỷ (id 2) | 40–69 điểm |
| COLD | 50.000.000 | (để trống) | Bất kỳ | < 40 điểm |

4. Với ca HOT: bấm **Duyệt** trong email nhân viên → kiểm tra `GET /api/leads/{id}/events` (hoặc trang `/leads/{id}` khi HO4 xong) có `AI_SCORED`, `APPROVED`, `STATUS_CHANGED`. Vào DB kiểm tra cột `approval_url` của lead đã có giá trị.
5. Thử hết giờ: tạm đặt Limit Wait Time = 2 phút, chờ, kiểm tra quản lý nhận email cảnh báo, rồi đặt lại 24 giờ.
6. Thử lỗi: đổi tạm key Gemini sai → lead `FAILED` trên trang `/leads`.

## 6. HO3: Error workflow

File: `n8n-workflows/error-workflow.json`.

| # | Node | Cấu hình |
|---|---|---|
| 1 | `Error Trigger` | Mặc định |
| 2 | `Tóm tắt lỗi` (Edit Fields) | `workflow = {{ $json.workflow.name }}`, `node = {{ $json.execution.lastNodeExecuted }}`, `message = {{ $json.execution.error.message }}`, `url = {{ $json.execution.url }}` |
| 3 | `Email báo lỗi` (Send Email) | To `nhadn2457+quanly@gmail.com`, tiêu đề `[LỖI] {{ $json.workflow }}`, nội dung gồm 4 trường trên + link mở execution |

Sau đó, trong luồng 1: menu `...` → **Settings** → **Error Workflow** → chọn workflow này. Error workflow không cần bấm Active. Hậu gắn vào luồng 2 theo mục 9.6 khi file này đã có trên `main`.

**Error workflow chỉ chạy khi cả lần chạy bị lỗi.** Các node trước bước 11 của luồng 1 có nhánh lỗi sang `Report FAILED`, nên khi chúng lỗi thì lần chạy vẫn tính là thành công và Error workflow **không** chạy. Muốn thử (và demo) thì phải làm hỏng một node **không có** nhánh lỗi:

1. Đổi tạm URL của `Ghi log AI_SCORED`, thêm `x` vào cuối (backend trả `404`).
2. Gửi 1 lead. Sau 3 lần thử, node lỗi, lần chạy dừng → `+quanly` nhận email `[LỖI]`.
3. Sửa lại URL.

## 7. HO4: Web, cột trạng thái + trang chi tiết lead

Mục đích: xem kết quả của backend và hai luồng ngay trên giao diện thay vì Swagger. Chỉ dùng API có trong hợp đồng. **Không** làm web khách, web admin hay đăng nhập ở tuần này.

Nhánh `feature/web-lead-detail`. Cần HA1 đã merge để gọi API thật (`GET /leads/:id` có `viewing`, `property`; `GET /leads/:id/events`). Trong lúc chờ, dựng giao diện với một object dữ liệu giả viết tay theo đúng kiểu ở hợp đồng, khi HA1 merge thì đổi sang gọi API.

| File | Việc |
|---|---|
| `web/src/lib/api.ts` | Thêm kiểu `LeadStatus` (6 giá trị), `LeadEvent` (`id, leadId, type, note, createdAt`), `LeadDetail = Lead & { viewing: Viewing \| null; property: Property \| null }`. Thêm hàm `getLead(id)`, `getLeadEvents(id)`. Thêm bảng tên tiếng Việt cho loại sự kiện (bên dưới) |
| `web/src/components/LeadStatusBadge.tsx` (mới) | Nhãn trạng thái bán hàng, mỗi trạng thái một màu |
| `web/src/app/leads/page.tsx` | Thêm cột "Trạng thái". Tên khách thành link sang `/leads/[id]` |
| `web/src/app/leads/[id]/page.tsx` (mới) | Trang client, lấy `id` bằng `useParams()` của `next/navigation`. Gồm: thông tin khách (SĐT, email, ngân sách, nhu cầu); căn nhà + giờ xem (giờ Việt Nam); kết quả AI (điểm, mức, lý do, nội dung email AI soạn); trạng thái xử lý (`PENDING` / `COMPLETED` / `FAILED` kèm `automationError`); **dòng thời gian** từ `getLeadEvents`, cũ nhất ở trên, mỗi dòng gồm tên sự kiện, ghi chú, giờ. Tự tải lại mỗi 5 giây, để khi bấm Duyệt trong email thì dòng `APPROVED` hiện ngay. Lead không tồn tại (`404`): hiện "Không tìm thấy khách" |

Tên tiếng Việt cho `lead_events.type`:

| `type` | Hiển thị |
|---|---|
| `AI_SCORED` | AI chấm điểm |
| `APPROVED` | Nhân viên duyệt lịch |
| `RESCHEDULE_REQUESTED` | Nhân viên yêu cầu đổi giờ |
| `APPROVAL_TIMEOUT` | Quá 24 giờ chưa duyệt |
| `REMINDER_SENT` | Đã nhắc lịch |
| `FEEDBACK_ASKED` | Đã hỏi cảm nhận |
| `WARM_NUDGE_SENT` | Đã nhắc khách WARM |
| `STATUS_CHANGED` | Đổi trạng thái |

Trước khi mở PR: `npm run lint` và `npm run build` trong `web/` không lỗi. Đọc `web/AGENTS.md`: bản Next.js này khác bản cũ, cần xem tài liệu trong `web/node_modules/next/dist/docs/` khi dùng API lạ.

---

# PHẦN B. Hậu

## 8. HA1: API backend cho tuần 2

Hợp đồng đã ghi sẵn trong `api-contract.md` (mục 2.1, 2.3, 2.4, 3, 4), Hậu làm đúng theo đó. Nhánh `feature/lead-events-api`. **Làm việc này đầu tiên**: luồng 1 và trang web của Hoàng dùng các API này. Không cần chờ PR tài liệu merge.

### 8.1. File cần tạo hoặc sửa

| File | Việc |
|---|---|
| `backend/src/leads/lead.constants.ts` | **Tạo mới.** Danh sách trạng thái và loại sự kiện |
| `backend/src/leads/entities/lead-event.entity.ts` | **Tạo mới.** Entity bảng `lead_events` |
| `backend/src/leads/dto/update-lead-status.dto.ts` | **Tạo mới** |
| `backend/src/leads/dto/create-lead-event.dto.ts` | **Tạo mới** |
| `backend/src/leads/entities/lead.entity.ts` | Thêm cột `approvalUrl` (`select: false`) |
| `backend/src/leads/dto/update-ai-result.dto.ts` | Thêm `approvalUrl?: string` (`@IsOptional() @IsString()`) |
| `backend/src/leads/leads.module.ts` | Thêm `LeadEvent`, `Viewing`, `Property` vào `TypeOrmModule.forFeature([...])` |
| `backend/src/leads/leads.service.ts` | Thêm `updateStatus`, `addEvent`, `findEvents`, `findDetail`. `updateAiResult` lưu thêm `approvalUrl` |
| `backend/src/leads/leads.controller.ts` | Thêm 3 route. `GET :id` đổi sang gọi `findDetail`. Gom đoạn kiểm tra secret đang lặp thành một hàm `checkSecret` |
| `backend/src/properties/properties.service.ts` | Thêm `findOne(id)`, không có thì `NotFoundException` |
| `backend/src/properties/properties.controller.ts` | Thêm `@Get(':id')` |

### 8.2. Code gợi ý

`lead.constants.ts`:

```ts
export const LEAD_STATUSES = ['NEW', 'CONFIRMED', 'VIEWED', 'DEPOSIT', 'SIGNED', 'LOST'];
export const LEAD_EVENT_TYPES = [
  'AI_SCORED', 'APPROVED', 'RESCHEDULE_REQUESTED', 'APPROVAL_TIMEOUT',
  'REMINDER_SENT', 'FEEDBACK_ASKED', 'WARM_NUDGE_SENT', 'STATUS_CHANGED',
];
```

`entities/lead-event.entity.ts`:

```ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('lead_events')
export class LeadEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'lead_id' })
  leadId: number;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

Hai DTO (cùng kiểu với `update-automation-status.dto.ts` đang có):

```ts
// update-lead-status.dto.ts
export class UpdateLeadStatusDto {
  @IsIn(LEAD_STATUSES)
  status: string;

  @IsOptional()
  @IsString()
  note?: string;
}

// create-lead-event.dto.ts
export class CreateLeadEventDto {
  @IsIn(LEAD_EVENT_TYPES)
  type: string;

  @IsOptional()
  @IsString()
  note?: string;
}
```

Thêm vào `leads.service.ts` (inject thêm `@InjectRepository(LeadEvent) private readonly leadEventRepository: Repository<LeadEvent>`):

```ts
async updateStatus(id: number, data: { status: string; note?: string }): Promise<Lead> {
  const lead = await this.findOne(id);
  const oldStatus = lead.status;
  if (oldStatus === data.status) return lead; // trùng trạng thái: không đổi, không ghi log (hợp đồng 2.3)
  lead.status = data.status;
  const saved = await this.leadRepository.save(lead);
  await this.addEvent(id, {
    type: 'STATUS_CHANGED',
    note: `${oldStatus} -> ${data.status}${data.note ? `: ${data.note}` : ''}`,
  });
  return saved;
}

async addEvent(id: number, data: { type: string; note?: string }): Promise<LeadEvent> {
  await this.findOne(id); // 404 nếu lead không tồn tại
  return this.leadEventRepository.save(
    this.leadEventRepository.create({ leadId: id, type: data.type, note: data.note ?? null }),
  );
}

findEvents(id: number): Promise<LeadEvent[]> {
  return this.leadEventRepository.find({ where: { leadId: id }, order: { createdAt: 'ASC' } });
}

// Cho GET /leads/:id: trả thêm viewing và property (hợp đồng mục 3)
async findDetail(id: number) {
  const lead = await this.findOne(id);
  const viewing = await this.viewingRepository.findOne({ where: { leadId: id }, order: { id: 'DESC' } });
  const property = viewing
    ? await this.propertyRepository.findOne({ where: { id: viewing.propertyId } })
    : null;
  return { ...lead, viewing, property };
}
```

`findDetail` cần inject thêm `Repository<Viewing>` và `Repository<Property>` (import từ `../viewings/entities/viewing.entity` và `../properties/entities/property.entity`).

Trong `updateAiResult`, thêm `approvalUrl?: string` vào kiểu của tham số `data`, rồi thêm một dòng giống các trường khác:

```ts
if (data.approvalUrl !== undefined) lead.approvalUrl = data.approvalUrl;
```

Cột mới trong `lead.entity.ts`. `select: false` nghĩa là mọi `find` đều **không** lấy cột này, nên `GET` không lộ link duyệt; `save` vẫn ghi được khi gán giá trị:

```ts
@Column({ name: 'approval_url', type: 'text', nullable: true, select: false })
approvalUrl?: string | null;
```

Thêm vào `leads.controller.ts`:

```ts
private checkSecret(webhookSecret?: string) {
  if (!webhookSecret || webhookSecret !== process.env.WEBHOOK_SECRET) {
    throw new UnauthorizedException('Invalid webhook secret');
  }
}

@Put(':id/status')
updateStatus(
  @Param('id') id: string,
  @Body() data: UpdateLeadStatusDto,
  @Headers('x-webhook-secret') webhookSecret?: string,
): Promise<Lead> {
  this.checkSecret(webhookSecret);
  return this.leadsService.updateStatus(Number(id), data);
}

@Post(':id/events')
addEvent(
  @Param('id') id: string,
  @Body() data: CreateLeadEventDto,
  @Headers('x-webhook-secret') webhookSecret?: string,
): Promise<LeadEvent> {
  this.checkSecret(webhookSecret);
  return this.leadsService.addEvent(Number(id), data);
}

@Get(':id/events')
findEvents(@Param('id') id: string): Promise<LeadEvent[]> {
  return this.leadsService.findEvents(Number(id));
}
```

Hai route cũ `ai-result` và `automation-status` đổi sang gọi `this.checkSecret(webhookSecret)` cho gọn. Route `GET :id` đổi thân hàm thành `return this.leadsService.findDetail(Number(id));` (bỏ kiểu trả về `Promise<Lead>`).

### 8.3. Kiểm tra

Chạy `npm run start:dev` (mục 4.4) hoặc `docker compose up -d --build backend`, mở `http://localhost:8081/api/docs`, rồi thử:

```powershell
$h = @{ "X-Webhook-Secret" = "GIA_TRI_SECRET" }
Invoke-RestMethod -Uri "http://localhost:8081/api/properties/1"
Invoke-RestMethod -Method Put  -Uri "http://localhost:8081/api/leads/1/status" -Headers $h -ContentType "application/json" -Body '{"status":"CONFIRMED","note":"test"}'
Invoke-RestMethod -Method Post -Uri "http://localhost:8081/api/leads/1/events" -Headers $h -ContentType "application/json" -Body '{"type":"REMINDER_SENT","note":"test"}'
Invoke-RestMethod -Uri "http://localhost:8081/api/leads/1/events"
Invoke-RestMethod -Uri "http://localhost:8081/api/leads/1"          # có viewing, property; KHÔNG có approvalUrl
# Gọi PUT status CONFIRMED lần 2: GET events không có thêm dòng STATUS_CHANGED
# Phải lỗi: thiếu secret → 401, status sai → 400, property 999 → 404
```

Kiểm tra `approvalUrl` được lưu: gọi `PUT /api/leads/1/ai-result` (kèm secret) có `"approvalUrl": "http://test"`, rồi:

```powershell
docker compose exec db psql -U realestate -d realestate -c "select id, approval_url from leads where id = 1"
```

Chạy thêm `npm run lint` và `npm run build` trong `backend/` trước khi mở PR.

## 9. HA2: Luồng 2, follow-up tự động

File: `n8n-workflows/luong-2-follow-up.json`. Làm mới trên n8n ở máy mình. Cách dựng node AI và Send Email: mục 4.5 (hoặc import luồng 1 ra xem mẫu).

Luồng 2 **không cần dữ liệu từ luồng 1**: 3 lead mẫu do file SQL ở mục 9.4 tạo ra.

### 9.1. Ba loại follow-up

| `type` | Điều kiện | Email khách | Việc thêm | Sự kiện ghi |
|---|---|---|---|---|
| `REMINDER` | `status = CONFIRMED`, giờ xem trong 24 giờ tới, chưa có `REMINDER_SENT` | Nhắc giờ, tên nhà, địa chỉ | | `REMINDER_SENT` |
| `FEEDBACK` | `status` là `CONFIRMED` hoặc `VIEWED`, giờ xem đã qua hơn 1 ngày, chưa có `FEEDBACK_ASKED` | Hỏi cảm nhận, gợi ý bước tiếp theo (xem căn khác, đặt cọc) | Đổi lead sang `VIEWED` (đã `VIEWED` thì backend bỏ qua) | `FEEDBACK_ASKED` |
| `WARM_NUDGE` | `level = WARM`, `status = NEW`, tạo hơn 3 ngày, chưa có `WARM_NUDGE_SENT` | Email lần 2, hỏi thêm nhu cầu, gợi ý căn | Email nhắc nhân viên gọi lại | `WARM_NUDGE_SENT` |

### 9.2. Sơ đồ và từng bước

```
Schedule (mỗi giờ) ┐
Manual Trigger     ┴→ Cấu hình → Lấy lead cần follow-up (Postgres) → Có dữ liệu? ──không──→ (kết thúc)
  └─có→ Loop Over Items ─(từng lead)→ Lấy thông tin nhà → Chuẩn bị ngữ cảnh → AI soạn email
        → Kiểm tra nội dung AI → Email khách → Ghi log → Việc thêm (Switch)
              ├ FEEDBACK   → Chuyển VIEWED ───────┐
              ├ WARM_NUDGE → Nhắc nhân viên ──────┼→ Gom kết quả → quay lại Loop Over Items
              └ REMINDER   ───────────────────────┘
        Loop xong (done) → Tổng hợp → Có gửi email? → Email báo cáo quản lý
```

| # | Tên node | Loại | Cấu hình chính |
|---|---|---|---|
| 1 | `Mỗi giờ` + `Chạy tay` | Schedule Trigger + Manual Trigger | Schedule: Every Hour. Cả hai nối vào bước 2 |
| 2 | `Cấu hình` | Edit Fields | Như mục 4.3 |
| 3 | `Lấy lead cần follow-up` | Postgres | Operation **Execute Query**, câu SQL 9.3, credential `Postgres account`. Settings → **Always Output Data = bật** (để bước 4 vẫn chạy khi không có dòng nào) |
| 4 | `Có dữ liệu?` | IF | `{{ $json.type }}` **is not empty**. Nhánh false để trống (kết thúc) |
| 5 | `Loop Over Items` | Loop Over Items | Batch Size `1` |
| 6 | `Lấy thông tin nhà` | HTTP Request | GET `{{ $('Cấu hình').first().json.backendUrl }}/api/properties/{{ $json.property_id }}`. Retry |
| 7 | `Chuẩn bị ngữ cảnh` | Code | Đoạn code 9.5 |
| 8 | `AI soạn email` (+ Gemini + Parser) | Basic LLM Chain | Prompt 9.5. Parser ví dụ `{"subject": "...", "body": "..."}`. Retry |
| 9 | `Kiểm tra nội dung AI` | Code | Guardrail 9.5 |
| 10 | `Email khách` | Send Email | From `nhadn2457@gmail.com`, To `{{ $json.email }}`, Subject `{{ $json.subject }}`, HTML `{{ $json.body.replace(/\n/g,'<br>') }}`. Retry |
| 11 | `Ghi log` | HTTP Request | POST `.../api/leads/{{ $('Kiểm tra nội dung AI').item.json.lead_id }}/events`, credential `Header Auth account`, body `{ "type": $('Kiểm tra nội dung AI').item.json.eventType, "note": $('Kiểm tra nội dung AI').item.json.subject }`. Sau node Send Email, `$json` là phản hồi SMTP chứ không còn dữ liệu lead, nên luôn lấy từ `Kiểm tra nội dung AI` |
| 12 | `Việc thêm` | Switch | Theo `{{ $('Kiểm tra nội dung AI').item.json.type }}`: `FEEDBACK` / `WARM_NUDGE` / fallback (`REMINDER`) |
| 13 | `Chuyển VIEWED` | HTTP Request | PUT `.../api/leads/{{ $('Kiểm tra nội dung AI').item.json.lead_id }}/status`, body `{ "status": "VIEWED", "note": "Đã hỏi cảm nhận sau buổi xem" }` |
| 14 | `Nhắc nhân viên` | Send Email | To `staffEmail`, tiêu đề `[GỌI LẠI] <tên khách> - WARM 3 ngày chưa phản hồi`, kèm SĐT, nhu cầu, email AI vừa gửi |
| 15 | `Gom kết quả` | Code | Đầu ra của 13, 14 và nhánh fallback của 12 cùng nối vào node này (Run Once for Each Item): `return { json: $('Kiểm tra nội dung AI').item.json };`. Đầu ra nối ngược vào input của `Loop Over Items`. Nhờ vậy output **done** của Loop chứa đủ dữ liệu từng lead để tổng hợp |
| 16 | `Tổng hợp` | Code | Nối từ output **done** của Loop. Đoạn code 9.5 |
| 17 | `Có gửi email?` → `Email báo cáo quản lý` | IF + Send Email | IF `{{ $json.total }}` > 0. Email tới `managerEmail`: số email theo từng loại, số lần dùng mẫu dự phòng |

Đường dài nhất: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 15 → (Loop) → 16 → 17, tức **17 bước**.

Không cần nhánh báo `FAILED` như luồng 1 (lead đã `COMPLETED` từ trước). Lỗi ở luồng 2 do Error workflow báo cho quản lý (mục 9.6, bước 4).

Giới hạn đã biết: nếu `Email khách` đã gửi mà `Ghi log` vẫn lỗi sau 3 lần thử, lần chạy dừng và giờ sau khách đó có thể nhận lại email. Chấp nhận ở tuần này.

### 9.3. Câu SQL cho bước 3

n8n chỉ **đọc** DB. Mọi thao tác ghi đều đi qua API.

```sql
SELECT 'REMINDER' AS type, l.id AS lead_id, l.name, l.email, l.phone, l.needs, l.level,
       v.property_id, v.viewing_time
FROM leads l JOIN viewings v ON v.lead_id = l.id
WHERE l.status = 'CONFIRMED'
  AND v.viewing_time BETWEEN now() AND now() + interval '24 hours'
  AND NOT EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id = l.id AND e.type = 'REMINDER_SENT')
UNION ALL
SELECT 'FEEDBACK', l.id, l.name, l.email, l.phone, l.needs, l.level, v.property_id, v.viewing_time
FROM leads l JOIN viewings v ON v.lead_id = l.id
WHERE l.status IN ('CONFIRMED', 'VIEWED')   -- VIEWED: sau này nhân viên bấm "Đã xem" trên web/app
  AND v.viewing_time < now() - interval '1 day'
  AND NOT EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id = l.id AND e.type = 'FEEDBACK_ASKED')
UNION ALL
SELECT 'WARM_NUDGE', l.id, l.name, l.email, l.phone, l.needs, l.level, v.property_id, v.viewing_time
FROM leads l JOIN viewings v ON v.lead_id = l.id
WHERE l.level = 'WARM' AND l.status = 'NEW'
  AND l.created_at < now() - interval '3 days'
  AND NOT EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id = l.id AND e.type = 'WARM_NUDGE_SENT')
LIMIT 50;
```

### 9.4. HA3: Dữ liệu mẫu `backend/sql/demo-follow-up.sql`

Mỗi lần chạy sẽ xoá 3 lead mẫu cũ rồi tạo lại, mỗi lead rơi đúng một loại. Căn `id = 1` có sẵn từ seed. Cần HA1 đã chạy (có bảng `lead_events`).

```sql
-- Xoá dữ liệu mẫu cũ (chỉ các lead dùng email +demo)
DELETE FROM lead_events WHERE lead_id IN (SELECT id FROM leads WHERE email LIKE 'nhadn2457+demo%');
DELETE FROM viewings    WHERE lead_id IN (SELECT id FROM leads WHERE email LIKE 'nhadn2457+demo%');
DELETE FROM leads       WHERE email LIKE 'nhadn2457+demo%';

-- REMINDER: đã chốt lịch, xem sau 5 giờ nữa
WITH l AS (
  INSERT INTO leads (name, email, phone, budget, needs, score, level, reason, status, automation_status)
  VALUES ('Nguyễn Văn Nhắc', 'nhadn2457+demo1@gmail.com', '0900000001', 3000000000, 'Căn hộ 2PN', 85, 'HOT', 'Dữ liệu mẫu', 'CONFIRMED', 'COMPLETED')
  RETURNING id)
INSERT INTO viewings (property_id, lead_id, viewing_time, status) SELECT 1, id, now() + interval '5 hours', 'NEW' FROM l;

-- FEEDBACK: đã chốt lịch, giờ xem đã qua 2 ngày
WITH l AS (
  INSERT INTO leads (name, email, phone, budget, needs, score, level, reason, status, automation_status)
  VALUES ('Trần Thị Cảm', 'nhadn2457+demo2@gmail.com', '0900000002', 2800000000, 'Căn hộ gần trường học', 78, 'HOT', 'Dữ liệu mẫu', 'CONFIRMED', 'COMPLETED')
  RETURNING id)
INSERT INTO viewings (property_id, lead_id, viewing_time, status) SELECT 1, id, now() - interval '2 days', 'NEW' FROM l;

-- WARM_NUDGE: WARM, đăng ký 4 ngày trước, chưa tiến triển
WITH l AS (
  INSERT INTO leads (name, email, phone, budget, needs, score, level, reason, status, automation_status, created_at)
  VALUES ('Lê Minh Ấm', 'nhadn2457+demo3@gmail.com', '0900000003', 3000000000, '', 55, 'WARM', 'Dữ liệu mẫu', 'NEW', 'COMPLETED', now() - interval '4 days')
  RETURNING id)
INSERT INTO viewings (property_id, lead_id, viewing_time, status) SELECT 1, id, now() + interval '3 days', 'NEW' FROM l;
```

Chạy từ thư mục gốc repo (thay `realestate` nếu `.env` đặt khác):

```powershell
cmd /c "docker compose exec -T db psql -U realestate -d realestate < backend\sql\demo-follow-up.sql"
```

Dùng `cmd /c ... <` thay cho `Get-Content |`, vì PowerShell 5.1 đọc file sai bảng mã rồi gửi sang lệnh khác dưới dạng ASCII, làm hỏng dấu tiếng Việt trong tên khách mẫu. `cmd` chuyển nguyên từng byte của file.

### 9.5. Code và prompt

`Chuẩn bị ngữ cảnh` (bước 7, Mode: Run Once for Each Item):

```js
const lead = $('Loop Over Items').item.json;
const p = $json; // kết quả GET /api/properties/:id
const purposes = {
  REMINDER: 'Nhắc khách lịch xem nhà sẽ diễn ra trong 24 giờ tới. Nêu rõ giờ, tên căn, địa chỉ. Dặn khách báo lại nếu cần đổi giờ.',
  FEEDBACK: 'Khách đã đi xem nhà hôm trước. Cảm ơn, hỏi cảm nhận về căn nhà, gợi ý bước tiếp theo: xem thêm căn khác hoặc trao đổi về đặt cọc.',
  WARM_NUDGE: 'Khách đăng ký 3 ngày trước nhưng chưa phản hồi. Hỏi thăm nhẹ nhàng, hỏi thêm nhu cầu cụ thể (khu vực, số phòng), mời khách trả lời email.',
};
const eventTypes = { REMINDER: 'REMINDER_SENT', FEEDBACK: 'FEEDBACK_ASKED', WARM_NUDGE: 'WARM_NUDGE_SENT' };
return {
  json: {
    ...lead,
    propertyName: p.name,
    propertyAddress: p.address,
    viewingTimeText: DateTime.fromISO(new Date(lead.viewing_time).toISOString()).setZone('Asia/Ho_Chi_Minh').toFormat("HH:mm 'ngày' dd/MM/yyyy"),
    purpose: purposes[lead.type],
    eventType: eventTypes[lead.type],
  },
};
```

Prompt cho `AI soạn email` (bước 8):

```
Bạn là nhân viên chăm sóc khách hàng của một văn phòng bất động sản.
Mục đích email: {{ $json.purpose }}

Khách: {{ $json.name }}
Căn nhà: {{ $json.propertyName }}, {{ $json.propertyAddress }}
Giờ xem: {{ $json.viewingTimeText }}
Nhu cầu khách ghi: {{ $json.needs || '(không ghi)' }}

Yêu cầu: tiếng Việt, thân thiện, xưng "chúng tôi", gọi khách là "anh/chị {{ $json.name }}", tối đa 6 câu, không bịa thông tin không có ở trên.
Chỉ trả về JSON: {"subject": "...", "body": "..."}
```

`Kiểm tra nội dung AI` (bước 9, Mode: Run Once for Each Item):

```js
const ctx = $('Chuẩn bị ngữ cảnh').item.json;
const out = $json.output ?? {};
let subject = String(out.subject ?? '').trim();
let body = String(out.body ?? '').trim();

const ok = subject.length > 0 && body.length > 0 && body.length <= 1200
  && body.includes(ctx.name) && !body.includes('{{');

if (!ok) {
  const fallback = {
    REMINDER: ['Nhắc lịch xem nhà', `Chào anh/chị ${ctx.name}, chúng tôi xin nhắc lịch xem ${ctx.propertyName} lúc ${ctx.viewingTimeText} tại ${ctx.propertyAddress}. Nếu cần đổi giờ, anh/chị vui lòng trả lời email này.`],
    FEEDBACK: ['Cảm ơn anh/chị đã đi xem nhà', `Chào anh/chị ${ctx.name}, cảm ơn anh/chị đã xem ${ctx.propertyName}. Anh/chị thấy căn nhà thế nào? Chúng tôi sẵn sàng giới thiệu thêm căn khác hoặc trao đổi về đặt cọc.`],
    WARM_NUDGE: ['Chúng tôi có thể hỗ trợ thêm gì cho anh/chị?', `Chào anh/chị ${ctx.name}, anh/chị có thể cho chúng tôi biết thêm khu vực và số phòng mong muốn để chúng tôi gợi ý căn phù hợp hơn không?`],
  }[ctx.type];
  [subject, body] = fallback;
}

return { json: { ...ctx, subject, body, usedFallback: !ok } };
```

`Tổng hợp` (bước 16, Mode: Run Once for All Items):

```js
const rows = $input.all().map(i => i.json); // output done của Loop, mỗi item là một lead đã xử lý
const count = t => rows.filter(r => r.type === t).length;
return [{
  json: {
    total: rows.length,
    reminder: count('REMINDER'),
    feedback: count('FEEDBACK'),
    warmNudge: count('WARM_NUDGE'),
    fallback: rows.filter(r => r.usedFallback).length,
  },
}];
```

### 9.6. Thứ tự làm và cách thử

1. Sau khi HA1 chạy trên máy mình: tạo credential `Postgres account`, nạp dữ liệu mẫu (9.4), dựng bước 1 đến 5, chạy thử câu SQL thấy đúng 3 dòng.
2. Bước 6 đến 11 (AI, guardrail, email, ghi log). Thử guardrail: tạm sửa prompt để AI trả rỗng → phải dùng mẫu dự phòng.
3. Bước 12 đến 17, nối vòng lặp qua `Gom kết quả`. Chạy trọn: nạp dữ liệu mẫu → Execute → kiểm tra hộp thư → Execute lần 2 → không có email mới.
4. Khi `error-workflow.json` của Hoàng đã có trên `main`: import vào n8n máy mình, rồi ở luồng 2 chọn menu `...` → **Settings** → **Error Workflow** → chọn workflow đó. Việc này không chặn các bước trên.
5. Muốn Schedule tự chạy mỗi giờ thì bật **Active** (chỉ chạy khi máy đang bật). Khi thử và demo, dùng **Chạy tay** là đủ.

---

# PHẦN C. Chung

## 10. Ghép hai luồng trên một máy (trước khi demo)

Việc chung duy nhất của tuần. Làm trên máy của người sẽ trình bày, cả hai cùng ngồi:

1. Mọi PR đã xong đều merge vào `main`. Trên máy đó: `git checkout main`, `git pull`, `docker compose up -d --build`.
2. Import 3 workflow: `luong-1-dat-lich.json`, `luong-2-follow-up.json`, `error-workflow.json` (mục 3.3). Node nào báo thiếu credential thì chọn lại.
3. Ở luồng 1 và luồng 2: **Settings → Error Workflow** chọn lại workflow báo lỗi (id trên máy khác sẽ không khớp).
4. Bấm **Publish/Active** cho luồng 1 (bắt buộc, vì backend gọi `/webhook/viewing-requested`) và luồng 2.
5. Nạp dữ liệu mẫu (mục 9.4), chạy trọn kịch bản demo ở mục 11 một lượt. Lỗi ở phần của ai thì người đó sửa trên nhánh của mình.
6. Từ lúc đã ghép chạy trọn: chỉ sửa lỗi, không thêm tính năng.

HO5 và HA4 (chạy thử luồng của nhau) có thể làm sớm hơn trên máy mỗi người, không cần chờ bước ghép này.

## 11. Kịch bản demo

Chỉ trình bày phần đã chạy được (bảng mốc ở mục 2.3). Bản đầy đủ khi đã xong mốc 4:

**Mở đầu: backend (Hậu, 1–2 phút)**

1. Sơ đồ kiến trúc: web → backend → n8n → backend.
2. `docker ps`: 4 container đang chạy.
3. Mở Swagger `http://localhost:8081/api/docs`: chỉ ra 4 API mới. Gọi `PUT /api/leads/1/status` không có secret → `401`.
4. Giải thích bảng `lead_events`: vừa là dòng thời gian của khách, vừa chống gửi trùng, vừa là log.

**Hoàng: luồng 1 + Error workflow (3–4 phút)**

1. Nói bài toán (30 giây), mở sơ đồ luồng 1 trên n8n.
2. Điền form trên web `http://localhost:3000`, email `+khach1`, ca HOT.
3. Mở tab Executions: lần chạy đang dừng ở `Chờ duyệt`. Bấm vào xem kết quả AI.
4. Mở hộp thư nhóm: khách nhận email "đã nhận yêu cầu", nhân viên nhận email `[ƯU TIÊN]` có 2 nút. Mở `/leads/{id}`: đã có `AI_SCORED`.
5. Bấm **Duyệt lịch**: trình duyệt hiện "Đã ghi nhận", khách nhận email chốt lịch, trang `/leads/{id}` tự hiện `APPROVED` và `NEW -> CONFIRMED`.
6. Làm hỏng `Ghi log AI_SCORED` như mục 6, gửi 1 lead: quản lý nhận email `[LỖI]` từ Error workflow. Sửa lại.

**Hậu: luồng 2 (3–4 phút)**

1. Nói 3 loại follow-up, mở sơ đồ luồng 2.
2. Dữ liệu mẫu đã nạp sẵn. Cho xem 3 lead ở `/leads`.
3. Bấm **Execute workflow** (Chạy tay): 3 email khách, 1 email nhắc nhân viên, 1 email tổng kết cho quản lý.
4. Mở `/leads/{id}` của lead "Trần Thị Cảm": có `FEEDBACK_ASKED` và `CONFIRMED -> VIEWED`. (Nếu HO4 chưa xong thì xem bằng Swagger `GET /api/leads/{id}/events`.)
5. Bấm chạy lần nữa: không có email mới. Giải thích cơ chế chống gửi trùng bằng `lead_events`.
6. Mở node `Kiểm tra nội dung AI`: giải thích guardrail và mẫu dự phòng khi AI trả nội dung hỏng.

## 12. Checklist trước khi demo

- [ ] Các PR đã xong đều merge. Máy demo chạy `main` bằng `docker compose up -d --build`
- [ ] Đã ghép theo mục 10: luồng 1 và luồng 2 đã Active, đã chọn Error workflow trong Settings
- [ ] Mỗi luồng ≥ 12 bước, có retry, có nhánh lỗi hoặc Error workflow
- [ ] File JSON trên Git không chứa key, mật khẩu, mail cá nhân (lệnh ở mục 3.3)
- [ ] Dọn lead test cũ, nạp lại `demo-follow-up.sql`
- [ ] Dọn hộp thư nhóm cho dễ nhìn khi chiếu
- [ ] Quay video dự phòng phần đã chạy được
