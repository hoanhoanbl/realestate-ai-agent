# Tổng quan dự án: AI Real Estate Agent

Môn: Chuyên đề 2, No-code / Low-code Automation (n8n). Nhóm: **Hoàng**, **Hậu**.

Các tài liệu khác:

- [api-contract.md](api-contract.md): luật chung về dữ liệu và API. Mâu thuẫn thì file đó thắng.
- [tuan-1.md](tuan-1.md): kế hoạch tuần 1 (demo giữa kỳ 10/10).
- [tuan-2.md](tuan-2.md): kế hoạch tuần 2 (luồng 1, luồng 2, API mới).

## 1. Yêu cầu của môn

Theo tài liệu thầy giao:

- **Mục tiêu môn:** kết hợp workflow automation (n8n) với API, webhook, database, AI/LLM, human-in-the-loop và monitoring để giải một **bài toán thực tế**.
- **Kiến trúc gợi ý cho mỗi luồng:** `Trigger → Xử lý dữ liệu → API → AI → Quyết định → Hành động → Người duyệt → Log/Giám sát`.
- **Tiêu chí luồng tốt:** không chỉ "A → B"; phải có dữ liệu thực tế, xử lý lỗi, retry, xác thực, log, bước duyệt và kết quả đo được.
- **Yêu cầu thêm trên lớp:** mỗi thành viên làm **một luồng n8n riêng, tối thiểu 12 bước**. n8n chạy trên host (máy chủ chung) hoặc Linux. Sản phẩm có **web và app**.

## 2. Đề tài

> **AI Real Estate Agent**: Visits, document signing, lead follow-up, and sales analytics.
> (Nhóm 9 "Industry-specific" trong danh sách đề tài)

## 3. Bài toán thực tế

Một văn phòng môi giới bất động sản nhỏ (dữ liệu mẫu: 10 căn ở TP.HCM, Hà Nội, Đà Nẵng và Phú Quốc) nhận khách đăng ký xem nhà qua web. Hiện họ làm tay và gặp các vấn đề sau:

| Vấn đề | Hậu quả |
|---|---|
| Nhiều khách đăng ký, không biết ai mua thật | Nhân viên gọi lần lượt, bỏ lỡ khách tiềm năng |
| Xác nhận lịch, nhắc lịch bằng tay | Khách quên lịch, nhân viên quên gọi lại |
| Không theo dõi khách sau buổi xem | Khách "nguội" và chuyển sang bên khác |
| Giấy tờ đặt cọc soạn tay, gửi qua lại | Chậm, dễ sai thông tin |
| Không có số liệu | Quản lý không biết tỉ lệ chốt, nguồn khách nào tốt |

**Giải pháp:** một AI Agent tự động hoá **toàn bộ vòng đời của khách**, từ lúc đăng ký đến lúc ký cọc và báo cáo. AI làm phần lặp lại (chấm điểm, soạn email, nhắc việc, tổng hợp số liệu), còn con người chỉ **duyệt** ở các bước quan trọng.

## 4. Người dùng

| Vai | Làm gì trong hệ thống | Kênh |
|---|---|---|
| Khách mua nhà | Xem nhà, đăng ký xem, nhận email, ký hợp đồng cọc | Web (khu khách), email |
| Nhân viên sale | Nhận lead đã chấm điểm, duyệt lịch xem, cập nhật trạng thái khách | Email, web admin, app |
| Quản lý | Duyệt hợp đồng, nhận báo cáo tuần, cảnh báo lỗi | Email, web admin |

## 5. Vòng đời của khách (trạng thái lead)

```
NEW → CONFIRMED (đã chốt lịch) → VIEWED (đã xem) → DEPOSIT (muốn đặt cọc) → SIGNED (đã ký)
                                                   ↘ LOST (không mua)
```

Mỗi lần đổi trạng thái hoặc hệ thống làm một việc tự động, backend ghi một dòng vào bảng `lead_events`. Bảng này phục vụ chống gửi trùng, dòng thời gian của khách, báo cáo và log.

## 6. Bốn luồng n8n (mỗi vế của đề tài một luồng)

| Luồng | Vế đề tài | Trigger | Tóm tắt | Điểm nhấn kỹ thuật | Chủ | Khi nào |
|---|---|---|---|---|---|---|
| **1. Tiếp nhận và chốt lịch xem nhà** | Visits | Webhook | Đăng ký → AI chấm điểm HOT/WARM/COLD → email khách → nhân viên duyệt → chốt lịch | LLM, Switch, **Human-in-the-loop (Wait)** | **Hoàng** | Tuần 2 |
| **2. Follow-up tự động** | Lead follow-up | Schedule | Nhắc lịch trước 24h, hỏi cảm nhận sau khi xem, nhắc khách WARM im lặng | Trigger định kỳ, Postgres, vòng lặp, guardrail AI | **Hậu** | Tuần 2 |
| **3. Hợp đồng đặt cọc** | Document signing | Webhook | Khách muốn cọc → AI soạn hợp đồng → quản lý duyệt → khách ký online → xác nhận | 2 lần Wait (quản lý duyệt, khách ký), xử lý quá hạn | **Hoàng** | Cuối kỳ |
| **4. Báo cáo kinh doanh** | Sales analytics | Schedule (thứ Hai) | Gom số liệu tuần → tính phễu chuyển đổi → AI phân tích, đề xuất → email quản lý | **AI Agent có tool** (truy vấn DB), Merge, cảnh báo | **Hậu** | Cuối kỳ |
| Error workflow (dùng chung) | Monitoring | Error Trigger | Luồng nào lỗi thì gửi email cảnh báo quản lý | Giám sát | Hoàng | Tuần 2 |

Mỗi luồng tối thiểu 12 bước và có:

- Retry (3 lần, chờ 5 giây) ở mọi node có thể lỗi.
- Xử lý lỗi: luồng nhận **một lead mới** (luồng 1) thì nhánh lỗi báo `FAILED` cho lead đó. Các luồng chạy theo lịch hoặc không gắn với một lead mới (luồng 2, 4) thì để Error workflow gửi email cho quản lý.
- Ghi log: việc làm trên một lead thì ghi vào `lead_events`. Luồng 4 (báo cáo cả tuần) lưu kết quả vào bảng báo cáo riêng (thiết kế ở cuối kỳ).

## 7. Kiến trúc hệ thống

```
 Web khách (Next.js) ─┐                         ┌─> Gemini (AI)
 Web admin (Next.js) ─┼─> Backend (NestJS) <──> n8n ──┼─> Gmail nhóm (SMTP)
 App nhân viên (Expo) ┘        │                 │    └─> (push notification, cuối kỳ)
                               └──> PostgreSQL <─┘ (n8n chỉ đọc, ghi qua API backend)
Tất cả chạy bằng Docker Compose. Trong lúc làm, mỗi người chạy trên máy mình; máy chủ chung tính sau.
```

- Backend ↔ n8n giao tiếp bằng webhook và callback có header `X-Webhook-Secret` (xem [api-contract.md](api-contract.md)).
- n8n được **đọc** PostgreSQL trực tiếp (node Postgres) để lấy dữ liệu hàng loạt. Mọi thao tác **ghi** đều đi qua API backend.

## 8. Đối chiếu với "Technology Challenge Matrix" của thầy

| Công nghệ | Trạng thái | Ở đâu |
|---|---|---|
| Webhook | ✅ Có | Luồng 1, 3 |
| REST API | ✅ Có | Backend NestJS, n8n gọi qua HTTP Request |
| Database | ✅ Có | PostgreSQL, n8n đọc bằng node Postgres (luồng 2, 4) |
| LLM | ✅ Có | Gemini: chấm điểm, soạn email, soạn hợp đồng, phân tích |
| Docker / Self-hosting | ✅ Có | Docker Compose, n8n tự host |
| Human-in-the-loop | Tuần 2 | Luồng 1 (duyệt lịch), luồng 3 (duyệt hợp đồng) |
| Queue / Event-driven | Một phần | Webhook bất đồng bộ, retry, Wait chờ sự kiện |
| AI Agent / Tool calling | Cuối kỳ | Luồng 4 |
| Logging / Monitoring | Tuần 2 | `lead_events`, Error workflow, tab Executions |
| RAG, STT/TTS, OCR, IoT, Cloud | Không làm | Không thuộc yêu cầu của đề tài |

**Mức mục tiêu:** đạt trọn **Intermediate** (API + DB + AI + rẽ nhánh + duyệt) vào tuần 2, tiến gần **Advanced** vào cuối kỳ nhờ AI Agent ở luồng 4.

## 9. Sản phẩm cuối kỳ (nộp cuối tháng 12/2026)

Nguyên tắc: **web làm trước, app làm sau**. Mỗi sản phẩm phục vụ một nhóm người dùng để không làm trùng: web khu khách cho người mua (không đăng nhập), web admin cho quản lý (máy tính, xem toàn cảnh), app cho nhân viên sale (điện thoại, xử lý việc ngay, có thông báo đẩy).

| Sản phẩm | Nội dung |
|---|---|
| 4 luồng n8n + Error workflow | Như mục 6 |
| Web khu khách | Trang chủ (danh sách nhà, lọc), chi tiết nhà + form đặt lịch, ký hợp đồng `/sign/[token]` (link do luồng 3 gửi) |
| Web admin | Đăng nhập, tổng quan (phễu theo trạng thái, tỉ lệ chốt, việc tồn), danh sách lead, chi tiết lead (dòng thời gian, nút Duyệt / Đã xem / Mất khách / Tạo hợp đồng), lịch xem (đổi giờ), quản lý nhà, hợp đồng (duyệt), báo cáo AI hằng tuần |
| App nhân viên (Expo) | Đăng nhập, việc hôm nay (chờ duyệt, lịch xem trong ngày), danh sách và chi tiết lead (Duyệt, Đổi giờ, Gọi, Email, Đã xem), thông báo đẩy |
| Báo cáo | Mô tả bài toán, kiến trúc, từng luồng, kết quả đo lường |

Backend cần thêm cho web admin và app: bảng `users` (vai `MANAGER`, `SALE`) và đăng nhập JWT, bảng `contracts`, bảng báo cáo tuần, push token của app; API thêm/sửa nhà, đổi giờ xem (`PUT /viewings/:id`), đổi trạng thái lead dành cho nhân viên (có đăng nhập, khác API dùng `X-Webhook-Secret` của n8n). Nút Duyệt trên web admin và app gọi `approvalUrl` mà n8n đã gửi về (xem `api-contract.md` mục 2.1), để n8n vẫn là nơi duy nhất xử lý duyệt.

### Việc đã biết phải giải quyết trước cuối kỳ

| Vấn đề | Hướng giải quyết | Khi nào |
|---|---|---|
| `GET /api/leads` công khai, ai có địa chỉ backend cũng xem được thông tin khách | Đăng nhập JWT cho mọi API của admin và app | Khi làm web admin |
| Chưa có máy chủ chung: link Duyệt trong email chỉ bấm được trên máy đang chạy n8n | Chọn máy chủ chung (VPS hoặc máy Ubuntu), có HTTPS | Tính sau |
| Nhân viên bấm "Đổi giờ" hoặc quá 24 giờ không duyệt: lead nằm ở `NEW`, không có cách đặt giờ mới | Trang lịch xem ở admin gọi `PUT /viewings/:id`, rồi duyệt lại | Khi làm web admin |
| `viewings.status` luôn là `NEW`, trùng ý nghĩa với `leads.status` | Chốt: hoặc bỏ dùng `viewings.status`, hoặc cập nhật cùng lúc khi duyệt / đổi giờ | Trước khi làm web admin |
| Luồng 2 tự đổi lead sang `VIEWED` chỉ dựa vào giờ xem đã qua (khách có thể không đến) | Khi có app, nhân viên bấm "Đã xem" hoặc "Khách không đến"; luồng 2 chỉ hỏi cảm nhận | Khi làm app |
| Luồng 2 gửi email xong nhưng ghi log lỗi thì giờ sau gửi lại | Chấp nhận ở tuần 2 (đã có retry); nếu cần thì ghi log `*_SENDING` trước khi gửi | Tuỳ thời gian |

## 10. Đo lường kết quả (mục tiêu)

| Chỉ số | Mục tiêu | Cách đo |
|---|---|---|
| Độ chính xác phân loại HOT/WARM/COLD | ≥ 80% | Chạy 20 lead mẫu có nhãn mong đợi |
| Thời gian từ đăng ký đến khi khách nhận email | < 1 phút | Tab Executions của n8n |
| Lead bị kẹt `PENDING` | 0 | Mọi lỗi đều có nhánh báo `FAILED` |
| Email follow-up gửi trùng | 0 | Kiểm tra `lead_events` |

## 11. Lộ trình

Hạn nộp: **cuối tháng 12/2026**. Mỗi tuần làm xong và chạy thử được tới đâu thì demo tới đó. Các giai đoạn sau tuần 2 là **dự kiến**, làm theo thứ tự; việc cụ thể và chia việc theo tên được chốt trong file kế hoạch của từng tuần.

| Giai đoạn | Kết quả |
|---|---|
| Tuần 1: giữa kỳ | ✅ Backend, DB, web 3 trang, luồng 1 bản đầu (6 bước), Docker Compose |
| Tuần 2 | Luồng 1 (Hoàng) và luồng 2 (Hậu) đủ ≥ 12 bước, Error workflow, API mới. Web: trang chi tiết lead (dòng thời gian) |
| Tiếp theo: web | Đăng nhập (JWT). Web admin bản đầu: tổng quan (phễu trạng thái), khách, chi tiết lead có nút Duyệt, lịch xem (đổi giờ). Web khách: trang chủ danh sách nhà, chi tiết nhà + form |
| Luồng 3 | Hợp đồng đặt cọc (Hoàng), bảng `contracts`, trang `/sign/[token]`, trang hợp đồng ở admin, quản lý nhà |
| Luồng 4 | Báo cáo kinh doanh (Hậu), trang báo cáo AI ở admin |
| App | App Expo: đăng nhập, việc hôm nay, chi tiết lead, duyệt, thông báo đẩy (n8n gọi Expo Push) |
| Hoàn thiện | Máy chủ chung, đo lường (20 lead mẫu), báo cáo, video dự phòng, **nộp cuối tháng 12** |

## 12. Thông tin chung của nhóm

- **Gmail nhóm:** `nhadn2457@gmail.com`. Dùng làm tài khoản gửi (SMTP) và hộp thư nhận chung. **Mật khẩu không ghi trong repo**, hai người giữ riêng.
- Các vai nhận email dùng bí danh dấu cộng, tất cả đều về chung một hộp thư:

| Vai | Địa chỉ |
|---|---|
| Quản lý | `nhadn2457+quanly@gmail.com` |
| Nhân viên sale | `nhadn2457+nhanvien@gmail.com` |
| Khách test | `nhadn2457+khach1@gmail.com`, `+khach2`, ... |
