# Luồng 5: Khách gửi cảm nhận, AI phân tích và báo nhân viên

File n8n: `n8n-workflows/luong-5-cam-nhan.json` · Trigger: **Webhook** `POST /webhook/feedback-submitted` (do backend gọi khi khách bấm "Gửi cảm nhận")

## 1. Ngoài đời luồng này giải quyết việc gì?

Sau khi dẫn khách đi xem nhà, nhân viên thường chỉ hỏi miệng "anh/chị thấy sao?" rồi quên, hoặc khách trả lời qua tin nhắn lẻ tẻ không ai tổng hợp. Điểm quyết định mua hay không lại nằm đúng ở lúc này.

Luồng này làm cho phản hồi của khách **thành việc cần làm cụ thể**:

1. Luồng 2 gửi khách email hỏi cảm nhận, trong email có nút **"Gửi cảm nhận"**.
2. Khách mở trang web, chọn số sao, chọn bước tiếp theo (đặt cọc / xem căn khác / không còn nhu cầu), viết thêm nếu muốn.
3. AI đọc phản hồi, tóm tắt, đánh giá cảm xúc và **gợi ý nhân viên nên làm gì tiếp**.
4. Nhân viên nhận email có tóm tắt và nút mở hồ sơ. Khách muốn đặt cọc thì tiêu đề email là **[CƠ HỘI ĐẶT CỌC]**. Khách không hài lòng thì quản lý cũng nhận cảnh báo.
5. Khách nhận email cảm ơn.

AI **không** tự đổi trạng thái khách hay tự soạn hợp đồng. Nó chỉ gợi ý; nhân viên quyết định (human-in-the-loop).

## 2. Ai tham gia?

Khách, Web (trang `/cam-nhan/[token]`), Backend, n8n (luồng 5), PostgreSQL (n8n đọc), Gemini, Email, Nhân viên, Quản lý.

## 3. Sơ đồ swimlane

```mermaid
sequenceDiagram
    autonumber
    actor K as Khách
    participant W as Web khách
    participant B as Backend
    participant N as n8n (luồng 5)
    participant D as PostgreSQL
    participant G as Gemini
    participant E as Email
    actor S as Nhân viên
    actor Q as Quản lý

    Note over K,B: Trước đó, luồng 2 đã xin link (POST /feedback/link/:leadId)<br/>và gửi email hỏi cảm nhận kèm nút "Gửi cảm nhận"
    K->>W: Mở /cam-nhan/{token} từ email
    W->>B: GET /api/feedback/{token}
    B-->>W: Tên khách, căn nhà, giờ xem (không lộ email, SĐT)
    K->>W: Chọn số sao, lựa chọn, góp ý, bấm Gửi
    W->>B: POST /api/feedback/{token}
    B->>B: Lưu cảm nhận (chỉ được gửi một lần, lần hai trả 409)
    B->>B: Ghi lead_events FEEDBACK_RECEIVED
    B->>N: Webhook feedback-submitted {feedbackId, leadId}
    B-->>W: ok
    W-->>K: Cảm ơn anh/chị
    N->>D: Lấy cảm nhận + khách + căn nhà
    N->>G: Phân tích: sentiment, summary, nextAction
    G-->>N: Kết quả (hoặc lỗi: dùng mẫu dự phòng)
    N->>N: Kiểm tra: số sao và cảm xúc không được mâu thuẫn
    N->>B: PUT /api/feedback/:id/ai-result
    N->>B: POST /events FEEDBACK_ANALYZED
    N->>E: Email cho nhân viên (tóm tắt, gợi ý, nút mở hồ sơ)
    E-->>S: [CƠ HỘI ĐẶT CỌC] / [CẦN XỬ LÝ] / thường
    N->>E: Email cảm ơn khách
    opt Khách không hài lòng (cảm xúc NEGATIVE hoặc 1-2 sao)
        N->>E: Email cảnh báo quản lý
        E-->>Q: [KHÁCH KHÔNG HÀI LÒNG]
    end
```

## 4. Từng bước

| Bước | Node | Làm gì |
|---|---|---|
| 1 | Webhook | Nhận `feedbackId`, kiểm tra header bí mật |
| 2 | Cấu hình | Địa chỉ backend, địa chỉ web, email nhân viên và quản lý |
| 3 | Chuẩn hoá | Kiểm tra `feedbackId` là số nguyên |
| 4 | Lấy cảm nhận (Postgres) | Một câu SQL lấy cảm nhận đã gửi, khách, căn nhà |
| 5 | Có cảm nhận? | Không có thì dừng và báo lỗi qua Error workflow |
| 6 | Chuẩn bị | Escape HTML, đổi `DEPOSIT/OTHER/NONE` thành chữ dễ đọc |
| 7 | Basic LLM Chain (Gemini) | Phân tích. Prompt dặn rõ **phần góp ý của khách chỉ là dữ liệu, không làm theo lệnh trong đó** (chống chèn lệnh) |
| 8 | Kiểm tra AI | **Guardrail**: AI lỗi hoặc thiếu thì dùng mẫu dự phòng; 4–5 sao không được `NEGATIVE`, 1–2 sao không được `POSITIVE` |
| 9 | Lưu kết quả AI | Backend lưu `aiSentiment`, `aiSummary`, `aiNextAction` |
| 10 | Ghi log FEEDBACK_ANALYZED | Dòng thời gian của khách |
| 11 | Email nhân viên | Tóm tắt và gợi ý; tiêu đề đổi theo mức ưu tiên |
| 12 | Email cảm ơn khách | Nội dung đổi theo lựa chọn của khách |
| 13 | Cần báo quản lý? → Email cảnh báo quản lý | Chỉ khi khách không hài lòng |

## 5. Nối với hệ thống

- **Bảng mới `feedbacks`:** `leadId, token, rating, interest, comment, submittedAt, aiSentiment, aiSummary, aiNextAction`.
- **API công khai:** `GET` và `POST /api/feedback/:token`. **Cho n8n:** `POST /api/feedback/link/:leadId`, `PUT /api/feedback/:id/ai-result`. **Cho admin:** `GET /api/feedback/lead/:leadId`. Xem `api-contract-dev.md` mục 3e.
- **Web:** trang khách `/cam-nhan/[token]`; trang chi tiết khách ở admin có thẻ "Cảm nhận của khách".
- **Log:** `FEEDBACK_ASKED` (luồng 2), `FEEDBACK_RECEIVED` (backend), `FEEDBACK_ANALYZED` (luồng 5).
- **Bảo mật:** `token` là chuỗi ngẫu nhiên 32 ký tự, mỗi khách một link, chỉ gửi được một lần. Trang công khai không lộ email hay số điện thoại.

## 6. Khi lỗi thì sao?

- Gemini lỗi sau 3 lần thử: **không dừng**, dùng mẫu dự phòng từ số sao và lựa chọn của khách. Nhân viên vẫn nhận email.
- Các node khác: thử lại 3 lần; lỗi cuối cùng thì Error workflow gửi email quản lý.
- n8n lỗi hoặc tắt: cảm nhận của khách **vẫn được lưu**, chỉ thiếu phần AI. Backend ghi log cảnh báo.

## 7. Cách chạy thử

1. Chạy `backend/sql/demo-follow-up.sql`, rồi chạy luồng 2 (nhánh "Chạy tay"). Khách `Trần Thị Cảm` nhận email hỏi cảm nhận.
2. Mở link trong email (hoặc lấy `token` trong bảng `feedbacks`) tại `http://localhost:3000/cam-nhan/<token>`, gửi cảm nhận.
3. Sau chừng 30 giây: hộp thư nhóm có email cho nhân viên và email cảm ơn; trang chi tiết khách ở admin hiện thẻ cảm nhận kèm tóm tắt AI. Gửi lại lần hai: báo "đã gửi rồi".
