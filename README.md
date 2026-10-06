# realestate-ai-agent

AI Real Estate Agent - dat lich xem nha, cham diem khach tiem nang bang AI, nhac follow-up. Du an mon Chuyen de 2: No-code / Low-code Automation (n8n).

## Luong chinh

Khach dang ky xem nha (web) -> Backend luu DB -> webhook sang n8n -> AI cham diem (HOT/WARM/COLD) va soan email -> gui email, bao Telegram neu lead nong -> n8n goi lai Backend cap nhat ket qua.

Chi tiet dinh dang JSON: [docs/api-contract.md](docs/api-contract.md)

## Cau truc

| Thu muc | Noi dung |
|---|---|
| `backend/` | API, ket noi PostgreSQL |
| `web/` | Giao dien web |
| `n8n-workflows/` | File workflow n8n (export JSON) |
| `docs/` | Tai lieu, hop dong API |
| `docker-compose.yml` | PostgreSQL + n8n (+ backend khi da co) |

## Chay local

1. Cai Docker Desktop.
2. Sao chep `.env.example` thanh `.env` va dien gia tri.
3. Chay:

```bash
docker compose up -d
```

4. Mo n8n tai http://localhost:5678

## Quy uoc Git

- Moi nguoi lam tren nhanh rieng (`feature/backend-api`, `feature/n8n-workflow`), gop vao `main` qua Pull Request.
- Khong commit file `.env`.
