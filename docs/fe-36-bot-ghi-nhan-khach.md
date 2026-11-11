# FE-36 — Bot Telegram ghi nhận khách và gắn lịch sử chat vào lead

Triển khai local trên nền FE-33 và FE-35, chưa phát hành server. Phạm vi nghiệp vụ: [quy trình 1, mục 3.4](nghiep-vu/01-tiep-nhan-va-phan-cong.md). Đóng LH-01 (khách để lại số trong bot mà không đặt lịch) và LH-11 (lịch sử chat không gắn với lead). Change OpenSpec: `fe36-bot-lead-capture`.

## Hành vi

- **Công cụ "Lưu liên hệ khách" của bot (luồng 6).** Khi khách muốn được gọi lại hoặc nói sẽ để lại số, bot hỏi họ tên và số điện thoại, nhắc lại và hỏi "Anh/chị xác nhận để nhân viên gọi lại số này không?". Chỉ gọi công cụ khi tin mới nhất của khách đồng ý rõ ràng, mỗi lần xác nhận gọi một lần. Công cụ gọi `POST /api/leads/intake` với `source: telegram`, không gửi email, ngân sách hay `consentMarketing` (đồng ý nhận tin quảng cáo vẫn do form web thu). Lead trùng số thì dùng lại hồ sơ cũ, không đổi tên, nguồn, đồng ý hay người phụ trách; bot không nói khách đã có hồ sơ. Số sai (dưới 8 hay trên 15 chữ số) bị backend từ chối 400, bot xin khách gõ lại.
- **`chatId` do n8n gắn, không do AI quyết định.** Body của công cụ lấy `chatId` từ node "Chuẩn hoá tin nhắn", nên AI không thể gắn chat của người khác. Công cụ "Đặt lịch xem nhà" cũng gửi `chatId` theo cách này.
- **Báo sale phụ trách.** Sau khi bot xong lượt trả lời, node "Trích liên hệ đã lưu" đọc kết quả công cụ trong các bước trung gian của Agent. Có `lead.id` thì "Báo sale khách mới" gọi sub-workflow `thong-bao-nhan-vien` với `assigneeId` của lead (FE-35: email, Telegram cá nhân, push; chưa có sale thì email quản lý). Tiêu đề "Khách Telegram để lại số" cho lead mới hoặc mở lại, "Khách cũ nhắn lại" cho lead đã có. Thông báo có tên, số điện thoại, username Telegram nếu có, nút mở hồ sơ. Lỗi lưu (400, văn bản lỗi) thì không báo; báo lỗi không chặn tin trả lời khách (node đặt `onError: continueRegularOutput`).
- **Gắn lịch sử chat.** `POST /api/leads/intake` nhận thêm `chatId` (tuỳ chọn). Sau khi lead được lưu xong, backend gắn mọi log cũ của chat đó chưa thuộc lead nào vào lead (`UPDATE chat_logs SET lead_id ... WHERE lead_id IS NULL`). Log đã thuộc lead khác giữ nguyên. Lỗi khi gắn chỉ ghi log, không làm mất lead. `POST /api/viewings` chỉ nhận `chatId` khi request mang `X-Webhook-Secret`; form web công khai gửi `chatId` thì bị bỏ qua. `POST /api/leads` (đăng nhập) bỏ qua `chatId`.
- **Log sau theo lead.** `POST /api/chat-logs` không có lead trong body nhưng chat đã có log gắn lead thì log mới lấy lead của log gắn gần nhất. Chat chưa từng gắn thì log không thuộc lead nào.
- **Xem lịch sử chat.** `GET /api/leads/{id}/chat-logs` (đăng nhập) trả tối đa 200 log mới nhất, cũ trước, không có `chatId` và `executionId`. Nội dung là bản đã che email và số dài từ FE-32. Trang lead có mục "Lịch sử chat Telegram" (gập lại khi quá 10 lượt), chỉ hiện khi có log.

## Giới hạn đã biết

- **Một chat để lại hai số khác nhau.** Chat theo lead đầu tiên: log cũ và log viết sau đều ở lead đó, lead thứ hai chỉ nhận log chưa thuộc lead nào lúc gắn. Đã chốt (đổi spec): muốn chuyển chat sang lead mới cần thêm cột đánh dấu lead hiện tại (đổi schema), mà trường hợp này hiếm (người thân dùng chung một chat). Có test ghi lại hành vi.
- Bot không thu đồng ý nhận tin quảng cáo; lead từ bot không email nên chưa đồng bộ sang Mautic (FE-40, PR #65).
- Không gắn lại lịch sử chat của lead tạo trước FE-36.
- Trang lead cùng file với PR FE-39 (#63): mỗi bên thêm một import và một dòng JSX, merge #63 trước hoặc giữ cả hai khi xung đột.

## API

Xem [api-contract.md mục 7](api-contract.md#7-l6-ghi-log-hội-thoại-bot-telegram) và [mục 3.3](api-contract.md#33-lịch-sử-chat-telegram-của-lead-fe-36).

## Triển khai

[trien-khai.md mục 9e](trien-khai.md#9e-bot-telegram-ghi-nhận-khách-fe-36). Không SQL (`chat_logs.lead_id` có từ FE-33), không biến `.env` mới.

## Kiểm thử

- Backend: `npm run lint`, `npm run build`, `npm test` đạt; bộ `chat-lead-link.integration.spec.ts` trên PostgreSQL tạm `localhost:55433/fe33_test`: 6 log rồi để lại số thì cả 6 thuộc lead; chat khác không bị gắn; log mới theo lead; chat đã gắn lead A thì log cũ và log sau đều giữ ở A; không có `chatId` thì không gắn; JWT bỏ qua `chatId`; đặt lịch có secret mới gắn; body đúng dạng công cụ n8n (số trùng khác định dạng dùng lại lead, không đổi tên và người phụ trách; số `09012` bị 400, không tạo lead, không gắn); đọc chat 401/404/thứ tự/200 log/không lộ `chatId`.
- Web: lint và build đạt; trang lead ở 375 px với API giả cho 0, 3, 12 và 200 lượt chat: không tràn ngang, danh sách dài cuộn trong khung.
- `node scripts/check-bot-lead-capture.cjs`: PASS (công cụ, `chatId` từ n8n, không gửi `consentMarketing`, luật xác nhận trong prompt, trích kết quả công cụ với các dạng created/reopened/existing/lỗi 400/văn bản thường/không có bước, nội dung báo sale, mọi đường nối và tham chiếu node). Các script `check-*` khác của FE-35 vẫn PASS.
- **n8n 2.46.6 cô lập** (container tạm, backend và SMTP giả, không gửi thư thật): workflow thử gồm các node thật của nhánh sau Agent, nhận bước công cụ ghi sẵn. Khách mới: một thư "Khách Telegram để lại số" tới sale phụ trách (có link hồ sơ và link Telegram), sub-workflow gọi `GET /api/users/5/notify-target`; khách cũ: "Khách cũ nhắn lại"; lead mở lại: tiêu đề khách mới; chưa có người phụ trách: thư tới email quản lý; lỗi 400, văn bản thường, không gọi công cụ: không thư nào; trả lời khách giữ nguyên ở mọi trường hợp, kể cả khi backend và SMTP tắt giữa chừng.

## Chưa kiểm chứng

- Chạy luồng 6 đủ đường với Gemini thật và Telegram thật: Agent có đúng lúc hỏi, nhắc lại, chờ xác nhận và gọi công cụ một lần hay không phụ thuộc prompt và model, chưa thử. Cần chạy bằng bot nội bộ trước khi lên server.
- Dạng chuỗi của `observation` trong các bước trung gian thật của n8n Agent: đã xử lý chuỗi JSON, object và mảng, chưa thấy dữ liệu thật.
- Telegram và push thật của sub-workflow (xem FE-35).
