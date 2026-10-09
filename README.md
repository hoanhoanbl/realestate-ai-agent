# realestate-ai-agent

AI Real Estate Agent - dat lich xem nha, cham diem khach tiem nang bang AI, nhac follow-up. Du an mon Chuyen de 2: No-code / Low-code Automation (n8n).

## Luong chinh

Khach dang ky xem nha (web) -> Backend luu DB -> webhook sang n8n -> AI cham diem (HOT/WARM/COLD) va soan email -> gui email xac nhan cho khach, gui email bao nhan vien neu lead nong (HOT) -> n8n goi lai Backend cap nhat ket qua.

Chi tiet dinh dang JSON: [docs/api-contract.md](docs/api-contract.md)

## Cau truc

| Thu muc | Noi dung |
|---|---|
| `backend/` | API, ket noi PostgreSQL |
| `web/` | Giao dien web |
| `n8n-workflows/` | File workflow n8n (export JSON) |
| `docs/` | Tai lieu: hop dong API (`api-contract.md`), phan cong va huong dan (`huong-dan-thuc-hien.md`) |
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

- Phan cong va quy tac phoi hop: xem `docs/huong-dan-thuc-hien.md`, muc "Cach phoi hop".
- Khong commit file `.env`.
