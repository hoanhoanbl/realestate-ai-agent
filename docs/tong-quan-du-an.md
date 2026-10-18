# Tổng quan dự án: AI Real Estate Agent

Môn: Chuyên đề 2, No-code / Low-code Automation (n8n). Nhóm: **Hoàng**, **Hậu**.

File này là **tờ tóm tắt** để trả lời "dự án giải bài toán gì, đáp ứng yêu cầu của thầy ở đâu, đã đo được gì". Chi tiết nằm ở các file khác, file này chỉ trỏ tới:

| Muốn biết | Đọc |
|---|---|
| Cách chạy, tài khoản đăng nhập, các trang web | [../README-dev.md](../README-dev.md) |
| Từng luồng n8n làm gì ngoài thực tế (sơ đồ swimlane) | [luong/](luong/) |
| API, dữ liệu, webhook | [api-contract-dev.md](api-contract-dev.md) |
| 3 actor làm được gì | [use-cases.md](use-cases.md) |
| Hai người chia việc | [phoi-hop.md](phoi-hop.md) |

## 1. Yêu cầu của môn

Theo tài liệu thầy giao:

- **Mục tiêu:** kết hợp workflow automation (n8n) với API, webhook, database, AI/LLM, human-in-the-loop và monitoring để giải một **bài toán thực tế**.
- **Kiến trúc gợi ý cho mỗi luồng:** `Trigger → Xử lý dữ liệu → API → AI → Quyết định → Hành động → Người duyệt → Log/Giám sát`.
- **Tiêu chí luồng tốt:** không chỉ "A → B"; phải có dữ liệu thực tế, xử lý lỗi, retry, xác thực, log, bước duyệt và kết quả đo được.
- **Yêu cầu thêm trên lớp:** mỗi thành viên làm **một luồng n8n riêng, tối thiểu 12 bước**. Sản phẩm có **web và app**.

## 2. Đề tài và bài toán

> **AI Real Estate Agent**: Visits, document signing, lead follow-up, and sales analytics. (Nhóm 9 "Industry-specific")

Một văn phòng môi giới bất động sản nhỏ nhận khách đăng ký xem nhà qua web. Hiện họ làm tay và gặp các vấn đề sau:

| Vấn đề | Hậu quả |
|---|---|
| Nhiều khách đăng ký, không biết ai mua thật | Nhân viên gọi lần lượt, bỏ lỡ khách tiềm năng |
| Xác nhận lịch, nhắc lịch bằng tay | Khách quên lịch, nhân viên quên gọi lại |
| Không theo dõi khách sau buổi xem | Khách "nguội" và chuyển sang bên khác |
| Giấy tờ đặt cọc soạn tay, gửi qua lại | Chậm, dễ sai thông tin |
| Không có số liệu | Quản lý không biết tỉ lệ chốt, khâu nào đang rơi rụng |

**Giải pháp:** tự động hoá **toàn bộ vòng đời của khách**, từ lúc đăng ký đến lúc ký cọc và báo cáo. AI làm phần lặp lại (chấm điểm, soạn email, nhắc việc, rà soát hợp đồng, tổng hợp số liệu); **con người duyệt** ở hai điểm quan trọng nhất: duyệt lịch xem (nhân viên) và duyệt hợp đồng (quản lý).

Ba actor: **khách hàng**, **nhân viên sale**, **quản lý**. n8n, AI (Gemini) và email là hệ thống, không phải actor.

## 3. Vòng đời của khách

```
NEW ──duyệt lịch──► CONFIRMED ──đã xem──► VIEWED ──tạo hợp đồng──► DEPOSIT ──khách ký──► SIGNED

LOST (không mua): nhân viên đánh dấu được từ bất kỳ trạng thái nào trước khi ký.
Hợp đồng bị từ chối hoặc hết hạn: khách DEPOSIT quay về VIEWED.
```

Mỗi lần đổi trạng thái hoặc hệ thống làm một việc tự động, backend ghi một dòng vào bảng `lead_events`: dòng thời gian của khách, và là chốt để các luồng định kỳ không gửi trùng.

## 4. Các luồng n8n

| Luồng | Vế đề tài | Trigger | Tóm tắt | Điểm nhấn kỹ thuật |
|---|---|---|---|---|
| [**1. Đặt lịch xem nhà**](luong/luong-1-dat-lich.md) | Visits | Webhook | Khách đăng ký → AI chấm HOT/WARM/COLD → email khách và nhân viên (kèm thông báo đẩy) → **chờ nhân viên duyệt** → chốt lịch | LLM, Switch, **human-in-the-loop (Wait)**, level tính lại từ điểm chứ không tin AI |
| [**1b. Chốt lịch từ web admin**](luong/luong-1b-chot-lich-thu-cong.md) | Visits | Webhook | Nhân viên duyệt khi link email đã hết hạn, hoặc đổi giờ khách đã chốt → email báo khách | Phương án dự phòng khi link hết hạn, n8n đọc DB trực tiếp |
| [**2. Follow-up tự động**](luong/luong-2-follow-up.md) | Lead follow-up | Schedule (mỗi giờ) | Nhắc lịch trước 24 giờ, xin cảm nhận sau buổi xem, nhắc khách WARM, nhắc nhân viên duyệt chậm | Vòng lặp, một khách lỗi không chặn cả lượt, kiểm tra nội dung AI trước khi gửi |
| [**3. Hợp đồng đặt cọc**](luong/luong-3-hop-dong.md) | Document signing | Webhook | Soạn từ mẫu → AI rà soát → **quản lý duyệt** → khách **ký online** → xác nhận. Nhắc ký, hết hạn | **Hai lần Wait**, xử lý quá hạn; số liệu do code điền, AI chỉ rà soát |
| [**4. Báo cáo kinh doanh**](luong/luong-4-bao-cao.md) | Sales analytics | Schedule (thứ Hai 8:00) hoặc webhook | Số liệu tuần, phễu, cảnh báo → **AI Agent tra cứu DB** → báo cáo cho quản lý | **AI Agent có công cụ**, tài khoản DB chỉ đọc, cảnh báo bằng quy tắc cố định |
| [**5. Cảm nhận sau buổi xem**](luong/luong-5-cam-nhan.md) | Lead follow-up | Webhook | Khách gửi cảm nhận → AI phân tích và gợi ý việc → báo nhân viên; khách không hài lòng thì báo cả quản lý | Chống chèn lệnh trong ô góp ý, số sao và cảm xúc không được mâu thuẫn |
| [**Error workflow**](luong/error-workflow.md) | Monitoring | Error Trigger | Luồng nào lỗi thì gửi email cho quản lý | Giám sát |

Người duyệt nằm ở luồng 1 (nhân viên) và luồng 3 (quản lý, rồi khách ký). Các luồng 2, 4, 5 không cần duyệt vì chỉ gửi thông báo hoặc báo cáo, không thay đổi trạng thái khách.

Đặc điểm chung: mọi node gọi dịch vụ ngoài (AI, email, HTTP) đều thử lại 3 lần cách 5 giây; luồng xử lý một khách mới có nhánh báo `FAILED` để khách không kẹt ở `PENDING`; lỗi ngoài dự kiến đi qua Error workflow; việc làm trên một khách đều ghi vào `lead_events`.

## 5. Kiến trúc

```
 Web khách (Next.js) ─┐                              ┌─> Gemini (AI)
 Web admin (Next.js) ─┼─> Backend (NestJS) <──> n8n ─┼─> Email (SMTP Gmail)
 App nhân viên (Expo) ┘        │                     └─> Expo Push (thông báo đẩy)
                               └──> PostgreSQL <──── n8n đọc trực tiếp (ghi qua API)
Tất cả chạy bằng Docker Compose.
```

- Backend và n8n nói chuyện bằng **webhook** (backend gọi n8n) và **callback** (n8n gọi ngược API backend), cùng header `X-Webhook-Secret`. Với các bước chờ người, backend bấm "link tiếp tục" của lần chạy n8n đang chờ.
- n8n **đọc** PostgreSQL trực tiếp, nhưng mọi thao tác **ghi** đi qua API backend, để luật nghiệp vụ nằm ở một chỗ.
- Nút **Duyệt** trên web admin và app đi qua backend, để n8n vẫn là nơi duy nhất xử lý duyệt.
- Luồng 4 dùng tài khoản database **chỉ đọc**, vì AI tự viết câu SQL.

## 6. Đối chiếu với "Technology Challenge Matrix" của thầy

| Công nghệ | Trạng thái | Ở đâu |
|---|---|---|
| Webhook | Có | Luồng 1, 1b, 3, 4, 5 |
| REST API | Có | Backend NestJS; n8n gọi bằng HTTP Request |
| Database | Có | PostgreSQL; n8n đọc bằng node Postgres (luồng 1, 1b, 2, 3, 4, 5) |
| LLM | Có | Gemini: chấm điểm, soạn email, rà soát hợp đồng, phân tích cảm nhận, viết báo cáo |
| Docker / Self-hosting | Có | Docker Compose, n8n tự host |
| Human-in-the-loop | Có | Luồng 1 (duyệt lịch), luồng 3 (duyệt hợp đồng, khách ký) |
| Queue / Event-driven | Một phần | Webhook bất đồng bộ, retry, Wait chờ sự kiện (chưa có hàng đợi riêng) |
| AI Agent / Tool calling | Có | Luồng 4 |
| Guardrail | Có | Luồng 1 (tính level), 2 (kiểm tra nội dung AI), 3 (quy tắc rủi ro), 5 (sao khớp cảm xúc) |
| Logging / Monitoring | Có | `lead_events`, Error workflow, tab Executions của n8n |
| Mobile app | Có, chưa thử trên máy thật | App Expo cho nhân viên |
| RAG, STT/TTS, OCR, IoT | Không làm | Không thuộc yêu cầu của đề tài |

## 7. Đo lường kết quả

| Chỉ số | Mục tiêu | Cách đo | Tình trạng |
|---|---|---|---|
| Độ chính xác phân loại HOT/WARM/COLD | ≥ 80% | Chạy 20 lead mẫu có nhãn mong đợi | **Chưa đo** |
| Thời gian từ đăng ký đến khi khách nhận email | < 1 phút | Tab Executions của n8n | Khi chạy thử, xong trong khoảng 45 giây; chưa đo bài bản |
| Khách bị kẹt `PENDING` | 0 | Mọi lỗi đều có nhánh báo `FAILED` | Đã có nhánh lỗi, kể cả khi AI trả mức lạ; chưa gây lỗi hàng loạt để thử |
| Email follow-up gửi trùng | 0 | Kiểm tra `lead_events` | Đã thử: dữ liệu mẫu có 4 việc cần làm, sau một lượt chạy câu truy vấn trả 0 việc |
