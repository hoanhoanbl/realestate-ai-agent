# Spec Delta

## Purpose

Lưu bản hợp đồng đã ký thành file PDF chính thức kèm mã băm SHA-256 và nhật ký, để chứng minh hợp đồng không bị sửa sau khi ký (yêu cầu "compliant archiving" của đề bài).

## ADDED Requirements

### Requirement: Lưu bản đã ký thành file PDF
Sau khi khách ký, hệ thống SHALL tạo file PDF từ bản hợp đồng đã ký gồm tiêu đề, nội dung, giá thoả thuận khi có, họ tên người ký, ảnh chữ ký, giờ ký và địa chỉ IP ký, rồi lưu file vào thư mục lưu trữ của hệ thống. Tiếng Việt có dấu SHALL hiển thị đúng. Chỉ hợp đồng ở trạng thái "Đã ký" SHALL được lưu.

#### Scenario: Lưu thành công
- **WHEN** khách ký hợp đồng #7 và luồng 3 yêu cầu lưu trữ
- **THEN** hệ thống có một file PDF cho hợp đồng #7, và hợp đồng ghi đường dẫn lưu, mã băm và giờ lưu

#### Scenario: Hợp đồng chưa ký
- **WHEN** có yêu cầu lưu trữ cho hợp đồng đang "Đã gửi khách ký"
- **THEN** hệ thống từ chối với lỗi 409 và không tạo file

### Requirement: Mã băm và nhật ký lưu trữ
Khi lưu file, hệ thống SHALL tính SHA-256 của nội dung file, lưu mã băm cùng giờ lưu, và ghi vào lịch sử khách sự kiện `CONTRACT_ARCHIVED` nêu mã hợp đồng và tên file. Đường dẫn SHALL do hệ thống đặt tên, không lấy từ dữ liệu người dùng.

#### Scenario: Ghi mã băm
- **WHEN** hợp đồng #7 được lưu thành file
- **THEN** mã băm lưu bằng SHA-256 của chính file đó (64 ký tự hex) và lịch sử khách có sự kiện `CONTRACT_ARCHIVED`

### Requirement: Lưu lại không tạo bản thứ hai
Yêu cầu lưu trữ cho hợp đồng đã được lưu SHALL không tạo thêm file, không đổi mã băm và không ghi thêm sự kiện, và SHALL trả kết quả thành công cho bên gọi.

#### Scenario: Luồng 3 gọi hai lần
- **GIVEN** hợp đồng #7 đã lưu
- **WHEN** luồng 3 gọi lại yêu cầu lưu trữ do thử lại
- **THEN** vẫn một file, mã băm cũ, một sự kiện `CONTRACT_ARCHIVED`

### Requirement: Tải bản lưu và kiểm tra mã băm
Nhân viên đã đăng nhập SHALL tải được file bản đã ký của hợp đồng. Trang chi tiết hợp đồng SHALL hiển thị mã băm, giờ lưu và kết quả kiểm: tính lại SHA-256 của file hiện có và so với mã đã lưu. Khi không khớp hoặc không còn file, hệ thống SHALL hiển thị cảnh báo "Bản lưu đã bị thay đổi hoặc mất". Khách chưa đăng nhập SHALL NOT tải được file này.

#### Scenario: File nguyên vẹn
- **WHEN** nhân viên mở chi tiết hợp đồng #7 đã lưu và file không bị đổi
- **THEN** trang hiện mã băm, giờ lưu và trạng thái "Khớp"; nút tải trả đúng file PDF

#### Scenario: File bị sửa
- **GIVEN** một byte của file lưu bị đổi
- **WHEN** nhân viên mở chi tiết hợp đồng #7
- **THEN** trang hiện cảnh báo "Bản lưu đã bị thay đổi hoặc mất"

#### Scenario: Người chưa đăng nhập
- **WHEN** một người không có phiên đăng nhập yêu cầu tải file
- **THEN** hệ thống trả lỗi 401 và không trả file

### Requirement: Lỗi lưu không làm mất hợp đồng đã ký
Khi lưu trữ lỗi, hợp đồng SHALL vẫn ở trạng thái "Đã ký" và lead vẫn "Đã ký hợp đồng cọc". Luồng 3 SHALL thử lại tối đa 3 lần, vẫn lỗi thì SHALL báo quản lý qua Error workflow. Quản lý SHALL có cách lưu lại bản đã ký từ trang chi tiết hợp đồng.

#### Scenario: Lưu lỗi, quản lý lưu lại
- **GIVEN** thư mục lưu trữ tạm không ghi được khiến luồng 3 báo lỗi sau 3 lần thử
- **WHEN** thư mục hoạt động lại và quản lý bấm "Lưu lại bản đã ký"
- **THEN** file được tạo, mã băm được ghi, hợp đồng vẫn "Đã ký" suốt thời gian đó

#### Scenario: Chỉ quản lý được lưu lại
- **WHEN** một sale (không phải quản lý) gọi lưu lại bản đã ký
- **THEN** hệ thống từ chối với lỗi 403
