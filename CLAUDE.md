# CLAUDE.md — đọc trước khi làm việc trong repo này

## Nhánh `dev` là gì? (đừng nhầm với `main`)

| Nhánh | Vai trò |
|---|---|
| `main` | Bản của nhóm, **là bản được chấm**. Tài liệu ở đây (`README.md`, `docs/api-contract.md`, `docs/tong-quan-du-an.md`, `docs/tuan-*.md`) giữ nguyên, không sửa. |
| `dev` | **Bản mẫu chạy ở local** để xem toàn cảnh hệ thống khi đã làm đủ. Không push, không deploy. Sau này nhóm làm lại trên `main` dựa theo `dev`. |

### Quy tắc đọc tài liệu khi đang ở `dev`

Trên `dev`, các file có hậu tố `-dev` và thư mục `docs/luong/` **thay thế** file cùng tên của `main`:

| Đọc cái này (dev) | Thay cho (main) |
|---|---|
| `README-dev.md` | `README.md` |
| `docs/api-contract-dev.md` | `docs/api-contract.md` |
| `docs/luong/*.md` | mục "Bốn luồng n8n" trong `docs/tong-quan-du-an.md` |
| `docs/use-cases.md` | (mới, chỉ có ở `dev`) |

Các file cũ vẫn nằm đó **để đối chiếu với `main`**, nhưng trên `dev` có thể đã lỗi thời. Khi hai bên mâu thuẫn, bản `-dev` thắng.

## Quy trình Git trên `dev`

```
main ──► dev ──► feature/<việc> ──(merge --no-ff, local)──► dev
```

- Mỗi tính năng một nhánh `feature/...`, `fix/...` hoặc `docs/...`, tạo **từ `dev`**.
- Làm xong, kiểm tra, rồi `git merge --no-ff` vào `dev` và xoá nhánh feature. Không dùng Pull Request.
- **Không push, không đụng `main`** trừ khi người dùng yêu cầu rõ.
- Commit nhỏ, tiếng Việt không dấu hoặc tiếng Anh đều được, tiền tố `feat:` `fix:` `docs:` `chore:`.
- Không commit `.env`, khoá, `node_modules`, file build.

## Ngôn ngữ

Trả lời và viết tài liệu bằng **tiếng Việt**. Mỗi luồng n8n phải có file trong `docs/luong/` giải thích: luồng làm gì ngoài thực tế, nối với hệ thống thế nào, theo kiểu **swimlane** (sơ đồ Mermaid mỗi làn một bên tham gia) để người không rành kỹ thuật đọc được.

## Kiến trúc nhanh

Web (Next.js, `web/`) → Backend (NestJS, `backend/`) → PostgreSQL. Backend gọi **webhook** sang n8n; n8n gọi AI (Gemini), gửi email (SMTP Gmail), rồi **gọi ngược API backend** (header `X-Webhook-Secret`). n8n được đọc DB trực tiếp, nhưng mọi thao tác **ghi** đi qua API backend. Chi tiết: `docs/api-contract-dev.md`.

## Lệnh thường dùng

```bash
docker compose up -d --build          # chạy toàn bộ (db, n8n, backend, web)
cd backend && npm run build && npm run lint && npm test
cd web && npm run lint && npm run build
```

Cổng: web 3000, backend 8081 (`/api`, Swagger `/api/docs`), n8n 5678.

## Lưu ý khi chạy thử

- Gemini và email là dịch vụ thật: chạy thử sẽ gửi email thật vào hộp thư nhóm và tốn quota.
- Backend dùng `synchronize: true`: thêm bảng/cột tự động vào DB local.
- Bản sao lưu DB/n8n trước khi làm `dev` nằm ngoài repo: `../_backup-realestate/2026-10-17/`.
- Workflow n8n sửa bằng file JSON trong `n8n-workflows/`, rồi import vào n8n bằng `docker exec`. Luồng 2 trong n8n local đang để `inactive` (tắt), bật khi cần chạy tự động.
