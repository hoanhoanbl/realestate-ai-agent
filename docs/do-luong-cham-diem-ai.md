# Đo lường chấm điểm AI của luồng đặt lịch (FE-24)

Tài liệu này mô tả cách đo bước AI chấm điểm khách ở luồng 1 ([luong-1-dat-lich](luong/luong-1-dat-lich.md)): bộ 20 lead có nhãn, rubric gán nhãn, chuẩn bị môi trường và cách chạy; kết quả sẽ thêm sau khi chạy thật.

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

## 5. Chuẩn bị môi trường chạy thật (task 4.1)

Phép đo tạo lead thật trên DB local và để luồng 1 gửi thư thật. Mọi tài khoản mẫu của backend đều là bí danh `+` của cùng hộp thư `nhadn2457@gmail.com` (xem `SEED_USERS` ở `backend/src/users/users.service.ts`), nên nếu để credential SMTP của n8n trỏ vào Gmail thì mỗi lượt đo gửi thư tới hộp thư thật. Vì vậy phải chuyển SMTP sang máy chủ giả **trước** lần chạy đầu.

### 5.1. Bật stack local

Cần bốn container đang chạy: `realestate-db`, `realestate-backend` (cổng 8081), `realestate-web` (cổng 3000), `realestate-n8n` (cổng 5678).

```bash
docker compose up -d
docker ps --format '{{.Names}} {{.Ports}}' | grep realestate
```

### 5.2. Dựng SMTP giả (Mailpit)

[`docker-compose.eval.yml`](../docker-compose.eval.yml) thêm một container `realestate-mailpit` vào cùng mạng với stack chính, mở giao diện xem thư ở `http://localhost:8025` và SMTP ở cổng 1025 (chỉ nghe trên `127.0.0.1`).

```bash
docker compose -f docker-compose.eval.yml up -d
```

Kiểm n8n gọi được Mailpit (đã chạy ngày 20/11, kết quả `open`):

```bash
docker exec realestate-n8n sh -c 'nc -zv mailpit 1025'
```

### 5.3. Trỏ credential SMTP của n8n vào Mailpit

Ở n8n (`http://localhost:5678`) mở **Credentials → SMTP account** (id `hfJ9bBGUGsjH8qDP`) và đổi:

| Trường | Giá trị |
| --- | --- |
| Host | `mailpit` |
| Port | `1025` |
| SSL/TLS | tắt |
| User, Password | để trống (credential SMTP của n8n không bắt buộc hai trường này) |

Lưu ý:
- Ghi lại host, port, user cũ ở nơi riêng để trả lại sau. **Không** commit hay dán giá trị credential vào tài liệu.
- Credential này dùng chung: mọi node gửi thư của n8n local (luồng 1, 1b, 2, 4, sub-workflow thông báo) đều đi vào Mailpit cho tới khi trả lại.
- Giữ nguyên cấu hình này cho tới khi xong task 4.4 (dọn lead mẫu). Luồng 2 có thể nhắc các lead mẫu qua cùng credential, và nếu trả SMTP về Gmail sớm thì thư tới `@eval.invalid` sẽ thật sự được gửi.

### 5.4. Kiểm luồng 1 đã bật

```bash
docker exec realestate-n8n n8n list:workflow --active=true | grep -E 'luong-1-dat-lich|thong-bao-nhan-vien'
```

Phải thấy cả hai. Node `Basic LLM Chain` dùng credential Gemini của n8n local (mô hình đọc từ `n8n-workflows/luong-1-dat-lich.json`, hiện là `models/gemini-3.5-flash-lite`). Mỗi lượt đo gọi Gemini một lần: bộ 20 lead lặp 3 lần là 60 lần gọi.

### 5.5. Hai kênh khác của lead mẫu

Đọc từ luồng và tài liệu, **chưa quan sát khi chạy thật**:
- **Telegram và push.** Luồng 1 gọi `thong-bao-nhan-vien` với `assigneeId`. Mọi tài khoản mẫu hiện không có chat id Telegram hay push token (đã kiểm trong DB local), nên thông báo cho sale rơi về email quản lý và đi vào Mailpit; tin vào nhóm Telegram chung chỉ dùng ở cách gọi cũ không có `assigneeId`, luồng 1 không dùng. Nếu sau này có sale điền chat id Telegram thì lead mẫu được chia cho sale đó sẽ gửi tin Telegram thật.
- **Mautic.** Khi backend lưu điểm AI, nó gọi webhook `lead-changed` của luồng 7, luồng này tạo contact Mautic theo email. Mỗi lượt đo thành một contact `@eval.invalid` trong Mautic local (luồng 7 không gửi email, xem [FE-40](fe-40-l7-khong-email.md)). Câu SQL dọn lead **không** xoá các contact này. Nếu không muốn có chúng, tắt workflow `luong-7-dong-bo-mautic` trong lúc đo (backend chỉ ghi cảnh báo khi webhook không đáp); nếu đã có thì xoá theo email `eval-%@eval.invalid` ở Mautic.

### 5.6. Biến môi trường cho runner

Runner đọc ba biến, **không** có giá trị nào nằm trong repo:

| Biến | Lấy ở đâu |
| --- | --- |
| `EVAL_USER` | Tài khoản quản lý mẫu: `nhadn2457+quanly@gmail.com` |
| `EVAL_PASSWORD` | `SEED_USER_PASSWORD` trong `.env` ở thư mục gốc repo |
| `WEBHOOK_SECRET` | `WEBHOOK_SECRET` trong `.env` (cùng giá trị backend dùng); có nó thì không bị giới hạn 5 lần đặt mỗi 10 phút |

```bash
set -a; . ./.env; set +a
export EVAL_USER='nhadn2457+quanly@gmail.com' EVAL_PASSWORD="$SEED_USER_PASSWORD"
```

### 5.7. Kiểm tay một lịch trước khi chạy bộ

1. Mở một căn đang mở bán trên web local (`http://localhost:3000`), đặt một lịch xem bằng form, dùng email dạng `thu@eval.invalid`.
2. Sau ít giây, lead trong trang quản trị có điểm và mức (`level`, `score`).
3. Mailpit (`http://localhost:8025`) có thư báo đã nhận gửi tới khách và thư báo nhân viên; hộp thư Gmail thật không nhận thư nào.
4. Nếu lead không có điểm, xem lần chạy mới nhất của luồng 1 ở n8n (Executions) và `automationStatus` của lead.

### 5.8. Trước khi chạy: kiểm số khung trống

Căn chọn khi chạy là căn đang mở bán đầu tiên đủ khung giờ cho `số lead × --repeat`. Xem số khung trống của một căn:

```bash
curl -s "http://localhost:8081/api/viewings/slots?propertyId=<id>" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.days.flatMap(d=>d.slots).filter(x=>x.available).length)})'
```

Chạy thử một vòng nhỏ trước khi chạy trọn bộ:

```bash
node scripts/eval-lead-scoring.cjs --only hot-01,warm-05,cold-06 --out eval/lead-scoring/results/thu.tmp
node scripts/eval-lead-scoring.cjs --repeat 3
```

Xong thì dọn lead mẫu bằng câu SQL runner in ra (task 4.4), xoá thư trong Mailpit, rồi trả credential SMTP về giá trị cũ.

### 5.9. Trạng thái

- Đã làm (20/11): thêm `docker-compose.eval.yml`, dựng Mailpit, kiểm n8n kết nối được cổng 1025 và Mailpit nhận thư thử (đã xoá).
- **Chưa làm:** đổi credential SMTP của n8n (mục 5.3) và đặt tay một lịch (mục 5.7). Hai bước này cần thao tác trên n8n đang chạy, nên task 4.1 chưa được đánh dấu xong.
