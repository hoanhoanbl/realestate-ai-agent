# Spec Delta

## Purpose

Một sale chỉ ở được một nơi tại một thời điểm và cần thời gian di chuyển giữa hai căn. Capability này đảm bảo hệ thống không xếp cho một sale hai buổi xem ở hai căn khác nhau quá gần nhau, nên quản lý thấy xung đột ngay lúc quyết định thay vì vào ngày xem.

## ADDED Requirements

### Requirement: Định nghĩa sale bận
Sale SHALL được coi là bận lúc T khi sale đó đang phụ trách một lead có buổi xem ở một căn khác mà giờ hẹn cách T dưới 90 phút. Buổi xem "Đã huỷ" và "Khách không đến" SHALL NOT được tính. Buổi xem "Khách đã đến" SHALL được tính theo giờ hẹn.

#### Scenario: Hai căn khác nhau cách 60 phút
- **GIVEN** sale An phụ trách lead có buổi xem căn Sơn Trà lúc 09:00 ở trạng thái "Chờ xem"
- **WHEN** hệ thống kiểm tra An có bận lúc 10:00 cho căn Hải Châu
- **THEN** An bận, vì 60 phút nhỏ hơn 90 phút

#### Scenario: Hai căn khác nhau cách đúng 90 phút
- **GIVEN** An có buổi xem căn Sơn Trà lúc 09:00
- **WHEN** hệ thống kiểm tra An có bận lúc 10:30 cho căn Hải Châu
- **THEN** An không bận

#### Scenario: Buổi đã huỷ hoặc khách không đến không tính
- **GIVEN** An có buổi xem lúc 09:00 ở trạng thái "Đã huỷ", và buổi khác lúc 15:00 ở trạng thái "Khách không đến"
- **WHEN** hệ thống kiểm tra An có bận lúc 09:30 hoặc 15:30 cho căn khác
- **THEN** An không bận

#### Scenario: Buổi đã điểm danh vẫn tính bận
- **GIVEN** An đã điểm danh "Khách đã đến" cho buổi xem lúc 09:00, lúc 08:40
- **WHEN** hệ thống kiểm tra An có bận lúc 09:30 cho căn khác
- **THEN** An bận

#### Scenario: Cùng căn theo quy tắc 60 phút của căn
- **GIVEN** An có buổi xem căn Sơn Trà lúc 09:00
- **WHEN** có yêu cầu xem cùng căn Sơn Trà lúc 09:30
- **THEN** quy tắc theo sale không áp dụng cho căn này; quy tắc theo căn (60 phút) quyết định

### Requirement: Chia sale bỏ qua sale đang bận
Khi chia người phụ trách lần lượt cho khách mới hoặc lead mở lại hoặc lead chưa có người phụ trách đặt buổi xem, hệ thống SHALL bỏ qua sale đang bận lúc giờ khách chọn và chia cho sale kế tiếp còn rảnh. Sale bị bỏ qua SHALL giữ nguyên lượt. Khi mọi sale đang nhận khách đều bận, hệ thống SHALL chia như quy tắc cũ. Khách SHALL NOT bị từ chối vì lịch của sale.

#### Scenario: Sale đầu lượt bận, chia cho sale kế
- **GIVEN** An là sale đến lượt và An bận lúc 09:30; Bình rảnh
- **WHEN** khách mới đặt buổi xem lúc 09:30
- **THEN** lead được giao cho Bình, và lượt của An không đổi

#### Scenario: Mọi sale đều bận
- **GIVEN** mọi sale đang nhận khách đều bận lúc 09:30
- **WHEN** khách mới đặt buổi xem lúc 09:30
- **THEN** lead vẫn được chia theo lượt như cũ và khách đặt lịch thành công

#### Scenario: Khách cũ giữ sale cũ dù sale bận
- **GIVEN** khách cũ đang do An phụ trách và An bận lúc 10:00
- **WHEN** khách đặt thêm buổi xem lúc 10:00
- **THEN** lead vẫn giao An và việc kiểm tra xảy ra ở bước duyệt

### Requirement: Duyệt, đổi giờ, hẹn lại và hẹn xem tiếp bị chặn khi sale bận
Khi duyệt lịch (nút trong thông báo, trang xác nhận, web admin), đổi giờ, hẹn lại sau khi khách không đến, hoặc hẹn xem tiếp trong theo dõi phản hồi, hệ thống SHALL kiểm tra lịch của sale phụ trách lead, kể cả khi quản lý thao tác thay. Nếu sale bận, hệ thống SHALL trả lỗi 409 và SHALL NOT thay đổi lịch hay trạng thái, kèm thông báo "Sale … đã có lịch xem căn … lúc …. Hãy đổi giờ hoặc nhờ quản lý chuyển sale." Buổi xem đang được duyệt hoặc đổi giờ SHALL được loại khỏi phép kiểm tra.

#### Scenario: Duyệt bị chặn
- **GIVEN** An phụ trách lead Lan có buổi 10:00 căn Ngũ Hành Sơn chờ duyệt, và có buổi 09:00 căn Sơn Trà
- **WHEN** An bấm Duyệt buổi 10:00
- **THEN** hệ thống trả 409 nêu sale An, căn Sơn Trà và giờ 09:00; lead vẫn "Mới"; không gọi n8n

#### Scenario: Đổi giờ ra ngoài khoảng 90 phút thì được
- **GIVEN** tình huống trên
- **WHEN** An đổi buổi 10:00 sang 10:30 và duyệt
- **THEN** hệ thống cho phép đổi và duyệt

#### Scenario: Quản lý duyệt thay vẫn kiểm theo sale phụ trách
- **GIVEN** quản lý duyệt buổi xem của lead do An phụ trách, An bận lúc đó
- **WHEN** quản lý bấm Duyệt
- **THEN** hệ thống trả 409 như khi An tự duyệt

#### Scenario: Hẹn xem tiếp trong theo dõi phản hồi
- **GIVEN** sale An ghi kết quả "hẹn xem tiếp" lúc 09:30 trong khi An có buổi xem khác lúc 09:00
- **WHEN** An gửi kết quả
- **THEN** hệ thống trả 409; việc theo dõi phản hồi không bị đóng và không tạo buổi xem mới

#### Scenario: Hẹn lại sau khi khách không đến
- **GIVEN** sale điểm danh "Khách không đến" và chọn hẹn lại vào giờ trùng lịch khác của chính sale
- **WHEN** sale gửi
- **THEN** hệ thống trả 409; buổi xem giữ nguyên trạng thái và giờ cũ, không ghi sự kiện không đến

### Requirement: Chuyển sale bị chặn khi sale mới bận
Khi quản lý chuyển một lead đang có buổi xem mở ("Chờ xem") sang sale khác, hệ thống SHALL kiểm tra lịch của sale mới với từng buổi xem mở của lead. Nếu sale mới bận, hệ thống SHALL trả lỗi 409 "Sale … đã có lịch xem căn … lúc …; chọn sale khác hoặc đổi giờ trước" và SHALL giữ nguyên người phụ trách. Lead không có buổi xem mở SHALL được chuyển như trước.

#### Scenario: Chuyển sang sale đang bận
- **GIVEN** lead Hùng có buổi 09:00 căn Sơn Trà; Bình có buổi 09:30 căn Hải Châu
- **WHEN** quản lý chuyển lead Hùng sang Bình
- **THEN** hệ thống trả 409, người phụ trách vẫn là sale cũ và không ghi sự kiện chuyển

#### Scenario: Chuyển sang sale rảnh
- **GIVEN** như trên và Chi không có buổi xem nào trong vòng 90 phút
- **WHEN** quản lý chuyển lead Hùng sang Chi
- **THEN** chuyển thành công

#### Scenario: Lead không có buổi xem mở
- **GIVEN** lead đã xem xong, không còn buổi xem "Chờ xem"
- **WHEN** quản lý chuyển sang sale đang có lịch dày
- **THEN** chuyển thành công

### Requirement: Kiểm tra an toàn khi nhiều thao tác cùng lúc
Các thao tác làm đổi tập buổi xem của một sale (tạo buổi xem, đổi giờ, hẹn xem tiếp, chuyển sale) SHALL chạy trong transaction có khoá theo sale, để hai thao tác đồng thời không cùng lọt qua phép kiểm tra.

#### Scenario: Hai buổi xem tạo cùng lúc cho cùng một sale
- **GIVEN** An rảnh lúc 09:00 và 09:30
- **WHEN** hai thao tác hẹn xem tiếp cho hai lead của An lúc 09:00 và 09:30 chạy đồng thời
- **THEN** đúng một thao tác thành công và thao tác còn lại trả 409

#### Scenario: Không chuyển lead khi sale cũ đang dẫn buổi xem đã điểm danh
- **GIVEN** An vừa điểm danh "Khách đã đến" cho buổi xem lúc 09:00, bây giờ là 09:05
- **WHEN** quản lý chuyển lead đó sang Bình
- **THEN** hệ thống trả 409 "Sale An đang dẫn buổi xem căn … lúc 09:00. Chuyển người phụ trách sau 10:30."; người phụ trách vẫn là An và lịch bận lúc 09:00 vẫn thuộc An

#### Scenario: Quá 90 phút kể từ giờ hẹn thì chuyển được
- **GIVEN** buổi đã điểm danh có giờ hẹn cách bây giờ hơn 90 phút
- **WHEN** quản lý chuyển lead sang Bình
- **THEN** chuyển thành công
