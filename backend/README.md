# Backend (NestJS + PostgreSQL)

API cho web, app và n8n. Cổng `8081`, tiền tố `/api`, Swagger tại `/api/docs`. Danh sách API và dữ liệu: [../docs/api-contract-dev.md](../docs/api-contract-dev.md).

## Cấu trúc `src/`

| Thư mục | Làm gì |
|---|---|
| `leads/` | Khách, kết quả AI, trạng thái, dòng thời gian (`lead_events`), duyệt lịch |
| `viewings/` | Đặt lịch xem nhà (gọi n8n), lịch xem, đổi giờ |
| `properties/` | Căn nhà; thêm, sửa, ẩn (quản lý) |
| `auth/`, `users/` | Đăng nhập JWT, phân vai `SALE` / `MANAGER`, guard cho người dùng và cho n8n (`X-Webhook-Secret`), push token |
| `feedback/` | Cảm nhận của khách (luồng 5) |
| `contracts/` | Hợp đồng đặt cọc và ký online (luồng 3) |
| `reports/` | Báo cáo tuần (luồng 4) |
| `stats/` | Số liệu tổng quan |
| `n8n/` | `N8nService`: gọi webhook của n8n và bấm "link tiếp tục" của lần chạy đang chờ |

## Chạy

Cách đơn giản nhất là cả hệ thống bằng Docker: `docker compose up -d --build` ở thư mục gốc. Chạy riêng backend:

```bash
cp .env.example .env     # điền giá trị; DB_HOST=localhost khi chạy ngoài Docker
npm install
npm run start:dev
```

## Kiểm tra

```bash
npm run build && npm run lint
```

`npm test` hiện **không chạy được** (NestJS 12 chỉ có dạng ESM, Jest 30 với TypeScript 6 không nạp được; các file `*.spec.ts` chỉ là mẫu sinh tự động). Kiểm tra bằng build, lint và gọi API thật bằng `curl` hoặc chạy luồng n8n.

## Dữ liệu mẫu

- 10 căn nhà được tạo tự động khi khởi động lần đầu.
- Hai tài khoản mẫu (quản lý, nhân viên): mật khẩu lấy từ `SEED_USER_PASSWORD`.
- `sql/demo-follow-up.sql`: tạo khách mẫu cho luồng 2 và hợp đồng.
- `sql/readonly-role.sql`: tài khoản database chỉ đọc cho AI Agent của luồng 4.
