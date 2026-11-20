# 00. Tiếp nhận khách (phần nền)

Phần nền cho cả 4 vế của đề tài: khách vào hệ thống từ đâu, được nhận ra thế nào, ai phụ trách, AI chấm điểm ra sao, sale phải chạm khách đầu tiên trong bao lâu. Đề tài không có vế riêng cho phần này, nhưng thiếu nó thì không vế nào chạy được.

Thuộc hành trình: **giai đoạn 1 (thu lead)**, **2 (chạm đầu tiên)** và phần máy của **4 (sàng lọc)**. Bản đồ hành trình và cách đọc nhãn: [vai-tro-va-trang-thai.md](vai-tro-va-trang-thai.md) mục 1. Giai đoạn tiếp theo: [01-visits.md](01-visits.md) (hẹn xem) hoặc [03-lead-follow-up.md](03-lead-follow-up.md) (khách chưa liên hệ được).

Cập nhật lần cuối: 18/11/2026.

## Tóm tắt các giai đoạn

| | GĐ1. Thu lead | GĐ2. Chạm đầu tiên | GĐ4. Sàng lọc (phần máy) |
|---|---|---|---|
| Mục tiêu | Không mất khách nào, không có hai hồ sơ cho một khách | Sale phản hồi nhanh khi khách còn "nóng" | Biết khách nào nên ưu tiên |
| Bắt đầu khi | Khách đặt lịch trên web, để số trong bot, hoặc nhân viên nhập tay | Lead được giao cho sale | Lead vừa tạo |
| Kết thúc khi | Có lead, có sale phụ trách | Sale có thao tác đầu tiên | Lead có mức HOT, WARM hoặc COLD |
| Khách làm | Đặt lịch, chat bot | Nhận thư "đã nhận yêu cầu" | |
| Sale, quản lý làm | Nhập khách hotline, văn phòng; quản lý chuyển sale | Sale gọi, duyệt lịch, ghi chú. Quản lý nhận báo khi sale quá hạn | Sale bổ sung ngân sách, nhu cầu |
| Hệ thống tự động | Chuẩn hoá số, nhận ra khách cũ, chia sale lần lượt, gắn chat bot vào lead | Thư cho khách, báo sale phụ trách, đếm hạn 2 giờ làm việc, báo quản lý khi quá hạn | AI chấm điểm 0–100 |
| Luồng n8n | L1, L6, Thông báo nhân viên | L1, L2 (nhánh hạn phản hồi), Thông báo nhân viên | L1 |
| Tình trạng | **[Đang chạy]** | **[Đang chạy]**; chưa có mốc gửi thư tiếp nhận chính xác | **[Đang chạy]** |

```
 Web form ----+
 Bot L6 ------+--> Chuẩn hoá SĐT --> Trùng? --có--> Gắn vào lead cũ, giữ sale cũ
 Nhập tay ----+                        |
                                       không
                                       v
                                 Tạo lead + chia sale lần lượt
                                       |
                                       v
                       L1: AI chấm điểm, thư cho khách, báo sale
                                       |
                                       v
                      Hạn 2 giờ làm việc cho thao tác đầu tiên
                         |                               |
                    có thao tác                      quá hạn
                         v                               v
              GĐ5 hẹn xem / GĐ3 cố liên hệ      L2 báo quản lý
```

## 1. Kênh tiếp nhận **[Đang chạy]**

| Kênh | Tạo lead khi | Nguồn ghi vào lead |
|---|---|---|
| Web: form đặt lịch ở trang chi tiết nhà | Khách gửi form | Lấy từ `?utm_source=`, không có thì "Trực tiếp" |
| Telegram bot (luồng 6) | Khách để lại số điện thoại trong chat, kể cả khi chưa đặt lịch. Bot hỏi tên và số, nhắc lại, chờ khách xác nhận rồi mới lưu | Telegram |
| Nhân viên nhập tay trên web admin | Sale hoặc quản lý bấm "Thêm khách" (`/admin/leads/them`) | Một trong các nguồn ở mục 1.1 |

Không làm:

- Form "nhờ tư vấn" chung trên web khách: khách chưa chọn được căn thì hỏi bot Telegram.
- Form đăng ký nhận tin của Mautic (FE-21, **[Mở rộng]**): chỉ tạo contact Mautic, **không** tạo lead.
- Zalo OA, Facebook, các sàn rao vặt **[Làm sau]**: khi làm, các kênh này dùng chung cửa vào như ba kênh trên.

### 1.1. Nhân viên nhập tay

Dành cho khách đến thẳng tay sale, không qua web hay bot. Trước đây những khách này chỉ nằm trong điện thoại của sale: công ty không biết, AI không chấm, báo cáo không đếm, sale nghỉ việc thì khách đi theo.

| Nguồn | Ví dụ |
|---|---|
| Gọi hotline | Số in trên bảng quảng cáo, tờ rơi, tin đăng |
| Biển treo tại căn | Khách đi ngang thấy biển "Bán nhà" |
| Đến văn phòng | Khách vãng lai ghé hỏi |
| Zalo cá nhân của sale | Khách cũ gửi Zalo của sale cho bạn bè |
| Người quen giới thiệu | Khách đã mua giới thiệu người nhà |
| Khác | Ghi rõ trong ghi chú |

| Ô của form | Bắt buộc | Ghi chú |
|---|---|---|
| Nguồn | Có | Danh sách ở trên |
| Họ tên | Có | |
| Số điện thoại | Có | Gõ đủ số thì tự kiểm tra trùng sau 0,4 giây, báo "Số này đã có: lead #…" kèm link mở hồ sơ và khoá nút Lưu |
| Email | Không | Khách Việt Nam nhiều người không dùng email |
| Ngân sách | Không | Không có thì AI chấm với dữ liệu đang có |
| Căn quan tâm | Không | Chọn được nhiều căn |
| Ghi chú | Không | Nội dung cuộc gọi, nhu cầu |
| Người phụ trách | Có | Mặc định là người nhập. Chỉ liệt kê sale đang nhận khách và quản lý; người nhập đã tắt "Đang nhận khách" thì phải chọn người khác |
| Đặt lịch xem luôn | | **[Làm sau]**. Hiện sale lưu khách rồi đặt lịch hộ trong hồ sơ |

## 2. Nhận ra khách cũ **[Đang chạy]**

- Khoá nhận ra khách là **số điện thoại đã chuẩn hoá**: bỏ dấu cách, dấu chấm, gạch ngang, đổi `+84` thành `0`. Email chỉ là thông tin phụ.
- Kênh nào cũng kiểm tra trùng trước khi tạo lead. Trùng thì không tạo lead mới:
  - Web và bot: gắn yêu cầu mới (buổi xem, tin nhắn) vào lead cũ, giữ sale cũ.
  - Nhập tay: form báo "Số này đã có: lead #… …, đang do … phụ trách" và mời mở lead cũ.
- Lead cũ đã "Không mua" mà khách quay lại đặt lịch thì mở lại lead đó, xoá lý do đóng, vẫn giao sale cũ nếu sale đó còn nhận khách.
- Hồ sơ trùng có từ trước FE-33 không tự gộp; trang lead hiện mục "Các lần đặt khác" để nhân viên thấy.

## 3. Một lead là một khách **[Đang chạy]**

Một lead là **một khách**, một lead có nhiều buổi xem, mỗi lúc **tối đa một buổi đang mở** (chờ duyệt hoặc đã chốt). Quy tắc buổi xem nằm ở [01-visits.md](01-visits.md).

Ví dụ chị Bình:

| Việc | Hệ thống ghi |
|---|---|
| Chat bot hỏi giá, để lại số | Lead #42 "Đang tư vấn", gán sale Minh |
| Đặt xem căn Sơn Trà | Buổi xem 1 dưới lead #42, lead "Mới" |
| Huỷ lịch Sơn Trà khi chưa xem | Buổi xem 1 "Đã huỷ", lead về "Đang tư vấn" (không bị đóng) |
| Đặt xem căn Hải Châu | Buổi xem 2 dưới lead #42, vẫn sale Minh |
| Báo cáo tuần | 1 khách, xem 2 căn |

Nhiều buổi xem mở cùng lúc, mỗi buổi duyệt riêng: **[Làm sau]**, cần chuyển nút Duyệt và luồng 1, 1b, 2 sang theo từng buổi xem.

## 4. Gán sale **[Đang chạy]**

| Khách đến từ | Ai phụ trách |
|---|---|
| Web, bot | **Chia lần lượt** cho các sale đang nhận khách, không phân biệt HOT/WARM/COLD |
| Nhân viên nhập tay | Người nhập (đổi được trong form) |
| Khách cũ quay lại | Sale cũ nếu còn nhận khách; không thì chia lần lượt |
| Không có sale nào đang nhận khách | Quản lý |

- Mỗi sale có công tắc **"Đang nhận khách"** (trang Tài khoản). Nghỉ phép, ốm thì tắt; lượt chia bỏ qua người đang tắt.
- Lead nhập tay cũng tính một lượt cho người nhập, để số khách giữa các sale cân bằng.
- Khách mới đặt lịch: lượt chia bỏ qua sale đang có buổi xem ở căn khác cách giờ khách chọn dưới 90 phút; sale bị bỏ qua giữ nguyên lượt **[Đang chạy]**, quy tắc ở [01-visits.md](01-visits.md) mục 1.6.
- Quản lý chuyển lead sang sale khác bất cứ lúc nào trên trang lead. Mỗi lần chia, chuyển ghi vào nhật ký lead. Ngoại lệ: lead đang có buổi xem "Chờ xem" mà sale mới bận trong vòng 90 phút quanh giờ đó thì **không chuyển được** **[Đang chạy]**, quy tắc ở [01-visits.md](01-visits.md) mục 1.6.
- Quản lý kiểm tra việc chia có đều không ở trang **Đội sale** ([04-sales-analytics.md](04-sales-analytics.md) mục 3).

Vì sao chia lần lượt:

| Cách khác | Vì sao không chọn |
|---|---|
| Quản lý tự chia | Khách gửi buổi tối hay Chủ nhật thì phải chờ quản lý |
| Ai nhận trước thì được | Sale nhanh tay giành hết khách HOT, khách COLD không ai nhận |
| Chia theo khu vực | Bảng nhân viên chưa có khu vực; nhóm nhỏ thì mỗi khu vực chỉ có 1 người |

Ví dụ một ngày với 3 sale An, Bình, Chi:

```
09:00  Khách Hùng đặt lịch trên web          -> An    (lượt 1)
09:20  Khách Lan để số trong bot Telegram    -> Bình  (lượt 2)
10:00  Khách Tú gọi hotline, Chi nghe máy    -> Chi   (nhập tay, tính lượt 3)
11:00  Khách Mai đặt lịch trên web           -> An    (vòng lại)
14:00  Hùng đặt thêm căn thứ hai             -> vẫn An (khách cũ)
Chiều  Bình tắt "Đang nhận khách"            -> khách mới chỉ chia cho An và Chi
```

**Không làm:** tự thu hồi khách khi sale chậm. Quá hạn thì báo quản lý, quản lý chuyển tay.

## 5. AI chấm điểm (sàng lọc phần máy) **[Đang chạy]**

- Luồng 1 cho AI chấm **khi tạo lead**, không chấm lại mỗi lần đặt lịch.
- Thang 0–100: `HOT` từ 70, `WARM` từ 40 đến 69, `COLD` dưới 40. Ngân sách rõ và nhu cầu cụ thể thì điểm cao; ngân sách từ 90% giá căn trở lên được cộng mạnh, dưới 50% bị trừ mạnh.
- Lead thiếu ngân sách (nhập tay, bot) vẫn được chấm; AI không đủ căn cứ thì để WARM.
- Sale bổ sung ngân sách hoặc nhu cầu thì chấm lại.
- Mức khách quyết định nội dung thư "đã nhận yêu cầu". Mức **không** quyết định ai phụ trách, và từ FE-45 không còn quyết định khách có được chăm sau buổi xem hay không ([03-lead-follow-up.md](03-lead-follow-up.md) mục 4).
- AI hoặc luồng 1 lỗi: lead có trạng thái xử lý AI `FAILED`, Error workflow báo quản lý. Nhân viên vẫn xử lý tay được trên web admin.

Phần sàng lọc của người (hỏi ngân sách, khả năng vay, thời gian cần mua) do sale làm khi gọi khách, ghi vào ghi chú hoặc sửa ngân sách, nhu cầu trên trang lead.

## 6. Bot Telegram ghi nhận khách **[Đang chạy]**

Khi khách để lại số trong bot, chat Telegram đó được gắn vào lead (bảng `chat_logs`): log cũ của chat chưa thuộc lead nào chuyển sang lead, log sau tự theo lead. Một chat theo lead đầu tiên; để lại số thứ hai trong cùng chat không chuyển chat sang lead mới. Sale phụ trách nhận thông báo ngay ("Khách Telegram để lại số", hoặc "Khách cũ nhắn lại" nếu số đã có hồ sơ) và đọc lịch sử chat trong trang lead. Bot không hỏi email, ngân sách và không thu đồng ý nhận tin quảng cáo. Chi tiết: [FE-36](../fe-36-bot-ghi-nhan-khach.md).

Bot còn trả lời câu hỏi về căn nhà bằng RAG (luồng 6b nạp tri thức) và đặt lịch hộ khách theo quy tắc khung giờ ở [01-visits.md](01-visits.md) mục 1.

## 7. Chạm đầu tiên và hạn phản hồi

### 7.1. Thông báo cho sale **[Đang chạy]**

- Lead mới, buổi xem mới: báo **sale phụ trách** qua email riêng, Telegram cá nhân và thông báo đẩy (sub-workflow "Thông báo nhân viên"; ba kênh chạy độc lập, kênh nào lỗi không chặn kênh khác). Nhánh thông báo đẩy đã có trong luồng nhưng chỉ có tác dụng khi sale cài app; app Expo dời **[Làm sau]**.
- Quản lý chỉ nhận khi quá hạn, khi không có sale nào nhận khách, hoặc khi có lỗi.
- Sale chưa có kênh nào dùng được: báo email cho quản lý.

### 7.2. Hạn thao tác đầu tiên **[Đang chạy]**

Hệ thống **chỉ đo những gì xảy ra trong hệ thống**. Gọi điện, nhắn Zalo là việc của sale ngoài hệ thống; sale ghi lại kết quả bằng một thao tác dưới đây.

**Thao tác đầu tiên** của sale phụ trách là một trong các việc:

- duyệt lịch, hoặc đổi giờ;
- đặt lịch hộ khách;
- ghi một dòng ghi chú vào lead (ví dụ "đã gọi, hẹn thứ 7");
- đóng lead;
- bấm "Đã liên hệ được" hoặc ghi một lần gọi không được **[Sắp làm FE-44]** ([03-lead-follow-up.md](03-lead-follow-up.md) mục 1).

| Quy tắc | Giá trị | Ở đâu |
|---|---|---|
| Hạn thao tác đầu tiên | **2 giờ**, chỉ tính giờ làm việc **08:00–21:00** mỗi ngày, kể cả cuối tuần, giờ Việt Nam | `backend/src/leads/intake-rules.ts`, cột `response_due_at` |
| Quá hạn | Luồng 2 (chạy mỗi giờ) báo quản lý một lần. Quản lý duyệt thay hoặc chuyển sale | Tác vụ `STAFF_NUDGE` |
| Lead được chuyển sale | Sale mới có 2 giờ làm việc tính từ lúc nhận | |
| Lỗi khi báo quản lý | Thử lại sau 6 giờ | `followup-sql.ts` |

```
Lead vào 09:00   -> hạn 11:00 cùng ngày
Lead vào 20:00   -> hạn 09:00 sáng mai (1 giờ hôm nay, 1 giờ sáng mai)
Lead vào 23:00   -> hạn 10:00 sáng mai
```

Khách đã đặt lịch thì "duyệt lịch" thường chính là thao tác đầu tiên, nên không có hạn duyệt riêng.

### 7.3. Mốc thư tự động tới khách

Hiện có mốc sale thao tác lần đầu (`first_response_at`). Hệ thống **chưa có mốc gửi chính xác** cho thư "đã nhận yêu cầu". Sự kiện `AI_SCORED` của luồng 1 chỉ là **mốc hoàn tất xử lý**: luồng ghi nó sau khi thư khách, báo sale và lưu kết quả AI đã xong, nên nó thiếu khi một bước sau thư lỗi, và `emailSent` trong kết quả AI là boolean không có giờ. Báo cáo dùng `AI_SCORED` phải gọi đúng tên là "thời gian hệ thống hoàn tất xử lý yêu cầu" (FE-47). Muốn có mốc gửi thư chính xác thì định nghĩa riêng, ngoài phạm vi FE-50. `VIEWING_CONFIRMATION_SENT` (FE-50) là của thư chốt lịch ở luồng 1b, không phải mốc này.

### 7.4. Sau chạm đầu tiên

Thao tác đầu tiên chỉ dừng lời nhắc 2 giờ. Nếu sale đã gọi mà **chưa nói chuyện được với khách**, lead đi tiếp sang giai đoạn "cố liên hệ" với các bậc nhắc ngày 1, 3, 7 **[Sắp làm FE-45]**: [03-lead-follow-up.md](03-lead-follow-up.md) mục 1.

## 8. Còn mở

- Mautic tìm contact theo email. Lead không có email đồng bộ sang Mautic theo [FE-40](../fe-40-l7-khong-email.md) **[Mở rộng]**.
- Dữ liệu cũ: các lead trùng số điện thoại trước FE-33 có gộp không. Hiện không gộp, cần quản lý duyệt riêng.
