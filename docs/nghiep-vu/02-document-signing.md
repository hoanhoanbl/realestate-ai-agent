# 02. Document signing: thương lượng, đặt cọc, ký và lưu trữ

Vế **Document signing** của đề tài (đề bài ghi *signature workflows and compliant archiving*): từ lúc khách muốn cọc đến lúc có hợp đồng đặt cọc đã ký, được quản lý duyệt và lưu trữ chống sửa. Đây là bước có rủi ro pháp lý và tiền, nên AI chỉ soạn và rà, **quản lý luôn là người duyệt**.

Thuộc hành trình: **giai đoạn 8 (thương lượng, làm nhẹ)** và **9 (đặt cọc, ký)**. Giai đoạn 10 (công chứng, sang tên) nằm ngoài hệ thống. Bản đồ hành trình và cách đọc nhãn: [vai-tro-va-trang-thai.md](vai-tro-va-trang-thai.md) mục 1. Trạng thái hợp đồng và căn: cùng file, mục 5.3 và 5.4.

Cập nhật lần cuối: 20/11/2026 (FE-48: giá thoả thuận đang chạy, nền lưu file đã ký).

## Tóm tắt các giai đoạn

| | GĐ8. Thương lượng | GĐ9a. Lập và duyệt hợp đồng | GĐ9b. Ký và lưu trữ | Sau ký |
|---|---|---|---|---|
| Mục tiêu | Ghi lại giá đã thoả thuận | Hợp đồng đúng căn, đúng tiền, đã được duyệt | Khách ký được từ xa; bản ký không sửa được | Chốt tiền cọc, khoá căn |
| Bắt đầu khi | Khách muốn cọc (cảm nhận "muốn đặt cọc" hoặc sale gọi) | Sale bấm "Lập hợp đồng" | Quản lý duyệt | Khách ký xong |
| Kết thúc khi | Có giá thoả thuận | Quản lý duyệt, từ chối, hoặc quá 48 giờ | Khách ký, hoặc quá hạn | Căn "Đã bán" |
| Khách làm | Mặc cả với sale | | Ký trên `/ky/<mã>` | Xem lại, in bản ký `/hop-dong/<mã>` |
| Sale, quản lý làm | Sale thương lượng | Sale chọn căn, nhập tiền cọc. Quản lý duyệt hoặc từ chối | | Quản lý xác nhận "đã nhận tiền cọc", đánh dấu "đã bán" |
| Hệ thống tự động | | Giữ căn, AI soạn từ mẫu và rà nội dung, chờ quản lý, hết hạn tự trả căn | Gửi link ký, nhắc ký sau 48 giờ, hết hạn tự trả căn; tạo PDF, hash, lưu file | |
| Luồng n8n | | L3 | L3 | |
| Tình trạng | Ô giá thoả thuận **[Đang chạy]** | **[Đang chạy]** | Ký **[Đang chạy]**; lưu trữ **[Đang chạy]** (nền lưu file, mã băm, tải về từ FE-48; dựng PDF, luồng 3 tự lưu và nút "Lưu lại bản đã ký" từ FE-49) | **[Đang chạy]**; đường lui sau ký **[Làm sau]** |

```
 Lead VIEWED --sale Lập hợp đồng (chọn căn, tiền cọc)--> HĐ DRAFTING, căn RESERVED, lead DEPOSIT
                                                             |
                                  L3: AI soạn từ mẫu + rà nội dung (kẹt > 60s: Soạn lại / Huỷ)
                                                             v
                                                   HĐ PENDING_APPROVAL
                                       quản lý (tối đa 48 giờ)
                     +-----------------------+---------------------------+
                  duyệt                   từ chối                     quá 48 giờ
                     v                       v                           v
               HĐ SENT, link /ky       HĐ REJECTED                  HĐ EXPIRED
                     |                 lead về VIEWED, căn về AVAILABLE (nếu không còn HĐ khác)
        48 giờ chưa ký: nhắc; thêm 5 ngày: EXPIRED
                     v
               HĐ SIGNED, lead SIGNED
                     |
          PDF + SHA-256 + lưu file + nhật ký (FE-49, trước khi gửi thư sau ký)
                     v
          Quản lý: "Đã nhận tiền cọc" -> căn SOLD
```

## Các mốc thời gian

| Mốc | Giá trị | Ở đâu |
|---|---|---|
| Hợp đồng kẹt ở "Đang soạn" thì được bấm "Soạn lại" | Sau 60 giây từ lúc tạo hoặc lần soạn lại trước | `REDRAFT_AFTER_SECONDS` trong `backend/src/contracts/contracts.service.ts` |
| Quản lý duyệt hợp đồng | 48 giờ | Node "Chờ quản lý duyệt" của luồng 3 |
| Nhắc khách ký | 48 giờ sau khi gửi link | Luồng 3 |
| Hết hạn ký | Thêm 5 ngày sau lời nhắc | Luồng 3 |
| Link ký hết hiệu lực | 7 ngày | `SIGN_VALID_DAYS` trong `contracts.service.ts` |

## 1. Thương lượng **[Đang chạy]**

Thương lượng giá, tiến độ thanh toán, nội thất, ngày bàn giao là việc của sale với khách, hệ thống không mô phỏng từng vòng mặc cả. Hệ thống chỉ ghi **kết quả**:

| Quy tắc | Nội dung |
|---|---|
| Ô "Giá thoả thuận" | Nhập khi lập hợp đồng. Không nhập thì hiểu là giá niêm yết của căn |
| Lưu ở đâu | Cột `contracts.agreed_price`; giá niêm yết của căn giữ nguyên |
| Nhật ký | Mỗi lần lập hợp đồng có giá thoả thuận ghi sự kiện `CONTRACT_PRICE_AGREED` nêu mã hợp đồng, hai mức giá và người lập. Không có API sửa giá: muốn đổi thì huỷ hợp đồng đang soạn rồi lập lại |
| Tiền cọc | Không lớn hơn giá thoả thuận khi có, không thì không lớn hơn giá căn. Sai thì `400` "Tiền đặt cọc không được lớn hơn giá thoả thuận" (hoặc "giá căn nhà") |
| Báo cáo (đề xuất) | Chênh lệch giá niêm yết và giá thoả thuận dùng cho phân tích ([04-sales-analytics.md](04-sales-analytics.md)) |

Báo cáo chênh lệch giá **làm sau**, dựa vào sự kiện `CONTRACT_PRICE_AGREED`.

Văn bản hợp đồng do luồng 3 soạn: điều khoản giá có hai dòng "Giá thoả thuận" và "Giá niêm yết (đối chiếu)", phần trăm cọc tính theo giá thoả thuận; rà soát bằng quy tắc cố định cảnh báo khi giá thoả thuận lệch quá 20% so với giá niêm yết. Trang ký của khách, trang chi tiết hợp đồng của nhân viên hiện giá thoả thuận kèm giá niêm yết; hợp đồng không có giá thoả thuận hiện và soạn như trước. Chi tiết kỹ thuật: change `fe48-fe49-contract-price-archive`.

## 2. Lập hợp đồng **[Đang chạy]**

Sale hoặc quản lý bấm **Lập hợp đồng** trên trang chi tiết lead.

### 2.1. Chọn căn và tiền cọc

- Khách đã đến xem từ hai căn trở lên thì trang lead có **ô chọn căn**, liệt kê mỗi căn khách đã đến một dòng, buổi mới nhất trước. Mặc định là căn của buổi xem đã đến gần nhất.
- Tiền cọc gợi ý là **10% giá căn được chọn**; sale sửa được.
- Gọi API không kèm căn thì lấy căn của buổi xem đã đến gần nhất. Buổi xem sau đó bị huỷ hay không đến không đổi căn.

### 2.2. Điều kiện

| Điều kiện | Sai thì người dùng thấy |
|---|---|
| Lead "Đã xem nhà" | "Chỉ tạo hợp đồng cho khách đã xem nhà (trạng thái VIEWED)" |
| Khách có ít nhất một buổi xem "Khách đã đến" | "Khách chưa có buổi xem nào đã đến, chưa lập hợp đồng được" |
| Sale chọn căn nào thì khách phải đã đến xem đúng căn đó | "Khách chưa đến xem căn này, chưa lập hợp đồng cho căn này được" |
| Khách chưa có hợp đồng nào còn hiệu lực | "Khách này đã có hợp đồng đang xử lý" |
| Khách không có lịch xem đang chờ | "Khách đang có lịch xem chờ xử lý" |
| Tiền cọc không lớn hơn giá căn | "Tiền đặt cọc không được lớn hơn giá căn nhà" |
| Căn đang "Đang bán" | "Căn này đang ẩn hoặc không còn mở bán, không lập hợp đồng được" |
| Căn chưa có hợp đồng còn hiệu lực của khách khác | "Căn này đang có hợp đồng #… (…) của khách …, không lập thêm hợp đồng được" |
| Hai người lập cùng lúc cho một căn | "Căn này vừa có hợp đồng khác được tạo, vui lòng tải lại trang" |

Lập xong trong một transaction: hợp đồng "Đang soạn", căn "Đang giữ cọc", lead "Đang làm hợp đồng cọc"; rồi backend gọi luồng 3.

### 2.3. Hợp đồng kẹt ở bước soạn

Nếu n8n tắt hoặc lỗi lúc lập, hợp đồng nằm ở "Đang soạn" mà không có bản nháp. Trên trang hợp đồng:

| Nút | Khi nào dùng được | Kết quả |
|---|---|---|
| Soạn lại | Hợp đồng "Đang soạn", đã qua 60 giây từ lúc tạo hoặc lần soạn lại trước | Gọi lại luồng 3, ghi `CONTRACT_REDRAFT_REQUESTED`. Sớm hơn 60 giây: 409. Không gọi được n8n: 502 |
| Huỷ hợp đồng | Hợp đồng còn "Đang soạn" | Hợp đồng "Bị từ chối", lead về "Đã xem nhà", căn về "Đang bán". Đã có bản nháp thì không huỷ được: "Chỉ huỷ được hợp đồng đang ở bước soạn. Hợp đồng đã có bản nháp thì để quản lý từ chối" |

## 3. Soạn và duyệt **[Đang chạy]**

1. Luồng 3 soạn hợp đồng từ mẫu với dữ liệu khách, căn, tiền cọc; AI rà nội dung và ghi nhận xét; lưu bản nháp. Hợp đồng chuyển "Chờ duyệt".
2. Quản lý nhận email có bản nháp, nhận xét của AI và nút duyệt; cũng duyệt được trên web admin.
3. Luồng 3 chờ quản lý tối đa **48 giờ**.

| Quản lý | Kết quả |
|---|---|
| Duyệt | Hợp đồng "Đã gửi khách ký", khách nhận email có link ký |
| Từ chối, kèm lý do | Hợp đồng "Bị từ chối", lead về "Đã xem nhà", căn về "Đang bán" nếu không còn hợp đồng khác. Sale nhận email báo |
| Không làm gì trong 48 giờ | Hợp đồng "Hết hạn", lead và căn trả về như trên. Quản lý nhận email báo quá hạn. Duyệt muộn trên web: "Hợp đồng đã quá hạn duyệt, hãy tạo lại hợp đồng mới" |

**Tuỳ chọn [Làm sau]:** OCR căn cước công dân của khách trước khi soạn, để điền họ tên, số giấy tờ, địa chỉ vào hợp đồng (ô "Technology Challenge" của đề bài). Chỉ làm nếu còn thời gian trước 3/12.

## 4. Khách ký **[Đang chạy]**

- Link ký `/ky/<mã>` có hạn 7 ngày.
- Khách xem hợp đồng, nhập họ tên, ký trên màn hình. Hệ thống lưu tên người ký, chữ ký, giờ ký và IP.
- 48 giờ chưa ký: khách nhận email nhắc ký. Thêm 5 ngày vẫn chưa ký: hợp đồng "Hết hạn", lead và căn trả về như mục 3, sale nhận email báo.
- Link đã ký: "Hợp đồng này đã được ký rồi". Link quá hạn: "Liên kết ký đã hết hạn".
- Ký xong: hợp đồng "Đã ký", lead "Đã ký hợp đồng cọc". Khách nhận email xác nhận kèm link `/hop-dong/<mã>` để xem lại, in hoặc lưu PDF từ trình duyệt; sale nhận email báo.

## 5. Lưu trữ bản đã ký **[Đang chạy]**

**Nền đã có từ FE-48 [Đang chạy]:** dịch vụ lưu file của backend ghi PDF ra thư mục lưu trữ (volume Docker `contract_files`, biến `CONTRACT_ARCHIVE_DIR`), tính SHA-256, ghi `signed_file_path`, `signed_file_sha256`, `signed_file_stored_at` và sự kiện `CONTRACT_ARCHIVED`. Nhân viên đăng nhập tải được file (`GET /api/contracts/{id}/signed-file`); trang chi tiết hợp đồng hiện mã băm, giờ lưu và kết quả kiểm ("Khớp" hoặc cảnh báo "Bản lưu đã bị thay đổi hoặc mất"). Lưu lần hai khi file còn nguyên vẹn không đổi gì; file mất hoặc lệch thì lưu tự động bị `409` và chỉ quản lý phục hồi, file lệch được giữ lại làm chứng cứ. **Từ FE-49:** backend dựng PDF (`pdfkit`, phông Noto Sans để đủ dấu tiếng Việt) từ dữ liệu hợp đồng đã ký, và luồng 3 gọi lưu ngay sau khi khách ký. Khách vẫn xem lại hợp đồng ở `/hop-dong/<mã>`; file lưu trữ chỉ nhân viên tải được.

| Bước (luồng 3, sau khi khách ký) | Nội dung |
|---|---|
| Tạo PDF | `POST /api/contracts/{id}/archive` (webhook secret) dựng PDF từ bản hợp đồng đã ký: tiêu đề, nội dung, giá thoả thuận khi có, chữ ký, họ tên, giờ ký (giờ Việt Nam), IP. Ngày tạo trong file lấy theo giờ ký nên cùng dữ liệu cho cùng file |
| Lưu file | Ghi `HD-<mã 4 chữ số>.pdf` vào thư mục lưu trữ; tên do hệ thống đặt, đường dẫn ghi vào `contracts.signed_file_path` |
| Chống sửa | Tính SHA-256 của file, lưu `contracts.signed_file_sha256` và giờ lưu `signed_file_stored_at`. Mở lại file mà hash khác thì là file đã bị sửa |
| Nhật ký | Sự kiện `CONTRACT_ARCHIVED` kèm tên file và mã băm |
| Thứ tự | Lưu **trước** khi gửi hai thư sau ký, để lỗi SMTP không chặn việc lưu |
| Lỗi | Node lưu thử 3 lần (cách 5 giây). Vẫn lỗi thì luồng **vẫn gửi thư** cho khách và sale, rồi dừng ở trạng thái lỗi để Error workflow báo quản lý. Hợp đồng vẫn "Đã ký", không bị trả về. Quản lý lưu lại bằng nút "Lưu lại bản đã ký" |

**Giới hạn của mã băm.** SHA-256 chỉ phát hiện file bị sửa sau khi lưu; nó không chứng minh ai ký và không chống được người có quyền sửa cả file lẫn database. Đây không phải chữ ký số hay dấu thời gian của bên thứ ba, và văn bản hợp đồng đã ghi rõ không có giá trị pháp lý (đồ án môn học).

**Bản lưu hỏng.** Luồng 3 gọi lưu lại khi bản lưu đã có: file còn và khớp thì không ghi gì (an toàn khi n8n thử lại). File mất hoặc lệch thì lưu tự động bị `409` và không đổi gì, vì một file đã bị sửa không bao giờ được âm thầm coi là bản đúng. Chỉ quản lý phục hồi được bằng nút "Lưu lại bản đã ký" (`POST /api/contracts/{id}/archive-retry`): file lệch được giữ lại cạnh file mới với tên `HD-<mã>.pdf.hong-<giờ UTC>` làm chứng cứ, và lịch sử khách ghi tên người phục hồi, lý do (mất hay lệch), mã băm cũ và mới. Nút này cũng dùng để lưu lần đầu cho hợp đồng đã ký trước khi có FE-49 hoặc khi luồng 3 lưu lỗi.

## 6. Sau khi ký **[Đang chạy]**

| Việc | Ai | Điều kiện |
|---|---|---|
| "Đã nhận tiền cọc" | Quản lý | Hợp đồng đã ký, chưa xác nhận lần nào. Sai: "Chỉ xác nhận nhận cọc được khi hợp đồng đã ký" / "Hợp đồng này đã được xác nhận nhận cọc rồi" |
| Đánh dấu căn "Đã bán" | Quản lý | Căn "Đang giữ cọc" và hợp đồng của căn đã ký. Sai: "Chỉ đánh dấu "đã bán" được khi căn đang giữ cọc và hợp đồng đã ký" |

Hệ thống dừng ở đây. Thanh toán, hợp đồng mua bán công chứng, sang tên nằm ngoài phạm vi.

**Hạn chế đã biết [Làm sau]** (LH-23): sau "Đã ký" không có đường lui. Khách bỏ cọc, hoàn cọc, hoặc quản lý quên xác nhận "đã nhận cọc" đều không có trạng thái hay lời nhắc. Căn thành "Đã bán" thì khách dự phòng đang có lịch xem căn đó vẫn giữ lịch. Nếu không làm kịp thì ghi vào phần hạn chế của báo cáo.
