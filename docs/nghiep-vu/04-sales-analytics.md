# 04. Sales analytics: báo cáo và đo lường

Vế **Sales analytics** của đề tài. Phân tích không phải một giai đoạn riêng mà là **dữ liệu của mọi giai đoạn**: mỗi chặng ở các file 00 đến 03 ghi mốc thời gian và kết quả vào `lead_events`, file này nói những số đó được tổng hợp thế nào, ai xem, và cảnh báo khi nào. Đề bài yêu cầu "kết quả đo lường được", nên mục 5 ghi rõ số nào dùng để chứng minh hệ thống hiệu quả.

Bản đồ hành trình và cách đọc nhãn: [vai-tro-va-trang-thai.md](vai-tro-va-trang-thai.md) mục 1.

Cập nhật lần cuối: 18/11/2026.

## Tóm tắt

| | Báo cáo tuần | Trang Đội sale | Số liệu sắp thêm |
|---|---|---|---|
| Mục tiêu | Quản lý thấy phễu, điểm nghẽn, ai cần hỗ trợ | Quản lý thấy ngay sale nào đang quá tải hoặc chậm | Trả lời được "mất khách vì đâu", "liên hệ được sau bao lâu", "nguồn nào tốt" |
| Bắt đầu khi | 08:00 sáng thứ Hai, hoặc quản lý bấm "Tạo báo cáo ngay" | Quản lý mở `/admin/doi-sale` | |
| Người xem | Quản lý (web và email) | Quản lý | Quản lý |
| Hệ thống tự động | Lấy số liệu, tính phễu, cảnh báo theo quy tắc, AI Agent phân tích và tra thêm database chỉ đọc, lưu và gửi email | Tính số theo từng người phụ trách | |
| Luồng n8n | L4 | (không qua n8n, API backend) | L4 |
| Tình trạng | **[Đang chạy]** | **[Đang chạy]** | Theo nguồn **[Đang làm FE-23]**; liên hệ, lý do mất khách **[Sắp làm FE-47]** |

```
  00 Tiếp nhận ----+   mốc giao, thao tác đầu tiên, nguồn, mức AI
  01 Visits -------+   đặt, duyệt, đến / không đến, huỷ
  02 Ký hợp đồng --+-->  lead_events, leads, viewings, contracts, feedback
  03 Follow-up ----+   liên hệ được, cảm nhận, lý do mất khách
                                  |
               +------------------+------------------+
               v                                     v
     L4 báo cáo tuần (thứ Hai 8h)           Trang Đội sale (xem ngay)
     quy tắc cảnh báo cố định + AI Agent    theo từng sale, tuần / tháng
               |
               v
     web admin /admin/bao-cao + email quản lý (+ email cảnh báo)
```

## 1. Báo cáo tuần **[Đang chạy]**

**Khi nào:** 08:00 sáng thứ Hai (trigger "Thứ Hai 8h" của luồng 4), hoặc quản lý bấm "Tạo báo cáo ngay" trên web admin.

**Hệ thống làm:**

1. Luồng 4 lấy số liệu tuần này và tuần trước: khách mới, đã chốt lịch, đã xem, không đến, hợp đồng tạo, đã ký, không mua, thời gian duyệt trung bình, điểm hài lòng. Đếm theo khách (một lead là một khách), không theo buổi xem.
2. Tính phễu chuyển đổi và **cảnh báo theo quy tắc cố định** (không nhờ AI đoán, để lần nào cũng nhất quán):
   - Khách mới giảm hơn 30% so với tuần trước (khi tuần trước có từ 3 khách).
   - Có hợp đồng tạo trong tuần nhưng chưa hợp đồng nào được ký.
   - Thời gian duyệt lịch trung bình vượt 24 giờ.
   - Có khách bị lỗi xử lý tự động (`FAILED`).
   - Đang có khách chờ duyệt quá 24 giờ.
   - Điểm hài lòng trung bình dưới 3,5/5 (khi có từ 2 cảm nhận).
3. AI Agent phân tích số liệu, được tra thêm database bằng tài khoản **chỉ đọc**, rồi viết nhận xét và đề xuất. AI chỉ nhận xét dựa trên số liệu, nêu hạn chế khi mẫu nhỏ, không tự đổi giá hay trạng thái nhà.
4. Lưu báo cáo (quản lý xem lại trên web admin), gửi email cho quản lý. Có cảnh báo thì gửi thêm một email cảnh báo riêng.

Báo cáo đếm riêng số lead "Quá hạn không xử lý" theo lần đóng trong kỳ, không phụ thuộc thông báo quản lý đã gửi hay chưa.

### 1.1. Hiệu suất sale (bản gọn)

Bảng theo từng sale: khách được giao trong kỳ, đang phụ trách, phản hồi đúng hạn, quá hạn chưa phản hồi, khách đã đến xem, có hợp đồng cọc, đã ký. **Không** xếp hạng, không so sánh kỳ trước, không tính thời gian phản hồi trung bình hay trung vị. Quản lý nhận trên web và email.

- Đang phụ trách và quá hạn là ảnh chụp lúc lập báo cáo.
- Phản hồi đúng hạn chỉ tính phiên giao hiện tại bắt đầu trong kỳ, vì hồ sơ không giữ thời điểm phản hồi của phiên cũ sau khi chuyển sale.
- Kết quả xem, tạo hợp đồng, ký tra người phụ trách **tại thời điểm phát sinh** từ lịch sử giao khách; thiếu thì để "chưa xác định", không gán cho người hiện tại.
- Mỗi chỉ số đếm khách duy nhất theo người; khách chuyển sale có thể xuất hiện ở nhiều người. Hợp đồng tạo chưa có nghĩa đã nhận tiền.

### 1.2. Hiệu quả từng căn nhà

Mỗi căn: số buổi hẹn trong kỳ, khách đặt xem duy nhất, khách đã đến, số buổi huỷ hoặc không đến, số phản hồi và điểm trung bình, số khách muốn cọc, số hợp đồng tạo và ký.

- Buổi xem tính theo giờ hẹn, trạng thái tại lúc lập báo cáo; không gọi đây là số lịch mới tạo trong kỳ. Cảm nhận tính theo ngày gửi; hợp đồng theo ngày tạo hoặc ký.
- Không suy ra căn từ buổi xem mới nhất của khách: cảm nhận dùng liên kết buổi xem, hợp đồng dùng căn của hợp đồng. Thiếu liên kết thì báo cần kiểm tra.
- Không có điểm thì hiện "Chưa có", không hiện 0 sao; luôn kèm số phản hồi.
- Các nhóm giá, vị trí, diện tích/phòng, tình trạng, pháp lý, khác là **chủ đề được nhắc** trong nhận xét của khách chọn "xem căn khác" hoặc "chưa có nhu cầu", không khẳng định là nguyên nhân từ chối. Một phản hồi có thể nhắc nhiều chủ đề.

Hợp đồng dữ liệu, cách nối node và nghiệm thu: [L4 sale/căn nhà](../luong/luong-4-sale-va-can-nha.md).

## 2. Số liệu sắp thêm vào báo cáo tuần

| Số liệu | Lấy từ | Task |
|---|---|---|
| Khách mới, chốt lịch, ký theo **nguồn khách** và chiến dịch (`utm_source`) | `leads.source` | **[Đang làm FE-23]** |
| Thời gian từ lúc giao đến lúc **đã liên hệ được**, **theo phiên giao** | Sự kiện: mỗi phiên bắt đầu ở `LEAD_ASSIGNED`, `LEAD_REASSIGNED` hoặc `LEAD_REOPENED` (mở lại lead giao lại cho sale cũ mà không ghi sự kiện giao), kết thúc ở sự kiện `CONTACTED` đầu tiên sau đó (xem ghi chú dưới bảng) | **[Sắp làm FE-47]**, sau FE-44 |
| Số lead chưa liên hệ được sau bậc 7 ngày | Sự kiện của luồng 9 | **[Sắp làm FE-47]** |
| Mất khách **theo nhóm lý do** (giá cao, chọn căn khác, mua nơi khác, không liên lạc được, hết nhu cầu, lead nguội, quá hạn...) | `leads.lost_reason` | **[Sắp làm FE-47]** |
| Thời gian thư tự động tới khách | Sự kiện `AI_SCORED` của luồng 1 (ghi sau khi thư "đã nhận yêu cầu" gửi thành công), so với lúc lead được tạo | Có dữ liệu; số liệu trong báo cáo thuộc FE-47 |

**Vì sao "thời gian liên hệ" tính theo phiên giao, không lấy hai cột của lead:** `leads.contacted_at` chỉ lưu lần liên hệ được **đầu tiên** và không đổi khi chuyển sale, còn `leads.assigned_at` đổi theo lần giao mới nhất. Lấy `contacted_at - assigned_at` thì lead đã liên hệ được rồi mới chuyển sale sẽ ra **số âm**. Vì vậy chỉ số này không thêm cột mà tính từ nhật ký: mỗi lần giao hay chuyển sale mở một phiên; thời gian của phiên là từ lúc giao tới sự kiện `CONTACTED` đầu tiên sau đó. Phiên chưa có `CONTACTED` thì đếm vào "chưa liên hệ được", không tính vào trung bình. Báo cáo ghi rõ "theo phiên giao". Lead tạo trước FE-43 không có sự kiện `CONTACTED` (dữ liệu cũ chỉ được ghi cột), nên không vào chỉ số này.

Đề xuất thêm (chưa cấp mã): chênh lệch giá niêm yết và giá thoả thuận khi có dữ liệu FE-48.

## 3. Trang Đội sale **[Đang chạy]**

Chỉ quản lý thấy (sale không thấy mục này và ô lọc theo người phụ trách). Đường dẫn `/admin/doi-sale`, dữ liệu từ `GET /api/stats/team`.

| Kỳ | Cột |
|---|---|
| Hiện tại (mặc định) | Khách đang mở theo trạng thái (đang tư vấn, mới, đã chốt lịch, đã xem, đang cọc), **quá hạn phản hồi**, **im quá 7 ngày** (khách mở không có sự kiện nào trong 7 ngày) |
| Tuần này, tháng này | Khách mới được chia, đã đến xem, đã ký, không mua, theo người đang phụ trách. Mốc 00:00 thứ Hai hoặc ngày 1, giờ Việt Nam |

- Mọi sale đều có dòng; quản lý và "chưa phân công" chỉ hiện khi có số.
- Bấm tên hoặc một số để mở đúng những khách đó ở trang Khách hàng (lọc "Phụ trách").
- Dùng để kiểm tra việc chia lần lượt có đều không ([00-tiep-nhan.md](00-tiep-nhan.md) mục 4).

Cột "im quá 7 ngày" hiện chỉ để xem, không có hành động đi kèm; từ FE-45 luồng 9 nhắc sale và đóng `STALE` cho các lead này ([03-lead-follow-up.md](03-lead-follow-up.md) mục 4.2).

## 4. Dữ liệu mỗi giai đoạn phải ghi

Để báo cáo tính được, mỗi giai đoạn phải ghi đủ bốn loại dữ liệu:

| Dữ liệu | Dùng để | Ghi ở giai đoạn | Tình trạng |
|---|---|---|---|
| Mốc thời gian chuyển chặng | Thời gian phản hồi, phễu | Mọi giai đoạn, qua `lead_events` | [Đang chạy] |
| Nguồn khách | So sánh kênh | GĐ1 | [Đang chạy]; báo cáo theo nguồn ở FE-23 |
| Người phụ trách tại thời điểm phát sinh | Hiệu suất sale | GĐ1, mỗi lần chuyển sale | [Đang chạy] |
| Lý do mất khách theo nhóm | Biết vì sao mất | GĐ12 và mọi lần đóng lead | [Sắp làm FE-43, FE-44] |
| Mốc "đã liên hệ được" | Đo giai đoạn cố liên hệ | GĐ3 | [Sắp làm FE-43, FE-44] |

## 5. Số đo cho báo cáo môn học

Những số dùng để chứng minh "kết quả đo lường được" trong báo cáo cuối kỳ:

| Số đo | Lấy từ | Tình trạng |
|---|---|---|
| Số khách được phản hồi đúng hạn 2 giờ và số quá hạn, theo từng sale | Báo cáo tuần mục 1.1 | [Đang chạy] |
| Thời gian duyệt lịch trung bình | Báo cáo tuần mục 1 | [Đang chạy] |
| Tỷ lệ đến xem, tỷ lệ không đến | Báo cáo tuần | [Đang chạy] |
| Phễu khách mới đến ký | Báo cáo tuần | [Đang chạy] |
| Số lead được nhắc và số lead bị đóng `STALE` (lead không bị bỏ quên) | Luồng 9 | [Sắp làm FE-45, FE-47] |
| Độ chính xác chấm điểm AI trên bộ 20 lead có nhãn | Bộ đo FE-24 | **[Chưa làm FE-24]** |
| Theo dõi chi phí, độ trễ AI ở luồng 1 (Langfuse) | FE-25 | Việc đầu tiên bị cắt nếu thiếu giờ |
