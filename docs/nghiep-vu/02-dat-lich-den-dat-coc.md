# Quy trình 2: Từ đặt lịch đến đặt cọc

Quy tắc của bốn chặng: đặt lịch, duyệt lịch, xem nhà và điểm danh, đặt cọc và ký. Vai trò, trạng thái và nhãn tiếng Việt: xem [vai-tro-va-trang-thai.md](vai-tro-va-trang-thai.md). Chặng sau buổi xem và nuôi khách: xem [03-cham-soc-va-marketing.md](03-cham-soc-va-marketing.md).

Mỗi quy tắc ghi: khi nào áp dụng, hệ thống làm gì, người dùng thấy gì, ai xử lý ở đâu. Thông báo lỗi trong dấu ngoặc kép là chữ người dùng thấy thật.

Cập nhật lần cuối: 4/11/2026.

**Bổ sung FE-33 (local, chưa triển khai server, 10/11):** đặt lịch khách mới đi qua intake chung, chuẩn hoá số điện thoại và gán người phụ trách trong cùng transaction với buổi xem. Hồ sơ `CONSULTING` chưa từng có buổi xem được đặt lịch đầu tiên trên cùng lead, giữ sale và bổ sung thông tin còn thiếu. Hồ sơ đã có buổi xem hoặc ở trạng thái khác nhận 409, không tạo lead trùng số. Cơ chế nhiều buổi xem và callback theo buổi xem chờ FE-34/FE-35. Callback duyệt/đổi lịch n8n ghi nhận phản hồi đầu tiên; note gửi lại qua intake được lưu vào lead cũ. API tiếp nhận khách chưa đặt lịch tạo `CONSULTING`, email/ngân sách không bắt buộc. Hợp đồng và cách triển khai: [FE-33](../fe-33-nen-tiep-nhan.md).

## Các mốc thời gian

| Mốc | Giá trị hiện tại | Ở đâu |
|---|---|---|
| Hai lịch xem cùng căn phải cách nhau | 60 phút | `BOOKING_GAP_MINUTES` trong `backend/src/viewings/booking-rules.ts` |
| Giới hạn đặt lịch mỗi IP | 5 lần / 10 phút | Biến môi trường `BOOKING_RATE_LIMIT`, `BOOKING_RATE_TTL_MS` |
| Chờ nhân viên duyệt trước khi báo quản lý | 24 giờ | Node "Chờ duyệt" của luồng 1 |
| Nhắc sale duyệt lead chưa duyệt | Sau 3 ngày | Luồng 2 |
| Nhắc lịch cho khách | Trong vòng 24 giờ trước giờ hẹn | Luồng 2 (chạy mỗi giờ) |
| Được điểm danh | Từ 30 phút trước giờ hẹn | `ATTENDANCE_GRACE_MS` trong `backend/src/viewings/viewing-time.ts` |
| Nhắc nhân viên điểm danh | 2 giờ sau giờ hẹn | Luồng 2 |
| Báo quản lý khi vẫn chưa điểm danh | 24 giờ sau lời nhắc | Luồng 2 |
| Bấm "xin đổi lịch" nhiều lần chỉ ghi một yêu cầu | Trong 10 phút | `backend/src/viewings/viewings.service.ts` |
| Quản lý duyệt hợp đồng | 48 giờ | Node "Chờ quản lý duyệt" của luồng 3 |
| Khách ký hợp đồng | 48 giờ, nhắc một lần, thêm 5 ngày | Luồng 3; link ký hết hạn sau 7 ngày (`SIGN_VALID_DAYS`) |

## 1. Đặt lịch

### 1.1. Khách nhập gì

Khách đặt lịch trên trang chi tiết căn nhà, hoặc nhờ trợ lý AI trên Telegram, ... đặt hộ.

| Thông tin | Bắt buộc | Kiểm tra |
|---|---|---|
| Họ tên | Có | Không để trống |
| Email | Có | Đúng định dạng email |
| Số điện thoại | Có | 8 đến 15 ký tự số, cho phép `+`, dấu cách, `.`, `-` |
| Ngân sách | Có | Số nguyên từ 0 |
| Nhu cầu | Không | Chữ tự do |
| Giờ xem | Có | Phải ở tương lai. Không ghi múi giờ thì hiểu là giờ Việt Nam |
| Đồng ý nhận tin | Không | Ô tick; không tick thì không gửi nội dung marketing |
| Nguồn khách | Tự động | Lấy từ `?utm_source=` trên đường dẫn |

### 1.2. Điều kiện nhận lịch

Backend kiểm tra theo thứ tự dưới đây, trong một transaction có khoá theo căn, nên hai người đặt cùng lúc không lọt cả hai.

| Quy tắc | Khách thấy |
|---|---|
| Ô bẫy bot (ẩn, người thật không thấy) có chữ thì không lưu gì | "Yêu cầu không hợp lệ" |
| Mỗi IP đặt tối đa 5 lần trong 10 phút. Trợ lý AI đặt hộ (gọi kèm secret) không bị giới hạn | "Bạn gửi quá nhiều lần, vui lòng thử lại sau ít phút" |
| Căn phải đang "Đang bán" | "Căn nhà này hiện không nhận đặt lịch xem" |
| Không có lịch đang chờ nào của căn đó cách giờ chọn dưới 60 phút. "Đang chờ" = buổi xem "Chờ xem" của lead "Mới" hoặc "Đã chốt lịch" | "Khung giờ này đã có khách hẹn xem căn này (lúc …). Vui lòng chọn giờ cách ít nhất 60 phút." |
| FE-33 local: số điện thoại chưa có hồ sơ, hoặc hồ sơ CONSULTING chưa từng có buổi xem; các trường hợp khác chờ FE-34/35 | "Số điện thoại này đã có hồ sơ. Vui lòng liên hệ nhân viên để đặt thêm hoặc đổi lịch xem." |

Hai lỗi trùng lịch trả mã 409, giới hạn đặt lịch trả 429. Trợ lý AI nhận lý do từ backend và nói lại cho khách.

### 1.3. Sau khi nhận lịch

1. Backend tạo lead "Mới" và buổi xem "Chờ xem", rồi gọi luồng 1.
2. Luồng 1 kiểm tra dữ liệu, cho AI chấm điểm và xếp mức HOT, WARM, COLD (thang điểm: xem [vai-tro-va-trang-thai.md](vai-tro-va-trang-thai.md) mục 4.1).
3. Khách nhận thư báo **đã nhận yêu cầu**, nội dung theo mức. Thư không khẳng định lịch đã chốt.
4. Nhân viên nhận thông báo qua email, Telegram, push trên app, ..., kèm điểm AI, gợi ý của AI và nút **Duyệt** / **Đổi giờ**.
5. Luồng 1 chờ nhân viên bấm, tối đa 24 giờ.

Nếu dữ liệu không hợp lệ hoặc bước AI lỗi, luồng 1 báo về backend và lead chuyển trạng thái xử lý AI sang `FAILED`. Nếu luồng dừng vì lỗi không lường trước, Error workflow gửi email cảnh báo cho quản lý. Cả hai trường hợp, nhân viên vẫn duyệt tay được trên web admin.

## 2. Duyệt lịch

### 2.1. Duyệt

- Nhân viên bấm **Duyệt** trong thông báo (email, Telegram, ...) hoặc trên trang chi tiết lead.
- Chỉ duyệt được lead "Mới" và AI đã chấm xong. Nếu AI chưa chấm xong: "AI chưa chấm điểm xong, chưa duyệt được".
- Duyệt xong: lead "Đã chốt lịch", khách nhận **thư chốt lịch** có giờ xem và **link quản lý lịch**.
- Quá 24 giờ hoặc đã bấm "Đổi giờ" trong thông báo thì nút trong thông báo hết hiệu lực; nút Duyệt trên web admin vẫn dùng được (đi qua luồng 1b).

### 2.2. Đổi giờ

- Nhân viên bấm **Đổi giờ** trong thông báo: hệ thống ghi "Nhân viên yêu cầu đổi giờ", nhân viên liên hệ khách rồi đặt giờ mới trên web admin.
- Đổi giờ trên web admin được khi lead "Mới" hoặc "Đã chốt lịch" và buổi xem còn "Chờ xem". Giờ mới phải ở tương lai và qua kiểm tra cách 60 phút như lúc đặt.
- Lead "Đã chốt lịch": khách nhận thư báo giờ mới (luồng 1b). Lead "Mới": chưa gửi gì, khách nhận giờ mới trong thư chốt lịch khi được duyệt.
- Giờ cũ và người đổi được ghi vào nhật ký.
- Nếu đổi giờ thành công mà gửi thư cho khách lỗi, giờ mới vẫn được lưu; nhân viên tự báo khách.

### 2.3. Không ai duyệt

| Khi nào | Hệ thống làm |
|---|---|
| 24 giờ sau khi đặt | Gửi email cảnh báo cho quản lý, ghi "Quá 24 giờ chưa duyệt". Lead vẫn "Mới" |
| Hơn 3 ngày sau khi đặt, lead HOT/WARM/COLD vẫn "Mới", giờ hẹn chưa qua | Nhắc sale duyệt qua sub-workflow thông báo nhân viên |
| Giờ hẹn đã qua mà lead vẫn "Mới", buổi xem còn "Chờ xem" | Chuyển "Không mua" với lý do "Quá hạn không xử lý" (`EXPIRED`), hủy buổi xem và vô hiệu link duyệt cũ; báo quản lý. Báo cáo tuần đếm theo thời điểm đóng. Không coi đây là khách không đến. |

## 3. Trước và trong buổi xem

### 3.1. Nhắc lịch

Luồng 2 chạy mỗi giờ. Lead "Đã chốt lịch" có giờ xem trong 24 giờ tới thì khách nhận thư nhắc lịch, một lần cho mỗi giờ hẹn. Đổi giờ sau khi đã nhắc thì nhắc lại theo giờ mới.

### 3.2. Link quản lý lịch

Link riêng `/lich/<mã>` gửi kèm thư chốt lịch và thư báo giờ mới. Khách mở link thấy tên căn, địa chỉ, giờ xem và hai nút:

| Nút | Kết quả |
|---|---|
| Huỷ lịch | Buổi xem "Đã huỷ", lead "Không mua" với lý do "Khách tự huỷ lịch". Nút duyệt đang chờ (nếu có) bị vô hiệu để không duyệt nhầm |
| Xin đổi lịch (kèm ghi chú) | Ghi "Khách xin đổi lịch", hiện trong việc cần làm của nhân viên. Khách không tự chọn giờ; nhân viên gọi lại và đổi giờ như mục 2.2 |

Link chỉ dùng được khi lead "Mới" hoặc "Đã chốt lịch", buổi xem còn "Chờ xem" và **chưa tới giờ hẹn**. Ngoài các trường hợp đó khách thấy: "Lịch này không còn thay đổi được. Vui lòng liên hệ nhân viên nếu cần hỗ trợ."

### 3.3. Điểm danh

Sau giờ hẹn, nhân viên ghi nhận khách có đến hay không trên trang chi tiết lead.

- Chỉ điểm danh được lead "Đã chốt lịch" có buổi xem "Chờ xem".
- Chỉ bấm được **từ 30 phút trước giờ hẹn** trở đi. Bấm sớm hơn: "Chưa đến giờ hẹn, chưa ghi nhận được khách có đến hay không".
- Đã điểm danh rồi: "Buổi xem này đã được ghi nhận rồi".

| Nhân viên chọn | Buổi xem | Lead | Việc tiếp theo |
|---|---|---|---|
| Có đến | "Khách đã đến" | "Đã xem nhà" | Khi đã qua giờ hẹn 2 giờ, khách nhận link gửi cảm nhận ([03-cham-soc-va-marketing.md](03-cham-soc-va-marketing.md)) |
| Không đến, đóng lead | "Khách không đến" | "Không mua", lý do "Khách không đến xem" | Không |
| Không đến, hẹn lại | Vẫn "Chờ xem", giờ mới | Vẫn "Đã chốt lịch" | Khách nhận thư báo giờ mới; giờ mới qua kiểm tra cách 60 phút |

### 3.4. Quên điểm danh

| Khi nào | Hệ thống làm |
|---|---|
| 2 giờ sau giờ hẹn, chưa điểm danh | Nhắc nhân viên qua email, Telegram, ..., kèm link tới trang lead |
| 24 giờ sau lời nhắc, vẫn chưa điểm danh | Gửi email báo quản lý |

Hệ thống **không** tự chuyển lead sang "Đã xem nhà": chỉ nhân viên mới biết khách có đến hay không.

## 4. Đặt cọc và ký

### 4.1. Lập hợp đồng

Sale hoặc quản lý bấm **Lập hợp đồng** trên trang chi tiết lead, nhập số tiền cọc.

| Điều kiện | Nếu sai, người dùng thấy |
|---|---|
| Lead "Đã xem nhà" | "Chỉ tạo hợp đồng cho khách đã xem nhà (trạng thái VIEWED)" |
| Khách chưa có hợp đồng nào còn hiệu lực | "Khách này đã có hợp đồng đang xử lý" |
| Tiền cọc không lớn hơn giá căn | "Tiền đặt cọc không được lớn hơn giá căn nhà" |
| Căn đang "Đang bán" | "Căn này đang ẩn hoặc không còn mở bán, không lập hợp đồng được" |
| Căn chưa có hợp đồng còn hiệu lực của khách khác | "Căn này đang có hợp đồng #… (…) của khách …, không lập thêm hợp đồng được" |

Căn của hợp đồng là căn trong buổi xem của lead. Lập xong: hợp đồng "Đang soạn", căn "Đang giữ cọc", lead "Đang làm hợp đồng cọc", rồi gọi luồng 3.

### 4.2. Soạn và duyệt

1. Luồng 3 soạn hợp đồng từ mẫu, AI rà nội dung và ghi nhận xét, lưu bản nháp. Hợp đồng chuyển "Chờ duyệt".
2. Quản lý nhận email có bản nháp, nhận xét của AI và nút duyệt; cũng duyệt được trên web admin.
3. Luồng 3 chờ quản lý tối đa **48 giờ**.

| Quản lý | Kết quả |
|---|---|
| Duyệt | Hợp đồng "Đã gửi khách ký", khách nhận email có link ký |
| Từ chối, kèm lý do | Hợp đồng "Bị từ chối", lead về "Đã xem nhà", căn về "Đang bán" nếu không còn hợp đồng khác. Nhân viên nhận email báo |
| Không làm gì trong 48 giờ | Hợp đồng "Hết hạn", lead và căn trả về như trên. Quản lý nhận email báo quá hạn. Duyệt muộn trên web: "Hợp đồng đã quá hạn duyệt, hãy tạo lại hợp đồng mới" |

### 4.3. Khách ký

- Link ký `/ky/<mã>` có hạn 7 ngày.
- Khách xem hợp đồng, nhập họ tên, ký trên màn hình. Hệ thống lưu tên người ký, chữ ký, giờ ký và IP.
- 48 giờ chưa ký: khách nhận email nhắc ký. Thêm 5 ngày vẫn chưa ký: hợp đồng "Hết hạn", lead và căn trả về như mục 4.2, nhân viên nhận email báo.
- Link đã ký: "Hợp đồng này đã được ký rồi". Link quá hạn: "Liên kết ký đã hết hạn".
- Ký xong: hợp đồng "Đã ký", lead "Đã ký hợp đồng cọc". Khách nhận email xác nhận, nhân viên nhận email báo.

### 4.4. Sau khi ký

| Việc | Ai | Điều kiện |
|---|---|---|
| "Đã nhận tiền cọc" | Quản lý | Hợp đồng đã ký, chưa xác nhận lần nào |
| Đánh dấu căn "Đã bán" | Quản lý | Căn "Đang giữ cọc" và hợp đồng của căn đã ký. Sai: "Chỉ đánh dấu "đã bán" được khi căn đang giữ cọc và hợp đồng đã ký" |

Hệ thống dừng ở đây. Thanh toán, công chứng, sang tên nằm ngoài phạm vi.

### 4.5. Khách khác của căn đang giữ cọc

Căn chuyển "Đang giữ cọc" thì không nhận lịch mới. Khách khác **đã có lịch** với căn đó vẫn giữ lịch, làm khách dự phòng, và hiện trong việc cần làm để nhân viên gọi báo hoặc gợi ý căn khác. Hợp đồng bị từ chối hoặc hết hạn thì căn mở bán lại.

## 5. Việc cần làm trên trang tổng quan

Trang tổng quan của web admin gom các khách cần nhân viên xử lý, mỗi nhóm tối đa 20 khách:

| Nhóm | Gồm |
|---|---|
| Chờ điểm danh | Lead "Đã chốt lịch", buổi xem "Chờ xem", giờ hẹn đã qua |
| Khách muốn đặt cọc | Khách chọn "muốn đặt cọc" khi gửi cảm nhận, lead còn "Đã xem nhà" |
| Khách không còn nhu cầu | Khách chọn "chưa có nhu cầu nữa", lead chưa đóng |
| Khách dự phòng | Lead "Mới" hoặc "Đã chốt lịch" có buổi xem ở căn "Đang giữ cọc" |
| Khách xin đổi lịch | Có yêu cầu đổi lịch trong 7 ngày qua, lead còn "Mới" hoặc "Đã chốt lịch" |
