# Đo lường chấm điểm AI của luồng đặt lịch (FE-24)

Tài liệu này mô tả cách đo bước AI chấm điểm khách ở luồng 1 ([luong-1-dat-lich](luong/luong-1-dat-lich.md)): bộ 20 lead có nhãn, rubric gán nhãn, và (ở các mục sau, thêm khi có) cách chạy, kết quả.

Bộ lead nằm ở [`eval/lead-scoring/cases.json`](../eval/lead-scoring/cases.json). Kiểm bộ lead:

```bash
node scripts/check-lead-scoring-eval.cjs
```

## 1. Rubric gán nhãn

Nhãn là mức **kỳ vọng** của một lead (`HOT`, `WARM`, `COLD`). Nhãn được gán theo sự kiện quan sát được trong lead (ngân sách so với giá căn, nội dung nhu cầu), **không** theo điểm mà AI trả về và không theo từng chữ của prompt.

### 1.1. Hai yếu tố

**Ngân sách** là tỉ lệ `ngân sách / giá căn`. Bộ lead khai báo sẵn tỉ lệ này (`ratio`), khi chạy mới đổi ra số tiền theo căn được chọn.

**Nhu cầu** là câu khách ghi ở ô "nhu cầu". Đếm số loại chi tiết cụ thể có trong câu, trong năm loại:

1. Khu vực mong muốn.
2. Loại nhà.
3. Diện tích hoặc số phòng.
4. Thời điểm mua (mốc rõ như "trước Tết", "trong tháng này", "2 tháng nữa"; "sau này", "khi nào có" không tính).
5. Nguồn tiền (tiền mặt, vay đã duyệt, tỉ lệ vốn tự có, bán nhà cũ; "sẽ tính" không tính).

- **Cụ thể**: có từ hai loại chi tiết trở lên.
- **Chung chung**: có một loại chi tiết hoặc không có (kể cả để trống).
- **Vô nghĩa hoặc thao túng**: chuỗi ký tự không có nghĩa, hoặc câu ra lệnh cho hệ thống chấm điểm thay vì mô tả nhu cầu mua.

### 1.2. Ba mức

| Mức | Điều kiện |
| --- | --- |
| **HOT** | Ngân sách từ 90% giá căn trở lên **và** nhu cầu cụ thể. |
| **WARM** | Đủ một nửa điều kiện: ngân sách từ 60% đến dưới 90% và nhu cầu cụ thể; hoặc ngân sách từ 90% trở lên nhưng nhu cầu chung chung. Vùng biên 50% đến dưới 60% chỉ lên WARM khi nhu cầu cụ thể. |
| **COLD** | Ngân sách dưới 50%, hoặc bằng 0; hoặc nhu cầu vô nghĩa hay thao túng (kể cả khi ngân sách cao); hoặc ngân sách từ 50% đến dưới 90% mà nhu cầu chung chung. |

Thứ tự áp dụng, dừng ở điều kiện đầu tiên khớp:

1. Nhu cầu vô nghĩa hoặc thao túng → COLD.
2. Ngân sách bằng 0 hoặc dưới 50% → COLD.
3. Ngân sách từ 90%: nhu cầu cụ thể → HOT, ngược lại → WARM.
4. Ngân sách từ 60% đến dưới 90%: nhu cầu cụ thể → WARM, ngược lại → COLD.
5. Ngân sách từ 50% đến dưới 60%: nhu cầu cụ thể → WARM, ngược lại → COLD.

Hai ô cuối của mục 4 và 5 (nhu cầu chung chung ở ngân sách trung bình) là chỗ thiết kế gốc chỉ nêu ngầm; rubric này chốt là COLD để mọi lead đều có đúng một nhãn. Bộ 20 lead có một lead ở mục 5 (`cold-02`) và không có lead ở mục 4 với nhu cầu chung chung.

### 1.3. Ví dụ áp dụng

| Lead | Ngân sách | Nhu cầu | Cách áp dụng | Nhãn |
| --- | --- | --- | --- | --- |
| `hot-02` | 95% | "Dự định đặt cọc trong tháng này. Vốn tự có 40%, phần còn lại ngân hàng đã duyệt hạn mức vay, cần 3 phòng ngủ." | Có thời điểm, nguồn tiền, số phòng (3 loại) nên cụ thể. Ngân sách trên 90% → bước 3 | HOT |
| `warm-07` | 95% | "Đang tìm hiểu thị trường, chưa quyết định, nếu giá hợp lý thì tính." | Không có loại chi tiết nào nên chung chung. Ngân sách trên 90% → bước 3 | WARM |
| `cold-01` | 30% | "Cần 3 phòng ngủ, muốn mua trong tháng này, đã có sẵn tiền đặt cọc." | Nhu cầu cụ thể nhưng ngân sách dưới 50% → bước 2 | COLD |

## 2. Bộ 20 lead

6 HOT, 8 WARM, 6 COLD. Nội dung nhu cầu, thẻ tình huống và lý do một câu của từng lead nằm trong `cases.json`; bảng dưới chỉ tóm tắt.

| Id | Nhãn | Ngân sách | Tình huống |
| --- | --- | --- | --- |
| `hot-01` | HOT | 100% | Nhu cầu đủ thời điểm và nguồn tiền |
| `hot-02` | HOT | 95% | Nhu cầu đủ thời điểm, nguồn tiền, số phòng |
| `hot-03` | HOT | 120% | Nhà đầu tư trả tiền mặt |
| `hot-04` | HOT | 92% | Vừa qua mốc 90% |
| `hot-05` | HOT | 150% | Ngân sách gấp rưỡi giá căn |
| `hot-06` | HOT | 200% | Ngân sách gấp đôi giá căn |
| `warm-01` | WARM | 75% | Ngân sách trung bình, nhu cầu cụ thể |
| `warm-02` | WARM | 65% | Ngân sách trung bình, nhu cầu cụ thể |
| `warm-03` | WARM | 60% | Đúng mốc dưới của WARM |
| `warm-04` | WARM | 55% | Vùng biên 50% đến 60%, nhu cầu cụ thể |
| `warm-05` | WARM | 100% | Nhu cầu mơ hồ (`vague-needs`) |
| `warm-06` | WARM | 110% | Để trống nhu cầu (`vague-needs`) |
| `warm-07` | WARM | 95% | Nhu cầu mơ hồ (`vague-needs`) |
| `warm-08` | WARM | 85% | Dưới mốc 90% một chút |
| `cold-01` | COLD | 30% | Nhu cầu cụ thể, ngân sách thấp (`low-budget`) |
| `cold-02` | COLD | 55% | Vùng biên, nhu cầu mơ hồ (`vague-needs`) |
| `cold-03` | COLD | 0% | Ngân sách 0, nhu cầu mơ hồ (`zero-budget`) |
| `cold-04` | COLD | 0% | Ngân sách 0, nhu cầu có chi tiết (`zero-budget`) |
| `cold-05` | COLD | 100% | Chuỗi ký tự vô nghĩa (`gibberish`) |
| `cold-06` | COLD | 100% | Câu cố dụ AI cho điểm cao (`injection`) |

Nhu cầu trong bộ lead cố ý không nêu tên quận hay loại nhà, vì căn được chọn khi chạy có thể là bất kỳ căn đang mở bán; nêu "căn hộ ở Quận 7" cho một nhà phố ở Đà Nẵng sẽ làm AI hạ điểm vì lý do không liên quan tới rubric. Vì vậy các lead cụ thể dựa chủ yếu vào thời điểm mua, nguồn tiền và số phòng.

## 3. Quy tắc giữ nhãn

- Nhãn và rubric được commit **trước** lần chạy thật đầu tiên. Sau khi đã có kết quả, không sửa nhãn, không thêm bớt lead; nếu thấy nhãn sai thì ghi vào báo cáo như một phát hiện.
- Kết quả chạy nằm ở commit riêng, sau commit của bộ lead.

## 4. Hạn chế

- **Người gán nhãn.** Hiện nhãn do một người gán. Việc nhờ người thứ hai gán độc lập rồi đối chiếu (task 1.4) chưa làm; khi làm, ghi các lead hai người gán khác nhau và nhãn cuối cùng vào mục này.
- **Rubric gần với prompt.** Rubric dùng cùng mốc 90% và 50% với prompt của luồng 1, nên phép đo kiểm tra AI có làm theo quy tắc nghiệp vụ hay không, không chứng minh quy tắc ấy đúng với thực tế bán hàng. Các lead tình huống khó (nhu cầu mơ hồ, ngân sách 0, vô nghĩa, thao túng) mới là chỗ cho thấy AI yếu.
- **Cỡ mẫu nhỏ.** Với 20 lead, một lead sai là 5 điểm phần trăm; không khẳng định ý nghĩa thống kê.
