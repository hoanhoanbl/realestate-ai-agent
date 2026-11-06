# Kịch bản demo phần Hậu (nói sau Hoàng)

Khoảng **14 phút**. Người nói: Hậu. Phạm vi: backend NestJS, Mautic, luồng **7, 2, 5, 8, 4**. Phần chung và phần Hoàng: [kich-ban-demo-hoang-hau.md](kich-ban-demo-hoang-hau.md).

Thứ tự: nối từ khách Hoàng vừa đặt (server) → backend → luồng 7 → luồng 5 → luồng 8 → luồng 4 (vẫn trên server) → **xin thầy chuyển sang local** → luồng 2 → tổng kết.

Để luồng 2 ở cuối để chỉ chuyển môi trường **một lần**, không qua lại.

---

## Chuẩn bị

### Trên server (dùng chung tab với Hoàng)

| Tab | Địa chỉ |
|---|---|
| S1 Admin | https://hoanhoan.hiennguyen.io.vn/admin/leads (đăng nhập quản lý) |
| S2 Swagger | https://hoanhoan.hiennguyen.io.vn/api/docs |
| S3 n8n | https://n8n.hoanhoan.hiennguyen.io.vn |
| S4 Mautic | https://mautic.hoanhoan.hiennguyen.io.vn (đăng nhập admin) |
| S5 Báo cáo | https://hoanhoan.hiennguyen.io.vn/admin/bao-cao |
| Gmail, Telegram nhóm sale | như Hoàng |

Server chưa lên `v0.3.1` thì luồng 7, 8 trên server là **bản cũ** (vẫn chạy được). Trước buổi demo thử luồng 7 và 8 trên server một lần; nếu không chạy thì cũng demo hai luồng này trên local.

### Trên máy Hậu (local), bật sẵn trước buổi demo

```bash
docker compose -p realestate-ai-agent -f docker-compose.yml -f docker-compose.mautic.yml up -d
```

| Tab | Địa chỉ |
|---|---|
| L1 Admin local | http://localhost:3000/admin/leads |
| L2 n8n local | http://localhost:5678 → mở sẵn **Luồng 2: Follow-up** (Editor) |
| L3 Mautic local | http://localhost:8082 |
| L4 Terminal | ở thư mục repo |

Kiểm tra ở local: luồng 2 bản mới đã import, credential Postgres, Gemini, SMTP, Mautic API đã chọn; sub-workflow Thông báo nhân viên và Error workflow đã publish; node **Cấu hình** trỏ `backendUrl`, `mauticUrl` của local.

**Nạp dữ liệu mẫu luồng 2 khoảng 30 phút trước khi demo** (chỉ ở local, **không bao giờ chạy trên server** vì file xoá mọi lead có email `nhadn2457+demo...`):

```bash
docker compose -p realestate-ai-agent exec -T db psql -U realestate -d realestate < backend/sql/demo-follow-up.sql
docker compose -p realestate-ai-agent exec -T db psql -U realestate -d realestate < backend/sql/preview-follow-up.sql
```

Lệnh thứ hai chỉ đọc, cho xem trước luồng 2 sẽ chọn những lead nào. Phải thấy 4 khách mẫu:

| Khách | Email | Ca demo |
|---|---|---|
| Nguyễn Văn Nhắc | `+demo1` | REMINDER: đã chốt lịch, xem sau 5 giờ nữa |
| Trần Thị Cảm | `+demo2` | ATTENDANCE_CHECK: giờ xem đã qua 2 ngày mà nhân viên chưa ghi nhận khách có đến |
| Lê Minh Ấm | `+demo3` | STAFF_NUDGE: WARM, đăng ký 4 ngày, sale chưa duyệt |
| Phạm Thị Lặng | `+demo4` | WARM_NUDGE: đã xem, đồng ý nhận tin, hỏi cảm nhận 4 ngày chưa trả lời |

**Không chạy luồng 2 trước giờ demo** sau khi nạp dữ liệu, nếu không tác vụ đã `COMPLETED` và lúc demo sẽ ra `NO_TASKS`. Nếu lỡ chạy thì nạp lại hai lệnh trên.

Ghi lại email Hoàng dùng để đặt lịch trên server (Hoàng không dùng dạng `+demo...` để khỏi lẫn với dữ liệu mẫu). Chụp sẵn ảnh một lần chạy luồng 2 thành công ở local để dự phòng.

---

## U1. Nhận lời từ Hoàng (30 giây)

**Màn hình:** S1 → bấm vào khách Hoàng vừa đặt lịch.

**Chỉ vào:** điểm AI, mức HOT/WARM/COLD, lý do AI, trạng thái `CONFIRMED`, dòng thời gian.

**Nói:**

> Em là Hậu, phụ trách backend và phần sau khi khách đặt lịch: đồng bộ sang Mautic, chăm sóc khách tự động, phân tích cảm nhận và báo cáo. Em dùng luôn khách bạn Hoàng vừa tạo: khách đã được AI chấm điểm và sale đã duyệt. Mỗi việc hệ thống làm đều ghi một dòng vào dòng thời gian này, đây cũng là log để kiểm tra.

## U2. Backend (1 phút)

**Màn hình:** S2 (Swagger). Cuộn qua các nhóm: leads, viewings, feedbacks, reports, followups, contracts.

**Nói:**

> Backend viết bằng NestJS và TypeScript, lưu PostgreSQL qua TypeORM. Đây là tài liệu API tự sinh. Web gọi các API này, n8n cũng gọi để ghi kết quả.
>
> Ba lớp bảo vệ: người dùng admin đăng nhập bằng **JWT** và có **phân quyền** (sale, quản lý); n8n gọi backend bằng header **webhook secret**; còn quy tắc nghiệp vụ nằm ở backend, ví dụ khách đang đặt cọc thì không cho đánh dấu "Không mua". n8n chỉ được đọc database trực tiếp, mọi thao tác ghi đều qua API này.

Không bấm "Try it out", không nhập secret khi đang chiếu.

## U3. Luồng 7: đồng bộ sang Mautic (2 phút)

**Màn hình 1:** S3 (n8n) → **Luồng 7: Đồng bộ Mautic** → tab **Executions** → mở lần chạy lúc Hoàng bấm Duyệt.

**Chỉ theo đường chạy:** Webhook `lead-changed` → chuẩn hoá dữ liệu → tìm contact theo email → tạo hoặc cập nhật → lưu contact ID về backend → ghi sự kiện.

**Nói:**

> Mỗi khi khách đổi trạng thái, backend bắn sự kiện sang luồng 7. Luồng tìm contact theo đúng email: có rồi thì cập nhật, chưa có thì tạo mới, rồi lưu mã contact ngược về backend để hai hệ thống nối với nhau.

**Màn hình 2:** S4 (Mautic) → **Contacts** → tìm email của khách Hoàng → mở contact.

**Chỉ vào:** các tag (mức AI, trạng thái, thành phố, nguồn).

> Bên Mautic khách có tag theo mức độ, trạng thái, thành phố và nguồn. Mautic dùng các tag này để chia nhóm và chạy chiến dịch email. Phân công rõ: backend giữ hồ sơ nghiệp vụ, n8n điều phối, Mautic lo marketing.

**Màn hình 3:** quay lại S1, dòng thời gian khách có `MAUTIC_SYNCED`.

## U4. Luồng 5: khách gửi cảm nhận (2 phút)

Cần một khách **đã xem nhà** trên server có email hỏi cảm nhận (lead Hoàng dùng cho hợp đồng, hoặc lead chuẩn bị riêng). Không có sẵn thì làm ca này ở local cùng phần luồng 2.

**Thao tác:**

1. Gmail → email "hỏi cảm nhận" → bấm link `/cam-nhan/<mã>`.
2. Chọn 4 sao, nhập: *"Nhà đẹp nhưng hơi xa chỗ làm, tôi muốn xem căn gần trung tâm hơn."* → **Gửi**.
3. S3 → **Luồng 5: Phân tích cảm nhận** → Executions → lần chạy mới nhất.
4. S1 → hồ sơ khách → phần cảm nhận.

**Chỉ vào:** đánh giá gốc, cảm xúc AI phân tích, tóm tắt, gợi ý bước tiếp; sự kiện `FEEDBACK_RECEIVED`, `FEEDBACK_ANALYZED`.

**Nói:**

> Backend lưu phản hồi trước, rồi gọi luồng 5. AI đọc phản hồi, xác định cảm xúc, tóm tắt và gợi ý cho sale: khách vẫn quan tâm nhưng cần vị trí gần trung tâm. AI chỉ gợi ý, sale quyết định giới thiệu căn nào. Nếu khách chấm 1–2 sao thì luồng báo thêm cho quản lý.

## U5. Luồng 8: Mautic báo ngược về (2 phút)

**Thao tác:**

1. S4 → contact của khách → cộng điểm tay (Edit points, ví dụ +25 để vượt ngưỡng).
2. S3 → **Luồng 8: Mautic báo về** → Executions → lần chạy mới nhất.
3. Chỉ: nhận webhook → kiểm tra token → tìm lead theo contact → cập nhật điểm Mautic → ghi sự kiện → báo sale.
4. Telegram nhóm sale: tin báo khách tương tác cao.
5. S1: hồ sơ khách có **điểm Mautic** cạnh điểm AI.

**Nói:**

> Luồng 7 đẩy hồ sơ sang Mautic, luồng 8 đi chiều ngược lại. Khi khách mở email, bấm link hoặc xem trang căn nhà, Mautic cộng điểm và báo về n8n. Điểm vượt ngưỡng thì báo sale gọi ngay.
>
> Hai điểm khác nhau: **điểm AI** là đánh giá lúc đăng ký (ngân sách, nhu cầu), **điểm Mautic** là mức tương tác về sau. Ở đây em cộng điểm tay để minh hoạ cho nhanh, thực tế điểm tăng theo quy tắc chấm điểm cấu hình trong Mautic.

Không nói "khách mở email là chắc chắn đã đọc" hay "luôn báo trong vài giây".

## U6. Luồng 4: báo cáo tuần bằng AI Agent (2 phút)

**Thao tác:**

1. S5 → **Tạo báo cáo ngay**.
2. Trong lúc chờ: S3 → **Luồng 4: Báo cáo** (Editor). Chỉ: 3 trigger (thứ Hai 8h / Chạy tay / webhook từ web) → số liệu tuần này, tuần trước → tính phễu và cảnh báo → **AI Agent** có tool tra cứu database.
3. Quay lại S5 → mở báo cáo vừa tạo. Chỉ một chỉ số, so sánh hai tuần, cảnh báo, đề xuất.
4. Gmail: email báo cáo gửi quản lý.

**Nói:**

> Luồng 4 chạy 8 giờ sáng thứ Hai, hoặc quản lý bấm tạo ngay. SQL tính số liệu cứng: số khách mới, tỉ lệ chốt lịch, đặt cọc, khách không mua, khách quá hạn. Quy tắc cố định sinh cảnh báo. Còn **AI Agent** viết nhận định và đề xuất, và khi cần thì tự gọi tool để tra thêm dữ liệu.
>
> Tool database dùng tài khoản **chỉ đọc**, nên dù AI tự viết câu truy vấn cũng không sửa hay xoá được dữ liệu.

Báo cáo chạy lâu thì mở báo cáo gần nhất và nói rõ ngày tạo.

---

## U7. Xin thầy chuyển sang local cho luồng 2 (30 giây)

**Nói (đọc gần nguyên văn):**

> Thưa thầy, luồng 2 em xin demo trên máy local. Có ba lý do:
>
> **Một, luồng 2 chạy theo thời gian thật.** Nó nhắc khách trước giờ xem 24 tiếng, hỏi cảm nhận sau buổi xem 2 tiếng, chăm sóc khách im lặng 3 ngày. Trên server muốn thấy đủ các ca thì phải chờ nhiều ngày. Ở local em nạp sẵn dữ liệu mẫu có mốc thời gian lùi lại (đăng ký 4 ngày trước, hỏi cảm nhận 4 ngày trước...), mà không phải sửa đồng hồ máy hay bỏ điều kiện lọc.
>
> **Hai, luồng 2 tự gửi email cho khách thật.** Trên server có dữ liệu khách thật; chạy luồng 2 ở đó là gửi email nhắc lịch, chăm sóc cho cả họ. Dữ liệu mẫu ở local chỉ dùng email của nhóm, và script dữ liệu mẫu có bước xoá lead `+demo`, nên chỉ được chạy ở local.
>
> **Ba, bản luồng 2 mới đang theo lịch phát hành `v0.3.1`.** Nhóm em phát hành theo quy trình: trước khi bật luồng 2 trên server phải chạy câu truy vấn xem trước luồng sẽ chọn ai, dọn hàng đợi email cũ của Mautic, tạo token và credential mới. *(Nếu đã phát hành: "Trên server luồng 2 đã bật từ ngày ..., em mở tab Executions cho thầy xem các lần chạy mỗi giờ, còn để thấy đủ các ca em chạy ở local.")*
>
> Code trên local giống hệt server, cùng repo, cùng file Docker Compose, cùng file workflow; chỉ khác dữ liệu.

**Thao tác:** chuyển sang tab L1, L2. Nói "Đây là máy local của em, địa chỉ localhost."

## U8. Luồng 2: giới thiệu (1 phút)

**Màn hình:** L2, n8n local → **Luồng 2: Follow-up** (Editor). Thu nhỏ để thấy cả luồng.

**Chỉ vào:** trigger **Mỗi giờ** và **Chạy tay** → **Lấy lead cần follow-up** → **Loop Over Items** → **Giữ tác vụ** → **AI soạn email** → các nhánh gửi (Email khách / Gửi Mautic nuôi dưỡng / Thông báo nhân viên) → **Hoàn tất tác vụ** → **Email báo cáo quản lý**.

**Nói:**

> Luồng 2 chạy mỗi giờ, câu SQL tìm các việc đến hạn, có 9 loại: nhắc lịch trước 24 giờ, hỏi cảm nhận sau buổi xem, nhắc sale duyệt khách chờ lâu, nhắc sale ghi nhận khách có đến không và báo quản lý nếu quá 24 giờ chưa ghi, đóng lịch quá hạn không ai xử lý, và với khách im lặng 3 ngày sau buổi xem: HOT thì nhắc sale gọi, WARM đưa vào chiến dịch nuôi bên Mautic, COLD đưa vào bản tin hằng tháng.
>
> Điểm quan trọng là **chống gửi trùng**. Mỗi việc là một dòng trong bảng `followup_tasks`. Trước khi gửi, n8n phải **giữ tác vụ** qua backend; backend khoá lead, kiểm tra lại điều kiện rồi mới cho gửi. Hai lần chạy chồng nhau cũng không gửi hai lần. Gửi xong mà mất phản hồi thì tác vụ chuyển **REVIEW** để người kiểm tra, không tự gửi lại.

## U9. Luồng 2: chạy thật (3 phút)

**Thao tác:**

1. Bấm **Execute workflow** từ trigger **Chạy tay**.
2. Mở output node **Lấy lead cần follow-up** (chọn Table). Chỉ cột `type`: REMINDER, ATTENDANCE_CHECK, STAFF_NUDGE, WARM_NUDGE cùng tên 4 khách mẫu.

   > Lần chạy này chọn được 4 việc, mỗi việc một loại khác nhau, đi vào các nhánh khác nhau.

3. **REMINDER** (Nguyễn Văn Nhắc): Gmail → email nhắc lịch gửi `+demo1`. L1 → hồ sơ khách → `REMINDER_SENT`.

   > Khách có lịch xem sau 5 giờ nữa nên nhận email nhắc. AI soạn nội dung; nếu AI lỗi hoặc trả sai định dạng thì dùng mẫu dự phòng, không bỏ email.

4. **STAFF_NUDGE** và **ATTENDANCE_CHECK**: Telegram nhóm sale / email nhân viên.

   > Lê Minh Ấm đăng ký 4 ngày mà sale chưa duyệt, hệ thống nhắc sale. Trần Thị Cảm đã qua giờ xem 2 ngày mà chưa ai ghi nhận khách có đến không, hệ thống nhắc sale ghi nhận. Luồng **không tự đoán** khách đã xem; người phải xác nhận.

5. **WARM_NUDGE** (Phạm Thị Lặng): L3 Mautic local → Contacts → `+demo4` → chỉ field `ai_nudge_text` và tag `nuoi-warm` → **Segments** → **Nuôi WARM** có khách này.

   > Khách WARM đã xem nhà, có đồng ý nhận tin, 4 ngày không trả lời. AI viết một đoạn cá nhân hoá vào field `ai_nudge_text`, gắn tag `nuoi-warm`; Mautic tự đưa vào phân khúc Nuôi WARM và chạy chuỗi email của chiến dịch. Email nhắc lịch là n8n gửi, email nuôi dưỡng là Mautic gửi. Khách không tick đồng ý nhận tin thì không vào nhánh này, theo Nghị định 13 về dữ liệu cá nhân.

6. Gmail: **email báo cáo quản lý** của luồng 2 (bao nhiêu việc thành công, bỏ qua, lỗi).

7. **Chứng minh chống trùng:** bấm **Execute workflow** lần nữa → node cuối ra **Không có tác vụ đến hạn** (`NO_TASKS`).

   > Chạy lại ngay thì không gửi gì nữa, vì các tác vụ đã ở trạng thái hoàn tất.

8. (Nếu còn thời gian) L4 terminal:

   ```bash
   docker compose -p realestate-ai-agent exec db psql -U realestate -d realestate -c "select id, lead_id, type, state from followup_tasks order by id desc limit 6"
   ```

   > Bảng tác vụ: mỗi việc một dòng, trạng thái `COMPLETED`.

## U10. Tổng kết (30 giây)

**Màn hình:** quay về S1 (server) → trang **Tổng quan** admin (phễu, tỉ lệ chốt).

**Nói:**

> Tóm lại phần em: luồng 7 đồng bộ khách sang Mautic, luồng 2 chăm sóc đúng lúc và không gửi trùng, luồng 5 phân tích cảm nhận, luồng 8 nhận tín hiệu tương tác ngược về, luồng 4 tổng hợp báo cáo cho quản lý. Cùng phần của bạn Hoàng, hệ thống tự động cả vòng đời khách, AI hỗ trợ còn người ra quyết định, và mọi bước đều có log để kiểm tra. Nhóm em xin hết, mời thầy đặt câu hỏi.

---

## Nếu có sự cố

| Sự cố | Làm gì, nói gì |
|---|---|
| Luồng 2 ra `NO_TASKS` ngay lần đầu | Đã lỡ chạy trước. Nạp lại `demo-follow-up.sql` (10 giây) rồi chạy lại. Hoặc mở ảnh chụp dự phòng và nói rõ "đây là lần chạy lúc ... giờ" |
| Không có execution luồng 7 trên server | Kiểm tra lead đã thật sự đổi trạng thái. Không mở URL webhook trên thanh địa chỉ (đó là GET, webhook nhận POST). Chuyển sang demo luồng 7 ở local |
| Luồng 8 trên server trả 403 | Bản cũ/thiếu token, thuộc `v0.3.1`. Chuyển luồng 8 vào phần local |
| Gemini chậm | Trong lúc chờ giải thích node tiếp theo; quá 1 phút thì mở execution thành công trước đó |
| Email chưa đến | Mở node gửi email trong execution, chỉ output đã gửi thành công |

## Câu hỏi thầy có thể hỏi

| Câu hỏi | Trả lời ngắn |
|---|---|
| Sao không demo luồng 2 trên server? | Ba lý do ở U7: chạy theo thời gian thật, gửi email cho khách thật, đang theo lịch phát hành `v0.3.1`. Code giống hệt, chỉ khác dữ liệu |
| Sao cần cả backend lẫn n8n? | Backend giữ quy tắc nghiệp vụ, quyền và dữ liệu; n8n điều phối lịch chạy, AI, email và cho xem từng bước. Quy tắc trước khi gửi của luồng 2 được backend kiểm tra lại |
| Mautic khác n8n chỗ nào? | n8n điều phối giữa các hệ thống; Mautic quản lý contact, phân khúc, chiến dịch và đo tương tác |
| Có đảm bảo không bao giờ gửi trùng? | Có khoá tác vụ và checkpoint nên chạy chồng không gửi hai lần. SMTP mất phản hồi đúng lúc thì không biết đã gửi chưa, khi đó tác vụ vào REVIEW cho người kiểm tra thay vì tự gửi lại |
| AI lỗi thì sao? | Đầu ra AI được kiểm tra; sai định dạng hoặc lỗi thì dùng mẫu dự phòng. Lỗi database hay dịch vụ gửi thì ghi lỗi, chờ 6 giờ thử lại; luồng lỗi hẳn thì Error workflow báo quản lý |
| WARM là tự động gửi quảng cáo? | Không. Phải đã xem nhà, có đồng ý nhận tin, im lặng hơn 3 ngày sau khi được hỏi cảm nhận, chưa từng vào chiến dịch |
| AI Agent ở đâu, khác gì gọi AI thường? | Luồng 4: Agent tự quyết định gọi tool tra database. Luồng 2, 5 gọi AI ở một bước cố định trong quy trình |
| Phần nào em tự làm? | API và dữ liệu backend (followups, feedbacks, reports, phân quyền), luồng 2, 4, 5, 7, 8, cấu hình Mautic. n8n, Mautic, Gemini, NestJS là công cụ sử dụng |

## Câu tránh nói

- "Không bao giờ lỗi / không bao giờ gửi trùng": nói cơ chế và giới hạn.
- "Gắn tag là khách đã nhận email chiến dịch": chỉ nói khi thấy lịch sử gửi trong Mautic.
- "Tất cả luồng đều là AI Agent": chỉ luồng 4 (và luồng 6 của Hoàng) là Agent có tool.
- "Luồng 2 đang chạy trên server": chỉ nói khi `v0.3.1` đã xong và thấy execution trên server.
