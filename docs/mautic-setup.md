# Hướng dẫn hạ tầng và cấu hình Mautic 5

Tài liệu hạ tầng Marketing Automation (Mautic 5) cho dự án AI Real Estate Agent (Hậu sở hữu - Quyết định D-04).

---

## 1. Kiến trúc dịch vụ Mautic 5

Mautic 5 chia tách theo các container chuyên trách dựa trên hình mẫu chính thức `mautic/docker-mautic`:

| Service | Image | Vai trò | Cổng / Tài nguyên |
|---|---|---|---|
| `mautic_db` | `mysql:8.0` | CSDL MySQL riêng cho Mautic | Nội bộ (3306), không mở ra ngoài. Tối ưu RAM buffer pool 256M |
| `mautic_web` | `mautic/mautic:5-apache` | Giao diện web và REST API Mautic | Cổng `8082` (local) hoặc qua Caddy reverse proxy |
| `mautic_worker` | `mautic/mautic:5-apache` | Tiêu thụ message queue ngầm (campaign events, email sending) | Chạy lệnh `mautic_worker` |
| `mautic_cron` | `mautic/mautic:5-apache` | Chạy tác vụ định kỳ tự động (cron triggers, segments rebuild) | Chạy lệnh `mautic_cron` |

---

## 2. Cách khởi động Mautic

### 2.1. Ở môi trường local:
Khởi động kết hợp cùng hệ thống chính:
```bash
docker compose -f docker-compose.yml -f docker-compose.mautic.yml up -d
```
Hoặc chỉ chạy Mautic độc lập nếu đã có network:
```bash
docker compose -f docker-compose.mautic.yml up -d
```

### 2.2. Kiểm tra container đang chạy:
```bash
docker ps --filter "name=mautic"
```

Truy cập giao diện: `http://localhost:8082`

---

## 3. Cài đặt ban đầu qua trình duyệt (Wizard)

1. Mở `http://localhost:8082` (hoặc `https://mautic.<domain>` trên server).
2. **Bước 1: Database Setup**
   - Database Host: `mautic_db`
   - Database Port: `3306`
   - Database Name: `mautic`
   - Database User: `mautic` (hoặc giá trị trong `.env`)
   - Database Password: `mautic_123456` (hoặc giá trị trong `.env`)
   - Bấm **Next Step**.
3. **Bước 2: Admin User Setup**
   - Tạo tài khoản Admin (Email: `nhadn2457@gmail.com`, username, password).
4. **Bước 3: Email Settings**
   - Cấu hình SMTP Gmail nhóm hoặc chọn gửi sau trong Settings.
5. **Kích hoạt REST API**:
   - Vào **Settings (Bánh răng)** > **Configuration** > **API Settings**:
     - *API enabled*: **Yes**
     - *Enable HTTP basic auth*: **Yes** (dành cho n8n gọi nhanh) hoặc tạo OAuth2 credentials.
     - Lưu lại.

---

## 4. Cấu hình Caddy (Dành cho Hoàng deploy lên server)

Thêm khối sau vào file `Caddyfile` trên server để trỏ subdomain `mautic.`:

```caddyfile
mautic.ten-mien-cua-ban.com {
    reverse_proxy mautic_web:80
}
```

*Lưu ý:* Khi chạy cùng compose prod, lệnh deploy thêm file compose Mautic:
```bash
docker compose -f docker-compose.prod.yml -f docker-compose.mautic.yml up -d
```

---

## 5. Sao lưu và Khôi phục Volume MySQL Mautic

### 5.1. Sao lưu (Backup DB ra file .sql):
```bash
docker exec realestate-mautic-db mysqldump -u mautic -pmautic_123456 mautic > mautic_backup_$(date +%Y%m%d).sql
```

### 5.2. Khôi phục (Restore):
```bash
docker exec -i realestate-mautic-db mysql -u mautic -pmautic_123456 mautic < mautic_backup_xxxx.sql
```

---

## 6. Tối ưu RAM cho Server (`realestate-vm`)

Server `realestate-vm` có 8 GB RAM:
- MySQL 8.0 được cấu hình:
  - `--innodb-buffer-pool-size=256M` (giới hạn cache RAM CSDL)
  - `--max-connections=50` (giới hạn kết nối đồng thời)
- Tổng tài nguyên Mautic (web + worker + cron + db) được giữ ổn định trong khoảng **1 - 1.2 GB RAM**, không gây quá tải server.


---

## 7. Cấu hình Trường tuỳ biến, Segment và Webhook (Luồng 2, 7, 8)

### 7.1. Tạo Custom Field `ai_nudge_text`
Để cá nhân hoá nội dung email nuôi WARM bằng lời khuyên từ Gemini:
1. Vào **Settings (Bánh răng)** > **Custom Fields** > Bấm **New**.
2. **Label**: `AI Nudge Text`
3. **Alias**: `ai_nudge_text` (phải trùng khớp với alias Luồng 2 n8n cập nhật qua API)
4. **Data Type**: `Textarea`
5. **Group**: `Core`
6. Bấm **Save & Close**.
7. Khi soạn Email Template trong Mautic, chèn mã token: `{contactfield=ai_nudge_text}` vào vị trí lời khuyên cá nhân hoá.

Trong giao diện Mautic 5.2.12 trên server, kiểu `Textarea` có tên hiển thị **Text: Paragraph**. Dùng Object **Contact**, Available for use **Yes**, Required **No**, Publicly updatable **No**; L2 cập nhật bằng API có xác thực, không cần bật sửa công khai qua tracking.

### 7.2. Tạo Segment "Nuôi WARM (Lead Tiềm Năng)"
1. Vào **Segments** > Bấm **New**.
2. **Name**: `Nuôi WARM (Lead Tiềm Năng)`
3. **Alias**: `nuoi-warm`
4. Sang tab **Filters**:
   - `Tags` **including**: `nuoi-warm`
   - VÀ `Tags` **excluding**: `DEPOSIT`, `SIGNED`, `LOST`
5. Bấm **Save & Close**.

Tag `WARM` chỉ phân loại mức tiềm năng và được L7 đồng bộ ngay sau khi AI chấm điểm. Không dùng riêng tag này để đưa khách vào chiến dịch. L2 chỉ gắn `nuoi-warm` khi khách đã xem nhà, đồng ý nhận tiếp thị, được hỏi cảm nhận hơn 3 ngày, chưa gửi cảm nhận và chưa bắt đầu nuôi dưỡng.

Nếu segment đã tồn tại, sửa bộ lọc theo điều kiện trên và kiểm tra lại danh sách contact cùng campaign đang dùng segment này trước khi chạy tiếp. Thay đổi file trong repo không tự cập nhật cấu hình Mautic trên server.

### 7.3. Tạo Webhook Báo động hành vi sang Luồng 8 n8n
1. Vào **Settings** > **Webhooks** > Bấm **New**.
2. **Name**: `Báo động hành vi Mautic sang n8n`
3. **Webhook POST Url**: `http://n8n:5678/webhook/mautic-event` (local) hoặc `https://n8n.<domain>/webhook/mautic-event` (server).
4. **Webhook Events**:
   - `Contact Page Hit` (mautic.page_on_hit)
   - `Contact Points Changed` (mautic.lead_points_change)
   - `Contact Email Opened` (mautic.email_on_open)
5. Bấm **Save & Close**.

Với bản L8 mới trong repo, URL phải thêm `?token=<MAUTIC_WEBHOOK_SECRET>` và token phải khớp node Cấu hình của L8. Đây là token riêng, không phải mật khẩu Mautic hoặc `WEBHOOK_SECRET` của backend. Không ghi token thật vào tài liệu, ảnh chụp hoặc Git. Cần đối chiếu bản L8 đang chạy trên server trước khi thay webhook đang dùng; xem [hướng dẫn L8](luong/luong-8-mautic-bao-ve.md).

## 8. FE-22 — Cấu hình trên server

Nhánh task: `feature/FE-22-mautic-server`, tạo từ `dev` tại commit `202d8b3`. Chỉ thay tài liệu này; nếu thật sự cần đổi workflow thì ghi rõ JSON và cách kiểm thử trong PR. Không merge trực tiếp vào `dev`. Đã đối chiếu lộ trình ở `dev` commit `df5871e` ngày 04/11: FE-22 thêm segment Bản tin hằng tháng; Hoàng chạy triển khai server, Hậu kiểm tra mục 9 của `docs/trien-khai.md`. Theo yêu cầu của Hậu, cấu hình/kiểm thử tiếp tục trên local trước; không tự merge, pull hoặc push.

### 8.1. Kết quả kiểm tra và thao tác ngày 04/11/2026

Các dòng “đã” dưới đây là kết quả quan sát/thao tác qua trình duyệt trên server ở phiên làm việc trước, không suy từ code local. Đây không phải kiểm tra lại trạng thái đang chạy sau các release tiếp theo; cần đối chiếu trực tiếp trước khi Hoàng triển khai. `docs/trien-khai.md` ở `dev` vẫn ghi chưa có field/campaign: hai bản ghi khác thời điểm cần được xác nhận lại, không tạo đối tượng trùng chỉ theo một bản ghi cũ.

| Thành phần | Kết quả | Định danh trên server |
|---|---|---|
| Mautic server | Truy cập và đăng nhập được, phiên bản 5.2.12 | `https://mautic.hoanhoan.hiennguyen.io.vn` |
| Website | Mở được, có danh sách căn nhà | `https://hoanhoan.hiennguyen.io.vn` |
| Custom field | Đã tạo `AI Nudge Text`, alias `ai_nudge_text`, Contact / Text: Paragraph, sử dụng được, không bắt buộc, không sửa công khai | field ID `44` |
| Segment | Có sẵn; đã kiểm tra bộ lọc đúng, giữ nguyên thay vì tạo trùng | `Nuôi WARM`, alias `nuoi-warm`, segment ID `1` |
| Email 01 | Đã tạo, Triggered email / Available for use | ID `1`, `FE-22 | Nuôi WARM | 01 Hỏi thăm` |
| Email 02A | Đã tạo, Triggered email / Available for use | ID `2`, `FE-22 | Nuôi WARM | 02A Đã mở` |
| Email 02B | Đã tạo, Triggered email / Available for use | ID `3`, `FE-22 | Nuôi WARM | 02B Chưa mở` |
| Campaign | Đã tạo và lưu nguồn + các bước rẽ nhánh; **Inactive**, chưa gửi thử | ID `1`, `FE-22 | Nuôi WARM sau xem nhà` |
| Backend server | Swagger đang không có API `/api/followups/*`; cũng chưa thấy API ghi nhận attendance trong danh sách | `https://hoanhoan.hiennguyen.io.vn/api/docs` |
| n8n server | Mở được trang đăng nhập; chưa kiểm tra workflow bên trong khi chưa có phiên đăng nhập | `https://n8n.hoanhoan.hiennguyen.io.vn` |
| Bật L2 mới | **Chưa thực hiện**: cần backend tương thích, kiểm tra credential và chạy thử trước | Không coi FE-22 hoàn tất chỉ vì đã tạo campaign |

ID trên server có thể khác local. Không dùng số ID trong bảng này để ghi đè dữ liệu local.

### 8.2. Field và segment

**Custom Fields → AI Nudge Text:**

- Label: `AI Nudge Text`; Alias: `ai_nudge_text`.
- Object: Contact; Group: Core; Data Type: Text: Paragraph.
- Available for use: Yes; Required: No; Publicly updatable: No.
- Không đặt nội dung mặc định chứa thông tin một khách cụ thể.

**Segments → Nuôi WARM → Edit → Filters:**

```text
Tags including nuoi-warm
AND Tags excluding DEPOSIT
AND Tags excluding SIGNED
AND Tags excluding LOST
```

Segment Active = Yes; Visible to other users = Yes; Available in Preference Center = No. Không đổi điều kiện thành `WARM`, không nhập contact thủ công vào segment này vì contact thêm thủ công không tự bị loại bằng bộ lọc giống contact động.

**Segment Bản tin hằng tháng (bổ sung theo kế hoạch 04/11):**

- Alias và tag nhận danh sách: `ban-tin-hang-thang`. Bộ lọc: Tags **including** `ban-tin-hang-thang`.
- Đây là tag đăng ký riêng, không phải tag mức AI `COLD`. FE-21 cấp tag sau khi khách đồng ý đăng ký nhận tin; FE-30 sẽ cấp cho COLD đủ điều kiện và có đồng ý tiếp thị. Hai task này chưa được thực hiện trong FE-22.
- Người chỉ đăng ký nhận tin là contact Mautic, không tự tạo lead hoặc buổi xem trong backend.
- Local đã tạo segment ID 2, tag ID 14; để **Inactive** trong lúc chờ SMTP và ca kiểm thử. Không thêm vào campaign Nuôi WARM, không gửi hàng loạt cho các contact cũ.
- FE-22 chuẩn bị danh sách nhận tin; việc có segment không tự tạo lịch gửi bản tin hằng tháng. Chưa cấu hình một lịch gửi bản tin thực tế.
- Khi triển khai, đối chiếu tên/alias trên server rồi tạo nếu thiếu; không sao chép ID local. Email bản tin phải dùng loại Marketing và tôn trọng hủy nhận.

### 8.3. Nội dung email đã lưu

Tạo bằng **Channels → Emails → New → Triggered email → Code Mode**; nội dung nằm ở tab **Advanced → HTML Code**. Mỗi email có cả HTML và bản text. Khi gắn vào campaign phải dùng Email type **Marketing**, không đổi thành Transactional để vượt qua việc hủy nhận.

| Email | Subject | Nội dung chính |
|---|---|---|
| 01 | Anh/chị muốn điều chỉnh tiêu chí tìm nhà như thế nào? | Lời chào bằng firstname có fallback; đoạn AI; link căn nhà; mời phản hồi nhu cầu |
| 02A | Ba tiêu chí giúp chọn căn nhà phù hợp hơn | Khu vực, ngân sách, số phòng; mời chia sẻ tiêu chí ưu tiên |
| 02B | Anh/chị còn cần hỗ trợ tìm nhà không? | Nhắc nhẹ cập nhật nhu cầu; nếu không cần có thể hủy nhận |

Token đã dùng trong email 01:

```text
{contactfield=firstname|bạn}
{contactfield=ai_nudge_text|Anh/chị có muốn chia sẻ thêm tiêu chí về khu vực, ngân sách và số phòng để chúng tôi hỗ trợ tìm nhà phù hợp hơn?}
```

Footer HTML dùng `{unsubscribe_text}` và `{webview_text}`. Bản text có `{unsubscribe_url}`. Khi kiểm thử cần xác nhận token được thay bằng nội dung và link thật; trang preview chưa chọn contact có thể vẫn hiển thị token.

Hai link tham khảo đã đối chiếu với website server tại thời điểm cấu hình:

- `https://hoanhoan.hiennguyen.io.vn/nha/1` — Căn hộ Vinhomes Grand Park 2PN, TP.HCM.
- `https://hoanhoan.hiennguyen.io.vn/nha/10` — Căn hộ Studio Vinhomes Ocean Park, Hà Nội.

Đây là ví dụ tham khảo chung, không phải đề xuất tương tự đã cá nhân hóa theo ngân sách/khu vực của từng lead. Không ghi giá hoặc khẳng định căn vẫn còn khi chưa kiểm tra. Trước khi chạy cho khách thực, chọn nội dung/đường dẫn đúng phân khúc; thay link nếu căn ngừng bán.

### 8.4. Campaign đã lưu

**Campaigns → FE-22 | Nuôi WARM sau xem nhà → Edit → Launch Campaign Builder**:

```text
Contact source: Nuôi WARM (segment 1)
  → 01 | Gửi lời hỏi thăm cá nhân hóa
       Send email: email 1, immediately, Marketing
  → 02 | Có mở email hỏi thăm?
       Opens email (gắn dưới bước gửi email 01)
       ├ Yes → 03A | Sau 3 ngày từ lúc mở: gợi ý tiêu chí
       │         Send email: email 2, relative 3 days, Marketing
       └ No  → 03B | Sau 3 ngày chưa mở: nhắc nhẹ
                 Send email: email 3, within 3 days, Marketing
```

- Allow contacts to restart the campaign = No.
- Active = No trong lúc chờ kiểm thử và backend tương thích.
- Nhánh Yes chờ ba ngày kể từ việc mở được ghi nhận; nhánh No là thời hạn ba ngày không mở. Hai mốc không đồng nghĩa cùng ngày thứ ba tuyệt đối.
- Các bước gửi có Attempts = 3 theo mặc định Mautic; đây là retry của Mautic, độc lập checkpoint L2.
- Không có thêm email sau các bước 03A/03B trong cấu hình hiện tại. Chưa cấu hình nhánh ngày 7 gắn tag “nguội” hoặc thao tác tự thoát campaign; không giới thiệu chức năng đó là đã chạy.
- L7 gỡ tag `nuoi-warm` khi DEPOSIT/SIGNED/LOST, nhưng phải kiểm thử segment rebuild và campaign update thực sự loại contact trước khi tin rằng các bước chờ đã bị hủy. Có độ trễ cron; gỡ tag không phải xác nhận dừng tức thời.
- Việc ghi nhận mở email chỉ là tín hiệu hỗ trợ. Cộng điểm và webhook L8 là cấu hình riêng, không tự có chỉ vì tạo decision Opens email.

### 8.5. Điều kiện trước khi bật L2 mới trên server

Backend trên server chưa có API tác vụ trong lần kiểm tra này. Không import/publish bản L2 mới để gọi vào backend cũ, không bỏ node claim/checkpoint để ép chạy.

1. Release backend đã review qua PR theo [quy trình Git](quy-trinh-git.md), có module Followups và các thay đổi attendance tương ứng. Hoàng thực hiện deploy server theo phân công; FE-22 không tự merge `dev` vào `main`.
2. Kiểm tra Swagger có `/api/followups/claim`, `/{id}/start`, `/{id}/action-done`, `/{id}/complete`, `/{id}/fail`, `/{id}/resolve`. Kiểm tra database có bảng `followup_tasks` và cột attendance cần thiết. Swagger có route chưa chứng minh database đã sẵn sàng.
3. Đăng nhập n8n **server**, export bản L2 đang chạy để dự phòng. Dùng một bản L2 chính; không để lịch cũ và mới cùng xử lý khách vì bản cũ chưa có claim.
4. Import JSON đã review, đối chiếu cấu hình: backend nội bộ `http://backend:8081`, publicWebUrl `https://hoanhoan.hiennguyen.io.vn`, mauticUrl `https://mautic.hoanhoan.hiennguyen.io.vn/api`. Xác nhận các địa chỉ đó phù hợp network server thực tế.
5. Chọn credential Postgres đúng database server, Gemini, SMTP và Basic Auth Mautic server cho hai node Tìm contact nuôi dưỡng / Gửi Mautic Nuôi WARM. Chọn sub-workflow thông báo nhân viên và Error workflow thật đã publish; ID local không tự dùng được trên server.
6. `webhookSecret` phải khớp backend. Không đưa mật khẩu, token hoặc export credential vào PR. L8 mới cần token riêng theo mục 7.3 nếu được triển khai trong cùng release.
7. Chạy thử có kiểm soát với dữ liệu nội bộ; xác nhận email nhận thật, token được thay và tác vụ không lặp. Với L2 theo lịch, việc bật sẽ quét mọi khách đủ điều kiện, không chỉ khách thử.
8. Khi SMTP, cron/worker, backend và các ca kiểm thử đạt, kích hoạt campaign và publish L2, kiểm tra execution tiếp theo. Ghi giờ bật, workflow ID/version, task/contact thử và kết quả vào mục 8.6; không ghi secret.

### 8.6. Nghiệm thu còn phải thực hiện

| Ca | Kết quả cần thấy | Kết quả hiện tại |
|---|---|---|
| Preview email | HTML/text rõ ràng; tên và AI token được thay cho contact thử | Chưa kiểm thử với contact |
| SMTP thật | Một email thử tới địa chỉ nội bộ được người nhận xác nhận | Chưa gửi thử |
| WARM đủ điều kiện | VIEWED + viewing ATTENDED + consent + FEEDBACK_ASKED quá 3 ngày + chưa phản hồi; có field/tag và WARM_NURTURE_STARTED | Chưa chạy trên server |
| Không đồng ý / đã phản hồi | Không chuyển vào nhánh nuôi WARM | Chưa chạy trên server |
| Mức WARM đơn thuần | Không tự vào segment nếu thiếu nuoi-warm | Bộ lọc đã kiểm tra, chưa test bằng contact |
| L2 chạy lại | Tác vụ hoàn tất không gửi/chuyển lại | Chưa chạy trên server |
| Attendance | Chưa xác nhận đến xem thì nhắc nhân viên, không tự hỏi cảm nhận và không tự đổi VIEWED | Chưa chạy trên server |
| Rẽ nhánh campaign | Đã mở đi 02A; không mở trong thời hạn đi 02B, đúng độ trễ | Cấu trúc đã lưu, chưa chạy theo thời gian thật |
| Tiến triển/hủy nhận | DEPOSIT/SIGNED/LOST bị loại; contact hủy nhận không nhận email Marketing tiếp theo | Chưa chạy trên server |
| Bật lịch | Campaign Active và L2 Published, execution không lỗi API/credential | Chưa bật |

Trạng thái FE-22: **đã chuẩn bị field, kiểm tra segment và tạo campaign/email trên server; chưa nghiệm thu và chưa bật L2**. Chỉ chuyển task sang hoàn tất sau khi có kết quả thực tế cho các mục còn lại.

### 8.7. Tài liệu chính thức đã đối chiếu

- [Mautic 5.2: Custom Fields](https://docs.mautic.org/en/5.2/contacts/custom_fields.html).
- [Mautic 5.2: Email và token](https://docs.mautic.org/en/5.2/channels/emails.html).
- [Mautic 5.2: Tạo campaign](https://docs.mautic.org/en/5.2/campaigns/creating_campaigns.html).
- [Mautic 5.2: Campaign Builder, độ trễ và cron](https://docs.mautic.org/en/5.2/campaigns/campaign_builder.html).

## 9. Kiểm tra local và bàn giao FE-22 (04/11/2026)

Theo yêu cầu của Hậu, tiếp tục kiểm tra trên local trước; Hoàng triển khai server sau khi review và nhận thay đổi qua Git. **Pull code không sao chép cấu hình trong database Mautic/n8n**: field, segment, email, campaign và credential vẫn cần đối chiếu hoặc tạo trên từng môi trường theo mục 8.

### 9.1. Kết quả đã kiểm chứng

| Hạng mục | Kết quả |
|---|---|
| Kiểm tra JSON L2 | `node scripts/check-followup-workflow.cjs` đạt: tham chiếu node, nhánh lỗi, selector, nội dung dự phòng và tổng hợp |
| SQL chọn tác vụ | Fixture chạy trên database thử riêng, toàn bộ assertion đạt và kết thúc bằng `ROLLBACK` |
| Backend thử | Cổng `8083`, có đủ sáu route `/api/followups/*` và `/api/viewings/{id}/attendance` |
| Mautic local | Đã đăng nhập, v5.2.11; field `ai_nudge_text` có sẵn, đã dùng trong contact thử |
| Bản tin hằng tháng | Đã tạo segment ID 2/tag ID 14, lọc tag `ban-tin-hang-thang`, để Inactive |
| Email WARM local | Đã tạo ba Triggered email ID 1/2/3 tương ứng 01, 02A, 02B; có HTML và plain text, link dùng `localhost:3000` |
| Campaign local | ID 1, nguồn Nuôi WARM; email 01 ngay, quyết định mở email, nhánh Yes email 02A chờ 3 ngày, nhánh No email 02B trong 3 ngày; cả ba bước gửi dùng Marketing; Inactive, restart No |
| Thư mẫu | Sau khi sửa SMTP, gửi lại Send Example email 01 với contact thử riêng; Mautic hiển thị “Test emails have been sent”. Chờ người nhận xác nhận Inbox và token; chưa nghiệm thu campaign |

Các kiểm tra SQL không gửi email, không chứng minh SMTP/campaign đã chạy và không thay thế ca end-to-end.

### 9.1a. Hai vướng mắc gửi thư local đã xác định

1. **SMTP Mautic đã kiểm tra thành công:** ban đầu dùng `localhost:25`; sau khi cấu hình `smtp.gmail.com:587` (scheme `smtp`), Hậu tự nhập mật khẩu ứng dụng. Lỗi Gmail 535 được xác định do mật khẩu có ba dấu cộng thừa; nhập lại 16 chữ liền nhau và lưu thì Send test email hiển thị **Success!**, Hậu đã cung cấp ảnh xác nhận. Tài khoản đúng; `%40` trong DSN là mã hóa dấu `@`, còn `%%` trong file cấu hình là escape của Mautic/Symfony, không phải lỗi tài khoản. Kết quả này xác nhận kiểm tra SMTP, chưa nghiệm thu email campaign/token hoặc việc nhận thư trong Inbox. Credential SMTP trong n8n là cấu hình khác, không được Mautic dùng lại. Không ghi mật khẩu/DSN chứa mật khẩu vào repo.
2. **Worker/cron đang chạy sai vai trò:** kiểm tra tiến trình container `realestate-mautic-worker` thấy Apache; entrypoint của image chọn vai trò bằng biến `DOCKER_MAUTIC_ROLE`, không chỉ bằng `command: mautic_worker`. Cấu hình local hiện chỉ đặt command, nên tên container không chứng minh worker/cron hoạt động.

Vai trò cần đối chiếu khi triển khai: `mautic_web` dùng `DOCKER_MAUTIC_ROLE=mautic_web`, `mautic_worker` dùng `mautic_worker`, `mautic_cron` dùng `mautic_cron`. Hoàng kiểm tra file override của server trước khi thay đổi; FE-22 hiện chưa sửa file compose dùng chung hoặc tự bật worker để xử lý hàng đợi có thể chứa thư cũ. Trước khi bật worker, kiểm tra số lượng và người nhận thư đang chờ, chỉ dùng thư thử đã được cho phép. Chưa nghiệm thu việc rebuild segment, thực thi campaign hay gửi theo lịch.

Mẫu local hiện dùng link localhost, chỉ phù hợp kiểm thử trên máy này. Hoàng phải đổi link thành domain web server trước khi gửi trên server. Dữ liệu nhận thư thử chỉ lưu trong Mautic local; không ghi địa chỉ đó vào tài liệu bàn giao.

### 9.2. Vướng mắc dữ liệu khi nâng backend

Khi khởi động backend mới với database local hiện có, TypeORM không tạo được unique index `uq_contracts_active_property` do nhiều hợp đồng còn hiệu lực cùng căn nhà (ghi nhận ở `property_id = 2`). Không tự xóa hoặc đổi trạng thái hợp đồng để vượt lỗi này.

- Đã sao lưu database trước lần nâng backend; bản sao nằm ngoài repository.
- Backend local cổng `8081` đã được khôi phục bằng image build từ commit `603ecd5`; Swagger trả HTTP 200. Đây là bản nền cũ, chưa dùng để nghiệm thu L2 mới.
- Backend mới chạy riêng trong container `realestate-fe22-backend-test`, cổng `127.0.0.1:8083`, database `realestate_fe22_test_20261104`. Không chuyển web hoặc workflow đang chạy sang database thử.
- Trước khi Hoàng triển khai backend mới lên server, kiểm tra và xử lý hợp đồng trùng theo nghiệp vụ, sao lưu database rồi mới nâng phiên bản. Không suy ra server có dữ liệu trùng chỉ từ lỗi local.

Lệnh kiểm tra selector trong database thử (PowerShell, chạy tại gốc dự án):

```powershell
node scripts/check-followup-workflow.cjs
node scripts/check-followup-workflow.cjs --sql | docker exec -i realestate-db psql -U realestate -d realestate_fe22_test_20261104 -v ON_ERROR_STOP=1
```

Database thử phải tồn tại trước khi chạy. Fixture sử dụng bảng tạm và rollback; không thay `--sql` bằng truy vấn cập nhật khách thật.

### 9.3. Bàn giao cho Hoàng

1. Review nhánh `feature/FE-22-mautic-server` qua PR vào `dev`; không tự push thẳng `dev` hoặc tự deploy server.
2. Giải quyết điều kiện nâng backend ở mục 9.2 và xác nhận API/database tương thích theo mục 8.5.
3. Đối chiếu field, segment, ba email và campaign theo mục 8.1–8.4. ID chỉ đúng tại môi trường đã ghi nhận; không chép ID contact/email local sang server.
4. Chọn credential và sub-workflow thật của server; đổi toàn bộ URL local sang URL server tương ứng. Không đưa credential, mật khẩu SMTP, bản sao database hoặc địa chỉ người nhận thư thử vào Git.
5. Chạy các ca mục 8.6 bằng contact nội bộ, ghi kết quả thực tế trước khi bật lịch/campaign. Không bật bản L2 cũ đồng thời bản mới.

FE-22 vẫn đang thực hiện; chưa xác nhận hoàn tất gửi thư thật hoặc bật L2 trên server.
