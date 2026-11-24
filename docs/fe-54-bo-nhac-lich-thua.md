# FE-54 — Bỏ thư nhắc lịch thừa

Ngày 24/11/2026. Nhánh local: `codex/fe54-skip-redundant-reminder`. Đã triển khai và kiểm local; chưa nghiệm thu VPS. Assistant không chạy Git/GitHub.

## Làm gì

Trước FE-54, khách nhận thư chốt lịch lúc còn vài giờ trước buổi xem vẫn có thể nhận thêm thư nhắc ngay lượt quét sau. FE-54 dùng bằng chứng thư chốt đã gửi thành công để bỏ lời nhắc này. Quy tắc nghiệp vụ đầy đủ: [01-visits mục 3.1](nghiep-vu/01-visits.md#31-nhắc-lịch).

- Chỉ dùng sự kiện `VIEWING_CONFIRMATION_SENT` có đúng lead, viewing ID và giờ hẹn ISO UTC của lịch hiện tại. Luồng 1b ghi sau khi SMTP thành công; luồng 1 không ghi vì thư nhận yêu cầu chưa chốt lịch.
- Sự kiện phải ghi khi còn **dưới 24 giờ** trước giờ hẹn và không nằm ở tương lai. Đúng 24 giờ vẫn nhắc theo hành vi hiện có. Ghi chú sai định dạng được bỏ qua, không ép kiểu có thể làm SQL lỗi.
- Đổi giờ làm sự kiện giờ cũ không khớp; lịch mới được xét lại. Việc thiếu consent marketing không chặn thư dịch vụ nhắc lịch.
- Cùng điều kiện được dùng ở selector, claim và start. Giới hạn sự kiện tương lai dùng `statement_timestamp()` (thời điểm chạy truy vấn), không dùng `now()` vốn cố định từ đầu transaction; nhờ đó không bỏ sót thư vừa commit trong lúc chờ khóa. Thư chốt đến sau claim nhưng trước start sẽ chặn gửi lời nhắc. Đây là kiểm tra ở điểm start, không phải transaction chung với SMTP bên ngoài.
- Tác vụ đã gửi email và có `ACTION_DONE` vẫn được phục hồi/hoàn tất nhật ký, không gửi lại hoặc bị bỏ dở vì mới có thư xác nhận.

## Thay đổi

`followup-sql.ts` thêm bằng chứng `confirmation_covers_reminder` vào snapshot dùng chung, so note với giờ UTC chuẩn millisecond. `followup-policy.ts` dùng bằng chứng này cho REMINDER. Không thêm cột, route, loại sự kiện, biến môi trường hay migration.

Đã chạy `scripts/sync-followup-sql.cjs` sau build để cập nhật `backend/sql/preview-follow-up.sql` và query của node `Lấy lead cần follow-up` trong L2. Đã so sánh JSON trước/sau: chỉ query selector đổi; các node, connection, setting và worker phản hồi khác không đổi.

## Kiểm tra

- Backend build/lint PASS. Toàn bộ backend: **26 suite, 396 test PASS**, không skip, với PostgreSQL tạm localhost:55433/fe33_test.
- Bộ tập trung FE-54 và followups: **51 test PASS**, gồm 18 integration test FE-54. Bao phủ mốc 24 giờ ±1 ms; đúng/sai lead và viewing; thiếu/sai note; sự kiện tương lai; đổi giờ; timezone PostgreSQL khác UTC; bằng chứng đến trước claim/start và trong lúc transaction chờ; phục hồi ACTION_DONE.
- `scripts/check-followup-workflow.cjs`: PASS. JSON L2 nguồn import/export qua n8n 2.42.4, node và connection không đổi.
- Runtime L2 trên n8n cô lập với worker backend thật, PostgreSQL thật và SMTP giả: thư chốt khớp thì không tạo reminder; thiếu thư chốt thì một email/một event qua hai lượt; sự kiện giờ cũ thì vẫn gửi nhắc lịch mới. AI và workflow phụ trợ phản hồi dùng fixture; không gửi qua Gemini, email hoặc Telegram thật.
- `tsc --noEmit` còn 19 lỗi có sẵn trong `feedback-work.integration.spec.ts` và `fe38.integration.spec.ts`; không có lỗi ở các file FE-54. Không báo toàn bộ typecheck xanh.

Lệnh test từ thư mục `backend` sau khi dựng DB dùng một lần đúng địa chỉ:

```powershell
$env:FE33_TEST_DATABASE_URL='postgresql://fe33:fe33-local-test@localhost:55433/fe33_test'
npm test -- --runTestsByPath src/followups/fe54.integration.spec.ts src/followups/followups.service.spec.ts
npm run build
npm run lint
```

Bằng chứng local: `output/fe54/runtime-result.json`, bản JSON nguồn xuất lại `output/fe54/export-luong2-fe54.json`. Không đưa toàn bộ output vào PR vì có DB/profile/credential test.

## Triển khai và rollback

1. Nền FE-43 và luồng 1b FE-50 phải có. Kiểm thư chốt thành công mới ghi sự kiện; không tạo sự kiện này từ luồng 1.
2. Deploy backend FE-54 rồi import L2 cùng phiên bản, giữ credential và sub-workflow đúng môi trường. Chỉ publish sau khi chạy ca sát giờ/thiếu thư/đổi giờ với hộp thư test. Không có SQL migration hay env mới.
3. Không bật lại selector chăm khách cũ đã chuyển sang L9. Chưa xác nhận những bước này đã chạy trên VPS.
4. Khi rollback dùng cặp backend/L2 đồng bộ trước FE-54; giữ checkpoint và sự kiện đã gửi, không xoá để gửi lại. Không hạ về backend trước FE-43 vì nguy cơ mất cột đã ghi trong tài liệu triển khai.

Chi tiết: [triển khai mục 9i](trien-khai.md#9i-bỏ-nhắc-lịch-thừa-fe-54-chưa-nghiệm-thu-server). Sau review/merge FE-54 mới chuyển sang task FE-46 trên nhánh riêng để tách PR.
