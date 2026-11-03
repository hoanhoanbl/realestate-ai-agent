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
