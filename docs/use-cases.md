# Danh sách use case

Tài liệu liệt kê use case của 3 actor trong hệ thống AI Real Estate Agent. Vai, luồng và giai đoạn lấy theo [tong-quan-du-an.md](tong-quan-du-an.md).

## 1. Actor

| Actor | Mô tả | Kênh |
|---|---|---|
| **Khách hàng** | Người muốn mua nhà, không cần đăng nhập | Web khu khách, email |
| **Nhân viên sale** | Nhận lead, duyệt lịch xem, chăm sóc khách đến lúc đặt cọc | Email, web admin, app |
| **Quản lý** | Quản lý nhà, duyệt hợp đồng, theo dõi số liệu | Email, web admin |

n8n, AI (Gemini) và Gmail là **hệ thống**, không phải actor. Các việc hệ thống tự làm được liệt kê riêng ở mục 3.

## 2. Use case theo actor

Cột "Luồng" ghi luồng n8n xử lý use case đó (để trống nếu chỉ dùng web và backend). Cột "Giai đoạn" theo lộ trình ở mục 11 của tổng quan.

### 2.1. Khách hàng

| Mã | Use case | Mô tả | Luồng | Giai đoạn |
|---|---|---|---|---|
| UC-K01 | Xem danh sách nhà | Xem các căn đang bán, lọc theo thành phố, giá, loại nhà | | Web |
| UC-K02 | Xem chi tiết nhà | Xem ảnh, giá, diện tích, vị trí, mô tả của một căn | | Web |
| UC-K03 | Đăng ký lịch xem nhà | Điền form (họ tên, email, số điện thoại, giờ muốn xem, nhu cầu) ở trang chi tiết nhà | 1 | Tuần 1 |
| UC-K04 | Nhận email xác nhận | Nhận email "đã nhận yêu cầu", sau đó nhận email chốt lịch khi nhân viên duyệt | 1 | Tuần 2 |
| UC-K05 | Nhận nhắc lịch xem | Nhận email nhắc trước giờ xem 24 giờ | 2 | Tuần 2 |
| UC-K06 | Gửi cảm nhận sau buổi xem | Trả lời email hỏi cảm nhận mà hệ thống gửi sau buổi xem | 2 | Tuần 2 |
| UC-K07 | Ký hợp đồng đặt cọc online | Mở link `/sign/[token]` trong email, xem lại hợp đồng và ký | 3 | Luồng 3 |
| UC-K08 | Nhận xác nhận đã ký | Nhận email xác nhận kèm bản hợp đồng đã ký | 3 | Luồng 3 |

### 2.2. Nhân viên sale

| Mã | Use case | Mô tả | Luồng | Giai đoạn |
|---|---|---|---|---|
| UC-S01 | Đăng nhập | Đăng nhập web admin hoặc app (JWT, vai `SALE`) | | Web |
| UC-S02 | Nhận thông báo lead mới | Nhận email hoặc thông báo đẩy về lead mới, kèm điểm AI (HOT/WARM/COLD) và tóm tắt nhu cầu | 1 | Tuần 2 (email), App (push) |
| UC-S03 | Duyệt lịch xem nhà | Bấm **Duyệt** hoặc **Đổi giờ** trong email, web admin hoặc app (đều gọi `approvalUrl` của n8n) | 1 | Tuần 2 |
| UC-S04 | Đổi giờ xem | Đặt giờ xem mới cho khách rồi duyệt lại (`PUT /viewings/:id`) | | Web |
| UC-S05 | Xem danh sách lead | Xem và lọc lead theo trạng thái, điểm AI | | Web |
| UC-S06 | Xem chi tiết lead | Xem thông tin khách và dòng thời gian (từ `lead_events`) | | Tuần 2 |
| UC-S07 | Cập nhật kết quả buổi xem | Bấm **Đã xem**, **Khách không đến** hoặc **Mất khách** (`VIEWED` / `LOST`) | | Web, App |
| UC-S08 | Tạo hợp đồng đặt cọc | Khi khách muốn cọc, bấm **Tạo hợp đồng** (lead chuyển `DEPOSIT`), kích hoạt luồng 3 | 3 | Luồng 3 |
| UC-S09 | Xem việc hôm nay | Xem lead chờ duyệt và các lịch xem trong ngày trên app | | App |
| UC-S10 | Liên hệ khách | Bấm **Gọi** hoặc **Email** khách ngay từ app | | App |

### 2.3. Quản lý

| Mã | Use case | Mô tả | Luồng | Giai đoạn |
|---|---|---|---|---|
| UC-Q01 | Đăng nhập | Đăng nhập web admin (JWT, vai `MANAGER`) | | Web |
| UC-Q02 | Xem tổng quan | Xem phễu theo trạng thái lead, tỉ lệ chốt, việc tồn | | Web |
| UC-Q03 | Quản lý nhà | Thêm, sửa, ẩn căn nhà đang bán | | Luồng 3 |
| UC-Q04 | Duyệt hợp đồng đặt cọc | Xem hợp đồng do AI soạn, bấm **Duyệt** để gửi khách ký hoặc **Từ chối** kèm lý do | 3 | Luồng 3 |
| UC-Q05 | Theo dõi hợp đồng | Xem danh sách hợp đồng và trạng thái (chờ duyệt, chờ ký, đã ký, quá hạn) | | Luồng 3 |
| UC-Q06 | Nhận báo cáo kinh doanh | Nhận email báo cáo AI mỗi thứ Hai và xem lại trên trang báo cáo ở web admin | 4 | Luồng 4 |
| UC-Q07 | Nhận cảnh báo lỗi | Nhận email khi một luồng n8n bị lỗi | Error | Tuần 2 |
| UC-Q08 | Xem lead và lịch xem | Dùng được UC-S05, UC-S06 để xem toàn bộ lead của văn phòng | | Web |

## 3. Việc hệ thống tự làm (không phải actor)

Các việc này không do người bấm, nhưng là kết quả mà actor nhận được ở mục 2.

| Mã | Việc | Trigger | Luồng | Phục vụ use case |
|---|---|---|---|---|
| SYS-01 | AI chấm điểm lead HOT/WARM/COLD, soạn email | Webhook khi có đăng ký mới | 1 | UC-K04, UC-S02 |
| SYS-02 | Báo `FAILED` cho lead khi luồng 1 lỗi | Nhánh lỗi luồng 1 | 1 | UC-S06 |
| SYS-03 | Nhắc lịch trước 24 giờ | Mỗi giờ | 2 | UC-K05 |
| SYS-04 | Hỏi cảm nhận sau buổi xem | Mỗi giờ | 2 | UC-K06 |
| SYS-05 | Nhắc khách WARM im lặng (AI viết, có guardrail) | Mỗi giờ | 2 | |
| SYS-06 | AI soạn hợp đồng đặt cọc | Webhook khi lead chuyển `DEPOSIT` | 3 | UC-Q04 |
| SYS-07 | Nhắc ký và xử lý hợp đồng quá hạn | Wait hết hạn trong luồng 3 | 3 | UC-K07 |
| SYS-08 | Gom số liệu tuần, AI Agent phân tích và đề xuất | Thứ Hai hằng tuần | 4 | UC-Q06 |
| SYS-09 | Ghi log mọi việc tự động vào `lead_events` | Trong mọi luồng | 1–3 | UC-S06 |
| SYS-10 | Gửi cảnh báo khi luồng lỗi | Error Trigger | Error | UC-Q07 |

## 4. Đối chiếu với 4 vế của đề tài

| Vế đề tài | Use case chính |
|---|---|
| Visits | UC-K01, UC-K02, UC-K03, UC-K04, UC-K05, UC-S03, UC-S04, UC-S07, UC-S09 |
| Document signing | UC-K07, UC-K08, UC-S08, UC-Q04, UC-Q05 |
| Lead follow-up | UC-K06, UC-S02, UC-S05, UC-S06, UC-S10, SYS-05 |
| Sales analytics | UC-Q02, UC-Q06 |
