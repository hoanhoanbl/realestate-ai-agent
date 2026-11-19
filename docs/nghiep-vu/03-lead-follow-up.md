# 03. Lead follow-up: liên hệ, chăm sau buổi xem, nuôi và đóng lead

Vế **Lead follow-up** của đề tài. Theo thông lệ của các CRM bất động sản, follow-up chủ yếu là **nhắc sale đúng lúc** (gọi ai, khi nào, nói gì), chỉ một phần nhỏ là gửi thư cho khách. Mục tiêu nghiệp vụ: **không lead nào nằm mãi không ai xử lý**. Mọi lead mở cuối cùng phải về một trong ba kết cục: đã liên hệ được, đã xử lý (hẹn xem, cọc), hoặc đóng có lý do.

Thuộc hành trình: **giai đoạn 3 (cố liên hệ)**, phần sau của **6 (hỏi cảm nhận, theo dõi phản hồi)**, **7 (tìm tiếp, làm sau)** và **12 (nuôi hoặc đóng)**. Bản đồ hành trình và cách đọc nhãn: [vai-tro-va-trang-thai.md](vai-tro-va-trang-thai.md) mục 1. Kế hoạch đầy đủ: [../ke-hoach-hanh-trinh-va-luong-n8n.md](../ke-hoach-hanh-trinh-va-luong-n8n.md); thiết kế và đặc tả: change OpenSpec `journey-followup-ladder`.

Cập nhật lần cuối: 18/11/2026.

## Tóm tắt các giai đoạn

| | GĐ3. Cố liên hệ | GĐ6b. Cảm nhận và theo dõi | GĐ12. Lead im lặng, đóng | Nuôi dài hạn |
|---|---|---|---|---|
| Mục tiêu | Nói chuyện được với khách | Biết khách nghĩ gì sau buổi xem, gọi lại đúng hạn | Lead nguội được nhắc; lead bị bỏ quên được đóng | Giữ liên lạc với khách chưa cần mua |
| Bắt đầu khi | Lead được giao, chưa "đã liên hệ được" | Khách đã đến xem 2 giờ | Lead "Đang tư vấn" hoặc "Đã xem nhà" đã liên hệ được, im 7 ngày | Khách đồng ý nhận tin |
| Kết thúc khi | Sale bấm "Đã liên hệ được", hoặc hết bậc nhắc | Việc chăm sóc hoàn tất | Có hoạt động mới, hoặc đóng `STALE` sau 14 ngày | Khách mua, đóng, hoặc huỷ nhận tin |
| Khách làm | Nghe máy | Chấm sao, chọn mong muốn | Nhận thư sale đã duyệt (nếu đồng ý nhận tin) | Nhận bản tin |
| Sale, quản lý làm | Sale gọi, ghi kết quả từng lần | Sale ghi kết quả gọi. Quản lý nhận báo khi quá hạn, khi cảm nhận tiêu cực | Sale đọc gợi ý AI, sửa và duyệt thư. Quản lý nhận báo khi lead bị đóng | |
| Hệ thống tự động | Nhắc sale ngày 1, 3, 7 kèm gợi ý AI | Gửi link cảm nhận, AI phân tích, tạo việc có hạn, nhắc sale, báo quản lý | Nhắc sale kèm gợi ý AI và nháp thư; tự đóng `STALE` | Mautic gửi chuỗi email |
| Luồng n8n | L9 | L2, L5, L5b | L9 | L7, L8 |
| Tình trạng | **[Sắp làm FE-43, FE-44, FE-45]** | **[Đang chạy]** | **[Sắp làm FE-45]**; hiện chỉ có nhắc HOT (mục 4.1) | **[Mở rộng]** |

```
           Lead được giao (GĐ1)
                  |
     ngày 0: hạn 2 giờ làm việc (đang chạy, 00-tiep-nhan)
                  |
     "Đang tư vấn"/"Mới", chưa liên hệ được? --- L9 nhắc sale ngày 1, 3, 7 [FE-45]
                  |                         |    (bậc rơi vào lúc đã chốt lịch thì bỏ)
          đã liên hệ được             hết bậc 7 vẫn chưa
                  |                         |
                  v                         v
        hẹn xem (01-visits)        lead tiếp tục im ----+
                  |                                     |
   có đến: L2 gửi /cam-nhan sau 2 giờ                   |
                  |                                     |
   L5 AI phân tích -> việc chăm sóc, hạn 2 giờ          |
                  |                                     |
     CONSULTING / VIEWED im 7 ngày                      |
     (đã liên hệ được, hoặc đã lỡ hết bậc, mục 4.2)     |
                  |                                     |
     L9 nhắc sale + AI gợi ý + nháp thư                 |
     -> sale duyệt -> gửi khách (nếu đồng ý nhận tin)   |
                  |                                     |
     im 14 ngày, không lịch mở, không hợp đồng <--------+
                  v
     LOST (STALE), báo quản lý
```

## Các mốc thời gian

| Mốc | Giá trị | Ở đâu | Tình trạng |
|---|---|---|---|
| Bậc nhắc lead chưa liên hệ được | Ngày 1, 3, 7 sau lúc giao (ngày 0 là hạn 2 giờ đã có) | `LADDER_REACH_DAYS` trong `backend/src/followups/followup-policy.ts` | [Sắp làm FE-45] |
| Nhắc lead im lặng | 7 ngày không có hoạt động | `LADDER_QUIET_DAYS` (cùng file) | [Sắp làm FE-45] |
| Tự đóng lead im lặng | 14 ngày không có hoạt động | `LADDER_STALE_DAYS` (cùng file) | [Sắp làm FE-45] |
| Giờ L9 được nhắc sale | 08:00–20:00 giờ Việt Nam, chạy mỗi giờ | Trigger lịch của luồng 9 | [Sắp làm FE-45] |
| Hỏi cảm nhận | Đã qua giờ hẹn 2 giờ, khách đã được điểm danh "có đến" | Luồng 2 (chạy mỗi giờ) | [Đang chạy] |
| Hạn sale xử lý phản hồi | 2 giờ làm việc từ lúc nhận phản hồi; quá hạn nhắc sale, thêm 2 giờ báo quản lý | Theo dõi phản hồi (L5b) | [Đang chạy] |
| Nhắc sale gọi khách HOT im lặng | 3 ngày sau khi hỏi cảm nhận mà chưa trả lời | Luồng 2 | [Đang chạy], bỏ ở FE-45 |
| Thử lại một việc của luồng 2 bị lỗi | Sau 6 giờ | `followup-sql.ts` | [Đang chạy] |
| Ngưỡng điểm Mautic báo sale | 20 điểm | `pointThreshold` trong luồng 8 | [Mở rộng] |

## 1. Cố liên hệ khách **[Sắp làm FE-43, FE-44, FE-45]**

Ngành coi đây là giai đoạn **mất khách nhiều nhất**: sale gọi một lần không nghe rồi quên. Hiện hệ thống chỉ có hạn 2 giờ cho thao tác đầu tiên; ghi một dòng ghi chú là hết nhắc, dù sale chưa nói chuyện được với khách (LH-21).

### 1.1. Đánh dấu "Đã liên hệ được" và ghi lần gọi (FE-43 dữ liệu, FE-44 nút)

**FE-44 đã triển khai local, chưa merge/chưa nghiệm thu server.** Hồ sơ khách có khối "Liên hệ khách" cho người phụ trách và quản lý; người khác chỉ xem. Lead `LOST` hoặc `SIGNED` không nhận thao tác liên hệ mới. Hai API, mốc và nhật ký đã kiểm với PostgreSQL thật; QA component trên Chrome headless 375px đã đạt (callback giả); chưa thay thế nghiệm thu trang admin/API cùng chạy trên server. Bậc nhắc L9 vẫn thuộc FE-45, chưa triển khai.

| Thao tác trên trang lead | Quy tắc |
|---|---|
| **Đã liên hệ được** | Lần bấm đầu lưu giờ và người bấm (cột `leads.contacted_at`, sự kiện `CONTACTED`). Bấm lại không đổi giờ đã lưu. Lead "Không mua" thì bị từ chối |
| **Ghi lần gọi không được** | Chọn một kết quả: **không nghe máy**, **máy bận**, **hẹn gọi lại**, **sai số**. Ghi sự kiện `CONTACT_ATTEMPTED` kèm kết quả và giờ. Không tính là đã liên hệ được |
| Tính là thao tác đầu tiên | Cả hai thao tác đều ghi `first_response_at` nếu chưa có, nên lời nhắc 2 giờ dừng lại |
| **Điểm danh "có đến" tự ghi "đã liên hệ được"** | Sale đã gặp khách ở buổi xem tức là đã liên hệ được. Khi sale điểm danh "có đến" mà lead chưa có mốc này, hệ thống tự ghi giờ điểm danh và người điểm danh (sự kiện `CONTACTED`, ghi chú "từ điểm danh"). Đã có mốc thì giữ nguyên. Điểm danh "không đến" không tính |
| Dữ liệu cũ | Khi nâng cấp (FE-43), lead đã có buổi xem "Khách đã đến" được ghi mốc "đã liên hệ được" bằng giờ của buổi xem đến sớm nhất |

API: `POST /api/leads/:id/contacted`, `POST /api/leads/:id/contact-attempts`.

### 1.2. Bậc nhắc sale (luồng 9)

| Quy tắc | Nội dung |
|---|---|
| Áp dụng cho | Lead **"Đang tư vấn" hoặc "Mới"** chưa "đã liên hệ được" |
| Không áp cho | Lead "Đã chốt lịch": sale và khách đã thống nhất giờ xem. Lead "Đã xem nhà": đã tự ghi "đã liên hệ được" khi điểm danh |
| Bậc | Ngày 1, 3, 7 kể từ lúc giao. Mỗi bậc gửi tối đa một lần cho mỗi lần giao |
| Đã liên hệ được trước bậc | Các bậc sau không gửi nữa (ví dụ bấm ngày 2 thì không có nhắc ngày 3, ngày 7) |
| Chuyển sale | Các bậc tính lại từ lúc giao mới và gửi cho sale mới |
| Mốc "đủ điều kiện từ lúc" | Lúc gần nhất lead **bắt đầu** ở "Đang tư vấn" hoặc "Mới": lúc tạo lead, lúc giao hoặc chuyển sale, lúc mở lại lead, hoặc lần đổi trạng thái gần nhất vào một trong hai trạng thái này. Một bậc chỉ gửi khi **mốc ≤ giờ của bậc ≤ hiện tại < giờ bậc kế tiếp** (bậc 7 không có giờ kế tiếp) |
| Lịch bị huỷ, lead về "Đang tư vấn" | Giờ các bậc vẫn tính từ lúc giao cũ, nhưng bậc nào rơi vào lúc lead đang "Đã chốt lịch" thì bỏ, **không gửi bù**. Ví dụ giao ngày 0, chốt lịch ngày 1, huỷ ngày 2: mốc là ngày 2, nên không có nhắc ngày 1, vẫn có nhắc ngày 3 và 7 |
| Mở lại lead đã "Không mua" | Mở lại là giao lại, nên các bậc tính lại từ lúc mở; không gửi bậc nào của lần giao trước |
| Mỗi lời nhắc | Kèm gợi ý của AI (mục 4.3) |
| Hết bậc 7 vẫn chưa liên hệ được | Không nhận thêm nhắc im lặng (mục 4.2). Không ai làm gì thì lead bị đóng `STALE` khi đủ 14 ngày im; sale có thể đóng trước với lý do "Không liên lạc được" |

## 2. Hỏi cảm nhận sau buổi xem **[Đang chạy]**

**Khi nào:** lead "Đã xem nhà", buổi xem "Khách đã đến", đã qua giờ hẹn 2 giờ, khách có email, chưa được hỏi và chưa gửi cảm nhận. Chưa điểm danh thì chưa hỏi ([01-visits.md](01-visits.md) mục 4.1).

**Hệ thống làm:**

1. Luồng 2 tạo link riêng `/cam-nhan/<mã>` cho buổi xem, AI soạn thư hỏi thăm (AI lỗi thì dùng mẫu dự phòng), gửi khách, ghi "Đã hỏi cảm nhận". Lead không đổi trạng thái. Sale không phải tự gửi thư.
2. Khách mở link (không cần đăng nhập), chấm 1–5 sao, viết nhận xét, chọn mong muốn tiếp theo: **muốn đặt cọc**, **muốn xem căn khác**, **chưa có nhu cầu nữa**.
3. Mỗi buổi xem có link riêng, gửi một lần; buổi xem sau có link mới. Link hex cũ thuộc buổi đầu. Gửi lại cùng link đã nộp: "Anh/chị đã gửi cảm nhận rồi, cảm ơn anh/chị". Chi tiết: [FE-38](../fe-38-han-phan-hoi.md).
4. Luồng 5: AI phân tích cảm xúc (tích cực, trung lập, tiêu cực), tóm tắt và gợi ý việc nên làm; ghi "AI phân tích cảm nhận".
5. Backend tạo việc chăm sóc cùng transaction lưu phản hồi (mục 3). Khách có email hợp lệ nhận email cảm ơn.
6. Cảm nhận **tiêu cực hoặc từ 2 sao trở xuống**: quản lý nhận thêm email cảnh báo.

**Khách phản hồi bằng link, không bằng thư trả lời.** Thư trả lời vào hộp thư chung của văn phòng, hệ thống không đọc. Chọn cách này vì form cho dữ liệu có cấu trúc (số sao, mong muốn) để AI phân tích, xếp việc và tính báo cáo.

| Lúc | Trang chi tiết lead hiện |
|---|---|
| Đã hỏi, khách chưa gửi | Dòng "Đã hỏi cảm nhận" trong dòng thời gian |
| Khách đã gửi | Thẻ "Cảm nhận của khách": số sao, mong muốn, góp ý, AI tóm tắt kèm cảm xúc và gợi ý |
| Khách không gửi | Lead đi vào quy tắc im lặng (mục 4) |

| Khách chọn | Hệ thống làm | Sale làm |
|---|---|---|
| Muốn đặt cọc | Hiện trong nhóm "Khách muốn đặt cọc" trên trang tổng quan | Gọi khách, lập hợp đồng ([02-document-signing.md](02-document-signing.md) mục 2) |
| Muốn xem căn khác | Ghi vào cảm nhận, tạo việc chăm sóc | Gọi xác nhận nhu cầu, chọn căn, tạo buổi xem mới trong hồ sơ cũ (không tạo lead trùng) |
| Chưa có nhu cầu nữa | Hiện trong nhóm "Khách không còn nhu cầu". **Không** tự đóng lead | Gọi hỏi lý do trong hạn chăm sóc, rồi đóng với lý do phù hợp hoặc mời xem căn khác |

Lý do không tự đóng: "không quan tâm căn này" chưa chắc là "không mua nhà".

## 3. Theo dõi sau khi khách phản hồi (L5b) **[Đang chạy]**

Mỗi phản hồi mới tạo **một việc** cho sale, có hạn, có nhắc, có báo quản lý và lịch sử. Gợi ý căn thay thế tự động chưa thuộc phạm vi.

**Tạo việc và người phụ trách:** lưu phản hồi, event và việc trong cùng transaction; gửi đồng thời cùng link chỉ thành công một lần. AI hoặc n8n lỗi không làm mất việc. Mỗi việc gắn đúng buổi xem của token `v<id>_<32 hex>` (token hex cũ gắn buổi đầu); không xác định được thì để trống, không lấy nhầm buổi mới nhất. Việc đi theo sale đang phụ trách lead; chuyển sale giữ nguyên hạn, sale cũ không sửa được nữa. Quản lý xem và xử lý toàn bộ.

**Hạn:** lần xử lý đầu trong 2 giờ làm việc (08:00–21:00 mỗi ngày, UTC+7) từ lúc backend nhận phản hồi. Ví dụ nhận 20:30 thì hạn 09:30 hôm sau. Hết hạn nhắc sale; thêm 2 giờ làm việc chưa xử lý thì báo quản lý. L2 quét mỗi giờ, nên thông báo xuất hiện ở lần quét tiếp theo; nếu lần quét đã qua cả mốc báo quản lý thì chỉ gửi mốc quản lý.

**Trạng thái việc:** `PENDING` (chưa xử lý), `IN_PROGRESS` (đang xử lý), `COMPLETED` (hoàn tất). "Quá hạn" là nhãn tính từ hạn, không phải trạng thái lead. Mỗi lần ghi kết quả cần ghi chú, lưu người làm và thời điểm. Hai người sửa cùng phiên bản: người đến sau nhận 409.

| Kết quả sale ghi | Yêu cầu | Sau khi lưu |
|---|---|---|
| Đã liên hệ (`CONTACTED`) | Ghi nội dung; tick hoàn tất nếu không cần gọi tiếp, không thì đặt hạn mới | Hoàn tất hoặc đang xử lý |
| Cần thêm thời gian (`NEEDS_TIME`) | Lý do + hạn liên hệ tiếp | Đang xử lý |
| Chưa liên hệ được (`UNREACHABLE`) | Ghi lần gọi + hạn thử lại | Đang xử lý |
| Hẹn xem tiếp (`NEXT_VIEWING`) | Chọn căn đang bán và giờ trong 08:00–19:00 (quy tắc giờ của nhân viên); từ FE-53 kiểm tra cả lịch của sale ([01-visits.md](01-visits.md) mục 1.6) | Tạo buổi xem thật, lead "Mới" chờ duyệt, hoàn tất việc |
| Không mua (`NOT_BUYING`) | Lý do; bị chặn nếu lead đang làm hợp đồng hoặc còn hợp đồng hiệu lực | Lead "Không mua" (hiện ghi lý do `NOT_INTERESTED`), huỷ lịch đang chờ, hoàn tất các việc còn mở |

Đóng lead hoặc ký hợp đồng ở các luồng khác cũng kết thúc việc còn mở; khách quay lại không làm sống lại việc cũ. Phản hồi đến sau khi lead đã đóng hoặc đã ký được lưu nhưng việc kết thúc ngay.

**Còn mở:** kết quả "Không mua" có chuyển sang dùng lý do chi tiết của FE-43 không (mục 4.4). Hậu quyết định ở PR sau.

**Giao diện:** menu "Theo dõi phản hồi" `/admin/theo-doi-phan-hoi`, lọc việc mở, chưa xử lý, đang xử lý, hạn hôm nay, quá hạn, hoàn tất, tất cả; tối đa 200 dòng mỗi lượt, hạn cũ trước. Hồ sơ khách hiện mọi việc của khách.

**Thông báo:** mỗi phiên bản hạn và người phụ trách có các mốc NEW, REMIND, ESCALATE riêng. Sale hẹn lại thì tính nhắc theo hạn mới, không gửi thêm NEW. Gửi lỗi hoặc mất phản hồi thì giữ `REVIEW`, không tự gửi lại; quản lý đối soát rồi xác nhận đã gửi hoặc cho thử lại. Chi tiết, API và nghiệm thu: [luồng theo dõi phản hồi](../luong/luong-5-theo-doi-sau-phan-hoi.md). Không backfill phản hồi cũ.

## 4. Lead im lặng và đóng lead

### 4.1. Hiện tại: chỉ khách HOT được nhắc **[Đang chạy, bỏ ở FE-45]**

**Khi nào:** khách đã được hỏi cảm nhận hơn 3 ngày mà chưa trả lời, lead vẫn "Đã xem nhà", khách **đã tick đồng ý nhận tin**.

| Mức khách | Hệ thống làm |
|---|---|
| HOT | Luồng 2 nhắc sale gọi khách qua Telegram, ghi "Đã nhắc sale gọi khách HOT". Không gửi thư cho khách |
| WARM | **[Mở rộng]** Gắn tag Mautic `nuoi-warm` kèm đoạn nhắc do AI viết, Mautic chạy chuỗi email |
| COLD | **[Mở rộng]** Gắn tag `ban-tin-hang-thang`, Mautic đưa vào bản tin hằng tháng |

**Lỗ hổng (LH-20, LH-21):** khách WARM, COLD hoặc không tick đồng ý nhận tin thì sau buổi xem không có việc tự động nào; lead "Đang tư vấn" và "Đã xem nhà" không có hạn xử lý, nằm vô thời hạn. FE-45 thay toàn bộ bảng trên bằng mục 4.2 và gỡ ba loại nhắc này khỏi bộ chọn của luồng 2 (giữ mã trong code để lịch sử cũ vẫn hiện).

### 4.2. Nhắc sau 7 ngày, đóng sau 14 ngày **[Sắp làm FE-45]**

| Quy tắc | Nội dung |
|---|---|
| Áp dụng cho | Lead "Đang tư vấn" hoặc "Đã xem nhà", **mọi mức** HOT, WARM, COLD, **có hay không** đồng ý nhận tin |
| Im 7 ngày | Nhắc sale phụ trách, kèm gợi ý AI (mục 4.3). Chỉ cho lead **đã liên hệ được**: lead chưa liên hệ được đã có bậc nhắc ở mục 1.2, nên ngày 7 không nhận cả hai lời nhắc |
| Ngoại lệ: lead chưa liên hệ được đã lỡ hết bậc | Khi giờ bậc 7 rơi trước mốc "đủ điều kiện từ lúc" (mục 1.2), không bậc nào còn gửi được nữa. Lead này được nhắc im lặng như lead đã liên hệ được. Ví dụ giao ngày 0, chốt lịch ngày 1, khách huỷ ngày 10 và không ai làm gì thêm: không có bậc nhắc, nhắc im lặng ngày 17, đóng `STALE` ngày 24. Không có ngoại lệ này thì lead bị đóng mà sale chưa nhận lời nhắc nào |
| Không nhắc, không đóng khi | Lead còn **việc chăm sóc sau phản hồi chưa hoàn tất** (mục 3). Việc đó đã có hạn, nhắc sale và báo quản lý riêng, nên luồng 9 im lặng. Ví dụ sale ghi "Cần thêm thời gian", hẹn gọi lại sau 21 ngày: lead không bị nhắc ngày 7, không bị đóng ngày 14. Việc hoàn tất thì đếm 7 ngày lại từ lúc đó |
| Im 14 ngày | Tự đóng "Không mua" lý do **`STALE`** (Lead nguội, không ai xử lý), ghi `LEAD_STALE_CLOSED`, báo quản lý. Áp dụng cho cả lead đã và chưa liên hệ được |
| Đóng rồi mà luồng dừng trước khi báo quản lý | Lượt chạy sau vẫn tìm lại được việc đóng đó (lead "Không mua" lý do `STALE`, có `LEAD_STALE_CLOSED` ghi đúng mã việc) và chỉ chạy nốt bước báo quản lý, không đóng lại lần nữa. Cách làm giống việc đóng lead quá hạn `EXPIRED` của luồng 2 |
| Không đóng khi | Lead có buổi xem đang mở, có hợp đồng chưa bị từ chối, chưa hết hạn, hoặc có việc chăm sóc chưa hoàn tất |
| Mở lại | Nhân viên mở lại lead `STALE` (hoặc khách đặt lịch lại) thì đếm lại từ lúc mở |
| Hoạt động là gì | Thời điểm muộn nhất trong: lúc tạo lead, và các sự kiện ghi chú, đã liên hệ được, ghi lần gọi, đổi trạng thái, giao hoặc chuyển sale, mở lại lead, khách gửi cảm nhận, duyệt lịch, khách không đến, huỷ lịch, đổi giờ, khách xin đổi lịch, sale ghi kết quả chăm sóc phản hồi, sale duyệt thư L9 |
| Vì sao là danh sách cố định | Một việc tự động mới thêm sau này (ví dụ gửi thư) không vô tình làm đồng hồ đếm lại |

Ví dụ: sale ghi chú ngày thứ 5 của đợt im lặng thì không có nhắc ngày 7 của đợt cũ; đợt 7 ngày mới bắt đầu từ ghi chú đó.

Hai ngưỡng 7 và 14 ngày là hằng số, chỉnh theo thực tế; không chia theo mức khách hay theo nguồn.

**Hạn chế đã biết:** lead "Đang tư vấn" không có việc chăm sóc thì không hẹn gọi lại xa hơn 7 ngày được; sale phải ghi chú lại, không thì lead bị nhắc ngày 7 và đóng ngày 14. Sau này có thể thêm ô "ngày liên hệ tiếp" trên lead.

### 4.3. AI gợi ý và sale duyệt thư **[Sắp làm FE-45]**

Mỗi lời nhắc của luồng 9 (bậc liên hệ ở mục 1.2 và nhắc im lặng ở mục 4.2) đi qua các bước:

| Bước | Nội dung |
|---|---|
| AI gợi ý | Gemini trả kết quả có cấu trúc: **việc nên làm tiếp** (gọi, gửi thư, mời xem căn mới, chờ), **lý do** ngắn, **nháp thư** cho khách |
| Kiểm tra nội dung (guardrail) | Bỏ nháp nếu hứa giá hoặc giảm giá, nêu thông tin không có trong dữ liệu lead, rỗng hoặc quá dài. Bỏ nháp hoặc AI lỗi thì sale vẫn nhận lời nhắc, chỉ không có nháp |
| Báo sale | Qua "Thông báo nhân viên", kèm việc nên làm, lý do và link duyệt |
| Sale duyệt | Mở link `/duyet-thu/<mã>` (không cần đăng nhập): xem tóm tắt lead, sửa nháp (tối đa 1500 ký tự, chữ thường), bấm "Gửi cho khách" hoặc "Bỏ qua" |
| Gửi khách | Chỉ khi khách **có email và đã đồng ý nhận tin**. Không đồng ý thì lời nhắc không có nút gửi, sale được nhắc liên hệ trực tiếp |
| Link | Dùng một lần; hết hiệu lực khi lead đã đóng hoặc đã có bậc nhắc mới hơn. Mở lại sau khi gửi: "đã xử lý" |
| Hai việc tách nhau | Việc nhắc (`LADDER_REACH`, `LADDER_QUIET`) **xong ngay khi đã báo sale**, kèm gợi ý AI đã lưu. Sale bấm "Gửi cho khách" thì hệ thống tạo **một việc riêng** `LADDER_EMAIL` (mã `LADDER_EMAIL:<mã việc nhắc>`) để gửi thư. Mã này là duy nhất, nên sale bấm hai lần hay mở hai tab cũng chỉ một thư đi; lần bấm sau thấy "đã xử lý". Ghi kết quả gửi không xoá gợi ý AI đã lưu |
| Nhật ký | `LADDER_STEP_SENT` khi nhắc sale, `LADDER_APPROVED` khi sale duyệt |

Vì sao không gửi thẳng cho khách: đề bài yêu cầu bước người duyệt (Human Approval), và thư do AI viết gửi khách mà không ai xem là rủi ro.

### 4.4. Lý do "Không mua" chi tiết **[FE-43 đã có; FE-44 đã triển khai local, chưa merge]**

Sale đóng lead bằng tay chỉ chọn được: **Giá cao**, **Chọn căn khác**, **Đã mua nơi khác**, **Không liên lạc được**, **Hết nhu cầu**, **Lý do khác**. Các lý do **Khách không đến**, **Khách tự huỷ lịch**, **Quá hạn không xử lý**, **Lead nguội (`STALE`)** chỉ hệ thống được ghi; gửi tay bị từ chối. Mã và nhãn: [vai-tro-va-trang-thai.md](vai-tro-va-trang-thai.md) mục 5.1. Báo cáo chia mất khách theo các nhóm này ([04-sales-analytics.md](04-sales-analytics.md) mục 4).

### 4.5. Luồng 9 theo khung của môn **[Sắp làm FE-45]**

| Bước | Nội dung |
|---|---|
| Trigger | Lịch, mỗi giờ trong 08:00–20:00 |
| Dữ liệu | Gọi `GET /api/followups/ladder-due` lấy tối đa 50 việc đến hạn (bậc liên hệ, im lặng, đóng) |
| Quyết định | Switch theo loại và bậc; nhận việc (`claim`) để hai lượt chạy không gửi trùng |
| AI | Gemini với output có cấu trúc, guardrail kiểm tra nháp |
| Người duyệt | Sale duyệt thư qua link (mục 4.3) |
| Hành động | Nhắc sale; gửi thư sau khi duyệt (lối vào thứ hai của luồng); quá bậc cuối thì báo quản lý; đóng `STALE` |
| Log và lỗi | Ghi `lead_events`; retry 3 lần ở node HTTP, email, AI; lỗi đẩy sang Error workflow |

## 5. Tìm tiếp: gợi ý căn khác **[Làm sau]**

Khách chọn "muốn xem căn khác": hiện sale gợi ý căn bằng tay (mục 2) và bot Telegram tìm được căn theo tiêu chí. Tự động gợi ý căn phù hợp (theo ngân sách, khu vực, căn mới lên) là điểm cộng, không bắt buộc cho đề tài.

## 6. Chống gửi trùng và xử lý lỗi **[Đang chạy]**

Luồng 2 chạy mỗi giờ nên một việc có thể bị chọn nhiều lần. Bảng `followup_tasks` giữ mỗi việc một dòng. Luồng 9 dùng lại đúng cơ chế này **[Sắp làm FE-45]**.

| Trạng thái việc | Nghĩa |
|---|---|
| Đã nhận (`CLAIMED`) | Một lượt chạy đã nhận việc, giữ 30 phút |
| Đang gửi (`ACTION_STARTED`) | Đã cho phép gửi ra ngoài (email, Telegram, Mautic) |
| Đã gửi (`ACTION_DONE`) | Bên ngoài xác nhận đã nhận; chỉ còn ghi dữ liệu |
| Xong (`COMPLETED`) | Hoàn tất, không làm lại |
| Lỗi trước khi gửi (`FAILED`) | Chưa gửi gì; sau 6 giờ kiểm tra lại điều kiện rồi thử lại |
| Cần kiểm tra (`REVIEW`) | Mất kết nối lúc đang gửi, không biết đã gửi chưa. **Không tự gửi lại**, người vận hành kiểm tra rồi xác nhận |

Nguyên tắc: thà để người kiểm tra còn hơn gửi trùng cho khách. Cách xác nhận việc `REVIEW`: [luong-2-follow-up.md](../luong/luong-2-follow-up.md).

## 7. Nuôi khách qua Mautic **[Mở rộng]**

Marketing Automation qua Mautic nằm ngoài đề tài, đóng băng từ 13/11: không làm thêm, ghi là phần mở rộng trong báo cáo. Các quy tắc dưới đây là phần đã có trong code (luồng 7, 8).

### 7.1. Đồng bộ khách sang Mautic

**Khi nào:** mỗi khi AI chấm điểm xong hoặc lead đổi trạng thái, backend báo luồng 7.

- Tìm contact Mautic **đúng email**, chưa có thì tạo mới; lead không có email xử lý theo [FE-40](../fe-40-l7-khong-email.md). Lưu số contact vào lead, ghi "Đồng bộ sang Mautic".
- Gắn tag theo mức khách, trạng thái lead, nguồn khách (mặc định `direct`). Tag mức và trạng thái cũ được gỡ, nên mỗi contact chỉ mang một mức và một trạng thái.
- Khách HOT hoặc điểm AI từ 80 được gắn thêm `vip-prospect`.
- Mọi khách đều có contact để theo dõi tương tác; **gửi** nội dung marketing chỉ cho khách đã đồng ý nhận tin.
- Lead chuyển "Đang làm hợp đồng cọc", "Đã ký hợp đồng cọc" hoặc "Không mua" thì luồng 7 gỡ tag `nuoi-warm` để Mautic dừng gửi.
- Lỗi: ghi "Follow-up bị lỗi" vào nhật ký lead. Lỗi Mautic không chặn các việc khác.

### 7.2. Điểm tương tác

**Mautic báo về khi:** điểm contact thay đổi, khách xem một trang trên web, khách mở email. Luồng 8 chỉ nhận yêu cầu có mã bí mật đúng (từ 24 ký tự); sai mã thì từ chối.

1. Tìm lead theo contact Mautic, cập nhật điểm Mautic, ghi "Điểm Mautic thay đổi". Khách xem trang `/nha/<số>` thì ghi kèm căn đã xem.
2. Điểm **vừa vượt** ngưỡng 20 (trước dưới 20, giờ từ 20): báo sale một lần, không báo lại mỗi lần tăng thêm.

| | Tương tác cao (từ 20 điểm) | Tương tác thấp |
|---|---|---|
| **Khách nóng** (HOT hoặc điểm AI từ 70) | Ưu tiên số 1, chốt cọc ngay | Tiềm năng cao nhưng đang nguội |
| **Khách khác** | Tương tác bứt phá, cần ưu tiên | Đang nuôi tự động |

Trang tổng quan, thẻ chi tiết và bộ lọc "Ưu tiên chốt cọc" dùng chung quy tắc HOT hoặc điểm AI từ 70. Các bộ lọc mức HOT/WARM/COLD dùng nhãn AI đã lưu; ma trận không tự sửa nhãn hay điểm.

### 7.3. Theo dõi hành vi trên web khách

Web khách gắn script theo dõi của Mautic: mỗi lần chuyển trang công khai gửi một lượt xem. **Không** tải script hoặc gửi lượt xem trên `/ky`, `/cam-nhan`, `/lich`, `/hop-dong`, `/admin` và trang con. Script đã tải từ trang công khai thì không gửi lượt xem mới khi vào trang bị loại trừ. URL lượt xem được chốt lúc vào hàng đợi; quay về trang công khai thì referrer thuộc đường dẫn bị loại trừ được để trống, để không chuyển mã riêng sang Mautic (BF-07). Dữ liệu tracking cũ có URL chứa token cần kiểm tra và xử lý riêng.

Script chạy cho mọi khách, chưa hỏi đồng ý theo dõi. Làm banner đồng ý hay ghi thành hạn chế đã biết: chưa chốt.

### 7.4. Việc Mautic đã lên kế hoạch

| Việc | Task |
|---|---|
| Form đăng ký nhận tin trên web khách (segment "Bản tin hằng tháng") | FE-21 |
| Cấu hình Mautic trên server: field `ai_nudge_text`, segment, campaign | FE-22 |
| Khách chọn "muốn xem căn khác" thì gắn tag Mautic để gửi gợi ý căn | Bỏ nếu thiếu giờ |
