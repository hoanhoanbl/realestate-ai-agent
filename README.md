# realestate-ai-agent

**AI Real Estate Agent**: đặt lịch xem nhà, ký hợp đồng đặt cọc online, chăm sóc khách và báo cáo kinh doanh, tự động hoá bằng n8n. Đồ án môn Chuyên đề 2: No-code / Low-code Automation.

> Bạn đang ở nhánh **`dev`**: bản mẫu đầy đủ chạy ở local để xem toàn cảnh. Nhánh `main` là bản được chấm, đang được làm lại dựa theo bản này. Xem `CLAUDE.md`.

## Đọc gì trước

| Muốn biết | Đọc |
|---|---|
| Cách chạy, tài khoản đăng nhập, các trang web | [README-dev.md](README-dev.md) |
| Hệ thống làm gì, bài toán, kiến trúc | [docs/tong-quan-du-an.md](docs/tong-quan-du-an.md) |
| Từng luồng n8n làm gì ngoài thực tế (sơ đồ swimlane) | [docs/luong/](docs/luong/) |
| API, dữ liệu, webhook | [docs/api-contract-dev.md](docs/api-contract-dev.md) |
| Use case của 3 actor | [docs/use-cases.md](docs/use-cases.md) |
| Hai người chia việc, quy tắc Git | [docs/phoi-hop.md](docs/phoi-hop.md) |
| App nhân viên (Expo) | [app/README.md](app/README.md) |

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `backend/` | NestJS + PostgreSQL: API, đăng nhập, gọi n8n |
| `web/` | Next.js: web khách và web admin |
| `app/` | Expo: app nhân viên |
| `n8n-workflows/` | Workflow n8n (JSON export) |
| `docs/` | Tài liệu |
| `docker-compose.yml` | PostgreSQL + n8n + backend + web |
