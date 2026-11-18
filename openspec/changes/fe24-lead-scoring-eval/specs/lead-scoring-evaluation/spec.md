# Spec Delta

## Purpose

Đo được chất lượng bước chấm điểm khách của luồng đặt lịch bằng một bộ lead có nhãn cố định, để báo cáo môn học có con số về độ chính xác, độ trễ và tỷ lệ lỗi của AI thay vì chỉ mô tả.

## ADDED Requirements

### Requirement: Bộ lead có nhãn
Hệ thống SHALL có một bộ đúng 20 lead mẫu, mỗi lead có nhãn mức kỳ vọng `HOT`, `WARM` hoặc `COLD` và lý do gán nhãn theo rubric bằng văn bản. Bộ SHALL có ít nhất 5 lead mỗi mức và ít nhất 4 lead tình huống khó: ngân sách cao nhưng nhu cầu mơ hồ, nhu cầu cụ thể nhưng ngân sách thấp, ngân sách bằng 0, và văn bản cố dụ AI cho điểm cao. Ngân sách mỗi lead SHALL được khai báo theo tỉ lệ so với giá căn để bộ dùng được với mọi dữ liệu căn mẫu.

#### Scenario: Bộ hợp lệ
- **WHEN** kiểm tra tệp bộ lead
- **THEN** có đúng 20 lead, mỗi lead có nhãn hợp lệ và lý do, đủ số lượng theo mức, đủ các tình huống khó

#### Scenario: Nhãn thiếu hoặc sai
- **WHEN** một lead thiếu nhãn hoặc nhãn không thuộc ba mức
- **THEN** lệnh kiểm bộ lead báo lỗi nêu lead đó và dừng

### Requirement: Chạy đo qua luồng thật
Lệnh chạy đo SHALL, với mỗi lead, đặt lịch xem qua API đặt lịch của backend để luồng đặt lịch chạy thật, đợi tới khi lead có điểm và mức hoặc có trạng thái lỗi hoặc quá thời gian chờ, rồi ghi lại mức, điểm, độ trễ và trạng thái. Mọi lead mẫu SHALL mang nguồn `eval-fe24`, tên bắt đầu bằng `[EVAL]` và email dưới tên miền `.invalid`.

#### Scenario: Chạy trọn bộ
- **GIVEN** stack local đang chạy với luồng đặt lịch bật
- **WHEN** chạy lệnh đo
- **THEN** 20 lead mẫu được tạo, mỗi lead có kết quả `level`, `score`, độ trễ; lệnh in tóm tắt và ghi tệp kết quả

#### Scenario: AI lỗi hoặc quá thời gian
- **WHEN** một lead không có điểm sau thời gian chờ tối đa hoặc có trạng thái xử lý `FAILED`
- **THEN** lead đó được tính là "lỗi" trong báo cáo, không tính vào độ chính xác, và các lead còn lại vẫn được đo

### Requirement: Chỉ chạy trên môi trường local
Lệnh chạy đo SHALL từ chối chạy nếu địa chỉ backend không phải `localhost`, `127.0.0.1` hoặc `[::1]`, để không tạo lead mẫu hay gửi thư trên hệ thống thật.

#### Scenario: Địa chỉ không phải local
- **WHEN** chạy lệnh đo với địa chỉ backend là tên miền của server thật
- **THEN** lệnh dừng trước khi tạo bất kỳ lead nào và nêu lý do

### Requirement: Số đo của báo cáo
Báo cáo kết quả SHALL gồm: độ chính xác đúng mức (số lead đúng trên số lead đo được), độ chính xác chấp nhận lệch một bậc, ma trận nhầm lẫn 3x3, số lỗi nghiêm trọng (lead `HOT` bị chấm `COLD` hoặc ngược lại), tỷ lệ lỗi hoặc quá thời gian, độ trễ trung vị và p95 tính bằng giây, danh sách từng lead sai kèm điểm và lý do AI trả về, và mô hình, ngày chạy. Khi chạy lặp nhiều lần, báo cáo SHALL thêm tỷ lệ lead được chấm cùng mức ở mọi lần.

#### Scenario: Tính độ chính xác
- **GIVEN** 18 lead đo được, 15 lead đúng mức, 2 lệch một bậc, 1 lệch hai bậc
- **WHEN** tạo báo cáo
- **THEN** độ chính xác đúng mức là 15/18 (83,3%), chấp nhận lệch một bậc là 17/18 (94,4%), có 1 lỗi nghiêm trọng

#### Scenario: Báo cáo trung thực khi dưới mục tiêu
- **WHEN** độ chính xác dưới 80%
- **THEN** báo cáo vẫn ghi đúng con số, nêu rõ chưa đạt mục tiêu và liệt kê lead sai, không điều chỉnh bộ lead hay nhãn sau khi đã có kết quả

### Requirement: Chạy mô phỏng không cần dịch vụ ngoài
Lệnh chạy đo SHALL có chế độ mô phỏng, dùng bộ chấm điểm giả có kết quả định sẵn, không gọi backend, n8n hay Gemini, để kiểm phần tính số liệu và định dạng báo cáo.

#### Scenario: Mô phỏng
- **WHEN** chạy lệnh với chế độ mô phỏng
- **THEN** lệnh không tạo kết nối mạng, in báo cáo với số liệu khớp kết quả giả định sẵn và thoát thành công
