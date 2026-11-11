# Tổng quan dự án: AI Real Estate Agent

Môn: Chuyên đề 2, No-code / Low-code Automation (n8n). Nhóm: **Hoàng**, **Hậu**.

Các tài liệu khác:

- [api-contract.md](api-contract.md): luật chung về dữ liệu và API. Mâu thuẫn thì file đó thắng.
- [luong/README.md](luong/README.md): tài liệu từng luồng n8n (làm gì, ai tham gia, nối với hệ thống, triển khai lên server).
- [nghiep-vu/](nghiep-vu/): quy tắc nghiệp vụ theo từng quy trình.
- [danh-sach-lo-hong.md](danh-sach-lo-hong.md): lỗ hổng còn lại, xếp theo vòng đời khách.
- [mautic-setup.md](mautic-setup.md): hướng dẫn hạ tầng và cấu hình Mautic 5.

## 1. Yêu cầu của môn

Theo tài liệu thầy giao:

- **Mục tiêu môn:** kết hợp workflow automation (n8n) với API, webhook, database, AI/LLM, human-in-the-loop và monitoring để giải một **bài toán thực tế**.
- **Kiến trúc gợi ý cho mỗi luồng:** `Trigger → Xử lý dữ liệu → API → AI → Quyết định → Hành động → Người duyệt → Log/Giám sát`.
- **Tiêu chí luồng tốt:** không chỉ "A → B"; phải có dữ liệu thực tế, xử lý lỗi, retry, xác thực, log, bước duyệt và kết quả đo được.
- **Yêu cầu thêm trên lớp:** mỗi thành viên làm **luồng n8n riêng, tối thiểu 12 bước**. n8n chạy trên host (máy chủ chung) hoặc Linux. Sản phẩm có **web và app**.

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
| Khách mua nhà | Xem nhà, đăng ký xem, nhận email, ký hợp đồng cọc | Web (khu khách), email, Telegram bot |
| Nhân viên sale | Nhận lead đã chấm điểm, duyệt lịch xem, cập nhật trạng thái khách | Email, Telegram, web admin, app Expo |
| Quản lý | Duyệt hợp đồng, nhận báo cáo tuần, cảnh báo lỗi, quản lý nhân sự | Email, web admin |

## 5. Vòng đời của khách (trạng thái lead)

```
CONSULTING (đang tư vấn) → NEW (chờ duyệt lịch) → CONFIRMED (đã chốt lịch) → VIEWED (đã xem)
                                                                               ↓
                                                              DEPOSIT (làm hợp đồng cọc) → SIGNED (đã ký)

LOST (không mua): đi tới từ CONSULTING, NEW, CONFIRMED hoặc VIEWED.
Lý do: NO_SHOW, NOT_INTERESTED, CUSTOMER_CANCELLED, EXPIRED, OTHER.
```

- `CONSULTING` có từ FE-33: khách để lại số trong bot Telegram hoặc nhân viên nhập tay, chưa đặt lịch. Huỷ hoặc không đến một buổi xem không làm mất khách: lead về `VIEWED` nếu từng đến một buổi khác, không thì về `CONSULTING` để sale gọi lại.
- `LOST` hiện trên giao diện là "Không mua". Lead `DEPOSIT` không sang `LOST` được: quản lý phải từ chối hợp đồng trước (BF-06). `EXPIRED` là lý do hệ thống tự đóng khi giờ hẹn đã qua mà không ai duyệt (FE-30).
- Quy tắc chi tiết từng chuyển trạng thái: [nghiep-vu/vai-tro-va-trang-thai.md](nghiep-vu/vai-tro-va-trang-thai.md) và [nghiep-vu/01-tiep-nhan-va-phan-cong.md](nghiep-vu/01-tiep-nhan-va-phan-cong.md) mục 3.

Mỗi lần đổi trạng thái hoặc hệ thống làm một việc tự động, backend ghi một dòng vào bảng `lead_events`. Bảng này phục vụ chống gửi trùng, dòng thời gian của khách, báo cáo và log.

## 6. Các luồng n8n trong hệ thống

| Luồng | Vế đề tài | Trigger | Tóm tắt | Điểm nhấn kỹ thuật | Chủ |
|---|---|---|---|---|---|
| **1. Tiếp nhận và chốt lịch xem nhà** | Visits | Webhook | Đăng ký → AI chấm điểm HOT/WARM/COLD → email khách → báo sale phụ trách kèm link Duyệt / Đổi giờ; luồng kết thúc, sale duyệt qua backend (FE-35) | LLM, Structured Output, Switch, **Human-in-the-loop (link duyệt)** | **Hoàng** |
| **1b. Xử lý duyệt/đổi giờ thủ công** | Visits | Webhook | Backend gọi khi sale duyệt, đổi giờ hoặc yêu cầu hẹn lại (web admin hoặc link trong thông báo) → gửi email cho khách | HTTP callback, cập nhật status | **Hoàng** |
| **2. Follow-up tự động** | Lead follow-up | Schedule | Nhắc lịch trước 24h, hỏi cảm nhận sau khi xem, nhắc khách WARM | Trigger định kỳ, Postgres, vòng lặp, guardrail AI | **Hậu** |
| **3. Hợp đồng đặt cọc** | Document signing | Webhook | Khách muốn cọc → AI soạn hợp đồng → quản lý duyệt → khách ký online → xác nhận | 2 lần Wait (quản lý duyệt, khách ký qua `/ky/[token]`) | **Hoàng** |
| **4. Báo cáo kinh doanh** | Sales analytics | Schedule (thứ Hai) | Gom số liệu tuần → tính phễu chuyển đổi → AI phân tích, đề xuất → email quản lý | **AI Agent có tool** (truy vấn DB), Merge, cảnh báo | **Hậu** |
| **5. Phân tích cảm nhận** | Lead follow-up | Webhook | Nhận đánh giá của khách qua `/cam-nhan/[token]` → AI phân tích sentiment, tóm tắt và gợi ý | AI Chain, cập nhật feedback, ghi event | **Hậu** |
| **6. Telegram Agent cho khách** | Visits & Q&A | Webhook (`telegram-khach`) | Khách chat Telegram: tìm nhà, hỏi đáp FAQ, đặt lịch, để lại số; muốn gặp người hoặc bot không trả lời được thì báo sale | AI Agent + Postgres Memory, Tool calling (6 tool, có Think), RAG, Guardrails, phân loại ý định, log hội thoại | **Hoàng** |
| **6b. Nạp tri thức cho bot** | Visits & Q&A | Schedule (2 giờ sáng) | Đọc nhà và tài liệu FAQ → cắt đoạn, tạo embedding → lưu pgvector cho công cụ "Hỏi đáp tri thức" của luồng 6 | RAG, embedding Gemini, pgvector | **Hoàng** |
| **7. Đồng bộ sang Mautic** | Marketing Auto | Webhook (`lead-changed`) | Nhận thay đổi từ lead → tạo/cập nhật Contact kèm Tag (thành phố, level, source, status) | Mautic REST API, data mapping | **Hậu** |
| **8. Mautic báo về n8n** | Marketing Auto | Webhook (Mautic) | Khách mở email, bấm link, tăng điểm → n8n ghi nhận và báo sale khi vượt ngưỡng | Webhook receiver, scoring sync | **Hậu** |
| **Thông báo nhân viên (dùng chung)** | Dùng chung | Execute Workflow | Báo đúng sale phụ trách qua email, Telegram cá nhân, push; không có kênh thì báo quản lý | Sub-workflow, định tuyến người nhận | **Hoàng** |
| **Error workflow (dùng chung)** | Monitoring | Error Trigger | Luồng nào lỗi thì gửi email cảnh báo quản lý | Giám sát | **Hoàng** |

Tài liệu từng luồng: [luong/README.md](luong/README.md).

Mỗi luồng tối thiểu 12 bước và có:

- Retry (3 lần, chờ 5 giây) ở mọi node có thể lỗi.
- Xử lý lỗi: luồng nhận **một lead mới** (luồng 1) thì nhánh lỗi báo `FAILED` cho lead đó. Các luồng chạy theo lịch hoặc không gắn với một lead mới (luồng 2, 4) thì để Error workflow gửi email cho quản lý.
- Ghi log: việc làm trên một lead thì ghi vào `lead_events`. Luồng 4 lưu kết quả vào bảng `weekly_reports`.


**Quy ước màu trong n8n** (CH-07). n8n không tô màu từng node được, nên mỗi luồng đặt sticky note có màu phía sau từng nhóm node, theo các bước kiến trúc của môn (Trigger → Xử lý → AI → Quyết định → Hành động → Người duyệt → Log). Mọi luồng dùng chung:

| Màu sticky | Số màu trong JSON | Nhóm |
|---|---|---|
| Xanh dương | 5 | Tiếp nhận: trigger, cấu hình, chuẩn hoá, đọc dữ liệu |
| Tím | 6 | Kiểm tra, quyết định: điều kiện, Guardrails, phân loại |
| Xanh lá | 4 | AI: LLM, AI Agent và node con (model, tool, bộ nhớ) |
| Cam | 2 | Con người: chờ duyệt, báo nhân viên (human-in-the-loop) |
| Vàng | 1 | Hành động: gửi email, gọi API, lưu, ghi log, phản hồi |
| Đỏ | 3 | Xử lý lỗi |
| Trắng | 7 | Ghi chú, chú thích màu (màu 7 hiện gần như trắng, không dùng cho nhóm) |

Thêm node mới thì đặt trong khung đúng nhóm; khung không đủ chỗ thì kéo rộng sticky. Mỗi luồng có sticky "Chú thích màu" ở góc trên (luồng 6 ghi chú thích trong sticky "Ghi chú").
## 7. Kiến trúc hệ thống

```
 KÊNH        Web khách · Web admin · Email · Telegram (bot khách, bot sale) · App Expo (giai đoạn 4)
                                     │
 n8n         12 workflow: L1 L1b L2 L3 L4 L5 L6 L6b L7 L8
                          + sub-workflow "Thông báo nhân viên" + Error workflow
                                     │
 DỊCH VỤ     Backend NestJS · Postgres (+ pgvector) · Gemini · Mautic + MySQL
             Langfuse Cloud (dự kiến, FE-25)
             Tất cả chạy trên realestate-vm (Langfuse là dịch vụ cloud)
```

- Backend ↔ n8n giao tiếp bằng webhook và callback có header `X-Webhook-Secret` (xem [api-contract.md](api-contract.md)).
- n8n được **đọc** PostgreSQL trực tiếp (node Postgres) để lấy dữ liệu hàng loạt. Mọi thao tác **ghi** đều đi qua API backend (riêng luồng 6b ghi kho vector `rag_chunks` và bộ nhớ hội thoại của luồng 6 trực tiếp).
- **Hai bot Telegram riêng:** bot khách (luồng 6, nhận và gửi, đăng ký webhook `telegram-khach`) và bot sale (chỉ gửi, qua sub-workflow Thông báo nhân viên). Biến môi trường và cách đăng ký: [luong/luong-6-telegram-agent.md](luong/luong-6-telegram-agent.md) mục 6.
- Kênh thông báo cho sale: email, Telegram cá nhân (chat id nhập ở trang Tài khoản), thông báo đẩy qua Expo khi app có mặt.
- Mautic chạy file compose riêng (`docker-compose.mautic.yml`) trên cùng network nội bộ.
- Cách đưa lên server và id từng workflow: [trien-khai.md](trien-khai.md).

## 8. Đối chiếu với "Technology Challenge Matrix" của thầy

| Công nghệ | Trạng thái | Ở đâu |
|---|---|---|
| Webhook | ✅ Có | Luồng 1, 3, 5, 7, 8 |
| REST API | ✅ Có | Backend NestJS (9 modules), n8n HTTP Request, Mautic API |
| Database | ✅ Có | PostgreSQL (chính), MySQL (Mautic) |
| LLM | ✅ Có | Gemini: chấm điểm, soạn email, phân tích cảm nhận, phân tích kinh doanh |
| Docker / Self-hosting | ✅ Có | Docker Compose đa dịch vụ, n8n tự host, Mautic tự host |
| Human-in-the-loop | ✅ Có | Luồng 1 (duyệt lịch qua link), Luồng 3 (duyệt hợp đồng, ký), Luồng 6 (chuyển nhân viên) |
| Queue / Event-driven | ✅ Có | Webhook bất đồng bộ, retry, Wait chờ sự kiện, Mautic worker queue |
| AI Agent / Tool calling | ✅ Có | Luồng 4 (Agent phân tích kèm tool DB), Luồng 6 (Telegram Agent), RAG ở luồng 6b |
| Marketing Automation | ✅ Có | Mautic 5 (chiến dịch nuôi khách, tính điểm hành vi) |
| Logging / Monitoring | ✅ Có | `lead_events`, `chat_logs`, Error workflow, tab Executions (Langfuse: dự kiến, FE-25) |

## 9. Sản phẩm hoàn thiện

Nguyên tắc: **web làm trước, app làm sau**.

| Sản phẩm | Nội dung |
|---|---|
| 8 luồng n8n + Sub-workflow + Error | Như mục 6 |
| Web khu khách | Trang chủ (danh sách nhà, lọc), chi tiết nhà (bộ ảnh, xem 360° từng phòng, thông tin cơ bản, tiện ích, nội thất, bản đồ và dịch vụ xung quanh) + form đặt lịch (nhận `?utm_source=`), cảm nhận `/cam-nhan/[token]`, ký hợp đồng `/ky/[token]` |
| Web admin | Đăng nhập JWT, tổng quan (phễu theo trạng thái, tỉ lệ chốt, việc tồn), danh sách lead (hiện nguồn), chi tiết lead (dòng thời gian, duyệt, đổi giờ), lịch xem, quản lý nhà, hợp đồng, báo cáo AI hằng tuần, phân quyền tài khoản (RBAC) |
| Mautic 5 | Quản lý contact, phân khúc khách hàng, chiến dịch nuôi WARM |
| App nhân viên (Expo) | Đăng nhập, việc hôm nay, chi tiết lead (Duyệt, Đổi giờ, Gọi, Email), thông báo đẩy |
| Báo cáo | Mô tả bài toán, kiến trúc, từng luồng, kết quả đo lường |

## 10. Mốc thời gian chốt

- **Demo tuần 1:** Thứ Bảy 24/10/2026
- **Web hoàn thành:** 22/11/2026
- **Khóa code toàn bộ:** 03/12/2026
- **Nộp bài cuối kỳ:** Thứ Bảy 05/12/2026

## 11. Thông tin chung của nhóm

- **Gmail nhóm:** `nhadn2457@gmail.com`. Dùng làm tài khoản gửi (SMTP) và hộp thư nhận chung. Mật khẩu không ghi trong repo.
- Các vai nhận email dùng bí danh dấu cộng:
  - Quản lý: `nhadn2457+quanly@gmail.com`
  - Nhân viên sale: `nhadn2457+nhanvien@gmail.com`
  - 10 sale demo để thử chia khách lần lượt: `nhadn2457+nhanvien01@gmail.com` đến `+nhanvien10` (Nguyễn Minh Khang, Trần Thu Hà, Lê Quốc Bảo, Phạm Ngọc Anh, Võ Hoàng Long, Đặng Thị Mai, Bùi Văn Phúc, Hồ Thanh Tâm, Dương Gia Huy, Ngô Bảo Châu)
- Các tài khoản trên do backend tự tạo khi khởi động (`SEED_USERS` trong `backend/src/users/users.service.ts`), ở mọi môi trường có biến `SEED_USER_PASSWORD`, kể cả server. Mật khẩu chung là giá trị biến đó. Backend chỉ tạo email còn thiếu, không đổi mật khẩu hay thông tin tài khoản đã có. Sale mới tạo đều ở trạng thái "Đang nhận khách", nên khách mới được chia vòng cho mọi sale; quản lý tắt bớt ở trang Phân quyền nếu không muốn.
  - Khách test: `nhadn2457+khach1@gmail.com`, `+khach2`, ...
