# Hướng dẫn hạ tầng và cấu hình Mautic 5

Tài liệu hạ tầng Marketing Automation (Mautic 5) cho dự án AI Real Estate Agent (Hậu sở hữu - Quyết định D-04).

---

## 1. Kiến trúc dịch vụ Mautic 5

Mautic 5 chia tách theo các container chuyên trách dựa trên hình mẫu chính thức `mautic/docker-mautic`:

| Service | Image | Vai trò | Cổng / Tài nguyên |
|---|---|---|---|
| `mautic_db` | `mysql:8.0` | CSDL MySQL riêng cho Mautic | Nội bộ (3306), không mở ra ngoài. Tối ưu RAM buffer pool 256M |
| `mautic_web` | `mautic/mautic:5-apache` | Giao diện web và REST API Mautic (`DOCKER_MAUTIC_ROLE=mautic_web`) | Cổng `8082` (local) hoặc qua Caddy reverse proxy |
| `mautic_worker` | `mautic/mautic:5-apache` | Tiêu thụ message queue ngầm (`DOCKER_MAUTIC_ROLE=mautic_worker`) | Chạy lệnh `mautic_worker` |
| `mautic_cron` | `mautic/mautic:5-apache` | Chạy tác vụ định kỳ tự động (`DOCKER_MAUTIC_ROLE=mautic_cron`) | Chạy lệnh `mautic_cron` |

> **Lưu ý quan trọng về vai trò container:** Entrypoint của image Mautic xác định vai trò chạy thông qua biến môi trường `DOCKER_MAUTIC_ROLE`. Phải cấu hình rõ ràng biến này trong file compose để tránh trường hợp worker và cron chạy nhầm vai trò web Apache.

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
4. **Data Type**: `Textarea` (trong Mautic 5 hiển thị là `Text: Paragraph`)
5. **Group**: `Core`
6. **Object**: `Contact`
7. **Available for use**: `Yes`, **Required**: `No`, **Publicly updatable**: `No`
8. Bấm **Save & Close**.
9. Khi soạn Email Template trong Mautic, chèn mã token: `{contactfield=ai_nudge_text}` vào vị trí lời khuyên cá nhân hoá.

### 7.2. Tạo Segment "Nuôi WARM (Lead Tiềm Năng)"
1. Vào **Segments** > Bấm **New**.
2. **Name**: `Nuôi WARM (Lead Tiềm Năng)`
3. **Alias**: `nuoi-warm`
4. Sang tab **Filters**:
   - `Tags` **including**: `nuoi-warm`
   - VÀ `Tags` **excluding**: `DEPOSIT`, `SIGNED`, `LOST`
5. Bấm **Save & Close**.

*Lưu ý:* Tag `WARM` chỉ phân loại mức tiềm năng và được L7 đồng bộ ngay sau khi AI chấm điểm. Không dùng riêng tag này để đưa khách vào chiến dịch. L2 chỉ gắn `nuoi-warm` khi khách đã xem nhà, đồng ý nhận tiếp thị, được hỏi cảm nhận hơn 3 ngày, chưa gửi cảm nhận và chưa bắt đầu nuôi dưỡng.

### 7.3. Tạo Segment "Bản tin hằng tháng" (Khách COLD & Form nhận tin)
1. Vào **Segments** > Bấm **New**.
2. **Name**: `Bản tin hằng tháng`
3. **Alias**: `ban-tin-hang-thang`
4. Sang tab **Filters**:
   - `Tags` **including**: `ban-tin-hang-thang`
5. Bấm **Save & Close**.

*Lưu ý:* Segment này dùng chung cho khách đăng ký qua Form web (FE-21) và khách mức `COLD` đủ điều kiện được Luồng 2 chuyển sang (FE-30).

### 7.4. Tạo Webhook Báo động hành vi sang Luồng 8 n8n
1. Vào **Settings** > **Webhooks** > Bấm **New**.
2. **Name**: `Báo động hành vi Mautic sang n8n`
3. **Webhook POST Url**: `http://n8n:5678/webhook/mautic-event?token=<MAUTIC_WEBHOOK_SECRET>` (local) hoặc `https://n8n.<domain>/webhook/mautic-event?token=<MAUTIC_WEBHOOK_SECRET>` (server).
4. **Webhook Events**:
   - `Contact Page Hit` (mautic.page_on_hit)
   - `Contact Points Changed` (mautic.lead_points_change)
   - `Contact Email Opened` (mautic.email_on_open)
5. Bấm **Save & Close**.

---

## 8. Cấu hình Mautic Server & Trạng thái Thực tế (FE-22)

### 8.1. Bảng đối chiếu thành phần trên Mautic Server

| Thành phần | Tên / Mô tả | Định danh / ID trên Server | Trạng thái |
|---|---|---|---|
| Custom Field | `AI Nudge Text` (`ai_nudge_text`), kiểu Text: Paragraph | Field ID `44` | Đã tạo, sẵn sàng |
| Segment WARM | `Nuôi WARM (Lead Tiềm Năng)`, alias `nuoi-warm` | Segment ID `1` | Đã tạo, bộ lọc chuẩn |
| Segment bản tin | `Bản tin hằng tháng`, alias `ban-tin-hang-thang` | Chưa tạo trên server (local: ID `2`) | Chưa tạo trên server. Sẽ tạo với lọc tag `ban-tin-hang-thang` |
| Email 01 | `FE-22 \| Nuôi WARM \| 01 Hỏi thăm` (Triggered email) | Email ID `1` | Đã tạo HTML + text, token hợp lệ |
| Email 02A | `FE-22 \| Nuôi WARM \| 02A Đã mở` (Triggered email) | Email ID `2` | Đã tạo HTML + text |
| Email 02B | `FE-22 \| Nuôi WARM \| 02B Chưa mở` (Triggered email) | Email ID `3` | Đã tạo HTML + text |
| Campaign | `FE-22 \| Nuôi WARM sau xem nhà` | Campaign ID `1` | Đã tạo luồng rẽ nhánh; **Inactive** |
| Webhook L8 | `n8n Luong 8` gửi sang Luồng 8 n8n | Webhook ID `1` | Đã tạo |

### 8.2. Nội dung 3 mẫu Email nuôi WARM

Tạo bằng **Channels → Emails → New → Triggered email → Code Mode** (Email type: **Marketing**):

| Email | Tiêu đề (Subject) | Nội dung & Token |
|---|---|---|
| **01** | Anh/chị muốn điều chỉnh tiêu chí tìm nhà như thế nào? | Lời chào `{contactfield=firstname\|bạn}`, đoạn AI `{contactfield=ai_nudge_text}`, link căn nhà mẫu, `{unsubscribe_text}` |
| **02A** | Ba tiêu chí giúp chọn căn nhà phù hợp hơn | Gợi ý khu vực, ngân sách, số phòng; mời chia sẻ tiêu chí ưu tiên |
| **02B** | Anh/chị còn cần hỗ trợ tìm nhà không? | Nhắc nhẹ cập nhật nhu cầu; nếu không cần có thể bấm hủy nhận |

### 8.3. Sơ đồ Chiến dịch Campaign Nuôi WARM

**Campaigns → FE-22 | Nuôi WARM sau xem nhà → Launch Campaign Builder**:

```text
Nguồn Contact: Segment "Nuôi WARM" (Segment ID 1)
  │
  └──► [Hành động 01]: Gửi Email 01 (Gửi ngay, Marketing)
         │
         └──► [Quyết định 02]: Khách có mở Email 01?
                │
                ├──► [Nhánh YES]: Sau 3 ngày kể từ lúc mở ──► Gửi Email 02A (Gợi ý tiêu chí)
                │
                └──► [Nhánh NO] : Sau 3 ngày không mở     ──► Gửi Email 02B (Nhắc nhẹ)
```

- **Allow contacts to restart the campaign**: `No`.
- **Trạng thái**: `Inactive` (chỉ kích hoạt Active khi triển khai bản phát hành `v0.3.1`).

### 8.4. Quy trình triển khai và lưu ý kỹ thuật (v0.3.1)

Các bước chi tiết triển khai n8n và kích hoạt Luồng 2 được tập trung quản lý duy nhất tại **Mục 9 của tài liệu triển khai**:  
👉 [docs/trien-khai.md#9-bản-v031](trien-khai.md#9-bản-v031)

**Lưu ý quan trọng về hàng đợi và vai trò container:**
1. **Trước khi merge release dev → main**:
   - Sao lưu CSDL Mautic trước: `/root/realestate-backup.sh`.
   - Kiểm tra và đếm tin chờ trong bảng `messenger_messages` (chi tiết lệnh ở [docs/trien-khai.md#9-bản-v031](trien-khai.md#9-bản-v031)):
     ```bash
     docker exec realestate-mautic-db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -e "SELECT queue_name, count(*) FROM messenger_messages GROUP BY queue_name;"'
     ```
   - Xử lý / dọn dẹp các tin nhắn thử nghiệm cũ tồn đọng trước khi merge, tránh việc worker tự động gửi email hàng loạt ngay khi container khởi động lại. (Thao tác này do Hoàng thực hiện trên server).
2. **Khi merge release vào main**:
   - CI tự động deploy lại toàn bộ stack container với các file compose cấu hình chuẩn (`docker-compose.prod.yml`, `docker-compose.mautic.yml`, `docker-compose.server.yml`). Không tự chạy lệnh `docker compose` tay riêng lẻ trên server để tránh sai tham số `-p realestate-ai-agent`.
3. **Sau khi deploy**:
   - Kiểm tra vai trò tiến trình trong container:
     - `docker top realestate-mautic-worker` $\rightarrow$ phải thấy tiến trình `messenger:consume` (không còn `apache2`).
     - `docker top realestate-mautic-cron` $\rightarrow$ phải thấy tiến trình `cron`.

### 8.5. Danh sách ca kiểm thử nghiệm thu (Hạn 8/11)

Các ca cần kiểm thử end-to-end trước khi chuyển Campaign sang **Active** và kích hoạt Luồng 2:

1. **Gửi thử email nội bộ**: Tạo contact test với email nội bộ (`nhadn2457+test<ngày>@gmail.com`), kích hoạt gửi Email 01.
2. **Thay thế token động**: Kiểm tra email nhận được phải hiển thị đúng tên `{contactfield=firstname|bạn}` và đoạn AI `{contactfield=ai_nudge_text}` (không còn sót lại mã `{...}`).
3. **Rẽ nhánh hành vi**:
   - Nhánh Đã mở: Mở email 01, sau 3 ngày hệ thống tự động gửi Email 02A.
   - Nhánh Chưa mở: Không mở email 01, sau 3 ngày hệ thống tự động gửi Email 02B.
4. **Loại trừ trạng thái chuyển đổi**: Khách hàng đã chuyển trạng thái sang `DEPOSIT` (đặt cọc), `SIGNED` (đã ký) hoặc `LOST` (không mua) phải được loại khỏi chiến dịch nuôi, không nhận tiếp các email marketing sau.
5. **Hủy nhận thư (Unsubscribe)**: Khách hàng bấm link `{unsubscribe_text}` phải được Mautic ghi nhận DNC (Do Not Contact) và ngừng gửi email marketing vĩnh viễn.

---

## 9. Tài liệu chính thức tham khảo

- [Mautic 5.2: Custom Fields](https://docs.mautic.org/en/5.2/contacts/custom_fields.html)
- [Mautic 5.2: Emails and Tokens](https://docs.mautic.org/en/5.2/channels/emails.html)
- [Mautic 5.2: Campaign Builder & Delays](https://docs.mautic.org/en/5.2/campaigns/campaign_builder.html)
- [Docker Mautic Official Image Environment Roles](https://github.com/mautic/docker-mautic)
