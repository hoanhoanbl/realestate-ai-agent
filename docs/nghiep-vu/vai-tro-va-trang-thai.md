# Vai trò, quyền và trạng thái

File này là luật chung của hệ thống: ai được làm gì, và mỗi đối tượng (lead, buổi xem, căn nhà, hợp đồng) có những trạng thái nào, chuyển qua lại ra sao. Quy tắc của từng chặng nằm ở:

- [01-tiep-nhan-va-phan-cong.md](01-tiep-nhan-va-phan-cong.md): quy trình 1, khách vào từ đâu, ai phụ trách, hạn phản hồi, khung giờ hẹn (đã chốt, chưa làm).
- [02-dat-lich-den-dat-coc.md](02-dat-lich-den-dat-coc.md): quy trình 2, đặt lịch, duyệt, xem nhà và điểm danh, đặt cọc và ký.
- [03-cham-soc-va-marketing.md](03-cham-soc-va-marketing.md): quy trình 3, sau buổi xem, nuôi khách, điểm tương tác, báo cáo.

Tài liệu luồng trong `docs/luong/` chỉ link về đây, không chép lại quy tắc. Nếu code chạy khác với file này, báo trong nhóm để sửa một trong hai, không để lệch.

Cập nhật lần cuối: 4/11/2026.

## 1. Hệ thống mô phỏng gì

Một văn phòng môi giới bất động sản nhận bán nhà cho chủ nhà hoặc chủ đầu tư và tìm người mua. Khách xem danh sách nhà, đặt lịch xem, đi xem, rồi đặt cọc nếu muốn mua. AI và n8n làm phần lặp lại (chấm điểm khách, soạn thư, nhắc việc, soạn hợp đồng, tổng hợp số liệu); con người duyệt ở các bước quan trọng.

Đội sale dùng chung một danh sách khách. Khách không được giao cho riêng một sale; ai thao tác thì hệ thống ghi tên người đó vào nhật ký của khách.

## 2. Phạm vi

**Có làm:** toàn bộ vòng đời của khách, từ lúc đăng ký xem nhà đến lúc ký hợp đồng đặt cọc, quản lý xác nhận đã nhận tiền cọc và đánh dấu căn đã bán. Cộng với chăm sóc khách sau buổi xem và báo cáo kinh doanh hằng tuần.

**Không làm** (ghi vào mục hướng phát triển của báo cáo):

| Việc | Lý do |
|---|---|
| Hoa hồng, lương của sale | Việc của kế toán, nhân sự; không thuộc đề tài |
| Chia khách cho từng sale, thu hồi khách khi sale chậm | Đội dùng chung danh sách (mục 1) |
| Thanh toán, hợp đồng mua bán công chứng, sang tên | Hệ thống dừng ở hợp đồng đặt cọc và "đã bán" |
| Khách tự chọn giờ mới khi đổi lịch | Khách chỉ gửi yêu cầu, nhân viên chọn giờ |
| Gộp nhiều lần đặt của cùng một khách thành một hồ sơ | Các lần đặt được nối với nhau qua email (mục 4.1) |

## 3. Vai trò và quyền

| Vai | Là ai | Đăng nhập |
|---|---|---|
| Khách | Người muốn mua nhà | Không cần tài khoản. Thao tác qua web khách, Telegram, ..., hoặc link có mã riêng gửi qua email, ... |
| Sale (`SALE`) | Nhân viên bán hàng | Tài khoản web admin, app, ... |
| Quản lý (`MANAGER`) | Trưởng văn phòng | Tài khoản web admin, app, ... |
| Tự động | n8n và AI | Gọi API backend bằng header `X-Webhook-Secret`. Mọi thao tác ghi dữ liệu đều đi qua backend |

| Việc | Khách | Sale | Quản lý | Tự động |
|---|---|---|---|---|
| Xem nhà, đặt lịch xem qua web, Telegram, ... | ✅ | | | Trợ lý AI trên Telegram, ... đặt lịch hộ khách |
| Huỷ lịch hoặc xin đổi lịch bằng link quản lý lịch | ✅ | | | |
| Gửi cảm nhận sau buổi xem (link `/cam-nhan/<mã>`) | ✅ | | | Hỏi cảm nhận, AI phân tích |
| Ký hợp đồng đặt cọc (link `/ky/<mã>`) | ✅ | | | Gửi link, nhắc ký |
| Duyệt lịch, đổi giờ xem | | ✅ | ✅ | Nhắc khi chưa duyệt |
| Điểm danh buổi xem (có đến, không đến) | | ✅ | ✅ | Nhắc khi chưa điểm danh |
| Đánh dấu "Không mua" kèm lý do | | ✅ | ✅ | Đóng lead quá hạn không xử lý |
| Lập hợp đồng đặt cọc | | ✅ | ✅ | AI soạn và rà nội dung |
| Duyệt hoặc từ chối hợp đồng | | | ✅ | |
| Xác nhận "Đã nhận tiền cọc", đánh dấu căn "Đã bán" | | | ✅ | |
| Thêm, sửa, ẩn, xoá căn nhà | | | ✅ | |
| Xem báo cáo tuần, bấm tạo báo cáo ngay | | | ✅ | Lập báo cáo mỗi thứ Hai |
| Xem trang Đội sale (khách đang giữ và kết quả của từng sale), lọc danh sách khách theo người phụ trách | | | ✅ | Sale không thấy mục này và không thấy ô lọc |
| Tạo tài khoản nhân viên | | | ✅ | |
| Xem danh sách khách, lịch xem, hợp đồng, số liệu tổng quan | | ✅ | ✅ | |

### Khách nhận thông tin qua đâu

Khách không có tài khoản. Hệ thống gửi cho khách qua email, ..., mỗi việc cần khách làm đi kèm một **link riêng có mã bí mật**: ai có link thì mở được đúng một việc của đúng một khách.

Thư gửi khách là thư tự động: khách thao tác bằng link, không bằng cách trả lời thư. Thư khách trả lời vào hộp thư chung của văn phòng, hệ thống không đọc.

| Lúc nào | Khách nhận | Link riêng |
|---|---|---|
| Vừa đặt lịch | Thư báo đã nhận yêu cầu (nội dung theo mức khách) | Không có |
| Nhân viên duyệt | Thư chốt lịch: căn, địa chỉ, giờ xem | `/lich/<mã>`: xem lịch, huỷ, xin đổi lịch |
| Nhân viên đổi giờ | Thư báo giờ mới | `/lich/<mã>` (cùng link) |
| Trong 24 giờ trước giờ hẹn | Thư nhắc lịch | |
| Đã qua giờ hẹn 2 giờ, khách có đến | Thư hỏi cảm nhận | `/cam-nhan/<mã>`: chấm sao, nhận xét, chọn muốn cọc / xem căn khác / chưa có nhu cầu |
| Quản lý duyệt hợp đồng | Thư mời ký | `/ky/<mã>`: đọc và ký hợp đồng |
| 48 giờ chưa ký | Thư nhắc ký | `/ky/<mã>` (cùng link) |
| Ký xong | Thư xác nhận đã ký | `/hop-dong/<mã>`: xem lại, in hoặc lưu PDF hợp đồng |

Khách cũng chat với trợ lý AI trên Telegram, ... để tìm nhà, hỏi đáp, đặt lịch và tra các lịch đã đặt. Muốn tra lịch, khách phải nhập đúng cả email và số điện thoại đã dùng khi đặt, để người khác không xem được lịch của khách.

Vì sao không làm đăng nhập cho khách:

- Khách xem nhà thường chỉ đặt một vài lần; bắt tạo tài khoản dễ làm khách bỏ ngang.
- Mỗi link chỉ làm được một việc và có điều kiện riêng (link quản lý lịch hết dùng được khi tới giờ hẹn, link ký hết hạn sau 7 ngày), nên lộ link cũng chỉ ảnh hưởng một việc.
- Khách mất email thì liên hệ nhân viên; nhân viên làm thay được mọi việc trên web admin (đổi giờ, huỷ, lập hợp đồng, ...).

## 4. Trạng thái

### 4.1. Lead (khách đăng ký xem nhà)

Từ FE-33 và FE-34 (local, chưa triển khai server): **một lead là một khách**, nhận ra bằng số điện thoại. Một lead có nhiều buổi xem (mục 4.2), mỗi lúc tối đa một buổi đang mở. Khách đặt lịch xem căn khác thì buổi xem mới gắn vào lead cũ. Trang chi tiết lead hiện lịch sử các buổi xem, và mục "Các lần đặt khác" cho các lead cũ trùng số điện thoại (dữ liệu trước FE-33 chưa gộp).

| Mã | Nhãn trên web | Nghĩa |
|---|---|---|
| `CONSULTING` | Đang tư vấn | Có hồ sơ nhưng chưa có buổi xem nào đang mở: khách để lại số qua bot hoặc nhân viên nhập tay, hoặc buổi xem vừa bị huỷ, khách không đến |
| `NEW` | Mới | Có buổi xem vừa đặt, chờ nhân viên duyệt |
| `CONFIRMED` | Đã chốt lịch | Nhân viên đã duyệt, chờ đến giờ xem |
| `VIEWED` | Đã xem nhà | Khách đã đến xem (đã điểm danh) |
| `DEPOSIT` | Đang làm hợp đồng cọc | Đã lập hợp đồng, chờ duyệt hoặc chờ khách ký |
| `SIGNED` | Đã ký hợp đồng cọc | Khách đã ký. Trạng thái cuối |
| `LOST` | Không mua | Khách không mua nữa, luôn kèm lý do. Trạng thái cuối |

```mermaid
stateDiagram-v2
    [*] --> CONSULTING: Để lại số điện thoại (bot, nhập tay)
    [*] --> NEW: Khách đặt lịch
    CONSULTING --> NEW: Đặt lịch xem
    NEW --> CONFIRMED: Nhân viên duyệt
    NEW --> CONSULTING: Huỷ lịch, chưa từng xem
    CONFIRMED --> CONSULTING: Huỷ hoặc không đến, chưa từng xem
    CONFIRMED --> VIEWED: Điểm danh "có đến"
    CONFIRMED --> VIEWED: Huỷ hoặc không đến, đã từng xem buổi khác
    VIEWED --> NEW: Đặt thêm lịch xem
    LOST --> NEW: Khách quay lại đặt lịch
    CONSULTING --> LOST
    VIEWED --> DEPOSIT: Lập hợp đồng
    DEPOSIT --> VIEWED: Hợp đồng bị từ chối / hết hạn
    DEPOSIT --> SIGNED: Khách ký
    NEW --> LOST
    CONFIRMED --> LOST
    VIEWED --> LOST
    SIGNED --> [*]
    LOST --> [*]
```

| Từ → Đến | Ai, khi nào |
|---|---|
| (chưa có) → `CONSULTING` | Khách để lại số điện thoại qua bot, hoặc nhân viên nhập tay |
| (chưa có) → `NEW` | Khách đặt lịch lần đầu qua web, Telegram, ... |
| `CONSULTING`, `VIEWED`, `LOST` → `NEW` | Khách (cùng số điện thoại) đặt lịch xem: buổi xem mới gắn vào lead cũ. Lead `LOST` được mở lại và xoá lý do đóng. Không đặt được khi đang có buổi xem mở, hoặc khi đang `DEPOSIT` / `SIGNED` |
| `NEW` → `CONFIRMED` | Nhân viên duyệt bằng nút trong email, Telegram, ... hoặc trên web admin. Không duyệt được khi AI chưa chấm điểm xong |
| `NEW`, `CONFIRMED` → `VIEWED` hoặc `CONSULTING` | Khách tự huỷ bằng link quản lý lịch. Chỉ buổi xem chuyển "Đã huỷ"; lead về `VIEWED` nếu khách từng đến một buổi khác, không thì về `CONSULTING`. Lead **không** bị đóng |
| `NEW` → `LOST` (`EXPIRED`) | Tự động: giờ hẹn đã qua mà chưa ai duyệt *(có từ FE-30)* |
| `CONFIRMED` → `VIEWED` | Nhân viên điểm danh "có đến" |
| `CONFIRMED` → `VIEWED` hoặc `CONSULTING` | Nhân viên điểm danh "không đến" và không hẹn lại (về trạng thái như khi khách huỷ). Lead không bị đóng; muốn đóng thì bấm "Không mua" |
| `CONFIRMED` → `CONFIRMED` (giờ mới) | Nhân viên đổi giờ, hoặc điểm danh "không đến" và chọn hẹn lại |
| `VIEWED` → `DEPOSIT` | Nhân viên lập hợp đồng đặt cọc |
| `DEPOSIT` → `VIEWED` | Hợp đồng bị quản lý từ chối hoặc hết hạn |
| `DEPOSIT` → `SIGNED` | Khách ký hợp đồng |
| `NEW`, `CONFIRMED`, `VIEWED` → `LOST` | Nhân viên bấm "Không mua" kèm lý do. Buổi xem còn chờ thì chuyển "Đã huỷ" |

Khách đang `DEPOSIT` **không** bấm "Không mua" được: quản lý phải từ chối hợp đồng trước, lead tự về `VIEWED`, căn tự về "Đang bán", rồi mới đóng lead nếu khách thật sự không mua. Trên trang chi tiết lead, nút "Không mua" ẩn đi và thay bằng dòng hướng dẫn này. Nếu vẫn gọi API (web admin hoặc n8n), backend trả `400`: "Khách đang đặt cọc, chưa chuyển sang "Không mua" được. Quản lý từ chối hợp đồng trước, khách sẽ về "Đã xem nhà"." *(từ BF-06)*. `SIGNED` và `LOST` không đổi được nữa.

**Lý do "Không mua"**

| Mã | Nhãn | Khi nào |
|---|---|---|
| `NO_SHOW` | Khách không đến xem | Chỉ còn ở dữ liệu trước FE-34; từ FE-34 điểm danh "không đến" không đóng lead |
| `NOT_INTERESTED` | Không còn nhu cầu | Nhân viên chọn sau khi gọi khách |
| `CUSTOMER_CANCELLED` | Khách tự huỷ lịch | Chỉ còn ở dữ liệu trước FE-34; từ FE-34 khách huỷ lịch không đóng lead |
| `EXPIRED` | Quá hạn không xử lý | Tự động, giờ hẹn qua mà chưa duyệt *(có từ FE-30)* |
| `OTHER` | Lý do khác | Mặc định khi nhân viên không chọn lý do |

Khách mất trước khi có lý do (dữ liệu cũ) để trống.

**Mức khách** do AI chấm khi khách đặt lịch, theo điểm 0–100: `HOT` từ 70 điểm, `WARM` từ 40 đến 69, `COLD` dưới 40. Ngân sách rõ và nhu cầu cụ thể thì điểm cao; ngân sách từ 90% giá căn trở lên được cộng mạnh, dưới 50% bị trừ mạnh. Mức quyết định nội dung thư gửi khách và cách chăm sóc sau buổi xem.

**Trạng thái xử lý AI** của lead: `PENDING` (đang chấm), `COMPLETED` (chấm xong), `FAILED` (luồng tự động lỗi giữa chừng; nhân viên vẫn xử lý tay được).

### 4.2. Buổi xem

Một lead có thể có nhiều buổi xem (mỗi lần đặt một buổi), nhưng mỗi lúc **tối đa một buổi đang mở** (`NEW`). Buổi xem đã kết thúc giữ lại làm lịch sử. Đổi giờ thì sửa giờ trên buổi xem đang mở, giờ cũ được ghi vào nhật ký.

| Mã | Nhãn | Từ đâu |
|---|---|---|
| `NEW` | Chờ xem | Khi khách đặt lịch; vẫn `NEW` khi đổi giờ |
| `ATTENDED` | Khách đã đến | Điểm danh "có đến" |
| `NO_SHOW` | Khách không đến | Điểm danh "không đến" và không hẹn lại |
| `CANCELLED` | Đã huỷ | Khách huỷ bằng link, hoặc nhân viên bấm "Không mua" khi buổi xem còn chờ |

Dữ liệu trước FE-19 có buổi xem để `NEW` dù khách đã xem, vì lúc đó chưa có điểm danh.

### 4.3. Căn nhà

| Mã | Nhãn | Hiện cho khách | Nhận đặt lịch |
|---|---|---|---|
| `AVAILABLE` | Đang bán | Có | Có |
| `RESERVED` | Đang giữ cọc | Có | Không |
| `SOLD` | Đã bán | Không | Không |
| `HIDDEN` | Đã ẩn | Không | Không |

| Từ → Đến | Ai, khi nào |
|---|---|
| (chưa có) → `AVAILABLE` hoặc `HIDDEN` | Quản lý thêm căn |
| `AVAILABLE` ↔ `HIDDEN` | Quản lý ẩn hoặc hiện lại |
| `AVAILABLE` → `RESERVED` | Tự động khi nhân viên lập hợp đồng cho căn |
| `RESERVED` → `AVAILABLE` | Tự động khi hợp đồng bị từ chối hoặc hết hạn và căn không còn hợp đồng nào khác |
| `RESERVED` → `SOLD` | Quản lý, chỉ khi hợp đồng của căn đã ký |

Căn đang có hợp đồng còn hiệu lực thì quản lý không đổi trạng thái được (trừ chuyển sang "Đã bán" như trên).

#### Thông tin căn nhà cho khách xem (FE-31)

Quản lý nhập trong form sửa căn ở mục **Quản lý nhà**. Ô nào để trống thì trang chi tiết nhà không hiện dòng đó.

| Nhóm trong form | Gồm | Hiện ở trang khách |
|---|---|---|
| Thông tin chính | Tên, địa chỉ, giá, diện tích, loại, link ảnh đại diện, mô tả | Đầu trang, thẻ căn ở trang chủ |
| Thông tin chi tiết | Phòng ngủ (0 = studio), phòng tắm/WC, số tầng (căn hộ: tầng của căn), diện tích đất, diện tích sàn, đường/hẻm trước nhà (m), hướng, pháp lý, nội thất, tình trạng sử dụng | Khối "Thông tin cơ bản"; số phòng ngủ, WC còn hiện trên thẻ căn |
| Ảnh | Tối đa 20 link ảnh thêm, xếp thứ tự bằng nút ↑ | Bộ ảnh: ảnh đại diện trước, rồi ảnh thêm; bấm để xem toàn màn hình |
| Tiện ích và nội thất | Bấm chọn trong gợi ý hoặc gõ mục khác rồi Enter, tối đa 30 mục mỗi loại | Khối "Tiện ích", "Nội thất" |
| Vị trí | Dịch vụ xung quanh: nhóm (trường học, y tế, chợ/siêu thị, trung tâm thương mại, công viên, giao thông, khác), tên, khoảng cách ghi tự do ("500 m", "5 phút đi bộ"), tối đa 20 dòng | Khối "Vị trí và dịch vụ xung quanh", dưới bản đồ |
| Ảnh 360° theo phòng | Tối đa 10 phòng, mỗi phòng tên + link ảnh | Tab "Xem 360°", nhãn "360°" trên thẻ căn |

- **Bản đồ** tự hiện theo địa chỉ (Google Maps nhúng, không cần API key), không phải nhập. Địa chỉ càng đầy đủ thì ghim càng đúng.
- **Mô tả** nên viết 2–3 đoạn: bố trí từng tầng hoặc từng phòng, hiện trạng và nội thất, điểm nổi bật quanh nhà. Số phòng, pháp lý, tiện ích đã có ô riêng, không cần lặp lại hết trong mô tả.
- **Link ảnh** (ảnh thường và ảnh 360°) phải bắt đầu bằng `http://` hoặc `https://` và mở được từ trình duyệt của khách.
- **Ảnh 360°** phải là ảnh toàn cảnh tỉ lệ 2:1 (chế độ 360° của điện thoại hoặc camera 360°), nên dưới 3 MB để khách xem bằng 4G không phải chờ lâu. Máy chủ chứa ảnh phải cho web khác tải ảnh: bấm **Xem thử** trước khi lưu; báo "Không tải được ảnh 360° của phòng này" là link hỏng hoặc máy chủ chặn, cần đổi chỗ lưu ảnh.
- **Căn mẫu** dùng ảnh Unsplash, ảnh 360° của Poly Haven (đều miễn phí) và địa điểm xung quanh gần đúng, chỉ để demo. Khi backend khởi động trên DB có từ trước FE-31, các căn mẫu chưa từng được lưu bằng form mới được điền thông tin chi tiết; mô tả chỉ được thay khi vẫn còn đúng bản mẫu cũ. Căn nào quản lý đã lưu (kể cả xoá hết ảnh, tiện ích, phòng 360°) thì không bị điền lại.
- **Luồng 6 (Telegram Agent):** công cụ "Tìm nhà" nhận thêm thông số, tiện ích, nội thất, dịch vụ xung quanh; không nhận link ảnh và link 360° (chỉ số lượng), để AI không phải đọc thừa. Luồng 6b (nạp RAG) vẫn chỉ đọc tên, địa chỉ, giá, diện tích, loại, mô tả.

### 4.4. Hợp đồng đặt cọc

Mỗi căn và mỗi khách chỉ có tối đa **một hợp đồng còn hiệu lực** (đang soạn, chờ duyệt, đã gửi hoặc đã ký).

| Mã | Nhãn | Nghĩa |
|---|---|---|
| `DRAFTING` | Đang soạn | Nhân viên vừa lập, AI đang soạn và rà nội dung |
| `PENDING_APPROVAL` | Chờ duyệt | Soạn xong, chờ quản lý duyệt |
| `SENT` | Đã gửi khách ký | Quản lý đã duyệt, khách nhận link ký |
| `SIGNED` | Đã ký | Khách đã ký. Sau đó quản lý xác nhận "Đã nhận tiền cọc" |
| `REJECTED` | Bị từ chối | Quản lý từ chối, kèm lý do |
| `EXPIRED` | Hết hạn | Quản lý không duyệt kịp, hoặc khách không ký kịp |

Thời hạn duyệt, ký và nhắc ký: xem [02-dat-lich-den-dat-coc.md](02-dat-lich-den-dat-coc.md).

### 4.5. Cảm nhận của khách

Khách gửi cảm nhận một lần sau buổi xem: số sao, nhận xét và mong muốn tiếp theo.

| Mã | Khách chọn | Hệ thống làm |
|---|---|---|
| `DEPOSIT` | Muốn đặt cọc | Hiện việc "khách muốn đặt cọc" cho nhân viên |
| `OTHER` | Muốn xem căn khác | Nhân viên gợi ý căn phù hợp hơn |
| `NONE` | Chưa có nhu cầu nữa | Hiện việc cho nhân viên gọi lại; **không** tự đóng lead |

## 5. Nhật ký sự kiện

Mỗi lần trạng thái đổi hoặc hệ thống làm một việc trên một khách, backend ghi một dòng vào bảng `lead_events`. Nhật ký dùng để: hiện dòng thời gian trên trang chi tiết lead, chống gửi trùng (luồng tự động kiểm tra đã làm việc đó chưa), tính báo cáo và tra lỗi. Thao tác của nhân viên ghi kèm tên người làm.

| Nhóm | Sự kiện |
|---|---|
| Đặt lịch, duyệt | AI chấm điểm · Nhân viên duyệt lịch · Nhân viên yêu cầu đổi giờ · Quá 24 giờ chưa duyệt · Đã nhắc nhân viên duyệt lịch · Đổi giờ xem nhà · Khách xin đổi lịch · Lịch xem bị huỷ |
| Buổi xem | Đã nhắc lịch · Đã nhắc xác nhận buổi xem · Báo quản lý: buổi xem chưa xác nhận · Khách không đến xem |
| Sau buổi xem | Đã hỏi cảm nhận · Khách gửi cảm nhận · AI phân tích cảm nhận · Đã nhắc khách WARM · Bắt đầu nuôi khách WARM |
| Hợp đồng, căn | Tạo hợp đồng · Hợp đồng soạn xong · Hợp đồng gửi khách ký · Khách ký hợp đồng · Hợp đồng bị từ chối · Hợp đồng hết hạn · Đã nhận tiền cọc · Căn chuyển sang giữ cọc · Căn đã bán |
| Marketing | Đồng bộ sang Mautic · Điểm Mautic thay đổi |
| Chung | Đổi trạng thái · Follow-up bị lỗi |

Danh sách mã đầy đủ: `LEAD_EVENT_TYPES` trong `backend/src/leads/lead.constants.ts`.

## 6. Thuật ngữ

| Từ | Nghĩa |
|---|---|
| Lead | Một lần khách đăng ký xem một căn |
| Duyệt lịch | Nhân viên xác nhận giờ xem với khách, lead chuyển "Đã chốt lịch" |
| Điểm danh | Nhân viên ghi nhận khách có đến buổi xem hay không |
| Giữ cọc | Căn đã có hợp đồng đặt cọc còn hiệu lực, tạm ngừng nhận lịch xem |
| Link quản lý lịch | Link riêng trong thư xác nhận (`/lich/<mã>`) để khách huỷ hoặc xin đổi lịch |
| Nuôi khách | Gửi nội dung định kỳ cho khách chưa sẵn sàng mua, qua Mautic |
| Đồng ý nhận tin | Ô khách tick khi đặt lịch; không tick thì không gửi nội dung marketing (Nghị định 13/2023) |
