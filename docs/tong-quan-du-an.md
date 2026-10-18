# Tổng quan dự án: AI Real Estate Agent

Môn: Chuyên đề 2, No-code / Low-code Automation (n8n). Nhóm: **Hoàng**, **Hậu**.

> Tài liệu này mô tả hệ thống như trên nhánh `dev` (bản mẫu đầy đủ chạy ở local). Nhánh `main` là bản được chấm và đang được làm lại dựa theo `dev`. Cách chia việc: [phoi-hop.md](phoi-hop.md).

Các tài liệu khác:

- [api-contract-dev.md](api-contract-dev.md): luật chung về dữ liệu và API. Mâu thuẫn thì file đó thắng.
- [luong/](luong/): mỗi luồng n8n một file, giải thích làm gì ngoài thực tế và nối với hệ thống thế nào (sơ đồ swimlane).
- [use-cases.md](use-cases.md): danh sách use case của 3 actor.
- [../README-dev.md](../README-dev.md): cách chạy.

## 1. Yêu cầu của môn

Theo tài liệu thầy giao:

- **Mục tiêu môn:** kết hợp workflow automation (n8n) với API, webhook, database, AI/LLM, human-in-the-loop và monitoring để giải một **bài toán thực tế**.
- **Kiến trúc gợi ý cho mỗi luồng:** `Trigger → Xử lý dữ liệu → API → AI → Quyết định → Hành động → Người duyệt → Log/Giám sát`.
- **Tiêu chí luồng tốt:** không chỉ "A → B"; phải có dữ liệu thực tế, xử lý lỗi, retry, xác thực, log, bước duyệt và kết quả đo được.
- **Yêu cầu thêm trên lớp:** mỗi thành viên làm **một luồng n8n riêng, tối thiểu 12 bước**. Sản phẩm có **web và app**.

## 2. Đề tài

> **AI Real Estate Agent**: Visits, document signing, lead follow-up, and sales analytics.
> (Nhóm 9 "Industry-specific" trong danh sách đề tài)

## 3. Bài toán thực tế

Một văn phòng môi giới bất động sản nhỏ nhận khách đăng ký xem nhà qua web. Hiện họ làm tay và gặp các vấn đề sau:

| Vấn đề | Hậu quả |
|---|---|
| Nhiều khách đăng ký, không biết ai mua thật | Nhân viên gọi lần lượt, bỏ lỡ khách tiềm năng |
| Xác nhận lịch, nhắc lịch bằng tay | Khách quên lịch, nhân viên quên gọi lại |
| Không theo dõi khách sau buổi xem | Khách "nguội" và chuyển sang bên khác |
| Giấy tờ đặt cọc soạn tay, gửi qua lại | Chậm, dễ sai thông tin |
| Không có số liệu | Quản lý không biết tỉ lệ chốt, khâu nào đang rơi rụng |

**Giải pháp:** một AI Agent tự động hoá **toàn bộ vòng đời của khách**, từ lúc đăng ký đến lúc ký cọc và báo cáo. AI làm phần lặp lại (chấm điểm, soạn email, nhắc việc, rà soát hợp đồng, tổng hợp số liệu), còn con người **duyệt** ở các bước quan trọng (duyệt lịch, duyệt hợp đồng).

## 4. Ba actor

| Actor | Làm gì | Kênh |
|---|---|---|
| **Khách hàng** | Xem nhà, đặt lịch xem, gửi cảm nhận, ký hợp đồng online. Không cần đăng nhập | Web khu khách, email |
| **Nhân viên sale** | Nhận khách đã chấm điểm, duyệt lịch, đổi giờ, đánh dấu đã xem, tạo hợp đồng | Email, web admin, app |
| **Quản lý** | Duyệt hợp đồng, quản lý nhà, xem báo cáo tuần, nhận cảnh báo | Email, web admin |

n8n, AI (Gemini) và email là **hệ thống**, không phải actor. Chi tiết: [use-cases.md](use-cases.md).

## 5. Vòng đời của khách (trạng thái)

```
NEW ──duyệt──► CONFIRMED ──đã xem──► VIEWED ──tạo hợp đồng──► DEPOSIT ──khách ký──► SIGNED
 │                                     ▲                          │
 └──────────── LOST (không mua) ◄──────┘     hợp đồng bị từ chối / hết hạn: quay về VIEWED
```

Mỗi lần đổi trạng thái hoặc hệ thống làm một việc tự động, backend ghi một dòng vào bảng `lead_events`. Bảng này phục vụ dòng thời gian của khách, chống gửi trùng, báo cáo và log.

## 6. Các luồng n8n

| Luồng | Vế đề tài | Trigger | Tóm tắt | Điểm nhấn kỹ thuật |
|---|---|---|---|---|
| [**1. Đặt lịch xem nhà**](luong/luong-1-dat-lich.md) | Visits | Webhook | Khách đăng ký → AI chấm HOT/WARM/COLD → email khách và nhân viên → **chờ nhân viên duyệt** → chốt lịch. Gửi thông báo đẩy cho app | LLM, Switch, **Human-in-the-loop (Wait)**, guardrail (level tính lại từ điểm) |
| [**1b. Chốt lịch từ web admin**](luong/luong-1b-chot-lich-thu-cong.md) | Visits | Webhook | Nhân viên duyệt khi link email hết hạn, hoặc đổi giờ khách đã chốt → email báo khách | Fallback khi link hết hạn, đọc DB trực tiếp |
| [**2. Follow-up tự động**](luong/luong-2-follow-up.md) | Lead follow-up | Schedule (mỗi giờ) | Nhắc lịch trước 24 giờ, xin cảm nhận sau buổi xem, nhắc khách WARM, nhắc nhân viên duyệt chậm | Trigger định kỳ, Postgres, vòng lặp, **một khách lỗi không chặn cả lượt**, chống gửi trùng bằng `lead_events` |
| [**3. Hợp đồng đặt cọc**](luong/luong-3-hop-dong.md) | Document signing | Webhook | Soạn từ mẫu → AI rà soát → **quản lý duyệt** → khách **ký online** → xác nhận. Nhắc ký, hết hạn | **Hai lần Wait** (quản lý duyệt, khách ký), xử lý quá hạn, mẫu do code điền, AI chỉ rà soát |
| [**4. Báo cáo kinh doanh**](luong/luong-4-bao-cao.md) | Sales analytics | Schedule (thứ Hai) + webhook | Số liệu tuần, phễu, cảnh báo → **AI Agent có công cụ tra cứu DB** → báo cáo cho quản lý | **AI Agent + tool calling**, tài khoản DB chỉ đọc, cảnh báo bằng quy tắc cố định |
| [**5. Cảm nhận sau buổi xem**](luong/luong-5-cam-nhan.md) | Lead follow-up | Webhook | Khách gửi cảm nhận → AI phân tích và gợi ý việc → báo nhân viên, cảnh báo quản lý nếu không hài lòng | Chống chèn lệnh trong dữ liệu khách, guardrail số sao và cảm xúc |
| [**Error workflow**](luong/error-workflow.md) | Monitoring | Error Trigger | Luồng nào lỗi thì gửi email cảnh báo quản lý | Giám sát |

Mỗi luồng có: retry (3 lần, chờ 5 giây) ở mọi node có thể lỗi, xử lý lỗi (khách không kẹt `PENDING`; lỗi lạ đi qua Error workflow), ghi log vào `lead_events`, và bước duyệt của người ở các điểm quan trọng.

## 7. Kiến trúc hệ thống

```
 Web khách (Next.js) ─┐                              ┌─> Gemini (AI)
 Web admin (Next.js) ─┼─> Backend (NestJS) <──> n8n ─┼─> Email (SMTP Gmail)
 App nhân viên (Expo) ┘        │                     └─> Expo Push (thông báo đẩy)
                               └──> PostgreSQL <──── n8n đọc trực tiếp (ghi qua API)
Tất cả chạy bằng Docker Compose.
```

- Backend ↔ n8n giao tiếp bằng **webhook** (backend gọi n8n) và **callback** (n8n gọi ngược API backend), cùng header `X-Webhook-Secret`. Với các bước chờ người, backend bấm "link tiếp tục" của lần chạy n8n đang chờ.
- n8n được **đọc** PostgreSQL trực tiếp (node Postgres) để lấy dữ liệu hàng loạt. Mọi thao tác **ghi** đi qua API backend, để luật nghiệp vụ nằm ở một chỗ.
- Luồng 4 dùng tài khoản database **chỉ đọc** vì AI tự viết câu SQL.
- Web và app chỉ gọi API ghi trong [api-contract-dev.md](api-contract-dev.md). Nút **Duyệt** gọi qua backend để n8n vẫn là nơi duy nhất xử lý duyệt.

## 8. Đối chiếu với "Technology Challenge Matrix" của thầy

| Công nghệ | Trạng thái | Ở đâu |
|---|---|---|
| Webhook | Có | Luồng 1, 1b, 3, 4, 5 |
| REST API | Có | Backend NestJS, n8n gọi bằng HTTP Request |
| Database | Có | PostgreSQL; n8n đọc bằng node Postgres (luồng 1b, 2, 3, 4, 5) |
| LLM | Có | Gemini: chấm điểm, soạn email, rà soát hợp đồng, phân tích cảm nhận, viết báo cáo |
| Docker / Self-hosting | Có | Docker Compose, n8n tự host |
| Human-in-the-loop | Có | Luồng 1 (duyệt lịch), luồng 3 (duyệt hợp đồng, khách ký) |
| Queue / Event-driven | Một phần | Webhook bất đồng bộ, retry, Wait chờ sự kiện |
| AI Agent / Tool calling | Có | Luồng 4 (Agent gọi công cụ tra cứu DB) |
| Guardrail | Có | Luồng 1 (tính level), 2 (kiểm tra nội dung AI), 3 (quy tắc rủi ro), 5 (số sao khớp cảm xúc) |
| Logging / Monitoring | Có | `lead_events`, Error workflow, tab Executions |
| Mobile app | Có (chưa thử trên máy thật) | App Expo cho nhân viên |
| RAG, STT/TTS, OCR, IoT | Không làm | Không thuộc yêu cầu của đề tài |

## 9. Sản phẩm

| Sản phẩm | Nội dung |
|---|---|
| 6 luồng n8n + Error workflow | Mục 6 |
| Web khu khách | Danh sách nhà có lọc, chi tiết nhà + form đặt lịch, gửi cảm nhận, ký hợp đồng |
| Web admin | Đăng nhập, tổng quan (phễu), khách (dòng thời gian, nút thao tác), lịch xem, hợp đồng, quản lý nhà, báo cáo AI |
| App nhân viên (Expo) | Đăng nhập, việc hôm nay, danh sách và chi tiết khách, duyệt, đổi giờ, gọi, thông báo đẩy |
| Tài liệu | Thư mục `docs/` (kèm sơ đồ swimlane từng luồng); báo cáo môn học |

## 10. Đo lường kết quả

| Chỉ số | Mục tiêu | Cách đo | Tình trạng |
|---|---|---|---|
| Độ chính xác phân loại HOT/WARM/COLD | ≥ 80% | Chạy 20 lead mẫu có nhãn mong đợi | **Chưa đo** |
| Thời gian từ đăng ký đến khi khách nhận email | < 1 phút | Tab Executions của n8n | Quan sát thấy khoảng 30 đến 45 giây, chưa đo chính thức |
| Lead bị kẹt `PENDING` | 0 | Mọi lỗi đều có nhánh báo `FAILED` | Đã có nhánh lỗi cho cả trường hợp AI trả mức lạ |
| Email follow-up gửi trùng | 0 | Kiểm tra `lead_events` | Đã thử chạy lại không gửi trùng |

## 11. Thông tin chung của nhóm

- **Gmail nhóm:** `nhadn2457@gmail.com`: tài khoản gửi (SMTP) và hộp thư nhận chung. **Mật khẩu không ghi trong repo.**
- Các vai nhận email dùng bí danh dấu cộng, đều về chung một hộp thư:

| Vai | Địa chỉ |
|---|---|
| Quản lý | `nhadn2457+quanly@gmail.com` |
| Nhân viên sale | `nhadn2457+nhanvien@gmail.com` |
| Khách thử | `nhadn2457+khach1@gmail.com`, `+khach2`, ... |
