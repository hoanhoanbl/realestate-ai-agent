# Design

## Context

- Luồng 1 (`luong-1-dat-lich.json`) nhận lead qua webhook `viewing-requested`, cho node `Basic LLM Chain` (Gemini, parser có cấu trúc) trả `score` 0 đến 100 và `level` `HOT` (từ 70) / `WARM` (40 đến 69) / `COLD` (dưới 40), rồi gửi thư cho khách, báo sale và gọi `PUT /api/leads/:id/ai-result` lưu `score`, `level`. Đọc lại bằng `GET /api/leads/:id` (JWT) cùng `automationStatus`.
- Prompt đã nêu quy tắc: ngân sách từ 90% giá căn cộng điểm mạnh, dưới 50% trừ mạnh, nhu cầu cụ thể thì điểm cao.
- Tạo lead đi qua `POST /api/viewings` (công khai, giới hạn 5 lần mỗi 10 phút mỗi IP, bỏ giới hạn khi gửi kèm `X-Webhook-Secret`). Giờ xem phải tròn giờ, trong 08:00 đến 19:00, cách hiện tại ít nhất 3 giờ làm việc và không quá 14 ngày; hai lịch cùng căn cách nhau 60 phút trở lên.
- Luồng 1 gửi thư thật qua credential SMTP; nếu gửi lỗi thì không tới được bước lưu điểm. Vì vậy chạy đo local cần một SMTP nhận thư giả.
- Thư mục `scripts/` đã có các script kiểm bằng Node thuần (`.cjs`, `assert`), và `scripts/lib/`.

## Goals / Non-Goals

**Goals:**
- Con số lặp lại được, đủ trung thực để đưa vào báo cáo, ngay cả khi thấp.
- Không phụ thuộc dữ liệu căn cụ thể: bộ lead dùng tỉ lệ ngân sách.
- Phần tính số kiểm được mà không cần dịch vụ ngoài.

**Non-Goals:**
- Không tối ưu prompt hay đổi luồng 1 để tăng điểm; đó là việc khác (nếu kết quả thấp, ghi vào báo cáo như một phát hiện).
- Không đo độ đúng của nội dung thư AI soạn, chỉ đo `level` và `score`.
- Không đo chi phí token và độ trễ từng bước (FE-25 Langfuse).
- Không chạy trong CI (cần Gemini và n8n).

## Decisions

### D1. Dữ liệu: một tệp JSON, ngân sách theo tỉ lệ
`eval/lead-scoring/cases.json`: mảng 20 phần tử `{ id, label, ratio, needs, tags, rationale }`. `ratio` là ngân sách chia giá căn (0 cho trường hợp ngân sách 0). Khi chạy, script lấy một căn đang mở bán, tính `budget = round(price * ratio)` và đặt tên, số điện thoại, email, giờ xem theo chỉ số lead. `tags` đánh dấu tình huống khó (`vague-needs`, `low-budget`, `zero-budget`, `gibberish`, `injection`). Tách khỏi mã nên người khác thêm hay sửa lead không cần đọc script.

*Phương án khác:* nhập thẳng số tiền cụ thể. Bị loại vì đổi dữ liệu căn mẫu sẽ làm nhãn sai.

### D2. Nhãn gán theo rubric trước khi chạy, và đóng băng
Rubric viết ở `docs/do-luong-cham-diem-ai.md`, dựa vào sự kiện quan sát được chứ không dựa vào chữ của prompt:
- **HOT**: ngân sách từ 90% giá căn trở lên **và** nhu cầu cụ thể (từ hai chi tiết trong: khu vực, loại nhà, diện tích hoặc số phòng, thời điểm mua, nguồn tiền).
- **WARM**: đủ một nửa điều kiện: hoặc ngân sách từ 60% đến dưới 90% và nhu cầu cụ thể; hoặc ngân sách từ 90% nhưng nhu cầu chung chung.
- **COLD**: ngân sách dưới 50%, hoặc bằng 0, hoặc nhu cầu vô nghĩa hay cố thao túng điểm; ngân sách từ 50% đến dưới 60% chỉ lên WARM khi nhu cầu cụ thể.

Nhãn được commit (cùng rubric) **trước** lần chạy thật đầu tiên và không sửa sau khi đã có kết quả; kết quả nằm ở commit riêng. Hai người gán nhãn độc lập là lý tưởng; nếu chỉ một người gán, ghi rõ trong tài liệu như một hạn chế.

*Giới hạn thừa nhận:* rubric gần với quy tắc trong prompt nên phép đo kiểm tra AI có làm theo quy tắc nghiệp vụ hay không, chứ không chứng minh quy tắc ấy đúng với thực tế bán hàng. Các lead tình huống khó mới cho thấy chỗ AI yếu.

### D3. Runner `scripts/eval-lead-scoring.cjs`
Node thuần (Node 20 có `fetch`), không thêm phụ thuộc. Tham số: `--api` (mặc định `http://localhost:8081`), `--repeat n` (mặc định 1), `--concurrency n` (mặc định 2), `--timeout-s` (mặc định 120), `--dry-run`, `--cases`, `--out`. Biến môi trường: `EVAL_USER`, `EVAL_PASSWORD` (đăng nhập `/api/auth/login`), `WEBHOOK_SECRET` (bỏ giới hạn đặt lịch). Không có khoá nào nằm trong repo.

**Cấp khung giờ.** Mỗi lượt cần một khung giờ riêng: hai lịch cùng căn phải cách nhau từ 60 phút (khung hợp lệ là giờ tròn 08:00 đến 19:00, tối đa 14 ngày tới, sớm nhất sau 3 giờ làm việc). Tính nhầm số khung từng làm kế hoạch cũ sai: một căn × 3 khung/ngày × 7 ngày chỉ có 21 khung, không đủ cho `--repeat 3` (20 lead × 3 = 60 buổi), còn tăng chỉ số liên tục với 3 khung/ngày cần 20 ngày, vượt giới hạn 14 ngày. Cách làm: trước khi tạo lead nào, runner gọi `GET /api/viewings/slots?propertyId=<căn>` (công khai, đã loại khung đã kín và khung vi phạm luật 60 phút), lấy các khung `available` theo thứ tự thời gian và gán **một khung riêng cho mỗi lượt** (`cases × repeat`). Mọi khung hợp lệ có tới khoảng 12 khung mỗi ngày × 14 ngày, nên 60 lượt vừa trong cửa sổ nếu căn còn trống. Nếu số khung trống ít hơn số lượt cần thì runner **dừng trước khi tạo bất kỳ lead nào** và nêu số khung thiếu cùng hai cách xử lý: giảm `--repeat`, hoặc dọn lead `eval-fe24` cũ (câu SQL ở dưới) để trả khung. Không dùng lại khung cho hai lead đang chờ (sẽ bị 409). Luật theo sale (FE-53, 90 phút giữa hai căn khác nhau) không chặn vì cả bộ dùng một căn.

Mỗi lead: đăng ký bằng `POST /api/viewings` với khung đã gán, ghi mốc giờ, rồi thăm dò `GET /api/leads/:id` mỗi 3 giây tới khi có `level` hoặc `automationStatus = FAILED` hoặc hết hạn chờ. Độ trễ là hiệu hai mốc giờ. Số điện thoại gồm mã lượt chạy để chạy lại không đụng "một khách một lead".

**An toàn:** từ chối khi `--api` không phải `localhost`, `127.0.0.1`, `[::1]`; lead mang `source = eval-fe24`, tên `[EVAL] ...`, email `...@eval.invalid`. Script in sẵn câu SQL dọn các lead này cho DB local nhưng không tự xoá.

### D4. Phần tính số tách thành thư viện thuần
`scripts/lib/lead-scoring-metrics.cjs`: `computeMetrics(results)` (độ chính xác, lệch một bậc, ma trận nhầm lẫn, lỗi nghiêm trọng, tỷ lệ lỗi, trung vị và p95 của độ trễ, độ nhất quán giữa các lần lặp) và `renderReport(metrics, meta)` (Markdown). `scripts/check-lead-scoring-eval.cjs` kiểm bộ lead (D1) và chạy các ví dụ số của spec qua `computeMetrics`. Chế độ `--dry-run` dùng bộ chấm giả trả đúng nhãn và gán `fetch` ném lỗi để chứng minh không gọi mạng.

Lead lỗi hoặc quá hạn chờ không vào mẫu số độ chính xác, nhưng được báo riêng; như vậy một lần Gemini hết quota không làm độ chính xác trông thấp một cách sai lệch, mà lộ ra ở tỷ lệ lỗi.

### D5. Mục tiêu là ngưỡng đọc kết quả, không phải điều kiện merge
Ngưỡng tham chiếu: đúng mức từ 80%, lệch một bậc từ 95%, không lỗi nghiêm trọng, tỷ lệ lỗi dưới 5%. Dưới ngưỡng thì báo cáo ghi nguyên văn là chưa đạt và nêu lead sai. PR FE-24 merge khi bộ đo chạy được và kết quả đã ghi, không phụ thuộc đạt hay không.

### D6. Chỗ lưu kết quả
Mỗi lần chạy thật ghi `eval/lead-scoring/results/<ngày>-<giờ>.json` (dữ liệu từng lead) và `.md` (báo cáo). Chỉ commit lần chạy dùng cho báo cáo; các lần thử bỏ qua bằng `.gitignore` dạng `results/*.tmp.*`. `docs/do-luong-cham-diem-ai.md` trích số của lần chạy được chọn.

## Risks / Trade-offs

- [20 lead là mẫu nhỏ nên độ chính xác dao động mạnh, một lead sai là 5%] → Chạy lặp 3 lần và báo độ nhất quán; ghi rõ cỡ mẫu trong báo cáo, không khẳng định ý nghĩa thống kê.
- [Chạy đo tạo lead và gửi thư thật qua n8n local] → Chỉ chạy local, email `.invalid`, SMTP giả; hướng dẫn dựng ở tài liệu và kiểm ở task 4.1.
- [Gemini hết quota giữa chừng] → Lead lỗi được báo riêng, chạy lại phần lỗi bằng `--only <id,...>`.
- [Một người gán nhãn nên có thiên lệch] → Nhờ Hậu gán nhãn độc lập cho 20 lead rồi đối chiếu khác biệt trước khi chạy; nếu không kịp, ghi hạn chế.
- [Luật chống trùng lịch theo sale (FE-53) làm lead mẫu bị chặn nếu cùng một sale] → Dùng một căn và giờ trải rộng; đo trên nhánh nào cũng chạy được.

## Migration Plan

Không có SQL hay triển khai. Thêm tệp mới trong `eval/`, `scripts/`, `docs/`. Rollback là xoá tệp.
