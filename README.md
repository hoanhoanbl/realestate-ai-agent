# realestate-ai-agent

AI Real Estate Agent - dat lich xem nha, cham diem khach tiem nang bang AI, nhac follow-up. Du an mon Chuyen de 2: No-code / Low-code Automation (n8n).

## Luong chinh

- **Luong 1 (dat lich):** khach dang ky xem nha (web) -> Backend luu DB -> webhook sang n8n -> AI cham diem (HOT/WARM/COLD) -> email "da nhan yeu cau" cho khach, email cho nhan vien (moi muc) kem nut Duyet / Doi gio -> n8n goi lai Backend cap nhat ket qua -> nhan vien bam Duyet -> email chot lich, lead `CONFIRMED`.
- **Luong 2 (follow-up, moi gio):** nhac lich truoc 24h, hoi cam nhan sau buoi xem, nhac khach WARM im lang; chong gui trung nho bang `lead_events`.
- **Error workflow:** luong nao loi thi gui email bao quan ly.

## Bản đồ tài liệu

Mọi quy tắc, ngoại lệ và bước làm tay đều nằm trong `docs/`. Đọc theo nhu cầu:

| Cần biết | Đọc |
|---|---|
| Dự án làm gì, các luồng, lộ trình | [docs/tong-quan-du-an.md](docs/tong-quan-du-an.md) |
| Ai làm gì tuần này, mã nhánh, mốc phát hành | [docs/danh-sach-task.md](docs/danh-sach-task.md) |
| Quy tắc nghiệp vụ: vai trò và trạng thái, quy trình 1 tiếp nhận, 2 đặt lịch đến đặt cọc, 3 chăm sóc khách và báo cáo | [docs/nghiep-vu/](docs/nghiep-vu/) |
| Từng luồng n8n chạy thế nào (khung chung và bảng 12 luồng) | [docs/luong/README.md](docs/luong/README.md) |
| Định dạng API giữa web, backend và n8n | [docs/api-contract.md](docs/api-contract.md) |
| Quy ước giao diện web (component, điện thoại, icon, font) | [docs/giao-dien-web.md](docs/giao-dien-web.md) |
| Cách tạo nhánh, mở PR, phát hành | [docs/quy-trinh-git.md](docs/quy-trinh-git.md) |
| Đưa code lên server, bước làm tay mỗi bản phát hành, xử lý sự cố | [docs/trien-khai.md](docs/trien-khai.md) |
| Cài và cấu hình Mautic (mở rộng, phát triển sau) | [docs/mautic-setup.md](docs/mautic-setup.md) |
| Lỗ hổng còn lại, xếp theo vòng đời khách | [docs/danh-sach-lo-hong.md](docs/danh-sach-lo-hong.md) |
| Tiếp nhận khách và phân công sale (đã chốt, chưa làm) | [docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md](docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md) |

## Cau truc

| Thu muc | Noi dung |
|---|---|
| `backend/` | API, ket noi PostgreSQL |
| `web/` | Giao dien web |
| `n8n-workflows/` | File workflow n8n (export JSON) |
| `docs/` | Tài liệu (xem bản đồ ở trên) |
| `docker-compose.yml` | PostgreSQL + n8n + backend + web |

## Chay local

1. Cai Docker Desktop.
2. Sao chep `.env.example` thanh `.env` va dien gia tri.
3. Chay:

```bash
docker compose up -d --build
```

4. Mo cac dia chi:
   - Web: http://localhost:3000
   - Backend (Swagger): http://localhost:8081/api/docs
   - n8n: http://localhost:5678

## Quy uoc Git

Xem [docs/quy-trinh-git.md](docs/quy-trinh-git.md): nhánh tạo từ `dev`, PR vào `dev`, phát hành `dev` → `main`. Không commit file `.env`.
