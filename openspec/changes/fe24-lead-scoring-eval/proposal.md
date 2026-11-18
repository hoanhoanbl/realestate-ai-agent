# Proposal

## Why

Đề bài yêu cầu "kết quả đo lường được", và `docs/nghiep-vu/04-sales-analytics.md` mục 5 đã hứa một số đo cho luồng 1: độ chính xác chấm điểm AI trên bộ 20 lead có nhãn. Hiện chưa có bộ lead, chưa có cách chạy, nên báo cáo (DC-05) chưa có con số nào về chất lượng của bước AI. FE-24 không phụ thuộc việc nào khác nên lấp được chỗ trống khi các PR khác đang chờ Hậu duyệt.

## What Changes

- Một bộ **20 lead có nhãn** (`HOT` / `WARM` / `COLD`) viết sẵn, có tình huống khó: ngân sách cao nhưng nhu cầu mơ hồ, nhu cầu cụ thể nhưng ngân sách thấp, ngân sách 0, văn bản vô nghĩa, và câu cố dụ AI chấm điểm cao.
- Một script chạy đo (`scripts/eval-lead-scoring.cjs`): với mỗi lead, đặt lịch qua API thật để luồng 1 chạy, đợi AI chấm xong, đọc điểm và mức, so với nhãn, rồi ghi báo cáo (độ chính xác, ma trận nhầm lẫn, lỗi nghiêm trọng HOT↔COLD, độ trễ, tỷ lệ AI lỗi).
- Cách chấm nhãn (rubric) ghi bằng văn bản để người khác chấm lại được; kết quả chạy thật được ghi vào `docs/` để đưa vào báo cáo.
- Chạy được ở chế độ mô phỏng (`--dry-run`) để kiểm phần tính số mà không cần n8n hay Gemini.

Không đổi luồng 1, không đổi backend, không thêm Langfuse (FE-25 làm sau và dùng lại bộ lead này).

## Capabilities

### New Capabilities
- `lead-scoring-evaluation`: bộ lead có nhãn và cách chạy đo, cho ra số liệu chất lượng chấm điểm AI của luồng đặt lịch.

### Modified Capabilities
<!-- Không đổi requirement của spec hiện có. -->

## Impact

- Thêm `eval/lead-scoring/` (bộ lead, rubric, kết quả) và `scripts/eval-lead-scoring.cjs`; tài liệu `docs/nghiep-vu/04-sales-analytics.md` mục 5, `docs/luong/luong-1-dat-lich.md` (mục đo lường).
- Không sửa code backend, web hay n8n. Không cần SQL, không cần bước tay trên VPS.
- Chạy đo cần stack local có n8n, khoá Gemini và SMTP giả; mỗi lần chạy tạo 20 lead mẫu trên DB local (nguồn `eval-fe24`) và tốn khoảng 20 lượt gọi Gemini.
- Dùng lại ở FE-25 (Langfuse) và ở DC-05 (báo cáo).
