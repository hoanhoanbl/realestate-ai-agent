# Luồng 2: Follow-up tự động

File n8n: `n8n-workflows/luong-2-follow-up.json` · Trigger: **Schedule, mỗi giờ** (và nút "Chạy tay" để thử)

## 1. Ngoài đời luồng này giải quyết việc gì?

Nhân viên môi giới thường quên: quên nhắc khách trước giờ xem nhà, quên hỏi cảm nhận sau buổi xem, quên liên lạc lại khách đang nguội dần. Luồng này mỗi giờ tự quét database và gửi đúng email cần gửi, **mỗi loại chỉ gửi một lần cho mỗi khách**.

| Loại | Điều kiện | Việc làm |
|---|---|---|
| `REMINDER` | Khách đã chốt lịch (`CONFIRMED`), giờ xem trong 24 giờ tới | Email nhắc lịch |
| `FEEDBACK` | Giờ xem đã qua hơn 1 ngày | Email hỏi cảm nhận, chuyển khách sang `VIEWED` |
| `WARM_NUDGE` | Khách WARM, đăng ký hơn 3 ngày, vẫn `NEW` | Email hỏi thăm khách, và email nhắc nhân viên gọi lại |

## 2. Ai tham gia?

| Làn | Vai trò |
|---|---|
| Đồng hồ (Schedule) | Đánh thức luồng mỗi giờ |
| n8n | Điều phối |
| PostgreSQL | n8n **đọc** trực tiếp để lấy danh sách khách cần chăm |
| Backend | n8n **ghi** (log, đổi trạng thái) qua API |
| Gemini | Viết email cho từng khách |
| Email | Gửi thư |
| Khách / Nhân viên / Quản lý | Nhận thư |

## 3. Sơ đồ swimlane

```mermaid
sequenceDiagram
    autonumber
    participant T as Đồng hồ (mỗi giờ)
    participant N as n8n (luồng 2)
    participant D as PostgreSQL
    participant B as Backend
    participant G as Gemini
    participant E as Email
    actor K as Khách
    actor S as Nhân viên
    actor Q as Quản lý

    T->>N: Đến giờ chạy
    N->>D: SELECT khách cần REMINDER / FEEDBACK / WARM_NUDGE (chưa có log tương ứng, tối đa 50)
    D-->>N: Danh sách
    loop Từng khách
        N->>B: GET /api/properties/:id
        N->>G: Viết email theo mục đích
        G-->>N: subject + body
        N->>N: Kiểm tra nội dung AI (guardrail), lỗi thì dùng mẫu dự phòng
        N->>E: Gửi email cho khách
        E-->>K: Nhắc lịch / hỏi cảm nhận / hỏi thăm
        N->>B: POST /events (REMINDER_SENT / FEEDBACK_ASKED / WARM_NUDGE_SENT)
        opt FEEDBACK
            N->>B: PUT /status VIEWED
        end
        opt WARM_NUDGE
            N->>E: Email nhắc nhân viên gọi lại
            E-->>S: [GỌI LẠI] khách WARM
        end
    end
    N->>E: Email báo cáo tổng hợp cho quản lý
    E-->>Q: Đã gửi bao nhiêu email, loại nào
```

## 4. Từng bước

| Bước | Node | Làm gì |
|---|---|---|
| 1 | Mỗi giờ / Chạy tay | Khởi động |
| 2 | Cấu hình | Địa chỉ backend, email nhân viên, quản lý |
| 3 | Lấy lead cần follow-up (Postgres) | Một câu SQL gộp 3 loại. `NOT EXISTS` trên `lead_events` đảm bảo **không gửi trùng** |
| 4 | Có dữ liệu? | Không có ai thì dừng |
| 5 | Loop Over Items | Xử lý từng khách một |
| 6 | Lấy thông tin nhà | Tên và địa chỉ căn nhà |
| 7 | Chuẩn bị ngữ cảnh | Ghép mục đích email, giờ xem theo giờ Việt Nam |
| 8 | AI soạn email | Gemini viết `subject` + `body` |
| 9 | Kiểm tra nội dung AI | **Guardrail**: thiếu tên khách, quá dài, còn `{{` thì thay bằng mẫu dự phòng |
| 10 | Email khách | Gửi thư |
| 11 | Ghi log | `POST /events`, vừa là nhật ký vừa là chốt chống gửi trùng |
| 12 | Việc thêm (Switch) | FEEDBACK → đổi `VIEWED`; WARM_NUDGE → email nhắc nhân viên |
| 13 | Tổng hợp + Email báo cáo | Cuối lượt gửi quản lý số liệu |

## 5. Nối với hệ thống

- **Đọc DB trực tiếp** (node Postgres): bảng `leads`, `viewings`, `lead_events`.
- **Ghi qua backend**: `POST /leads/:id/events`, `PUT /leads/:id/status`.
- Loại log: `REMINDER_SENT`, `FEEDBACK_ASKED`, `WARM_NUDGE_SENT`.

## 6. Khi lỗi thì sao?

Mọi node có thể lỗi đều thử lại 3 lần. Lỗi cuối cùng được Error workflow báo cho quản lý. *(Các hạn chế đã biết của bản hiện tại sẽ được sửa ở nhánh `fix/luong-2`: một khách lỗi đang làm dừng cả lượt, và luồng chưa gắn Error workflow.)*

## 7. Cách chạy thử

1. Nạp dữ liệu mẫu: chạy `backend/sql/demo-follow-up.sql` vào DB (tạo 3 khách đúng điều kiện).
2. Mở n8n, bấm **Execute workflow** ở nhánh "Chạy tay".
3. Kiểm tra hộp thư nhóm có 3 email follow-up + 1 email nhắc nhân viên + 1 email báo cáo; chạy lại thì **không gửi trùng**.
