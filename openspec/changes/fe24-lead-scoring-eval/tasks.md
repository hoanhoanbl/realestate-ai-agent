# Tasks

Nhánh `feature/FE-24-bo-20-lead` tạo từ `origin/dev`. Không phụ thuộc FE-43 hay việc nào khác. Chỉ thêm tệp mới và sửa tài liệu; không sửa code backend, web, n8n.

## 1. Bộ lead và rubric

- [ ] 1.1 Viết `docs/do-luong-cham-diem-ai.md` mục rubric (design D2): định nghĩa ba mức, quy tắc vùng biên 50% đến 60%, cách gán nhãn hai người nếu có. Verify: người đọc áp dụng rubric cho 3 lead mẫu ra đúng nhãn đã nêu trong tài liệu; `grep -n "HOT\|WARM\|COLD" docs/do-luong-cham-diem-ai.md` thấy cả ba mức.
- [ ] 1.2 Viết `eval/lead-scoring/cases.json` đủ 20 lead theo design D1: 6 HOT, 8 WARM, 6 COLD; có ít nhất một lead cho mỗi tag `vague-needs`, `low-budget`, `zero-budget`, `gibberish`, `injection`; mỗi lead có `rationale` một câu bám rubric. Verify: task 1.3 báo hợp lệ.
- [ ] 1.3 Viết `scripts/check-lead-scoring-eval.cjs` phần kiểm bộ lead: đúng 20, nhãn hợp lệ, đủ số lượng theo mức và theo tag, `ratio` từ 0 đến 2, id duy nhất. Verify: `node scripts/check-lead-scoring-eval.cjs` in PASS; sửa thử một nhãn thành `HOTT` thì script báo lỗi nêu đúng lead.
- [ ] 1.4 (Nếu Hậu có thời gian) Nhờ Hậu gán nhãn độc lập cho 20 lead không xem nhãn của mình; ghi các lead hai người khác nhau và nhãn cuối cùng vào `docs/do-luong-cham-diem-ai.md`. Verify: bảng khác biệt có trong tài liệu hoặc dòng "chỉ một người gán nhãn" ở phần hạn chế.
- [ ] 1.5 Commit riêng "bộ lead và nhãn" trước khi chạy đo thật (design D2). Verify: `git log --oneline -- eval/lead-scoring/cases.json` có commit này trước mọi commit thư mục `results/`.

## 2. Tính số liệu

- [ ] 2.1 Viết `scripts/lib/lead-scoring-metrics.cjs` (`computeMetrics`, `renderReport`) theo design D4. Verify: `scripts/check-lead-scoring-eval.cjs` thêm test cho đúng các số trong spec: 18 đo được, 15 đúng, 2 lệch một bậc, 1 lệch hai bậc ra 83,3%, 94,4%, 1 lỗi nghiêm trọng; lead lỗi không vào mẫu số; trung vị và p95 của dãy độ trễ mẫu; độ nhất quán khi lặp 3 lần.
- [ ] 2.2 Test biên: tất cả lead lỗi (không chia cho 0, in "không có dữ liệu đo"), một lead duy nhất, độ trễ rỗng. Verify: các test trong `check-lead-scoring-eval.cjs` xanh.

## 3. Runner

- [ ] 3.1 Viết `scripts/eval-lead-scoring.cjs` theo design D3: đọc tham số, chặn địa chỉ không phải local, đăng nhập, chọn căn đang mở bán, dựng lead từ `cases.json` (`budget = round(price * ratio)`), đặt lịch, thăm dò, hạn chờ, đồng thời có giới hạn, ghi JSON và Markdown. Verify: chạy với `--api https://example.com` thoát mã khác 0 trước khi gọi mạng; thiếu `EVAL_USER` báo rõ biến thiếu.
- [ ] 3.2 Chế độ `--dry-run` (bộ chấm giả, `fetch` bị chặn). Verify: `node scripts/eval-lead-scoring.cjs --dry-run` thoát mã 0 và in báo cáo 20 lead đúng 100% mà không có kết nối mạng (kiểm bằng cách chạy khi ngắt mạng hoặc khi `fetch` được ghi đè ném lỗi).
- [ ] 3.3 Tham số `--only` để chạy lại một số lead và `--repeat`. Verify: `--dry-run --only a,b --repeat 3` chỉ chạy hai lead ba lần, báo cáo có mục độ nhất quán.

## 4. Chạy thật và ghi kết quả

- [ ] 4.1 Chuẩn bị môi trường local và ghi lại từng bước trong `docs/do-luong-cham-diem-ai.md`: bật stack local, dựng SMTP nhận thư giả (ví dụ container Mailpit) và trỏ credential SMTP của **n8n local** vào đó (không commit credential), bật workflow luồng 1, đặt `EVAL_USER`, `EVAL_PASSWORD`, `WEBHOOK_SECRET`. Verify: đặt tay một lịch xem qua form web local, lead nhận được điểm và Mailpit thấy thư; không có thư nào ra ngoài.
- [ ] 4.2 Chạy thật một lần thử với `--only` ba lead, xem kết quả hợp lý rồi chạy trọn bộ `--repeat 3`. Verify: có `results/<ngày>.json` và `.md` đủ 60 lượt; lead lỗi (nếu có) được ghi riêng.
- [ ] 4.3 Đọc kết quả với ngưỡng ở design D5, ghi vào `docs/do-luong-cham-diem-ai.md` mục kết quả: các số, ma trận nhầm lẫn, các lead sai và nhận xét ngắn nguyên nhân (không sửa nhãn). Verify: số trong tài liệu khớp tệp kết quả; nếu dưới ngưỡng, văn bản nói thẳng là chưa đạt.
- [ ] 4.4 Dọn lead mẫu khỏi DB local bằng câu SQL script in ra. Verify: `SELECT count(*) FROM leads WHERE source = 'eval-fe24'` trả 0.

## 5. Tài liệu

- [ ] 5.1 `docs/nghiep-vu/04-sales-analytics.md` mục 5: dòng "Độ chính xác chấm điểm AI trên bộ 20 lead" đổi từ "Chưa làm FE-24" sang "Đã đo" kèm số và link tài liệu đo. Verify: số khớp tài liệu đo.
- [ ] 5.2 `docs/luong/luong-1-dat-lich.md`: thêm mục "Đo lường" ngắn trỏ sang tài liệu đo và lệnh chạy. `README.md` bản đồ tài liệu thêm dòng cho `docs/do-luong-cham-diem-ai.md`. Verify: link trong hai tài liệu mở được; lệnh trong tài liệu chạy đúng như viết với `--dry-run`.
- [ ] 5.3 Chạy `node scripts/check-lead-scoring-eval.cjs` và `node scripts/eval-lead-scoring.cjs --dry-run` lần cuối. Verify: cả hai thoát mã 0.

## Workflow follow-up

- Mở PR `[FE-24]` base `dev`; không sửa `docs/danh-sach-task.md` trong PR này (CH-13 cập nhật sổ).
- FE-25 (Langfuse) sau này dùng lại `cases.json` và runner; chưa lập change vì cần tài khoản Langfuse Cloud của Hoàng.
- DC-05 (báo cáo) trích số từ `docs/do-luong-cham-diem-ai.md`.
