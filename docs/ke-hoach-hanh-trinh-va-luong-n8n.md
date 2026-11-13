# Kế hoạch hoàn thiện hành trình khách và các luồng n8n

Ghi lại buổi rà soát ngày 13/11/2026: đối chiếu hành trình khách của hệ thống với hành trình chuẩn của các CRM bất động sản và với đề bài của thầy, rồi chốt luồng n8n nào giữ, sửa, thêm.

**Trạng thái (13/11/2026):** hướng đã thống nhất và **đã cấp mã task** (FE-43 đến FE-50, DC-14, CH-09) trong [danh-sach-task.md](danh-sach-task.md). Chưa sửa code hay workflow. Các quyết định đã chốt và việc để sau nằm ở mục 9. Kế hoạch triển khai FE-43 đến FE-46: change OpenSpec `journey-followup-ladder`. Đây không phải quy tắc đang chạy; quy tắc đang chạy nằm ở [nghiep-vu/](nghiep-vu/).

Cách đọc nguồn: phần nào lấy từ tài liệu CRM thì có link ở mục 11. Phần **"đề xuất"** là suy luận theo thông lệ chung và thị trường Việt Nam, tìm kiếm không có nguồn xác nhận.

## 1. Vì sao làm

Quy trình 1 (tiếp nhận, chia sale) đã rà kỹ và có bảng lỗ hổng LH-01..11. Quy trình 2 và 3 có quy tắc trong `docs/nghiep-vu/` nhưng bảng lỗ hổng ghi "chưa rà" ([danh-sach-lo-hong.md](danh-sach-lo-hong.md)). Tài liệu nghiệp vụ còn chỗ mâu thuẫn và chưa trả lời được "khách không phản hồi thì sao".

## 2. Hành trình khách hiện tại (theo tài liệu nghiệp vụ)

Lấy từ [tong-quan-du-an.md](tong-quan-du-an.md) và [nghiep-vu/](nghiep-vu/). Chưa kiểm lại từng dòng trong code.

| # | Chặng | Trạng thái lead | Khách | Sale | Quản lý | Tự động (n8n, AI) |
|---|---|---|---|---|---|---|
| 1 | Khách vào | `CONSULTING` hoặc `NEW` | Đặt lịch web, hoặc để số trong bot | Nhập tay khách gọi hotline, đến văn phòng | | Chuẩn hoá số điện thoại, nhận ra khách cũ, chia sale lần lượt, AI chấm HOT/WARM/COLD |
| 2 | Chờ duyệt | `NEW` | Nhận thư "đã nhận yêu cầu" | Thao tác đầu tiên trong 2 giờ làm việc | Được báo khi sale quá hạn, chuyển sale | Báo sale phụ trách. Giờ hẹn qua mà chưa duyệt thì `LOST` (`EXPIRED`) |
| 3 | Chốt lịch | `CONFIRMED` | Nhận thư chốt lịch, link `/lich` | Duyệt hoặc đổi giờ | | L1b gửi thư. L2 nhắc lịch trước 24 giờ |
| 4 | Đi xem | `CONFIRMED` | Đến xem | Điểm danh (từ 30 phút trước giờ hẹn) | Được báo nếu quên điểm danh 24 giờ | Nhắc sale điểm danh sau 2 giờ |
| 5 | Đã xem, hoặc không đến | `VIEWED`; không đến thì về `VIEWED` hoặc `CONSULTING` | | Gọi lại, hoặc bấm "Không mua" | | Sau 2 giờ gửi link `/cam-nhan` |
| 6 | Phản hồi | `VIEWED` | Chấm sao, chọn "muốn cọc / xem căn khác / chưa cần" | Gọi theo lựa chọn | Được báo nếu cảm nhận tiêu cực | L5: AI phân tích cảm nhận |
| 7 | Khách im lặng | `VIEWED` | Không trả lời | HOT được nhắc gọi | | Sau 3 ngày. WARM/COLD chỉ qua Mautic và chỉ khi khách đã đồng ý nhận tin |
| 8 | Lập hợp đồng | `DEPOSIT` | | Lập hợp đồng, nhập tiền cọc | | AI soạn và rà. Căn thành `RESERVED` |
| 9 | Duyệt hợp đồng | `DEPOSIT` | | | Duyệt hoặc từ chối trong 48 giờ | Từ chối hoặc hết hạn thì lead về `VIEWED`, căn về `AVAILABLE` |
| 10 | Ký | `SIGNED` | Ký tại `/ky`, hạn 7 ngày | Được báo | | Nhắc ký sau 48 giờ |
| 11 | Sau ký | `SIGNED` | | | Xác nhận "đã nhận cọc", đánh dấu căn `SOLD` | Hệ thống dừng ở đây |
| 12 | Báo cáo | | | | Xem báo cáo | L4 chạy 8 giờ sáng thứ Hai |

`LOST` đi tới được từ `CONSULTING`, `NEW`, `CONFIRMED`, `VIEWED`. Lead `DEPOSIT` phải từ chối hợp đồng trước mới đóng được.

## 3. Lỗ hổng logic tìm thấy

**Nghiêm trọng**

1. **Khách WARM/COLD hoặc không tick đồng ý nhận tin: sau buổi xem không có việc tự động nào chạy.** Sau khi tách Mautic thành phần mở rộng, nhánh nhắc khách im lặng ở phần lõi chỉ còn HOT. Lead nằm ở `VIEWED` vô thời hạn, không có hạn nhắc sale, không có tự đóng.
2. **`CONSULTING` và `VIEWED` không có hạn xử lý.** Hạn 2 giờ chỉ đo "thao tác đầu tiên". Khách bị huỷ hoặc không đến, về `CONSULTING`, thì không ai bị nhắc gọi lại. Trang Đội sale chỉ đo số khách im quá 7 ngày, không có hành động đi kèm.
3. **Hợp đồng lấy căn của buổi xem đã đến gần nhất** (`contracts.service.ts`). Khách xem căn A rồi căn B, muốn cọc căn A, thì hợp đồng ra căn B; sale không chọn được căn.
4. **Sau `SIGNED` không có đường lui.** Khách bỏ cọc, hoàn cọc, hoặc quản lý quên xác nhận "đã nhận cọc" đều không có trạng thái hay nhắc việc. Khi căn thành `SOLD`, khách dự phòng đang có lịch xem căn đó vẫn giữ lịch.

**Trung bình**

5. **Chống trùng lịch chỉ tính theo căn** (cách nhau 60 phút, `BOOKING_GAP_MINUTES`), không tính theo sale. Một sale có thể bị chia 2 buổi xem cùng giờ ở hai căn.
6. **Lý do "Không mua" quá thô** (`LOST_REASONS` chỉ có `NO_SHOW`, `NOT_INTERESTED`, `CUSTOMER_CANCELLED`, `EXPIRED`, `OTHER`). Báo cáo không trả lời được "mất khách vì giá, vì chọn căn khác hay vì mua nơi khác".
7. **Tài liệu mâu thuẫn (đã sửa 13/11).** `nghiep-vu/vai-tro-va-trang-thai.md` mục 1 và 2 nói đội dùng chung danh sách, không chia khách, trong khi quy trình 1 chia sale lần lượt và có người phụ trách: sửa ở DC-14. `nghiep-vu/03-cham-soc-va-marketing.md` mục 1 nói "xem căn khác" tạo lead mới, nhưng từ FE-34 là cùng lead: Hậu đã sửa trong PR #79.

## 4. Hành trình chuẩn ngành

Khung chung của các CRM bất động sản ([Wise Agent](https://wiseagent.com/blog/lead-pipeline-in-wise-agent-a-smarter-way-to-manage-real-estate-leads), [Follow Up Boss](https://help.followupboss.com/hc/en-us/articles/4402121268631), [Sierra Interactive](https://www.sierrainteractive.com/insights/blog/how-to-manage-your-real-estate-leads/), [Nimble](https://www.nimble.com/blog/crm-for-real-estate/)). Tên chặng khác nhau tuỳ hãng; nguồn phần lớn là blog của hãng nên chưa kiểm chứng độc lập.

| # | Chặng | Việc tự động | Việc của người | Loại |
|---|---|---|---|---|
| 1 | Thu lead (New Lead) | Gom từ mọi kênh, gộp trùng, chia sale (round robin, theo nguồn, hoặc "pond") | | Có nguồn |
| 2 | Chạm đầu tiên | Tự động trả lời trong vài giây; sale gọi trong khoảng 5 phút | Sale gọi | Có nguồn. Số liệu hiệu quả của "5 phút" khác nhau giữa các blog, chưa chắc |
| 3 | Đang cố liên hệ (Attempted Contact) | Chuỗi nhắc gọi, SMS, email theo ngày | Sale ghi kết quả mỗi lần | Có nguồn |
| 4 | Đã liên hệ, sàng lọc | Chấm điểm | Hỏi ngân sách, nhu cầu, khả năng vay, thời gian mua | Có nguồn |
| 5 | Hẹn xem (Showing) | Xác nhận, nhắc lịch, xử lý đổi lịch | Dẫn khách đi xem | Có nguồn. Phần đổi lịch là đề xuất |
| 6 | Sau buổi xem | Hỏi cảm nhận trong vài giờ; khách không đến thì mời hẹn lại | Gọi lại | Đề xuất |
| 7 | Tìm tiếp (Active Buyer) | Gợi ý căn mới phù hợp | Dẫn xem tiếp | Có nguồn |
| 8 | Thương lượng, ra giá (Offer) | | Thương lượng giá, điều kiện | Có nguồn |
| 9 | Đặt cọc, ký (Under Contract) | Soạn hợp đồng, nhắc hạn | Kiểm tra pháp lý, vay ngân hàng | Có nguồn. Pháp lý ở Việt Nam là đề xuất |
| 10 | Chốt (Closed) | Dừng chuỗi nhắc | Công chứng, sang tên | Có nguồn |
| 11 | Sau bán | Xin đánh giá, xin giới thiệu | | Đề xuất |
| 12 | Nuôi dài hạn (Long-Term Nurture) | Chuỗi tin định kỳ; khách ở trạng thái "bỏ" thì tạm dừng mọi chuỗi | | Có nguồn |

Đối chiếu: hệ thống đủ ở chặng 1, 4, 5, 6, 9. **Thiếu** ở chặng 3 (cố liên hệ nhiều lần), 7 (gợi ý căn), 8 (thương lượng), 11 (sau bán), 12 (nuôi hoặc đóng ở phần lõi).

## 5. Chặng cần cho đề tài (nói theo thực tế)

| Mức | Chặng | Ghi chú |
|---|---|---|
| **Bắt buộc** | 1 thu lead và chia sale; 2 chạm đầu tiên; 3 cố liên hệ; 4 sàng lọc; 5 hẹn xem; 6 sau buổi xem; 9 đặt cọc và ký; 12 nuôi hoặc đóng lead | Phân tích bán hàng không phải một chặng riêng mà là dữ liệu của mọi chặng (mục 5.1) |
| **Làm nhẹ** | 8 thương lượng | Không cần chặng riêng, chỉ thêm ô "giá thoả thuận" khi lập hợp đồng (kèm lịch sử đổi) |
| **Có thể bỏ** | 7 gợi ý căn tự động; 10 công chứng, sang tên; 11 sau bán | 7 là điểm cộng, sale gợi ý tay vẫn được. 10 là thủ tục ngoài hệ thống |

### 5.1. Phân tích cần dữ liệu gì từ các chặng

1. Mốc thời gian chuyển chặng (để tính thời gian phản hồi và phễu).
2. Nguồn khách.
3. Người phụ trách.
4. Lý do mất khách chia đủ nhóm: giá cao, chọn căn khác, mua nơi khác, không liên lạc được, hết nhu cầu.

## 6. Đối chiếu với đề bài của thầy

Tài liệu: *No-code / Low-code Automation Project Topics* (Tom Nguyen), mục 9 "Industry-specific".

- Đề tài là một dòng: *Visits, document signing, lead follow-up, and sales analytics*, tức **bốn vế**. Các chặng thu lead và chấm điểm chỉ là phần hỗ trợ.
- Kiến trúc mỗi luồng: `Trigger → Data Processing → API → AI → Decision → Action → Human Approval → Logging / Monitoring`. Thầy ghi rõ "không chỉ A → B", cần dữ liệu thực tế, xử lý lỗi, retry, xác thực, log, bước duyệt và **kết quả đo lường được**.
- "Technology Challenge Matrix" (OCR, STT/TTS, OAuth, Voice...) là **tuỳ chọn để tăng độ khó**. Mức Advanced là AI Agent + RAG + nhiều hệ thống + memory. Hệ thống đã đạt mức này (L6 có Agent, memory, RAG; L4 có Agent kèm tool Postgres).
- Mục E-signature của đề bài ghi *signature workflows and compliant archiving*. Trong `n8n-workflows/luong-3-hop-dong.json` **không có node lưu file, PDF hay Drive**, nên vế "ký giấy tờ" đang hở ở phần lưu trữ.

Điều chỉnh so với ý ban đầu: chia theo bốn vế thay vì chín chặng; **gộp hai luồng follow-up mới thành một** (L9) vì L2 đã 63 node; thêm lưu trữ hợp đồng; thêm đo lường; luồng mới phải có AI quyết định và người duyệt, không chỉ bộ đếm giờ.

## 7. Thay đổi từng luồng

Chủ luồng theo [quy-trinh-git.md](quy-trinh-git.md) mục "Ai giữ phần nào".

| Luồng | Chủ | Mức | Thay đổi | Ưu tiên |
|---|---|---|---|---|
| L1 Tiếp nhận, chấm điểm | Hoàng | Giữ, sửa nhẹ | Ghi lại mốc **chạm đầu tiên**. Lúc sale thao tác lần đầu đã có (`first_response_at`); còn thiếu lúc thư tự động tới khách. Task FE-50 | Thấp |
| L1b Duyệt, đổi giờ | Hoàng | Giữ | Không đổi | |
| L2 Follow-up | Hậu | **Sửa lớn** | (1) Chuyển nhánh "khách im lặng 3 ngày" sang L9. (2) Tách nhánh Mautic ra khỏi L2. (3) Thêm thư **mời hẹn lại** khi khách không đến. Giữ: nhắc lịch, nhắc điểm danh, hỏi cảm nhận, báo quản lý khi sale quá hạn, và nhánh gọi worker theo dõi phản hồi của PR #79. Task FE-46 | Cao |
| L3 Hợp đồng cọc | Hoàng | **Sửa** | (task FE-49, dữ liệu ở FE-43 và FE-48) Sau khi khách ký: tạo PDF, lưu file, tính hash chống sửa, ghi nhật ký kèm đường dẫn. Tuỳ chọn: OCR CCCD trước khi soạn | Cao |
| L4 Báo cáo tuần | Hậu | **Sửa** | Thêm số liệu thời gian chạm đầu tiên, lý do mất khách (chia nhóm), theo nguồn. Giữ Agent kèm tool Postgres. Phần theo sale và theo căn nhà đã làm ở PR #78 (FE-51). Task FE-47 | Trung bình |
| L5 Phân tích cảm nhận | Hậu | Giữ | Phần "xem căn khác thì ghi việc cho sale" đã làm ở PR #79 (FE-52): mỗi phản hồi tạo một việc có hạn, nhắc sale, báo quản lý. Không làm thêm | |
| L6 Telegram Agent | Hoàng | Giữ | Không đổi logic. Còn việc chạy thử với Gemini và Telegram thật (FE-36) | Trung bình |
| L6b Nạp tri thức | Hoàng | Giữ, sửa nhẹ | Bật retry khi lỗi (LH-53) | Thấp |
| L7, L8 Mautic | Hậu | **Đóng băng** | Không làm thêm. Ghi rõ trong báo cáo là phần mở rộng | |
| Thông báo nhân viên | Hoàng | Giữ, sửa nhẹ | Thêm kênh push Expo khi có app; L9 dùng chung | Thấp |
| Error workflow | Hoàng | Sửa nhẹ | Thêm báo Telegram (LH-52) | Thấp |
| **L9 Follow-up theo bậc** | Hậu | **Mới** | Mục 7.1. Task FE-45 | Cao |

### 7.1. L9: Follow-up theo bậc (đề xuất)

Vá lỗ hổng 1 và 2 ở mục 3: khách không phản hồi thì không ai nhắc và lead nằm mãi.

| Bước | Nội dung |
|---|---|
| Trigger | Schedule, chạy mỗi giờ trong khung 08:00 đến 20:00 (không nhắn sale ban đêm) |
| Dữ liệu | Gọi backend (`GET /api/followups/ladder-due`) lấy hai nhóm lead: (a) chưa "đã liên hệ được" sau ngày 1, 3, 7 kể từ lúc giao (ngày 0 là lời nhắc 2 giờ làm việc đã có ở FE-38); (b) `CONSULTING` hoặc `VIEWED` im 7 ngày, và im 14 ngày thì đóng |
| Quyết định | Switch theo nhóm và bậc. Kiểm tra `followup_tasks` để không nhắc trùng |
| AI | Gemini trả dạng có cấu trúc: **việc nên làm tiếp theo**, lý do, bản nháp thư. Có guardrail kiểm tra nội dung trước khi gửi |
| Người duyệt | Sale được báo kèm gợi ý của AI, xác nhận hoặc sửa. Khách đã đồng ý nhận tin mới nhận thư tự động |
| Hành động | Gửi thư, nhắc sale qua Telegram. Quá bậc cuối thì báo quản lý. Không ai xử lý thì **tự đóng** với lý do mới `STALE` |
| Log | Ghi `lead_events`. Retry 3 lần; lỗi đẩy sang Error workflow |

Mỗi luồng của môn cần tối thiểu 12 bước; khi viết đặc tả chi tiết cần đếm lại.

## 8. Việc ở backend và web mà các luồng cần

Không phải việc n8n, nhưng thiếu thì luồng không chạy được:

1. Trường ghi nhận "**đã liên hệ được**" và nút ở trang lead cho sale.
2. Lý do "Không mua" mới: `STALE` và nhóm lý do chi tiết (giá cao, chọn căn khác, mua nơi khác, không liên lạc được).
3. Endpoint lưu file hợp đồng đã ký.
4. Ô "giá thoả thuận" khi lập hợp đồng (web và backend).
5. Cho sale chọn căn khi lập hợp đồng (lỗ hổng 3).

## 9. Đã chốt và để sau (13/11)

| Việc | Quyết định |
|---|---|
| Lead nguội im bao nhiêu ngày thì nhắc, bao nhiêu ngày thì tự đóng | **7 ngày nhắc, 14 ngày tự đóng** (`STALE`); là hằng số trong `followup-policy.ts`, chỉnh theo thực tế |
| Chủ của L9 | **Hậu** (follow-up và `followup_tasks` thuộc phần Hậu giữ) |
| Bước duyệt của L9 | Sale nhận gợi ý của AI qua Telegram hoặc mail, mở link, sửa thư rồi bấm gửi; chỉ khách đã đồng ý nhận tin mới nhận thư. Cùng cách với duyệt lịch (FE-35) |
| Ai viết PR nền FE-43 | **Hoàng**; Hậu duyệt vì sửa file thuộc phần Hậu giữ |
| App Expo (FE-27, FE-28) | **Dời** sang "làm sau nếu có time" |
| Langfuse (FE-25) | Giữ nguyên, vẫn là việc đầu tiên bị cắt nếu thiếu giờ |
| Cấp mã task và cập nhật `danh-sach-task.md`, `danh-sach-lo-hong.md`, `README.md` | Làm ở CH-09 và DC-14 |

**Làm sau nếu có time (chưa cấp mã):** OCR CCCD (hợp với L3, chọn tối đa một việc tuỳ chọn), đồng bộ Google Calendar, Voice, lỗ hổng 4 (đường lui sau `SIGNED`), lỗ hổng 5 (trùng lịch theo sale), dọn khách dự phòng khi căn `SOLD`. Việc nào bỏ hẳn thì ghi vào "hạn chế đã biết" của báo cáo.

## 10. Thứ tự làm

Mốc: web hoàn thành 22/11, khoá code 3/12, nộp 5/12.

1. **CH-09 và DC-14** (Hoàng): cấp mã, đưa kế hoạch và sửa tài liệu lên `dev`.
2. **FE-43** (Hoàng, Hậu duyệt): PR nền, trường "đã liên hệ được", lý do "Không mua" mới, cột hợp đồng (mục 8, việc 1 đến 4 phần dữ liệu). L2, L4, L9 phụ thuộc vào đây.
3. **FE-44** (Hậu): nút "đã liên hệ được" và chọn lý do chi tiết. **FE-48** (Hoàng): giá thoả thuận, chọn căn, endpoint lưu file.
4. **FE-45** (Hậu): L9 và trang duyệt thư, rồi **FE-46** (Hậu): sửa L2.
5. **FE-49** (Hoàng): L3 lưu trữ bản ký. **FE-47** (Hậu): thêm số liệu cho L4.
6. Bộ 20 lead có nhãn (FE-24) để có số đo cho báo cáo. Langfuse (FE-25) bỏ được nếu thiếu giờ.
7. **FE-50** (Hoàng): các việc nhỏ ở L1, L6b, Error. Thông báo đẩy Expo dời cùng app.
8. Việc tuỳ chọn, nếu còn thời gian trước 3/12.

## 11. Nguồn

- [Wise Agent: Lead Pipeline](https://wiseagent.com/blog/lead-pipeline-in-wise-agent-a-smarter-way-to-manage-real-estate-leads)
- [Follow Up Boss help center](https://help.followupboss.com/hc/en-us/articles/4402121268631)
- [Sierra Interactive: How to manage your real estate leads](https://www.sierrainteractive.com/insights/blog/how-to-manage-your-real-estate-leads/)
- [Sierra Interactive: Speed to lead](https://www.sierrainteractive.com/insights/blog/speed-to-lead-real-estate/)
- [Nimble: CRM for Real Estate](https://www.nimble.com/blog/crm-for-real-estate/)
