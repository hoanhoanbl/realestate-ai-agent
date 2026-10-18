# README-dev — chạy bản `dev` ở local

> Bản mẫu `dev` để xem toàn cảnh hệ thống. Đọc `CLAUDE.md` để biết quy tắc nhánh.

## Hệ thống làm gì?

Văn phòng môi giới bất động sản nhỏ. Khách đăng ký xem nhà trên web; AI chấm điểm, nhân viên duyệt, hệ thống nhắc lịch, hỏi cảm nhận, soạn hợp đồng đặt cọc cho khách ký online, và báo cáo kinh doanh hằng tuần cho quản lý. n8n là bộ điều phối phía sau.

## 3 vai (actor)

Khách hàng · Nhân viên sale · Quản lý. Danh sách use case: [docs/use-cases.md](docs/use-cases.md).

## Các luồng n8n

| Luồng | Tài liệu | Tình trạng trên `dev` |
|---|---|---|
| 1. Đặt lịch xem nhà | [luong-1](docs/luong/luong-1-dat-lich.md) | Có |
| 2. Follow-up tự động | [luong-2](docs/luong/luong-2-follow-up.md) | Có |
| 1b. Chốt lịch / đổi giờ từ web admin | [luong-1b](docs/luong/luong-1b-chot-lich-thu-cong.md) | Có |
| Error workflow | [error-workflow](docs/luong/error-workflow.md) | Có |
| 3. Hợp đồng đặt cọc | [luong-3](docs/luong/luong-3-hop-dong.md) | Có |
| 4. Báo cáo kinh doanh | [luong-4](docs/luong/luong-4-bao-cao.md) | Có |
| 5. Cảm nhận sau buổi xem | [luong-5](docs/luong/luong-5-cam-nhan.md) | Có |

## Các trang web

| Địa chỉ | Dành cho | Nội dung |
|---|---|---|
| `/` | Khách | Danh sách nhà, lọc theo thành phố, loại, giá |
| `/nha/[id]` | Khách | Chi tiết một căn và form đặt lịch xem |
| `/admin/login` | Nhân viên, quản lý | Đăng nhập |
| `/ky/[token]` | Khách | Đọc và ký hợp đồng đặt cọc (link trong email) |
| `/cam-nhan/[token]` | Khách | Gửi cảm nhận sau buổi xem (link trong email) |
| `/admin` | Nhân viên, quản lý | Tổng quan: phễu theo trạng thái, việc cần xử lý |
| `/admin/leads`, `/admin/leads/[id]` | Nhân viên, quản lý | Danh sách khách, chi tiết, dòng thời gian, nút Duyệt / Đổi giờ / Đã xem / Mất khách |
| `/admin/lich-xem` | Nhân viên, quản lý | Lịch xem sắp tới và đã qua, đổi giờ |
| `/admin/hop-dong`, `/admin/hop-dong/[id]` | Nhân viên, quản lý | Danh sách và chi tiết hợp đồng; quản lý duyệt hoặc từ chối |
| `/admin/bao-cao` | Chỉ quản lý | Báo cáo tuần do AI Agent viết, nút "Tạo báo cáo ngay" |
| `/admin/nha` | Chỉ quản lý | Thêm, sửa, ẩn căn nhà |

Khu khách không có đường dẫn sang khu admin; nhân viên tự gõ `/admin`.

## App nhân viên

Thư mục `app/` (Expo, chạy bằng Expo Go): việc hôm nay, duyệt lịch, gọi khách, thông báo đẩy khi có khách mới. Xem [app/README.md](app/README.md).

## Chạy

1. Cài Docker Desktop. Sao chép `.env.example` thành `.env`, điền giá trị.
2. `docker compose up -d --build`
3. Mở: web http://localhost:3000 · backend http://localhost:8081/api/docs · n8n http://localhost:5678
4. Import workflow trong `n8n-workflows/` vào n8n, gắn credential (Gemini, SMTP, Header Auth `X-Webhook-Secret`), bật các luồng.
5. Luồng 4 cần thêm tài khoản database chỉ đọc: xem mục 8 của [luồng 4](docs/luong/luong-4-bao-cao.md).

## Tài khoản đăng nhập (web admin, app)

| Vai | Email | Mật khẩu |
|---|---|---|
| Quản lý | `nhadn2457+quanly@gmail.com` | giá trị `SEED_USER_PASSWORD` trong file `.env` |
| Nhân viên | `nhadn2457+nhanvien@gmail.com` | giống trên |

Hai tài khoản được tạo tự động khi backend khởi động lần đầu. Cần đặt `JWT_SECRET` và `SEED_USER_PASSWORD` trong `.env` (xem `.env.example`).

## Email thử nghiệm

Toàn bộ thư về hộp `nhadn2457@gmail.com` nhờ địa chỉ có dấu cộng: quản lý `+quanly`, nhân viên `+nhanvien`, khách thử `+khach1`, `+khach2`...

## Tài liệu

- [CLAUDE.md](CLAUDE.md): quy tắc nhánh `dev`
- [docs/tong-quan-du-an.md](docs/tong-quan-du-an.md): bài toán, kiến trúc, 6 luồng
- [docs/api-contract-dev.md](docs/api-contract-dev.md): API và dữ liệu
- [docs/phoi-hop.md](docs/phoi-hop.md): hai người chia việc và quy tắc Git
- [docs/use-cases.md](docs/use-cases.md): use case
- [docs/luong/](docs/luong/): từng luồng, kiểu swimlane
