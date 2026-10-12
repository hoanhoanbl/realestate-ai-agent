# realestate-ai-agent

AI Real Estate Agent - dat lich xem nha, cham diem khach tiem nang bang AI, nhac follow-up. Du an mon Chuyen de 2: No-code / Low-code Automation (n8n).

## Luong chinh

- **Luong 1 (dat lich):** khach dang ky xem nha (web) -> Backend luu DB -> webhook sang n8n -> AI cham diem (HOT/WARM/COLD) -> email "da nhan yeu cau" cho khach, email cho nhan vien (moi muc) kem nut Duyet / Doi gio -> n8n goi lai Backend cap nhat ket qua -> nhan vien bam Duyet -> email chot lich, lead `CONFIRMED`.
- **Luong 2 (follow-up, moi gio):** nhac lich truoc 24h, hoi cam nhan sau buoi xem, nhac khach WARM im lang; chong gui trung nho bang `lead_events`.
- **Error workflow:** luong nao loi thi gui email bao quan ly.

Tong quan du an va lo trinh: [docs/tong-quan-du-an.md](docs/tong-quan-du-an.md).

Chi tiet dinh dang JSON: [docs/api-contract.md](docs/api-contract.md)

## Cau truc

| Thu muc | Noi dung |
|---|---|
| `backend/` | API, ket noi PostgreSQL |
| `web/` | Giao dien web |
| `n8n-workflows/` | File workflow n8n (export JSON) |
| `docs/` | Tai lieu: hop dong API (`api-contract.md`), tong quan (`tong-quan-du-an.md`), ke hoach tung tuan (`tuan-1.md`, `tuan-2.md`) |
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

- Phan cong va quy tac phoi hop: xem `docs/tuan-1.md`, muc "Cach phoi hop" (van ap dung). Viec tuan nay: `docs/tuan-2.md`.
- Khong commit file `.env`.
