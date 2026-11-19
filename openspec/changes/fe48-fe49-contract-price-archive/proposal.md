# Proposal

## Why

Đề bài của thầy có hai yêu cầu hợp đồng mà hệ thống chưa đáp ứng:

- **Thương lượng giá**: hợp đồng luôn lấy giá niêm yết của căn, sale không ghi được giá đã thoả thuận với khách (`docs/nghiep-vu/02-document-signing.md` mục 1).
- **Lưu trữ có dấu vết chống sửa ("compliant archiving")**: sau khi khách ký, chữ ký và thông tin ký nằm trong database, khách tự in PDF từ trình duyệt; không có file lưu trữ chính thức, không có mã băm (LH-28, mục 5).

Hai việc cùng một change vì FE-49 dùng nền của FE-48 (cột, cách lưu file, quyền truy cập), nhưng đi hai PR: FE-48 trước, FE-49 chồng lên.

## What Changes

**FE-48 (giá thoả thuận, nền lưu file):**
- Sale nhập "Giá thoả thuận" (tuỳ chọn) khi lập hợp đồng; lưu ở `contracts.agreed_price`, giá niêm yết của căn giữ nguyên. Mỗi lần ghi giá ghi sự kiện `CONTRACT_PRICE_AGREED` kèm người làm.
- Tiền cọc không được lớn hơn giá thoả thuận (khi có) hoặc giá niêm yết (khi không).
- Luồng 3 soạn điều khoản với giá thoả thuận (kèm giá niêm yết để đối chiếu) và AI rà soát dùng giá đó; trang ký, trang chi tiết và trang in hợp đồng hiện giá thoả thuận.
- Dịch vụ lưu file đã ký của backend: ghi file ra thư mục lưu trữ (volume Docker), tính SHA-256, ghi `signed_file_path`, `signed_file_sha256`, `signed_file_stored_at`, sự kiện `CONTRACT_ARCHIVED`; tải file về (nhân viên đăng nhập) và kiểm hash khi tải.

**FE-49 (tạo và lưu bản đã ký):**
- Backend tự dựng PDF hợp đồng đã ký (nội dung, chữ ký, họ tên, giờ ký, IP, giá thoả thuận) với phông tiếng Việt, rồi lưu bằng dịch vụ của FE-48.
- Luồng 3, sau khi khách ký, gọi endpoint lưu trữ của backend (webhook secret) với thử lại; vẫn lỗi thì báo quản lý qua Error workflow, hợp đồng vẫn "Đã ký".
- Trang chi tiết hợp đồng (admin) có nút tải bản đã ký và dòng "Mã băm" kèm kết quả kiểm.

## Capabilities

### New Capabilities
- `contract-agreed-price`: giá thoả thuận của hợp đồng, quy tắc tiền cọc theo giá, nhật ký đổi giá và hiển thị.
- `signed-contract-archive`: file PDF bản đã ký lưu lại, mã băm chống sửa, nhật ký lưu trữ, tải về và xử lý lỗi lưu.

### Modified Capabilities
<!-- Không đổi requirement của spec hiện có. -->

## Impact

- Backend: `contracts/` (service, controller, DTO, entity dùng cột FE-43), module lưu trữ mới `contracts/archive/`, phụ thuộc `pdfkit` và một phông TTF có bản quyền mở (OFL) trong `backend/assets/fonts/`.
- Web: form lập hợp đồng ở trang chi tiết lead, trang `/admin/hop-dong/[id]`, `/ky/[token]`, trang in; `web/src/lib/api.ts` (kiểu và hàm gọi API, **sau FE-43**).
- n8n: `luong-3-hop-dong.json` (Hoàng): SQL, soạn điều khoản, AI rà soát, node gọi lưu trữ.
- Hạ tầng: volume `contract_files` cho container backend và biến `CONTRACT_ARCHIVE_DIR` (`docker-compose.yml`, `docker-compose.prod.yml`). **Bước tay trên VPS** (CH-12 đợt 2).
- Phụ thuộc: cột `agreed_price`, `signed_file_*` và loại sự kiện đến từ FE-43; FE-48 làm sau FE-43, FE-49 sau FE-48.
