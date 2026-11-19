# Tasks

Nhánh `feature/FE-50-viec-nho-n8n`, tạo từ nhánh FE-43 (nhánh chồng, PR nháp, base là nhánh FE-43) vì cần loại sự kiện `VIEWING_CONFIRMATION_SENT` và hàm dựng ghi chú. Sửa JSON n8n trên n8n local rồi export lại cả file; không sửa tay hai nơi.

## 1. Luồng 1b ghi `VIEWING_CONFIRMATION_SENT`

- [x] 1.1 Trong `luong-1b-chot-lich-thu-cong.json`, thêm `viewingTimeIso` (`new Date(q.viewing_time).toISOString()`) vào đầu ra của node `Chuẩn bị`. Verify: chạy thử trên n8n local, đầu ra node có `viewingTimeIso` dạng `2026-11-20T03:00:00.000Z`.
  - Ghi chú (20/11): chạy trên n8n cô lập, đầu ra `viewingTimeIso` có dạng `2026-11-24T03:00:00.000Z`, khớp ghi chú sự kiện.
- [x] 1.2 Thêm hai node HTTP `Ghi log VIEWING_CONFIRMATION_SENT` theo design D2: một sau `Email chốt lịch` (trước `Cập nhật CONFIRMED`), một sau `Email báo giờ mới`; `retryOnFail` 3 lần, `onError: continueRegularOutput`, ghi chú `viewing=<viewingId>;time=<viewingTimeIso>`. Tô màu nhóm theo quy ước `docs/tong-quan-du-an.md` mục 6 và cập nhật sticky note nhóm. Verify: JSON hợp lệ (`python3 -c "import json;json.load(open('n8n-workflows/luong-1b-chot-lich-thu-cong.json'))"`); import vào n8n local không báo lỗi.
  - Ghi chú (20/11): ba file JSON hợp lệ, import vào n8n cô lập không báo lỗi; hai node ghi sự kiện chạy đúng ở cả duyệt và đổi giờ.
- [x] 1.3 Thêm `scripts/check-confirmation-note.cjs` (design D3). Verify: `node scripts/check-confirmation-note.cjs` in PASS với giờ mẫu và bắt được khi đổi biểu thức sai (ví dụ bỏ `.toISOString()`).
- [x] 1.4 Chạy thử local với SMTP giả (stub): (a) sale duyệt, thư gửi, có đúng một sự kiện với ghi chú đúng; (b) đổi giờ, thêm một sự kiện giờ mới; (c) tắt SMTP, không có sự kiện, nhánh lỗi chạy như cũ; (d) cho backend từ chối ghi sự kiện, lead vẫn thành "Đã chốt lịch". Verify: kiểm `lead_events` sau mỗi trường hợp khớp scenario của spec `viewing-confirmation-event`; ghi kết quả vào `docs/luong/luong-1b-chot-lich-thu-cong.md`.
  - Ghi chú (20/11): đủ bốn tình huống (a) đến (d), kết quả ghi ở `docs/luong/luong-1b-chot-lich-thu-cong.md` mục 6. SMTP giả và backend cục bộ.
- [x] 1.5 Cập nhật `docs/luong/luong-1b-chot-lich-thu-cong.md` (số node, sơ đồ bước, bảng sự kiện ghi) và `docs/nghiep-vu/01-visits.md` mục 3.1: ghi "luồng 1b ghi sự kiện" thay cho "luồng 1 và 1b" và lý do (design D1); đổi nhãn FE-50 sang "Đang chạy", để FE-54 vẫn "Sắp làm". Verify: số node trong tài liệu bằng số node trong JSON (đếm bằng script).

## 2. Luồng 6b và Error workflow

- [ ] 2.1 Bật retry cho 5 node của luồng 6b (design D4). Verify: script đếm `retryOnFail` trong `luong-6b-nap-tri-thuc.json` ra đúng 5; chạy tay luồng với DB local, kết quả không đổi; ngắt Postgres giữa chừng thấy thử lại 3 lần trong tab Executions.
  - Ghi chú (20/11): script đếm ra 5; ngắt Postgres (cổng giả đếm kết nối) thấy node đầu thử đúng 3 lần. Chưa chạy trọn lượt với Gemini thật để so kết quả, nên chưa chứng minh phần "kết quả không đổi".
- [x] 2.2 Thêm `Có Telegram?` và `Gửi Telegram` vào `error-workflow.json` (design D5). Verify: trên n8n local gây lỗi một luồng thử; (a) có biến Telegram: nhóm test nhận tin có tên luồng và link; (b) bỏ biến: chỉ email, Error workflow không lỗi; (c) token sai: email vẫn gửi.
  - Ghi chú (20/11): cả ba tình huống (a) đến (c) chạy trên n8n cô lập với Telegram giả, kết quả ghi ở `docs/luong/error-workflow.md` mục 6.
- [x] 2.3 Cập nhật `docs/luong/error-workflow.md` (5 node, sơ đồ, biến môi trường cần có) và `docs/luong/luong-6b-nap-tri-thuc.md` (phần retry); `docs/danh-sach-lo-hong.md`: đóng LH-52, LH-53. Verify: số node trong tài liệu khớp JSON; hai dòng LH ghi "Đã xử lý" và FE-50.

## 3. Tích hợp

- [x] 3.1 Kiểm ba file JSON không chứa credential mới ngoài các id đã có ở luồng khác (`git diff` các khối `credentials`). Verify: diff không thêm id credential lạ.
- [x] 3.2 Cập nhật bước tay triển khai trong `docs/trien-khai.md`: import lại ba luồng, kiểm `TELEGRAM_SALE_CHAT_ID` đã có trong `.env` của VPS. Verify: các bước chạy được trên n8n local theo đúng văn bản.

## Workflow follow-up

- Mở PR nháp base là nhánh FE-43; sau khi FE-43 merge, đổi base sang `dev` và rebase.
- Nêu điểm lệch D1 (luồng 1 không ghi sự kiện) trong mô tả PR để Hậu xác nhận.
- Không sửa `docs/danh-sach-task.md` trong PR này (CH-13 cập nhật sổ).
