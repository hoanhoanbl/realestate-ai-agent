# Quy trình 3: Chăm sóc khách sau buổi xem và báo cáo

Quy tắc từ sau buổi xem trở đi. **Phần lõi đề tài** (vế Lead follow-up và Sales analytics): mục 1 hỏi cảm nhận, mục 2 khách im lặng (nhắc sale và nhắc khách HOT), mục 6 báo cáo tuần, mục 7 chống gửi trùng. **Phần mở rộng, phát triển sau** (Marketing Automation qua Mautic, ngoài đề tài): nuôi khách WARM và COLD ở mục 2, mục 3, mục 4, mục 5. Các mục mở rộng có chữ "Mở rộng" ở tiêu đề. Tên file giữ `03-cham-soc-va-marketing.md` để không gãy link. Vai trò, trạng thái và nhãn tiếng Việt: xem [vai-tro-va-trang-thai.md](vai-tro-va-trang-thai.md). Các chặng trước buổi xem: xem [02-dat-lich-den-dat-coc.md](02-dat-lich-den-dat-coc.md).

Cập nhật lần cuối: 12/11/2026.

## Các mốc thời gian

| Mốc | Giá trị hiện tại | Ở đâu |
|---|---|---|
| Hỏi cảm nhận | Khi đã qua giờ hẹn 2 giờ, khách đã được điểm danh "có đến" | Luồng 2 (chạy mỗi giờ) |
| Coi là khách im lặng | 3 ngày sau khi hỏi cảm nhận mà chưa trả lời | Luồng 2 |
| Ngưỡng điểm Mautic báo sale (mở rộng) | 20 điểm | `pointThreshold` trong node "Cấu hình" của luồng 8 |
| Thử lại một việc của luồng 2 bị lỗi | Sau 6 giờ | Luồng 2 |
| Báo cáo tuần | 8 giờ sáng thứ Hai | Trigger "Thứ Hai 8h" của luồng 4 |

## 1. Hỏi cảm nhận sau buổi xem

**Khi nào:** lead "Đã xem nhà", buổi xem "Khách đã đến", đã qua giờ hẹn 2 giờ, khách chưa được hỏi và chưa gửi cảm nhận. Lead chưa được điểm danh thì chưa hỏi (xem điểm danh ở [02-dat-lich-den-dat-coc.md](02-dat-lich-den-dat-coc.md) mục 3.3).

**Hệ thống làm:**

1. Luồng 2 tạo link riêng `/cam-nhan/<mã>` cho khách, AI soạn thư hỏi thăm (AI lỗi thì dùng mẫu dự phòng), gửi khách qua email, ... và ghi "Đã hỏi cảm nhận". Lead không đổi trạng thái. Sale không phải tự gửi thư.
2. Khách bấm link, mở trang cảm nhận trên web (không cần đăng nhập), chấm 1–5 sao, viết nhận xét, chọn mong muốn tiếp theo: muốn đặt cọc, muốn xem căn khác, chưa có nhu cầu nữa.
3. FE-38 local: mỗi buổi xem có link riêng và được gửi một lần; buổi xem sau có link mới. Link hex cũ vẫn thuộc buổi đầu, không bị đổi sang căn mới. Gửi lại cùng link đã nộp: "Anh/chị đã gửi cảm nhận rồi, cảm ơn anh/chị". Chi tiết: [FE-38](../fe-38-han-phan-hoi.md).
4. Luồng 5: AI phân tích cảm xúc (tích cực, trung lập, tiêu cực), tóm tắt và gợi ý việc nên làm; ghi "AI phân tích cảm nhận".
5. Backend tạo việc chăm sóc cùng transaction lưu phản hồi. Sale nhận thông báo mở hồ sơ; xem AI tóm tắt trong hồ sơ khi có kết quả. Khách có email hợp lệ nhận email cảm ơn. Chi tiết theo dõi ở mục 1.1.
6. Cảm nhận **tiêu cực hoặc từ 2 sao trở xuống**: quản lý nhận thêm email cảnh báo.

**Khách phản hồi bằng link, không bằng thư trả lời.** Thư gửi khách là thư tự động. Hệ thống chỉ nhận cảm nhận khách gửi qua trang `/cam-nhan/<mã>`; khách bấm "Trả lời" ngay trong thư thì thư đó vào hộp thư chung của văn phòng, hệ thống **không đọc** và không hiện lên web. Chọn cách này vì form cho dữ liệu có cấu trúc (số sao, mong muốn) để AI phân tích, xếp việc cho nhân viên và tính báo cáo; thư trả lời tự do thì không làm được như vậy.

**Nhân viên xem ở đâu:** trang chi tiết lead trên web admin.

| Lúc | Trang chi tiết lead hiện |
|---|---|
| Đã hỏi, khách chưa gửi | Dòng "Đã hỏi cảm nhận" trong dòng thời gian; chưa có thẻ cảm nhận |
| Khách đã gửi | Thẻ "Cảm nhận của khách": số sao, mong muốn, góp ý, AI tóm tắt kèm cảm xúc và gợi ý việc nên làm. Mong muốn "đặt cọc" và "chưa có nhu cầu" còn hiện trong việc cần làm ở trang tổng quan |
| Khách không gửi sau 3 ngày | Khách được coi là im lặng, chuyển sang mục 2 |

**Sau đó, theo mong muốn khách chọn:**

| Khách chọn | Hệ thống làm | Nhân viên làm |
|---|---|---|
| Muốn đặt cọc | Hiện trong nhóm "Khách muốn đặt cọc" trên trang tổng quan | Gọi khách, lập hợp đồng ([02-dat-lich-den-dat-coc.md](02-dat-lich-den-dat-coc.md) mục 4) |
| Muốn xem căn khác | Ghi vào cảm nhận | Gọi xác nhận nhu cầu, chọn căn và tạo buổi xem mới trong hồ sơ cũ (FE-33/34); không tự tạo lead trùng |
| Chưa có nhu cầu nữa | Hiện trong nhóm "Khách không còn nhu cầu". **Không** tự đóng lead | Liên hệ trong hạn chăm sóc ở mục 1.1 để hỏi lý do, rồi bấm "Không mua" với lý do "Không còn nhu cầu" hoặc mời xem căn khác |

Lý do không tự đóng: "không quan tâm căn này" chưa chắc là "không mua nhà".

## 1.1. Theo dõi sau khi khách đã phản hồi (L5)

Phạm vi đã chốt ngày 12/11: một việc cho mỗi phản hồi mới đã gửi, ghi kết quả gọi lại, hạn liên hệ tiếp, nhắc sale, báo quản lý và lịch sử. Gợi ý căn thay thế chưa thuộc phạm vi đợt này.

**Tạo việc và người phụ trách:** lưu phản hồi, event và việc trong cùng transaction; gửi đồng thời cùng link chỉ thành công một lần. AI/n8n lỗi không làm mất việc. Mỗi việc gắn buổi xem đúng token `v<id>_<32 hex>`; token hex cũ gắn buổi đầu. Không xác định được thì để trống, không lấy nhầm buổi mới nhất. Việc đi theo sale hiện đang phụ trách lead. Chuyển sale giữ nguyên hạn; sale cũ không được sửa nữa. Quản lý xem và xử lý toàn bộ.

**Hạn:** lần xử lý đầu trong 2 giờ làm việc tính từ lúc backend nhận phản hồi; giờ làm việc 08:00–21:00 mỗi ngày, kể cả cuối tuần, UTC+7. Ví dụ nhận 20:30 thì hạn 09:30 hôm sau. Hết hạn nhắc sale, thêm 2 giờ làm việc chưa xử lý thì báo quản lý. L2 quét mỗi giờ nên thông báo xuất hiện ở lần quét tiếp theo; giao diện báo quá hạn theo hạn thực tế. Nếu lần quét đã qua cả mốc báo quản lý, chỉ gửi mốc quản lý. Chưa có sale/kênh riêng thì workflow thông báo dùng đường dự phòng quản lý.

**Trạng thái việc:** `PENDING` (chưa xử lý), `IN_PROGRESS` (đang xử lý), `COMPLETED` (hoàn tất). Quá hạn là nhãn tính từ hạn và trạng thái, không phải trạng thái lead. Mỗi lần ghi kết quả cần ghi chú/lý do, lưu người thực hiện và thời điểm. Hai người sửa cùng phiên bản: người đến sau nhận 409, tải lại trước khi sửa.

| Kết quả | Yêu cầu | Sau khi lưu |
|---|---|---|
| Đã liên hệ (`CONTACTED`) | Ghi nội dung; tick hoàn tất nếu không cần gọi tiếp, còn lại phải đặt hạn tương lai | Hoàn tất hoặc đang xử lý |
| Cần thêm thời gian (`NEEDS_TIME`) | Lý do + hạn liên hệ tiếp ở tương lai | Đang xử lý |
| Chưa liên hệ được (`UNREACHABLE`) | Ghi lần gọi + hạn thử lại ở tương lai | Đang xử lý |
| Hẹn xem tiếp (`NEXT_VIEWING`) | Chọn căn đang bán và giờ xem tương lai trong 08:00–19:00; dùng quy tắc giờ của nhân viên | Tạo lịch NEW thật, lead NEW chờ duyệt, lưu viewingId trong lịch sử, hoàn tất việc |
| Không mua (`NOT_BUYING`) | Lý do; chặn nếu lead DEPOSIT hoặc còn hợp đồng DRAFTING/PENDING_APPROVAL/SENT/SIGNED | Lead LOST/NOT_INTERESTED, hủy lịch NEW và hoàn tất các việc còn mở của khách |

Tạo lịch kiểm tra khoảng cách tối thiểu 60 phút cùng căn và tối đa một lịch NEW của mỗi khách trong transaction. Không tạo lịch giả rồi đánh dấu thành công. Nếu gọi L1 thất bại, lịch đã lưu được giữ lại, automation FAILED để sale duyệt từ trang quản trị. Đóng lead hoặc ký hợp đồng ở các luồng hiện có cũng kết thúc việc còn mở; khách quay lại không làm sống lại việc cũ. Phản hồi đến sau khi khách đã đóng/đã ký được lưu nhưng việc được kết thúc ngay.

**Giao diện:** menu “Theo dõi phản hồi” `/admin/theo-doi-phan-hoi` có bộ lọc việc mở, chưa xử lý, đang xử lý, hạn hôm nay, quá hạn, hoàn tất và tất cả. Hồ sơ khách hiển thị mọi việc của khách, kể cả các buổi xem trước. Danh sách giới hạn 200 dòng/lượt, ưu tiên hạn cũ trước; trường hợp nhiều dữ liệu mở hồ sơ khách để xem riêng.

**Thông báo:** mỗi phiên bản hạn và người phụ trách có các mốc NEW/REMIND/ESCALATE riêng. Sau khi sale ghi kết quả và hẹn lại, tính nhắc theo hạn mới; không gửi thêm NEW cho mỗi lần cập nhật. SENT không gửi lại. Lần gửi lỗi/mất phản hồi giữ REVIEW, hoặc STARTED hết lease 30 phút chuyển REVIEW; không tự gửi lại. Quản lý đối soát lịch sử nhà cung cấp trên trang theo dõi rồi xác nhận đã gửi hoặc cho phép thử lại khi chắc chắn chưa gửi. Không cam kết giao dịch đúng một lần với SMTP; checkpoint ngăn tự gửi trùng khi kết quả chưa chắc chắn.

Cấu hình n8n, API, hướng dẫn test và bàn giao: [luồng theo dõi phản hồi](../luong/luong-5-theo-doi-sau-phan-hoi.md). Báo cáo L4 cho các việc này chưa nằm trong đợt này. Không backfill tự động phản hồi trước khi triển khai để tránh tạo nhắc hàng loạt dữ liệu cũ.

## 2. Khách im lặng sau buổi xem

> **Mở rộng:** hàng WARM và COLD trong bảng dưới dùng Mautic, thuộc Marketing Automation, phát triển sau. Hàng HOT (nhắc sale gọi) là phần lõi.

**Khi nào:** khách đã được hỏi cảm nhận hơn 3 ngày mà chưa trả lời, lead vẫn "Đã xem nhà", và khách **đã tick đồng ý nhận tin** khi đặt lịch. Không tick thì không gửi nội dung marketing (Nghị định 13/2023).

| Mức khách | Hệ thống làm |
|---|---|
| WARM | Luồng 2 tìm contact Mautic đúng email, ghi đoạn nhắc do AI viết vào field `ai_nudge_text`, gắn tag `nuoi-warm`. Mautic đưa khách vào segment "Nuôi WARM" và chạy chuỗi email của campaign. Ghi "Bắt đầu nuôi khách WARM" |
| HOT | Nhắc sale gọi khách qua Telegram, ghi "Đã nhắc sale gọi khách HOT" khi Telegram xác nhận gửi. Không gửi email chăm sóc tự động cho khách. |
| COLD | Gắn tag `ban-tin-hang-thang` cho contact đúng email để Mautic đưa vào segment "Bản tin hằng tháng" sau lần cập nhật segment. Không gửi thư ngay lúc gắn tag. |

Mỗi khách chỉ được đưa vào nuôi một lần. Lead chuyển "Đang làm hợp đồng cọc", "Đã ký hợp đồng cọc" hoặc "Không mua" thì luồng 7 gỡ tag `nuoi-warm` để Mautic dừng gửi.

## 3. Đồng bộ khách sang Mautic (Mở rộng, phát triển sau)

**Khi nào:** mỗi khi AI chấm điểm xong hoặc lead đổi trạng thái, backend báo luồng 7.

**Hệ thống làm:**

- Tìm contact Mautic **đúng email**; chưa có thì tạo mới. Lưu số contact vào lead, ghi "Đồng bộ sang Mautic".
- Gắn tag theo mức khách (HOT, WARM, COLD), trạng thái lead, nguồn khách (`?utm_source=`, mặc định `direct`). Tag mức và trạng thái cũ được gỡ, nên mỗi contact chỉ mang một mức và một trạng thái.
- Khách HOT hoặc có điểm AI từ 80 trở lên được gắn thêm tag `vip-prospect`.
- Mọi khách đều có contact trên Mautic để theo dõi tương tác; việc **gửi** nội dung marketing vẫn chỉ dành cho khách đã đồng ý nhận tin (mục 2).

**Khi lỗi:** luồng 7 ghi "Follow-up bị lỗi" vào nhật ký của lead. Lỗi Mautic không chặn các việc khác (nhắc lịch, hỏi cảm nhận vẫn chạy).

## 4. Điểm tương tác trên Mautic (Mở rộng, phát triển sau)

**Mautic báo về khi:** điểm của contact thay đổi, khách xem một trang trên web, khách mở email. Luồng 8 chỉ nhận yêu cầu có mã bí mật đúng (từ 24 ký tự trở lên); sai mã thì từ chối.

**Hệ thống làm:**

1. Tìm lead theo contact Mautic, cập nhật điểm Mautic, ghi "Điểm Mautic thay đổi". Khách xem trang `/nha/<số>` trên đúng web của mình thì ghi kèm căn đã xem.
2. Điểm **vừa vượt** ngưỡng 20 (trước đó dưới 20, giờ từ 20 trở lên): báo sale qua email, Telegram, .... Chỉ báo một lần lúc vượt, không báo lại mỗi lần điểm tăng thêm.

**Hai trục điểm trên trang chi tiết lead:** điểm AI (lúc đặt lịch, khách có nghiêm túc không) và điểm Mautic (tương tác sau đó, khách còn quan tâm không).

| | Tương tác cao (từ 20 điểm) | Tương tác thấp |
|---|---|---|
| **Khách nóng** (HOT hoặc điểm AI từ 70) | Ưu tiên số 1, chốt cọc ngay | Tiềm năng cao nhưng đang nguội |
| **Khách khác** | Tương tác bứt phá, cần ưu tiên | Đang nuôi tự động (Mautic) |

Trang tổng quan, thẻ chi tiết và bộ lọc "Ưu tiên chốt cọc" dùng chung quy tắc HOT hoặc điểm AI từ 70. Với hồ sơ cũ có điểm từ 70 nhưng nhãn mức chưa khớp, ba nơi vẫn xếp cùng nhóm ưu tiên. Các bộ lọc mức HOT/WARM/COLD tiếp tục dùng nhãn AI đã lưu; ma trận không tự sửa nhãn hoặc điểm khách.

## 5. Theo dõi hành vi trên web khách (Mở rộng, phát triển sau)

Web khách gắn script theo dõi của Mautic: mỗi lần khách chuyển trang công khai, ứng dụng gửi một lượt xem. **Không** tải script hoặc gửi lượt xem trên `/ky`, `/cam-nhan`, `/lich`, `/hop-dong`, `/admin` và các trang con của chúng. Nếu script đã tải từ trang công khai trước đó thì không tải lại hoặc gửi pageview mới khi vào trang bị loại trừ.

URL lượt xem được chốt khi gửi vào hàng đợi; chuyển sang trang chứa token lúc script đang tải không làm lượt xem trước đó dùng URL mới. Khi quay về trang công khai, referrer thuộc các đường dẫn bị loại trừ được để trống để không chuyển mã riêng sang Mautic. Thay đổi BF-07 ngăn ghi mới qua component này, không tự xóa dữ liệu tracking đã lưu trước đó; Hoàng và Hậu cần kiểm tra dữ liệu cũ và xử lý riêng nếu có URL chứa token.

Script hiện chạy cho mọi khách, chưa hỏi đồng ý theo dõi. Làm banner đồng ý hay ghi thành hạn chế đã biết: chưa chốt (xem `danh-sach-task.md`).

## 6. Báo cáo tuần

**Khi nào:** 8 giờ sáng thứ Hai, hoặc quản lý bấm "Tạo báo cáo ngay" trên web admin.

**Hệ thống làm:**

1. Luồng 4 lấy số liệu tuần này và tuần trước: khách mới, đã chốt lịch, đã xem, không đến, hợp đồng tạo, đã ký, không mua, thời gian duyệt trung bình, điểm hài lòng.
2. Tính phễu chuyển đổi và **cảnh báo theo quy tắc cố định** (không nhờ AI đoán, để lần nào cũng nhất quán):

   - Khách mới giảm hơn 30% so với tuần trước (khi tuần trước có từ 3 khách).
   - Có hợp đồng tạo trong tuần nhưng chưa hợp đồng nào được ký.
   - Thời gian duyệt lịch trung bình vượt 24 giờ.
   - Có khách bị lỗi xử lý tự động (`FAILED`).
   - Đang có khách chờ duyệt quá 24 giờ.
   - Điểm hài lòng trung bình dưới 3,5/5 (khi có từ 2 cảm nhận).

3. AI Agent phân tích số liệu, được phép tra thêm database bằng tài khoản **chỉ đọc**, rồi viết nhận xét và đề xuất.
4. Lưu báo cáo (quản lý xem lại trên web admin), gửi email báo cáo cho quản lý. Có cảnh báo thì gửi thêm một email cảnh báo riêng.

Báo cáo đếm riêng số lead "Quá hạn không xử lý" dựa theo lần đóng trong kỳ; không phụ thuộc thông báo quản lý đã gửi hay chưa. FE-23 sẽ thêm số liệu theo nguồn khách và chiến dịch.

## 7. Chống gửi trùng và xử lý lỗi của luồng 2

Luồng 2 chạy mỗi giờ nên một việc (nhắc lịch, hỏi cảm nhận, nuôi khách, nhắc sale, nhắc điểm danh) có thể bị chọn nhiều lần. Bảng `followup_tasks` giữ mỗi việc một dòng:

| Trạng thái việc | Nghĩa |
|---|---|
| Đã nhận (`CLAIMED`) | Một lượt chạy đã nhận việc, giữ 30 phút |
| Đang gửi (`ACTION_STARTED`) | Đã cho phép gửi ra ngoài (email, Mautic, ...) |
| Đã gửi (`ACTION_DONE`) | Bên ngoài xác nhận đã nhận; chỉ còn ghi dữ liệu |
| Xong (`COMPLETED`) | Hoàn tất, không làm lại |
| Lỗi trước khi gửi (`FAILED`) | Chưa gửi gì; sau 6 giờ kiểm tra lại điều kiện rồi thử lại |
| Cần kiểm tra (`REVIEW`) | Mất kết nối lúc đang gửi, không biết đã gửi chưa. **Không tự gửi lại**, người vận hành kiểm tra hộp thư / Mautic rồi xác nhận |

Nguyên tắc: thà để người kiểm tra còn hơn gửi trùng cho khách. Cách xác nhận việc `REVIEW`: xem [luong-2-follow-up.md](../luong/luong-2-follow-up.md).

## 8. Đã lên kế hoạch, chưa làm

FE-21, FE-22 và việc gắn tag "xem căn khác" dưới đây đều dùng Mautic, thuộc phần mở rộng, phát triển sau. FE-23 (báo cáo theo nguồn khách) thuộc vế Sales analytics.

| Việc | Task |
|---|---|
| Form đăng ký nhận tin của Mautic trên web khách (dùng chung segment "Bản tin hằng tháng") | FE-21 |
| Cấu hình Mautic trên server: field `ai_nudge_text`, segment, campaign; bật luồng 2 | FE-22 |
| Báo cáo theo nguồn khách và chiến dịch | FE-23 |
| Khách chọn "muốn xem căn khác" thì gắn tag Mautic để gửi gợi ý căn | Bỏ nếu thiếu giờ |
