# README-dev — chạy bản `dev` ở local

> Đây là bản mẫu để xem toàn cảnh hệ thống. `README.md` gốc (của `main`) giữ nguyên. Đọc `CLAUDE.md` để biết quy tắc nhánh.

## Hệ thống làm gì?

Văn phòng môi giới bất động sản nhỏ. Khách đăng ký xem nhà trên web; AI chấm điểm, nhân viên duyệt, hệ thống nhắc lịch, hỏi cảm nhận, soạn hợp đồng đặt cọc cho khách ký online, và báo cáo kinh doanh hằng tuần cho quản lý. n8n là bộ điều phối phía sau.

## 3 vai (actor)

Khách hàng · Nhân viên sale · Quản lý. Danh sách use case: [docs/use-cases.md](docs/use-cases.md).

## Các luồng n8n

| Luồng | Tài liệu | Tình trạng trên `dev` |
|---|---|---|
| 1. Đặt lịch xem nhà | [luong-1](docs/luong/luong-1-dat-lich.md) | Có (đang sửa lỗi) |
| 2. Follow-up tự động | [luong-2](docs/luong/luong-2-follow-up.md) | Có (đang sửa lỗi) |
| Error workflow | [error-workflow](docs/luong/error-workflow.md) | Có |
| 3. Hợp đồng đặt cọc | (sẽ thêm) | Chưa |
| 4. Báo cáo kinh doanh | (sẽ thêm) | Chưa |
| 5. Cảm nhận sau buổi xem | (sẽ thêm) | Chưa |

Bảng này được cập nhật khi mỗi nhánh được merge vào `dev`.

## Chạy

1. Cài Docker Desktop. Sao chép `.env.example` thành `.env`, điền giá trị.
2. `docker compose up -d --build`
3. Mở: web http://localhost:3000 · backend http://localhost:8081/api/docs · n8n http://localhost:5678
4. Import workflow trong `n8n-workflows/` vào n8n, gắn credential (Gemini, SMTP, Header Auth `X-Webhook-Secret`), bật các luồng.

## Email thử nghiệm

Toàn bộ thư về hộp `nhadn2457@gmail.com` nhờ địa chỉ có dấu cộng: quản lý `+quanly`, nhân viên `+nhanvien`, khách thử `+khach1`, `+khach2`...

## Tài liệu

- [CLAUDE.md](CLAUDE.md): quy tắc nhánh `dev`
- [docs/api-contract-dev.md](docs/api-contract-dev.md): API và dữ liệu
- [docs/use-cases.md](docs/use-cases.md): use case
- [docs/luong/](docs/luong/): từng luồng, kiểu swimlane
