# Spec Delta

## Purpose

Cho sale ghi lại giá đã thoả thuận với khách vào hợp đồng đặt cọc, tách khỏi giá niêm yết của căn, để hợp đồng, báo cáo và nhật ký phản ánh đúng giá hai bên đồng ý.

## ADDED Requirements

### Requirement: Nhập giá thoả thuận khi lập hợp đồng
Khi lập hợp đồng, nhân viên SHALL có thể nhập "Giá thoả thuận" là số nguyên đồng lớn hơn 0. Bỏ trống thì hợp đồng SHALL được hiểu là theo giá niêm yết của căn. Giá niêm yết của căn SHALL giữ nguyên, và hợp đồng SHALL lưu giá niêm yết tại thời điểm lập.

#### Scenario: Nhập giá thoả thuận
- **GIVEN** căn niêm yết 3.000.000.000 đồng
- **WHEN** sale lập hợp đồng với giá thoả thuận 2.850.000.000 đồng và cọc 100.000.000 đồng
- **THEN** hợp đồng lưu giá thoả thuận 2.850.000.000, giá niêm yết 3.000.000.000, và giá của căn không đổi

#### Scenario: Bỏ trống giá thoả thuận
- **WHEN** sale lập hợp đồng không nhập giá thoả thuận
- **THEN** hợp đồng không có giá thoả thuận và mọi nơi hiển thị giá dùng giá niêm yết

#### Scenario: Giá không hợp lệ
- **WHEN** sale nhập giá thoả thuận bằng 0, số âm hoặc không phải số nguyên
- **THEN** hệ thống từ chối với lỗi 400 và không tạo hợp đồng

### Requirement: Tiền cọc theo giá thoả thuận
Tiền đặt cọc SHALL NOT lớn hơn giá thoả thuận khi hợp đồng có giá thoả thuận, và SHALL NOT lớn hơn giá niêm yết khi không có.

#### Scenario: Cọc lớn hơn giá thoả thuận
- **GIVEN** giá thoả thuận 2.850.000.000 đồng
- **WHEN** sale nhập cọc 2.900.000.000 đồng
- **THEN** hệ thống từ chối với lỗi 400 "Tiền đặt cọc không được lớn hơn giá thoả thuận" và không tạo hợp đồng

#### Scenario: Không có giá thoả thuận
- **GIVEN** căn niêm yết 3.000.000.000 đồng và không nhập giá thoả thuận
- **WHEN** sale nhập cọc 3.100.000.000 đồng
- **THEN** hệ thống từ chối như quy tắc hiện tại

### Requirement: Nhật ký giá thoả thuận
Khi một hợp đồng được lập với giá thoả thuận, hệ thống SHALL ghi vào lịch sử khách sự kiện `CONTRACT_PRICE_AGREED` nêu mã hợp đồng, giá niêm yết, giá thoả thuận và người lập. Giá thoả thuận SHALL không đổi sau khi lập; muốn đổi giá thì huỷ hợp đồng đang soạn và lập lại.

#### Scenario: Ghi nhật ký
- **WHEN** sale Bình lập hợp đồng #7 với giá thoả thuận 2.850.000.000 đồng, niêm yết 3.000.000.000 đồng
- **THEN** lịch sử khách có sự kiện `CONTRACT_PRICE_AGREED` nêu hợp đồng #7, hai mức giá và "bởi Bình"

#### Scenario: Không giá thoả thuận thì không có sự kiện
- **WHEN** sale lập hợp đồng không nhập giá thoả thuận
- **THEN** không có sự kiện `CONTRACT_PRICE_AGREED`

### Requirement: Văn bản hợp đồng và rà soát dùng giá thoả thuận
Điều khoản giá trong văn bản hợp đồng do luồng soạn tạo SHALL nêu giá thoả thuận và tiền cọc tính theo giá đó, kèm giá niêm yết để đối chiếu, khi hợp đồng có giá thoả thuận. Rà soát bằng quy tắc cố định SHALL đánh dấu khi giá thoả thuận lệch quá 20% so với giá niêm yết.

#### Scenario: Điều khoản giá có giá thoả thuận
- **WHEN** luồng soạn hợp đồng có giá thoả thuận 2.850.000.000 đồng, niêm yết 3.000.000.000 đồng, cọc 100.000.000 đồng
- **THEN** điều khoản giá nêu giá thoả thuận, giá niêm yết và phần trăm cọc tính theo giá thoả thuận

#### Scenario: Giá lệch quá 20%
- **WHEN** giá thoả thuận thấp hơn giá niêm yết 25%
- **THEN** danh sách cảnh báo gửi cho quản lý duyệt có một mục nêu mức lệch

### Requirement: Hiển thị giá thoả thuận
Trang chi tiết hợp đồng của nhân viên, trang ký của khách và trang in SHALL hiển thị giá thoả thuận khi có, kèm giá niêm yết; khi không có SHALL hiển thị giá niêm yết như hiện nay.

#### Scenario: Khách thấy giá thoả thuận khi ký
- **WHEN** khách mở link ký hợp đồng có giá thoả thuận
- **THEN** trang hiện giá thoả thuận là giá chính và giá niêm yết ở dòng đối chiếu
