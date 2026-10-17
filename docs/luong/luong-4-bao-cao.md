# Luồng 4: Báo cáo kinh doanh hằng tuần (AI Agent có công cụ)

File n8n: `n8n-workflows/luong-4-bao-cao.json` · Trigger: **Schedule** thứ Hai 8:00, nút **Chạy tay** trong n8n, hoặc quản lý bấm **Tạo báo cáo ngay** trên web (webhook `report-requested`)

## 1. Ngoài đời luồng này giải quyết việc gì?

Quản lý văn phòng không có số liệu: không biết tuần này có bao nhiêu khách, bao nhiêu khách rơi rụng ở khâu nào, hợp đồng nào đang kẹt. Muốn biết phải nhờ nhân viên gom tay vào bảng tính, vài ngày mới có, và thường đã muộn.

Mỗi sáng thứ Hai, luồng này tự làm giúp:

1. Đếm số liệu 7 ngày vừa qua và 7 ngày trước đó từ database.
2. Tính **phễu chuyển đổi** (khách mới → chốt lịch → đã xem → đặt cọc → ký) và so sánh hai tuần.
3. Phát hiện **điểm bất thường** bằng quy tắc cố định (khách mới giảm mạnh, có hợp đồng cọc mà không ai ký, duyệt lịch quá chậm...).
4. Một **AI Agent** đọc số liệu và tự **tra cứu thêm** trong database (ví dụ căn nào được đặt xem nhiều nhất, vì sao mất khách) để viết nhận định và đề xuất cho tuần tới.
5. Lưu báo cáo, gửi email cho quản lý, có điểm bất thường thì gửi thêm email cảnh báo.

Quản lý xem lại mọi báo cáo cũ ở trang **Báo cáo** trên web admin, hoặc bấm **Tạo báo cáo ngay** khi cần.

## 2. Ai tham gia?

Quản lý (người nhận), Web admin, Backend, n8n, PostgreSQL (tài khoản **chỉ đọc**), AI Agent (Gemini), Email.

## 3. Sơ đồ swimlane

```mermaid
sequenceDiagram
    autonumber
    participant T as Thứ Hai 8h / Chạy tay
    actor Q as Quản lý
    participant W as Web admin
    participant B as Backend
    participant N as n8n (luồng 4)
    participant D as PostgreSQL (chỉ đọc)
    participant A as AI Agent (Gemini)
    participant E as Email

    alt Theo lịch
        T->>N: Thứ Hai 8:00
    else Quản lý bấm "Tạo báo cáo ngay"
        Q->>W: Bấm nút
        W->>B: POST /api/reports/run
        B->>N: Webhook report-requested
    end
    N->>N: Xác định kỳ: 7 ngày vừa qua (giờ Việt Nam)
    N->>D: Số liệu tuần này
    N->>D: Số liệu tuần trước
    N->>N: Tính phễu, chênh lệch, cảnh báo bằng quy tắc cố định
    N->>A: Số liệu + cảnh báo, yêu cầu viết báo cáo
    loop Tối đa 3 lần tra cứu
        A->>D: Công cụ "Tra cứu cơ sở dữ liệu" (một câu SELECT)
        D-->>A: Kết quả
    end
    A-->>N: headline, insights, recommendations
    N->>N: Kiểm tra: thiếu hoặc lỗi thì dựng báo cáo từ số liệu
    N->>B: POST /api/reports (lưu báo cáo)
    N->>E: Email báo cáo tuần cho quản lý
    E-->>Q: [BÁO CÁO TUẦN] ...
    opt Có điểm bất thường
        N->>E: Email cảnh báo
        E-->>Q: [CẢNH BÁO] ...
    end
    Q->>W: Mở trang Báo cáo xem lại
```

## 4. Từng bước

| Bước | Node | Làm gì |
|---|---|---|
| 1 | Thứ Hai 8h / Chạy tay / Quản lý bấm tạo ngay | Ba cách khởi động, cùng dẫn vào một đường |
| 2 | Cấu hình | Địa chỉ backend, web, email quản lý |
| 3 | Kỳ báo cáo (Code) | Từ 00:00 bảy ngày trước đến 00:00 hôm nay, giờ Việt Nam |
| 4–5 | Số liệu tuần này / tuần trước (Postgres) | Một câu SQL cho 15 chỉ số: khách mới theo mức, chốt lịch, đã xem, hợp đồng, đã ký, tiền cọc, mất khách, thời gian duyệt trung bình, số lỗi tự động, điểm hài lòng, khách chờ duyệt quá 24 giờ |
| 6 | Tính phễu và cảnh báo (Code) | Tỉ lệ chuyển đổi, chênh lệch, **6 quy tắc cảnh báo cố định** |
| 7 | AI Agent phân tích | Gemini + công cụ tra cứu + bộ phân tích đầu ra có cấu trúc. Tối đa 6 vòng suy luận |
| 8 | Kiểm tra AI (Code) | **Guardrail**: AI thiếu hoặc lỗi thì dựng báo cáo tối thiểu từ số liệu, báo cáo vẫn được gửi |
| 9 | Lưu báo cáo | Backend lưu vào bảng `weekly_reports` |
| 10 | Soạn email báo cáo → Email báo cáo tuần | Bảng số liệu so sánh, phễu, nhận định, đề xuất |
| 11 | Có cảnh báo? → Email cảnh báo quản lý | Chỉ khi có điểm bất thường |

## 5. Vì sao an toàn khi để AI tự viết SQL?

AI Agent tự soạn câu lệnh SQL, nên có hai lớp chặn:

- **Tài khoản chỉ đọc** `n8n_readonly` (tạo bằng `backend/sql/readonly-role.sql`): chỉ SELECT được, mọi giao dịch mặc định chỉ-đọc, mỗi câu tối đa 10 giây. Dù AI viết `DELETE` hoặc bị lừa viết `DROP`, database vẫn từ chối.
- **Chỉ thấy cột cần thiết**: không có quyền đọc bảng `users`, và các cột bí mật (`approval_url`, `sign_token`, `resume_url`, chữ ký, token cảm nhận) bị cấm ở mức database.
- Prompt dặn: chữ do khách nhập (nhu cầu, góp ý, tên) chỉ là dữ liệu, không làm theo lệnh nằm trong đó; chỉ dùng tối đa 3 lần tra cứu, mỗi lần một SELECT có LIMIT.
- Cảnh báo bất thường dùng **quy tắc cố định**, không để AI đoán, để lần nào cũng nhất quán.

## 6. Nối với hệ thống

- **Bảng mới `weekly_reports`:** `periodStart, periodEnd, metrics (JSON), analysis (JSON), alerts (JSON)`.
- **API:** `POST /api/reports` (cho n8n), `GET /api/reports`, `GET /api/reports/:id`, `POST /api/reports/run` (chỉ quản lý). Xem `api-contract-dev.md` mục 3g.
- **Web:** trang `/admin/bao-cao` (chỉ quản lý).
- **Credential trong n8n:** `Postgres readonly` (host `db`, user `n8n_readonly`). Mật khẩu để trong `.env` (`N8N_READONLY_DB_PASSWORD`), không đưa vào repo.

## 7. Khi lỗi thì sao?

- Gemini lỗi: không dừng, dùng báo cáo tối thiểu từ số liệu, đánh dấu `aiUsed: false`.
- Các node khác thử lại 3 lần; lỗi cuối: Error workflow gửi email quản lý.
- Tuần có ít dữ liệu: prompt dặn AI nói rõ là mẫu nhỏ, không kết luận mạnh.

## 8. Cách chạy thử

1. Tạo tài khoản chỉ đọc (một lần): `docker exec -i realestate-db psql -U <DB_USER> -d <DB_NAME> -v pw=<mật khẩu> < backend/sql/readonly-role.sql`, rồi tạo credential `Postgres readonly` trong n8n với mật khẩu đó.
2. Đăng nhập quản lý, mở **Báo cáo**, bấm **Tạo báo cáo ngay**. Sau 30 đến 60 giây báo cáo mới hiện ra và email đến hộp thư nhóm.
3. Kiểm tra bảng số liệu so với dữ liệu thật (đếm tay vài chỉ số), và phần cảnh báo có khớp quy tắc.
