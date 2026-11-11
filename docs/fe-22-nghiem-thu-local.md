# FE-22 — Nghiệm thu local và bàn giao server

Ngày 10/11/2026. Phạm vi người dùng chốt: hoàn tất code và kiểm thử local; Hoàng nghiệm thu server và bật campaign. Không gửi email thật trong đợt kiểm thử này.

## Kết quả local

`node scripts/check-mautic-local-setup.cjs` PASS (API chỉ đọc, cố định `localhost:8082`, không in credential):

- `ai_nudge_text`: textarea đã publish, ID 44.
- `nuoi-warm`: lọc tag nuôi; loại DEPOSIT, SIGNED, LOST. `ban-tin-hang-thang`: lọc đúng tag bản tin.
- Ba email FE-22 là template đã publish; unsubscribe token đầy đủ. Email 01 có AI token với nội dung dự phòng.
- Campaign lấy nguồn segment WARM, email đầu → quyết định mở → hai nhánh yes/no sau 3 ngày. Giữ Inactive.
- `docker compose -f docker-compose.yml -f docker-compose.mautic.yml config --quiet`: PASS.
- File compose đã có đúng `DOCKER_MAUTIC_ROLE` cho web/worker/cron (BF-08 đã ở dev).

Container worker/cron đang chạy trên máy local là bản cũ: `docker top` vẫn thấy Apache. Chưa recreate container dùng volume thật, chưa xác minh tiêu thụ queue hoặc giao thư. Đây là trạng thái runtime còn tồn, không phải bằng chứng worker/cron đã vận hành đúng. Không đánh dấu nghiệm thu gửi mail hoàn tất.

## Hoàng thực hiện trên server

Theo [triển khai mục 9](trien-khai.md#9-bản-v031) và [ca nghiệm thu Mautic](mautic-setup.md#85-danh-sách-ca-kiểm-thử-nghiệm-thu-hạn-811):

1. Sao lưu Mautic, kiểm tra nội dung và số lượng queue trước khi worker mới chạy. Triển khai compose có role đúng; xác minh worker là `messenger:consume`, cron là `cron`.
2. Tạo/kiểm tra segment bản tin trên server, webhook L8 và credential n8n; ID local không được dùng mặc định cho server.
3. Import workflow đã merge, kiểm tra URL/secret, gửi thử tới hộp thư nội bộ và xác minh token, tracking mở, hai nhánh trì hoãn, loại khách chốt/mất, DNC/unsubscribe.
4. Chỉ sau nghiệm thu mới bật campaign và các workflow theo kế hoạch phát hành. Đợt này không thực hiện bước đó.

Checker local không thay thế kiểm thử giao thư, thời gian chờ 3 ngày và DNC trên server.
