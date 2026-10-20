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
