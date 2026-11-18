# Design

## Context

- `ContractsService.create` kiểm cọc so với `property.price`, tạo hợp đồng `DRAFTING`, giữ căn, gọi luồng 3 (`contract-requested`). Luồng 3 đọc `contracts` bằng SQL (`Lấy dữ liệu hợp đồng`: `deposit_amount`, `property_price`) và tự soạn điều khoản trong node `Soạn hợp đồng`, nên **giá thoả thuận phải được sửa ở cả backend lẫn luồng 3**.
- Khi khách ký, `ContractsService.sign` lưu chữ ký (data URL PNG), họ tên, giờ, IP, rồi `resume` luồng 3 nhánh `signed`; luồng 3 gửi `Email xác nhận đã ký` và `Email báo đã ký`. Không có file nào được tạo.
- Cột `agreed_price`, `signed_file_path`, `signed_file_sha256`, `signed_file_stored_at` và loại sự kiện `CONTRACT_PRICE_AGREED`, `CONTRACT_ARCHIVED` do **FE-43** thêm (design D10 của `journey-followup-ladder`). Change này chỉ đọc và ghi chúng, nên FE-48 merge sau FE-43.
- Backend chạy trong container Alpine không có volume; DB là nơi lưu duy nhất hiện nay. Phần `contracts`, luồng 3 và các trang hợp đồng thuộc Hoàng.

## Goals / Non-Goals

**Goals:**
- Giá thoả thuận đi xuyên từ form lập hợp đồng tới văn bản, trang ký và nhật ký.
- Có một file PDF lưu trữ và mã băm kiểm được, nằm ngoài database.
- Lưu lỗi không làm hợp đồng đã ký mất hiệu lực, và lỗi luôn tới tai quản lý.

**Non-Goals:**
- Không sửa giá sau khi lập (huỷ rồi lập lại).
- Không đưa chênh lệch giá niêm yết và giá thoả thuận vào báo cáo luồng 4 (mục "đề xuất" của `04-sales-analytics.md`); có thể làm sau từ sự kiện `CONTRACT_PRICE_AGREED`.
- Không chữ ký số hay dấu thời gian của bên thứ ba; mã băm chỉ phát hiện sửa file, không chứng minh ai ký (đồ án, văn bản đã ghi "không có giá trị pháp lý").
- Không đưa file PDF vào email gửi khách (khách vẫn xem lại ở `/hop-dong/<mã>`).
- Không sao lưu thư mục lưu trữ tự động; chỉ ghi vào hướng dẫn sao lưu.

## Decisions

### D1. Giá thoả thuận: một cột, kiểm ở backend, ghi sự kiện lúc lập
`CreateContractDto` thêm `agreedPrice?` (`@IsInt @Min(1)`, tuỳ chọn). Kiểm tra giữ nguyên thứ tự hiện có, thêm: giá hiệu lực `effective = agreedPrice ?? property.price`; cọc `<= effective`, nếu sai ném 400 với câu theo spec. Giá niêm yết vẫn lưu ở `property_price` (giá tại thời điểm lập). Sau khi tạo hợp đồng thành công, nếu có `agreedPrice` thì `addEvent(CONTRACT_PRICE_AGREED)` cạnh `CONTRACT_CREATED`.

Không có API sửa giá: hợp đồng `DRAFTING` có sẵn thao tác huỷ (`cancelDraft`) và lập lại nên "đổi giá" là hai thao tác đã có. Điều này làm đúng một câu trong `02-document-signing.md` ("mỗi lần ghi hoặc đổi giá") thành "mỗi lần lập hợp đồng có giá"; cập nhật tài liệu cho khớp.

### D2. Luồng 3 dùng giá hiệu lực
`Lấy dữ liệu hợp đồng` thêm `c.agreed_price`. Trong `Soạn hợp đồng`: `effective = agreed_price ?? property_price`, phần trăm cọc tính trên `effective`; điều khoản giá có hai dòng khi có giá thoả thuận ("Giá thoả thuận: …", "Giá niêm yết (đối chiếu): …"); cờ cảnh báo thêm một mục khi `abs(agreed - listed) / listed > 0.2`. `priceText` trong thư và `AI rà soát` dùng `effective`. Mọi thay đổi chỉ làm khi có `agreed_price`, nên hợp đồng cũ soạn y như trước.

### D3. Lưu trữ: dịch vụ riêng trong `contracts/archive/`
`ContractArchiveService` có ba việc:
- `store(contractId, pdf: Buffer)`: mở transaction, khoá dòng hợp đồng (`FOR UPDATE`); không phải `SIGNED` thì 409; đã có `signed_file_sha256` thì trả kết quả hiện có (idempotent); ngược lại ghi file ra `CONTRACT_ARCHIVE_DIR` bằng tên `HD-<id 4 chữ số>.pdf` (ghi file tạm rồi `rename`, quyền `0o440`), tính SHA-256 của chính buffer, cập nhật ba cột, ghi sự kiện `CONTRACT_ARCHIVED`. Tên do hệ thống đặt nên không có chuyện đường dẫn do người dùng điều khiển; cột `signed_file_path` lưu tên tương đối.
- `read(contractId)`: đọc file, tính lại SHA-256, trả `{ stream hoặc buffer, verified }`; mất file hoặc lệch hash thì `verified = false`.
- `summary(contract)`: `{ sha256, storedAt, verified }` cho trang chi tiết (không trả đường dẫn).

Lưu file rồi mới cập nhật DB; nếu cập nhật DB lỗi thì file mồ côi bị ghi đè ở lần lưu sau (cùng tên), không để lại trạng thái "DB nói đã lưu mà không có file".

*Phương án khác:* lưu PDF vào cột `bytea` trong Postgres. Bị loại vì đề bài nói "lưu file" và vì sao lưu DB rồi thì file nằm cùng chỗ với dữ liệu có thể bị sửa; thư mục riêng cho phép đặt quyền chỉ đọc và sao lưu riêng.

### D4. PDF do backend dựng bằng `pdfkit`
Hợp đồng đã là văn bản thuần (`content`), nên PDF chỉ cần dàn chữ, ảnh chữ ký và khối thông tin ký; không cần dựng HTML. `pdfkit` thuần Node, không cần trình duyệt headless. Phông tiếng Việt: Noto Sans Regular và Bold (SIL OFL) đặt trong `backend/assets/fonts/` cùng tệp giấy phép; `Dockerfile` giai đoạn 2 chép thêm `assets`. Khung PDF: tiêu đề, số hợp đồng, nội dung theo đoạn có ngắt trang, trang cuối có "Bên B ký" với ảnh chữ ký, họ tên, giờ ký (giờ Việt Nam), IP, mã hợp đồng và dòng "Bản lưu điện tử do hệ thống RealEstate AI tạo". Hàm dựng là hàm thuần `buildContractPdf(contract, lead, property): Promise<Buffer>`, dễ kiểm.

*Phương án khác (đã hỏi, chọn backend tự dựng):* Gotenberg thêm một dịch vụ phải chạy trên VPS; lưu HTML/JSON thay PDF lệch chữ "PDF" của tài liệu nghiệp vụ.

### D5. Endpoint và quyền
| Route | Ai | Việc |
|---|---|---|
| `POST /api/contracts/:id/archive` | n8n (webhook secret) | Dựng PDF rồi `store`; idempotent |
| `POST /api/contracts/:id/archive-retry` | Quản lý (JWT, vai MANAGER) | Cùng việc, cho nút "Lưu lại bản đã ký" |
| `GET /api/contracts/:id/signed-file` | Nhân viên đăng nhập | Tải PDF; 404 nếu chưa lưu; kèm `X-Archive-Verified: true/false` |

`findDetail` thêm khối `archive` (từ `summary`) và **bỏ** `signedFilePath` khỏi kết quả (hiện `...rest` sẽ lộ cột mới). Khách không có route nào để tải file; họ xem lại ở `/hop-dong/<mã>` như cũ.

### D6. Luồng 3 gọi lưu trữ ở cuối nhánh đã ký
Thêm node HTTP `Lưu bản đã ký` **sau** `Email báo đã ký`: `POST /api/contracts/:id/archive`, `retryOnFail` 3 lần cách 5 giây, không bật `continueOnFail`. Hai email đi trước nên khách và sale không phụ thuộc việc lưu; nếu lưu lỗi cả 3 lần thì execution kết thúc ở trạng thái lỗi và Error workflow báo quản lý (email, và Telegram sau FE-50). Hợp đồng vẫn `SIGNED` vì chữ ký đã nằm trong DB trước đó.

### D7. Hạ tầng
Thêm volume `contract_files` gắn vào `/app/storage/contracts` ở `docker-compose.yml` và `docker-compose.prod.yml`, biến `CONTRACT_ARCHIVE_DIR` (mặc định `./storage/contracts` khi chạy local, thêm vào `.gitignore`). Volume phải ghi được bởi người dùng chạy Node trong container; kiểm bằng lần lưu thử trên VPS.

## Risks / Trade-offs

- [Mã băm không chống kẻ có quyền sửa cả file lẫn DB] → Ghi rõ trong tài liệu: phát hiện sửa file thường, không phải chữ ký số. Đủ cho yêu cầu đồ án.
- [Quên sao lưu volume nên mất file] → Thêm vào mục sao lưu của `docs/trien-khai.md`; trang chi tiết cảnh báo khi file mất để lưu lại được từ dữ liệu trong DB.
- [Phông thiếu ký tự tiếng Việt hiếm] → Noto Sans phủ đủ; test dựng PDF với câu chứa mọi dấu và kiểm mắt bằng ảnh chụp trang.
- [`pdfkit` kéo thêm phụ thuộc và ảnh Docker lớn hơn] → Chấp nhận; chỉ thêm `pdfkit` (không thêm trình duyệt headless).
- [Lệch giữa thư mục lưu trữ và DB nếu ghi file xong mà DB lỗi] → Thứ tự và ghi đè ở D3.
- [Luồng 3 đã chạy trước khi FE-49 có mặt thì hợp đồng đã ký cũ không có bản lưu] → Quản lý dùng nút "Lưu lại bản đã ký" cho hợp đồng cũ (cùng route retry).

## Migration Plan

1. FE-43 đã thêm cột bằng `fe-43-journey.sql` (đợt 2 của CH-12).
2. Trước khi chạy backend mới: thêm volume `contract_files` và `CONTRACT_ARCHIVE_DIR` vào compose, kéo image mới có `assets`.
3. Import lại `luong-3-hop-dong.json`, publish.
4. Chạy thử một hợp đồng từ lập đến ký, xác nhận file và mã băm; hợp đồng đã ký trước đó: bấm "Lưu lại bản đã ký".
Rollback: image cũ vẫn chạy được (cột thừa không ảnh hưởng); import lại luồng 3 cũ.
