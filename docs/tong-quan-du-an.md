# Tổng quan dự án: AI Real Estate Agent

Môn: Chuyên đề 2, No-code / Low-code Automation (n8n). Nhóm: **Hoàng**, **Hậu**.

Các tài liệu khác:

- [api-contract.md](api-contract.md): luật chung về dữ liệu và API. Mâu thuẫn thì file đó thắng.
- [ke-hoach-tich-hop.md](ke-hoach-tich-hop.md): kế hoạch chi tiết tích hợp Mautic, Agentic AI và App (chốt 20/10/2026).
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
NEW → CONFIRMED (đã chốt lịch) → VIEWED (đã xem) → DEPOSIT (muốn đặt cọc) → SIGNED (đã ký)
                                                   ↘ LOST (không mua)
```

Mỗi lần đổi trạng thái hoặc hệ thống làm một việc tự động, backend ghi một dòng vào bảng `lead_events`. Bảng này phục vụ chống gửi trùng, dòng thời gian của khách, báo cáo và log.

## 6. Các luồng n8n trong hệ thống

| Luồng | Vế đề tài | Trigger | Tóm tắt | Điểm nhấn kỹ thuật | Chủ |
|---|---|---|---|---|---|
| **1. Tiếp nhận và chốt lịch xem nhà** | Visits | Webhook | Đăng ký → AI chấm điểm HOT/WARM/COLD → email khách → thông báo nhân viên kèm nút Duyệt | LLM, Switch, **Human-in-the-loop (Wait)** | **Hoàng** |
| **1b. Xử lý duyệt/đổi giờ thủ công** | Visits | Webhook | Nhận hành động duyệt hoặc đổi giờ từ web admin / Telegram | HTTP callback, cập nhật status | **Hoàng** |
| **2. Follow-up tự động** | Lead follow-up | Schedule | Nhắc lịch trước 24h, hỏi cảm nhận sau khi xem, nhắc khách WARM | Trigger định kỳ, Postgres, vòng lặp, guardrail AI | **Hậu** |
| **3. Hợp đồng đặt cọc** | Document signing | Webhook | Khách muốn cọc → AI soạn hợp đồng → quản lý duyệt → khách ký online → xác nhận | 2 lần Wait (quản lý duyệt, khách ký qua `/ky/[token]`) | **Hoàng** |
| **4. Báo cáo kinh doanh** | Sales analytics | Schedule (thứ Hai) | Gom số liệu tuần → tính phễu chuyển đổi → AI phân tích, đề xuất → email quản lý | **AI Agent có tool** (truy vấn DB), Merge, cảnh báo | **Hậu** |
| **5. Phân tích cảm nhận** | Lead follow-up | Webhook | Nhận đánh giá của khách qua `/cam-nhan/[token]` → AI phân tích sentiment, tóm tắt và gợi ý | AI Chain, cập nhật feedback, ghi event | **Hậu** |
| **6. Telegram Agent cho khách** | Visits & Q&A | Telegram Trigger | Khách chat Telegram: tìm nhà, hỏi đáp FAQ, đặt lịch | AI Agent + Postgres Memory, Tool calling, RAG | **Hoàng** |
| **7. Đồng bộ sang Mautic** | Marketing Auto | Webhook (`lead-changed`) | Nhận thay đổi từ lead → tạo/cập nhật Contact kèm Tag (thành phố, level, source, status) | Mautic REST API, data mapping | **Hậu** |
| **8. Mautic báo về n8n** | Marketing Auto | Webhook (Mautic) | Khách mở email, bấm link, tăng điểm → n8n ghi nhận và báo sale khi vượt ngưỡng | Webhook receiver, scoring sync | **Hậu** |
| **Error workflow (dùng chung)** | Monitoring | Error Trigger | Luồng nào lỗi thì gửi email cảnh báo quản lý | Giám sát | **Hoàng** |

Mỗi luồng tối thiểu 12 bước và có:

- Retry (3 lần, chờ 5 giây) ở mọi node có thể lỗi.
- Xử lý lỗi: luồng nhận **một lead mới** (luồng 1) thì nhánh lỗi báo `FAILED` cho lead đó. Các luồng chạy theo lịch hoặc không gắn với một lead mới (luồng 2, 4) thì để Error workflow gửi email cho quản lý.
- Ghi log: việc làm trên một lead thì ghi vào `lead_events`. Luồng 4 lưu kết quả vào bảng `reports`.

## 7. Kiến trúc hệ thống

```
 KÊNH        Web khách · Web admin · Email · Telegram (sale, khách) · App Expo (giai đoạn 4)
                                     │
 n8n         Đã có: L1 L1b L2 L3 L4 L5 + Error
             Mới:   Sub-workflow "Thông báo nhân viên"
                    L6 Telegram Agent  (Hoàng)
                    L7 Đồng bộ sang Mautic, L8 Mautic báo về  (Hậu)
                                     │
 DỊCH VỤ     Backend NestJS · Postgres · Gemini · Mautic + MySQL · Langfuse Cloud
             Tất cả chạy trên realestate-vm (Langfuse là dịch vụ cloud)
```

- Backend ↔ n8n giao tiếp bằng webhook và callback có header `X-Webhook-Secret` (xem [api-contract.md](api-contract.md)).
- n8n được **đọc** PostgreSQL trực tiếp (node Postgres) để lấy dữ liệu hàng loạt. Mọi thao tác **ghi** đều đi qua API backend.
- Mautic chạy file compose riêng (`docker-compose.mautic.yml`) trên cùng network nội bộ.

## 8. Đối chiếu với "Technology Challenge Matrix" của thầy

| Công nghệ | Trạng thái | Ở đâu |
|---|---|---|
| Webhook | ✅ Có | Luồng 1, 3, 5, 7, 8 |
| REST API | ✅ Có | Backend NestJS (9 modules), n8n HTTP Request, Mautic API |
| Database | ✅ Có | PostgreSQL (chính), MySQL (Mautic) |
| LLM | ✅ Có | Gemini: chấm điểm, soạn email, phân tích cảm nhận, phân tích kinh doanh |
| Docker / Self-hosting | ✅ Có | Docker Compose đa dịch vụ, n8n tự host, Mautic tự host |
| Human-in-the-loop | ✅ Có | Luồng 1 (duyệt lịch), Luồng 3 (duyệt hợp đồng) |
| Queue / Event-driven | ✅ Có | Webhook bất đồng bộ, retry, Wait chờ sự kiện, Mautic worker queue |
| AI Agent / Tool calling | ✅ Có | Luồng 4 (Agent phân tích kèm tool DB), Luồng 6 (Telegram Agent) |
| Marketing Automation | ✅ Có | Mautic 5 (chiến dịch nuôi khách, tính điểm hành vi) |
| Logging / Monitoring | ✅ Có | `lead_events`, Error workflow, tab Executions, Langfuse |

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

## 10. Mốc thời gian chốt (theo `ke-hoach-tich-hop.md`)

- **Demo tuần 1:** Thứ Bảy 24/10/2026
- **Web hoàn thành:** 22/11/2026
- **Khóa code toàn bộ:** 03/12/2026
- **Nộp bài cuối kỳ:** Thứ Bảy 05/12/2026

## 11. Thông tin chung của nhóm

- **Gmail nhóm:** `nhadn2457@gmail.com`. Dùng làm tài khoản gửi (SMTP) và hộp thư nhận chung. Mật khẩu không ghi trong repo.
- Các vai nhận email dùng bí danh dấu cộng:
  - Quản lý: `nhadn2457+quanly@gmail.com`
  - Nhân viên sale: `nhadn2457+nhanvien@gmail.com`
  - Khách test: `nhadn2457+khach1@gmail.com`, `+khach2`, ...
