# 01. Visits: hẹn xem và đi xem nhà

Vế **Visits** của đề tài: từ lúc khách chọn giờ xem đến lúc biết khách có đến hay không. Mục tiêu nghiệp vụ là khách đến đúng giờ, ít vắng mặt, và không buổi xem nào bị bỏ quên không ai xử lý.

Thuộc hành trình: **giai đoạn 5 (hẹn xem)** và phần đầu của **6 (sau buổi xem: điểm danh, vắng mặt)**. Phần hỏi cảm nhận sau buổi xem nằm ở [03-lead-follow-up.md](03-lead-follow-up.md) mục 2. Bản đồ hành trình và cách đọc nhãn: [vai-tro-va-trang-thai.md](vai-tro-va-trang-thai.md) mục 1.

Mỗi quy tắc ghi: khi nào áp dụng, hệ thống làm gì, người dùng thấy gì, ai xử lý ở đâu. Thông báo lỗi trong dấu ngoặc kép là chữ người dùng thấy thật.

Cập nhật lần cuối: 18/11/2026.

## Tóm tắt các giai đoạn

| | GĐ5a. Đặt và duyệt lịch | GĐ5b. Trước buổi xem | GĐ6a. Điểm danh, vắng mặt |
|---|---|---|---|
| Mục tiêu | Chốt được giờ xem không trùng | Khách nhớ lịch, đổi hoặc huỷ dễ | Biết khách có đến; khách vắng được mời hẹn lại |
| Bắt đầu khi | Khách hoặc bot đặt lịch, hoặc sale đặt hộ | Lịch đã chốt | Tới giờ hẹn |
| Kết thúc khi | Lead "Đã chốt lịch", hoặc quá giờ hẹn chưa duyệt | Tới giờ hẹn | Buổi xem "Khách đã đến" hoặc "Khách không đến" |
| Khách làm | Chọn khung giờ còn trống | Huỷ hoặc xin đổi lịch qua `/lich/<mã>` | Đến xem |
| Sale, quản lý làm | Sale duyệt hoặc đổi giờ | Sale gọi lại khi khách xin đổi | Sale điểm danh. Quản lý nhận báo khi quên điểm danh |
| Hệ thống tự động | Kiểm tra khung giờ, khoá theo căn, thư "đã nhận", báo sale có nút Duyệt; quá giờ chưa duyệt thì đóng `EXPIRED` | Thư chốt lịch, nhắc lịch trước 24 giờ | Nhắc điểm danh sau 2 giờ, báo quản lý sau 24 giờ; thư mời hẹn lại khi vắng |
| Luồng n8n | L1, L1b, L6 (đặt hộ), L2 | L1b, L2 | L2 |
| Tình trạng | **[Đang chạy]**; chống trùng lịch theo sale **[Đang chạy]** | **[Đang chạy]**; bỏ nhắc thừa **[Sắp làm FE-54]** | **[Đang chạy]**; thư mời hẹn lại **[Sắp làm FE-46]** |

```
 Khách chọn khung giờ
        |
        v
 Buổi xem "Chờ xem", lead NEW ---- quá giờ hẹn, chưa ai duyệt ----> LOST (EXPIRED)
        |
   sale Duyệt (L1b gửi thư chốt lịch + link /lich)
        v
 Lead CONFIRMED --- khách huỷ qua /lich ---> buổi xem "Đã huỷ", lead về CONSULTING/VIEWED
        |
   L2 nhắc lịch trong 24 giờ trước giờ hẹn
        v
   Tới giờ hẹn: sale điểm danh (từ 30 phút trước)
        |                         |                         |
     có đến                 không đến, hẹn lại       không đến, không hẹn lại
        v                         v                         v
 Lead VIEWED              Vẫn CONFIRMED, giờ mới     Buổi xem "Khách không đến"
 -> hỏi cảm nhận                                     lead về CONSULTING/VIEWED
    (03-lead-follow-up)                              -> thư mời hẹn lại [FE-46]
```

## Các mốc thời gian

| Mốc | Giá trị | Ở đâu |
|---|---|---|
| Giờ xem hợp lệ (mọi người) | 08:00–19:00 giờ Việt Nam | `VIEWING_FIRST_HOUR`, `VIEWING_LAST_HOUR` trong `backend/src/viewings/viewing-time.ts` |
| Khách và bot đặt trước giờ hẹn | Ít nhất 3 giờ làm việc (08:00–21:00), làm tròn lên giờ chẵn | `BOOKING_LEAD_HOURS` (cùng file) |
| Khách và bot đặt xa nhất | 14 ngày | `BOOKING_MAX_DAYS` (cùng file) |
| Hai lịch xem cùng căn phải cách nhau | 60 phút | `BOOKING_GAP_MINUTES` trong `backend/src/viewings/booking-rules.ts` |
| Hai buổi xem của **cùng một sale** ở hai căn khác nhau phải cách nhau | 90 phút (60 phút xem + 30 phút di chuyển) **[Đang chạy]** | `SALE_GAP_MINUTES` (cùng file) |
| Giới hạn đặt lịch mỗi IP | 5 lần / 10 phút | Biến môi trường `BOOKING_RATE_LIMIT`, `BOOKING_RATE_TTL_MS` |
| Nút Duyệt / Đổi giờ trong thông báo dùng được | Tới giờ hẹn | Link do backend cấp, kiểm tra lại lúc bấm |
| Nhắc lịch cho khách | Trong vòng 24 giờ trước giờ hẹn, một lần cho mỗi giờ hẹn | Luồng 2 (chạy mỗi giờ) |
| Bỏ nhắc lịch khi thư chốt lịch vừa gửi | Thư chốt lịch hoặc thư báo giờ mới gửi khi giờ hẹn còn **dưới 24 giờ** thì không gửi nhắc nữa **[Sắp làm FE-54]** (đề xuất, chờ chốt) | `followup-policy.ts`, `followup-sql.ts` |
| Được điểm danh | Từ 30 phút trước giờ hẹn | `ATTENDANCE_GRACE_MS` trong `viewing-time.ts` |
| Nhắc sale điểm danh | 2 giờ sau giờ hẹn | Luồng 2 |
| Báo quản lý khi vẫn chưa điểm danh | 24 giờ sau lời nhắc | Luồng 2 |
| Bấm "xin đổi lịch" nhiều lần chỉ ghi một yêu cầu | Trong 10 phút | `backend/src/viewings/viewings.service.ts` |
| Thư mời hẹn lại khi khách vắng | Trong vòng 2 giờ sau khi điểm danh "không đến" **[Sắp làm FE-46]** | Luồng 2, tác vụ `REBOOK_INVITE` |

## 1. Đặt lịch **[Đang chạy]**

### 1.1. Khung giờ

Khách chọn **ngày rồi khung 1 tiếng** (08:00, 09:00, …, 19:00) trên trang chi tiết nhà. Khung đã có người hẹn căn đó bị gạch ngang, không chọn được (danh sách từ `GET /api/viewings/slots`, chỉ trả giờ, không kèm thông tin khách). Luồng 6 (bot) nhận cùng quy tắc qua mô tả công cụ đặt lịch.

- Khung 1 tiếng khớp quy tắc cách 60 phút: mỗi lịch đã đặt gạch đúng một khung.
- Vì sao sớm nhất 3 giờ: hạn duyệt là 2 giờ, còn 1 giờ để sale gọi chủ nhà, báo khách và di chuyển.
- Vì sao xa nhất 14 ngày: sau vài tuần căn có thể đã có người cọc hoặc đổi giá; khách hẹn quá xa dễ quên.
- **Sale đặt hộ hoặc đổi giờ** trên web admin không bị giới hạn 3 giờ, 14 ngày và giờ tròn; chỉ cần ở tương lai và trong 08:00–19:00.

| Khách đặt lúc | Khung sớm nhất |
|---|---|
| 09:00 | 12:00 cùng ngày |
| 15:30 | 19:00 cùng ngày |
| 17:00 | 08:00 sáng mai (20:00 đã quá khung cuối; sale còn làm tới 21:00 nên kịp duyệt) |
| 22:00 hoặc 02:00 | 11:00 sáng mai (giờ làm việc bắt đầu 08:00, cộng 3 giờ) |

### 1.2. Khách nhập gì

| Thông tin | Bắt buộc | Kiểm tra |
|---|---|---|
| Họ tên | Có | Không để trống |
| Email | Có | Đúng định dạng email |
| Số điện thoại | Có | 8 đến 15 ký tự số, cho phép `+`, dấu cách, `.`, `-` |
| Ngân sách | Có | Số nguyên từ 0 |
| Nhu cầu | Không | Chữ tự do |
| Giờ xem | Có | Một khung còn trống. Bot gửi giờ tròn. Không ghi múi giờ thì hiểu là giờ Việt Nam |
| Đồng ý nhận tin | Không | Ô tick; không tick thì không gửi nội dung marketing (Nghị định 13/2023) |
| Nguồn khách | Tự động | Lấy từ `?utm_source=` |

### 1.3. Điều kiện nhận lịch

Backend kiểm tra theo thứ tự dưới đây, trong một transaction có khoá theo căn, nên hai người đặt cùng lúc không lọt cả hai.

| Quy tắc | Khách thấy |
|---|---|
| Ô bẫy bot (ẩn, người thật không thấy) có chữ thì không lưu gì | "Yêu cầu không hợp lệ" |
| Mỗi IP đặt tối đa 5 lần trong 10 phút. Trợ lý AI đặt hộ (gọi kèm secret) không bị giới hạn | "Bạn gửi quá nhiều lần, vui lòng thử lại sau ít phút" |
| Căn phải đang "Đang bán" | "Căn nhà này hiện không nhận đặt lịch xem" |
| Giờ nằm trong 08:00–19:00 | "Giờ xem nhà phải trong khoảng 08:00–19:00" |
| Giờ tròn (khách, bot) | "Giờ xem nhà phải tròn giờ (ví dụ 09:00, 10:00)" |
| Đặt trước ít nhất 3 giờ làm việc (khách, bot) | "Cần đặt trước ít nhất 3 giờ làm việc. Khung sớm nhất còn đặt được: …" |
| Không quá 14 ngày tới (khách, bot) | "Chỉ nhận đặt lịch trong vòng 14 ngày tới" |
| Không có lịch đang chờ nào của căn đó cách giờ chọn dưới 60 phút. "Đang chờ" = buổi xem "Chờ xem" của lead "Mới" hoặc "Đã chốt lịch" | "Khung giờ này đã có khách hẹn xem căn này (lúc …). Vui lòng chọn giờ cách ít nhất 60 phút." |
| Khách (cùng số điện thoại) chưa có buổi xem nào đang mở, và không đang làm hợp đồng cọc | "Bạn đang có lịch xem lúc …. Nếu cần đổi giờ, hãy dùng link trong email xác nhận hoặc liên hệ nhân viên." hoặc "Bạn đang làm hợp đồng đặt cọc với chúng tôi. Vui lòng liên hệ nhân viên để đặt thêm lịch xem." |

Giờ sai quy tắc trả mã 400; trùng lịch và khách đã có lịch trả 409; giới hạn đặt lịch trả 429. Trợ lý AI nhận lý do từ backend và nói lại cho khách.

Quy tắc trên chỉ chống trùng **theo căn**. Chống trùng **theo sale** ở mục 1.6.

### 1.4. Sau khi nhận lịch

1. Backend tạo lead (hoặc dùng lại lead của khách cũ, [00-tiep-nhan.md](00-tiep-nhan.md) mục 2), tạo buổi xem "Chờ xem", đặt lead về "Mới", gán người phụ trách, tất cả trong cùng transaction, rồi gọi luồng 1.
2. Luồng 1 kiểm tra dữ liệu, cho AI chấm điểm (khi lead mới tạo).
3. Khách nhận thư **đã nhận yêu cầu**, nội dung theo mức HOT, WARM, COLD. Thư không khẳng định lịch đã chốt.
4. **Sale phụ trách** nhận thông báo kèm điểm AI, gợi ý của AI và nút **Duyệt** / **Đổi giờ**. Không gửi nhóm chung.
5. Luồng 1 kết thúc sau khi báo, không chờ. Nút mở trang xác nhận `/duyet/<mã>` và chỉ đổi lịch khi bấm xác nhận trên trang đó.

Dữ liệu không hợp lệ hoặc AI lỗi: lead có trạng thái xử lý AI `FAILED`. Luồng dừng vì lỗi không lường trước: Error workflow gửi email cho quản lý. Cả hai trường hợp nhân viên vẫn duyệt tay được.

### 1.5. Khách cũ đặt thêm lịch

Mỗi khách có **tối đa một buổi xem đang mở**; buổi đã xem, không đến, đã huỷ giữ lại làm lịch sử trên trang lead.

| Khách đang ở | Đặt thêm lịch |
|---|---|
| "Đang tư vấn" | Được. Buổi xem mới gắn vào lead này, lead sang "Mới" |
| "Đã xem nhà" | Được. Lead về "Mới" (buổi cũ vẫn "Khách đã đến") |
| "Không mua" | Được. Mở lại lead, xoá lý do đóng, buổi xem mới |
| "Mới", "Đã chốt lịch" | 409, báo giờ của buổi đang có |
| "Đang làm hợp đồng cọc", "Đã ký hợp đồng cọc" | 409, báo liên hệ nhân viên |

Giữ nguyên người phụ trách, nguồn, tên và đồng ý nhận tin của lead cũ; email, ngân sách, nhu cầu còn thiếu thì lấy từ form.

### 1.6. Chống trùng lịch theo sale **[Đang chạy]**

**Vì sao:** một sale chỉ ở được một nơi tại một thời điểm, và đi giữa hai căn cần thời gian. Hiện hệ thống chỉ chống trùng theo căn, nên một sale có thể bị xếp 09:00 ở Sơn Trà và 09:00 ở Hải Châu (LH-24).

**Sale "bận" lúc T** khi sale đó đang phụ trách một lead có buổi xem ở **căn khác**, giờ hẹn cách T dưới **90 phút**, trừ buổi "Đã huỷ" và "Khách không đến". Buổi xem cùng căn vẫn theo quy tắc 60 phút ở mục 1.3.

Buổi đã điểm danh "Khách đã đến" **vẫn tính bận**: bận theo giờ hẹn, không theo trạng thái buổi xem. Sale điểm danh được từ 30 phút trước giờ hẹn (mục 4.1), lúc đó sale vẫn đang ở căn; nếu bỏ buổi này ra thì hệ thống coi sale là rảnh và xếp thêm lịch trùng giờ.

**Khó khăn:** khách mới chỉ được chia sale ngay lúc gửi form, nên form đặt lịch không thể gạch khung theo lịch của sale. Vì vậy hệ thống chặn ở hai chỗ:

| Chỗ | Quy tắc | Ai thấy gì |
|---|---|---|
| Chia sale lần lượt (khách mới, web và bot) | Bỏ qua sale đang bận lúc giờ khách chọn, chia cho sale kế tiếp còn rảnh. Sale bị bỏ qua giữ nguyên lượt, nên được ưu tiên ở khách sau. Mọi sale đều bận thì chia như cũ, để bước duyệt xử lý | Khách không thấy gì khác: khách không bao giờ bị từ chối vì lịch của sale |
| Khách cũ đặt thêm lịch | Giữ sale cũ dù sale đó bận; bước duyệt xử lý | Như trên |
| Duyệt lịch (nút trong thông báo, trang xác nhận, web admin) | Kiểm tra lịch của **sale phụ trách lead**, kể cả khi quản lý duyệt thay. Bận thì không duyệt được | "Sale … đã có lịch xem căn … lúc …. Hãy đổi giờ hoặc nhờ quản lý chuyển sale." |
| Đổi giờ, sale đặt hộ, hẹn xem tiếp trong theo dõi phản hồi | Cùng kiểm tra và cùng thông báo như duyệt | Như trên |
| Chuyển sale (quản lý chuyển lead đang có buổi xem "Chờ xem") | Kiểm tra lịch của **sale mới** với từng buổi xem đang mở của lead. Sale mới bận thì **không chuyển được** | "Sale … đã có lịch xem căn … lúc …; chọn sale khác hoặc đổi giờ trước." |

Kiểm tra chạy trong transaction có khoá theo sale (giống khoá theo căn), để hai lượt duyệt hay chuyển cùng lúc không lọt cả hai.

**Chuyển sale khi sale cũ đang dẫn buổi xem:** hệ thống không lưu ai dẫn buổi đã điểm danh, mà tính bận theo người phụ trách lead hiện tại. Nên lead có buổi "Khách đã đến" mà giờ hẹn mới qua chưa tới 90 phút thì **không chuyển được**: "Sale … đang dẫn buổi xem căn … lúc …. Chuyển người phụ trách sau …". Quá 90 phút buổi này không còn ảnh hưởng lịch nào nên chuyển bình thường.

**Vì sao chuyển sale bị chặn, không chỉ cảnh báo:** quản lý thấy xung đột ngay lúc ra quyết định và chọn được sale khác. Nếu chỉ cảnh báo, lead vẫn chuyển được và trùng lịch chỉ lộ ra vào ngày xem. Lead không có buổi xem mở thì chuyển như cũ.

Ví dụ với sale An:

```
08:00  Khách Hùng đặt 09:00 căn Sơn Trà       -> chia An (rảnh)
08:10  Khách Lan đặt 09:30 căn Hải Châu       -> An bận (cách 30 phút) -> chia Bình
08:20  Khách cũ của An đặt 10:00 căn Ngũ Hành Sơn -> vẫn giao An
       An bấm Duyệt lịch 10:00                -> bị chặn (cách 60 phút < 90)
       An gọi khách đổi sang 10:30            -> duyệt được
```

## 2. Duyệt lịch **[Đang chạy]**

### 2.1. Duyệt

- Sale bấm **Duyệt** trong thông báo hoặc trên trang chi tiết lead. Cả hai đường đều đi qua luồng 1b.
- Chỉ duyệt được lead "Mới" và AI đã chấm xong. Chưa xong: "AI chưa chấm điểm xong, chưa duyệt được".
- Sale phụ trách đang bận ở căn khác trong vòng 90 phút thì không duyệt được (mục 1.6).
- Duyệt xong: lead "Đã chốt lịch", khách nhận **thư chốt lịch** có giờ xem và **link quản lý lịch** `/lich/<mã>`.
- Nút trong thông báo dùng được **tới giờ hẹn**. Trang xác nhận từ chối khi khách đã huỷ, lịch đã duyệt, khách đã có buổi xem mới hơn, hoặc đã tới giờ hẹn.

### 2.2. Đổi giờ

- Sale bấm **Đổi giờ** trong thông báo: hệ thống ghi "Nhân viên yêu cầu đổi giờ", sale liên hệ khách rồi đặt giờ mới trên web admin.
- Đổi được khi lead "Mới" hoặc "Đã chốt lịch" và buổi xem còn "Chờ xem". Giờ mới qua kiểm tra cách 60 phút như lúc đặt, và qua cả kiểm tra lịch của sale (mục 1.6).
- Lead "Đã chốt lịch": khách nhận thư báo giờ mới (luồng 1b). Lead "Mới": chưa gửi gì, khách nhận giờ mới trong thư chốt lịch khi được duyệt.
- Giờ cũ và người đổi được ghi vào nhật ký. Đổi giờ thành công mà gửi thư lỗi: giờ mới vẫn được lưu, sale tự báo khách.

### 2.3. Không ai duyệt

| Khi nào | Hệ thống làm |
|---|---|
| Quá 2 giờ làm việc mà sale chưa có thao tác đầu tiên | Báo quản lý ([00-tiep-nhan.md](00-tiep-nhan.md) mục 7.2); lead vẫn "Mới" |
| Giờ hẹn đã qua mà lead vẫn "Mới", buổi xem còn "Chờ xem" | Chuyển "Không mua" lý do "Quá hạn không xử lý" (`EXPIRED`), huỷ buổi xem, vô hiệu link duyệt cũ, báo quản lý. Không coi đây là khách không đến |

## 3. Trước buổi xem **[Đang chạy]**

### 3.1. Nhắc lịch

Lead "Đã chốt lịch" có giờ xem trong 24 giờ tới và khách có email: khách nhận thư nhắc lịch, một lần cho mỗi giờ hẹn. Đổi giờ sau khi đã nhắc thì nhắc lại theo giờ mới. **[Đang chạy]**

**Bỏ nhắc khi thư chốt lịch vừa gửi [Sắp làm FE-54]**. Hiện luồng 2 không xét thư chốt lịch gửi lúc nào, nên khách đặt sát giờ nhận hai thư gần giống nhau trong vòng một giờ:

| Trường hợp | Đang chạy (code trên `dev`) | Sau khi làm FE-54 (dự kiến, chưa có code) |
|---|---|---|
| Đặt trước 3 ngày: chốt lịch thứ Hai, xem 09:00 thứ Năm | Nhắc 09:00 thứ Tư | Như cũ |
| Đặt sáng xem chiều: chốt 09:30, xem 14:00 | Nhắc lúc 10:00, 30 phút sau thư chốt | Không nhắc: thư chốt đã là lời nhắc |
| Đặt tối xem sáng mai: chốt 20:00, xem 09:00 | Nhắc lúc 20:00–21:00, ngay sau thư chốt | Không nhắc |
| Sale đổi giờ lúc 16:00 sang 10:00 sáng mai | Nhắc lúc 17:00, một giờ sau thư báo giờ mới | Không nhắc: thư báo giờ mới đã là lời nhắc |
| Chốt lịch thứ Hai, thứ Ba sale đổi sang 09:00 thứ Sáu | Nhắc 09:00 thứ Năm theo giờ mới | Như cũ |

Quy tắc: **không nhắc** khi luồng 1 hoặc 1b đã gửi thư chốt lịch hay thư báo giờ mới cho **đúng buổi xem và đúng giờ hẹn đó**, vào lúc giờ hẹn còn dưới 24 giờ. Thư đó tự nó đã là lời nhắc. Các trường hợp khác nhắc đúng như hiện tại: một lần, khi giờ hẹn còn dưới 24 giờ.

| Câu hỏi | Trả lời |
|---|---|
| Biết thư đã gửi bằng gì | Sự kiện `VIEWING_CONFIRMATION_SENT` ("Đã gửi thư xác nhận lịch"). Luồng 1 và 1b ghi sự kiện này **sau khi gửi thư thành công** (FE-50), ghi chú dạng `viewing=<mã buổi xem>;time=<giờ hẹn ISO UTC>` |
| Vì sao không dựa vào "Nhân viên duyệt lịch" hay "Đổi giờ xem nhà" | Hai sự kiện này ghi **trước** khi gọi n8n: thư có thể chưa đi hoặc gửi lỗi, khách sẽ không nhận được cả thư chốt lẫn lời nhắc |
| Thư chốt gửi lỗi | Không có sự kiện, nên khách vẫn nhận lời nhắc như hiện tại |
| Đổi giờ sau khi đã có sự kiện | Sự kiện cũ ghi giờ cũ nên không còn khớp. Giờ mới được xét lại theo thư báo giờ mới |

### 3.2. Link quản lý lịch

Link `/lich/<mã>` gửi kèm thư chốt lịch và thư báo giờ mới. Khách thấy tên căn, địa chỉ, giờ xem và hai nút:

| Nút | Kết quả |
|---|---|
| Huỷ lịch | Buổi xem "Đã huỷ". Lead **không bị đóng**: về "Đã xem nhà" nếu khách từng đến một buổi khác, không thì "Đang tư vấn". Nút duyệt đang chờ bị vô hiệu |
| Xin đổi lịch (kèm ghi chú) | Ghi "Khách xin đổi lịch", hiện trong việc cần làm của nhân viên. Khách không tự chọn giờ; sale gọi lại và đổi giờ như mục 2.2 |

Link chỉ dùng được khi lead "Mới" hoặc "Đã chốt lịch", buổi xem còn "Chờ xem" và **chưa tới giờ hẹn**. Ngoài ra khách thấy: "Lịch này không còn thay đổi được. Vui lòng liên hệ nhân viên nếu cần hỗ trợ."

### 3.3. Khách dự phòng

Căn chuyển "Đang giữ cọc" thì không nhận lịch mới. Khách khác **đã có lịch** với căn đó vẫn giữ lịch, làm khách dự phòng, và hiện trong việc cần làm để sale gọi báo hoặc gợi ý căn khác. Hợp đồng bị từ chối hoặc hết hạn thì căn mở bán lại. Dọn lịch khách dự phòng khi căn thành "Đã bán": **[Làm sau]** (LH-23).

## 4. Điểm danh và vắng mặt

### 4.1. Điểm danh **[Đang chạy]**

Sau giờ hẹn, sale ghi nhận khách có đến hay không trên trang chi tiết lead.

- Chỉ điểm danh được lead "Đã chốt lịch" có buổi xem "Chờ xem".
- Chỉ bấm được **từ 30 phút trước giờ hẹn**. Sớm hơn: "Chưa đến giờ hẹn, chưa ghi nhận được khách có đến hay không".
- Đã điểm danh rồi: "Buổi xem này đã được ghi nhận rồi".

| Sale chọn | Buổi xem | Lead | Việc tiếp theo |
|---|---|---|---|
| Có đến | "Khách đã đến" | "Đã xem nhà" | Sau giờ hẹn 2 giờ, khách nhận link gửi cảm nhận ([03-lead-follow-up.md](03-lead-follow-up.md) mục 2). Lead tự được ghi "đã liên hệ được" nếu chưa có **[Sắp làm FE-44]** ([03-lead-follow-up.md](03-lead-follow-up.md) mục 1.1) |
| Không đến, hẹn lại | Vẫn "Chờ xem", giờ mới | Vẫn "Đã chốt lịch" | Khách nhận thư báo giờ mới |
| Không đến, không hẹn lại | "Khách không đến" | "Đã xem nhà" nếu từng đến buổi khác, không thì "Đang tư vấn" (không bị đóng) | Thư mời hẹn lại (mục 4.3). Sale tư vấn tiếp; muốn đóng thì bấm "Không mua" |

### 4.2. Quên điểm danh **[Đang chạy]**

| Khi nào | Hệ thống làm |
|---|---|
| 2 giờ sau giờ hẹn, chưa điểm danh | Nhắc sale kèm link tới trang lead |
| 24 giờ sau lời nhắc, vẫn chưa điểm danh | Báo quản lý |

Hệ thống **không** tự chuyển lead sang "Đã xem nhà": chỉ sale biết khách có đến hay không.

### 4.3. Mời hẹn lại khi khách vắng **[Sắp làm FE-46]**

Khách vắng mặt thường chỉ bận đột xuất; ngành coi đây là khách còn nóng, không phải khách mất.

| Quy tắc | Nội dung |
|---|---|
| Khi nào | Sale điểm danh "không đến" và **không** hẹn lại ngay (buổi xem thành "Khách không đến") |
| Gửi gì | Một thư trong vòng 2 giờ, nêu căn đã hẹn và link tới trang căn `/nha/<số>` để khách chọn giờ mới |
| Không gửi khi | Lead đã "Không mua"; lead "Đang làm hợp đồng cọc" hoặc "Đã ký hợp đồng cọc"; căn của buổi xem không còn "Đang bán"; khách đã có buổi xem mở khác; đã gửi cho buổi xem này rồi; khách không có email (ghi vào nhật ký "không gửi được thư mời") |
| Kiểm tra lại | Ngay trước lúc gửi, vì lead hoặc căn có thể đổi trong lúc chờ. Bỏ không gửi vì trạng thái lead hoặc căn thì ghi vào nhật ký kèm lý do |
| Đồng ý nhận tin | Không cần: đây là thư dịch vụ về chính lịch hẹn của khách, không phải marketing |
| Nhật ký | `REBOOK_INVITE_SENT` |

Khách không đặt lại thì lead đi tiếp vào quy tắc lead im lặng ở [03-lead-follow-up.md](03-lead-follow-up.md) mục 4.
