# Tasks

Hai PR từ một change. **FE-48** (nhóm 1 đến 5) tạo từ `feature/FE-43-nen-hanh-trinh` (nhánh chồng, PR nháp). **FE-49** (nhóm 6 đến 8) tạo từ nhánh FE-48. Cả hai cần cột và loại sự kiện của FE-43. Cập nhật `web/src/lib/api.ts` ở nhóm 3 là chỗ duy nhất FE-48 sửa file dùng chung ngoài PR nền; ghi rõ trong mô tả PR.

## 1. FE-48: giá thoả thuận ở backend

- [x] 1.1 `CreateContractDto` thêm `agreedPrice?` (số nguyên từ 1); `ContractsService.create` kiểm cọc so với giá hiệu lực, lưu `agreed_price`, ghi sự kiện `CONTRACT_PRICE_AGREED` sau khi tạo thành công (design D1). Verify: `contracts.service.spec.ts` có test cho từng scenario của spec `contract-agreed-price` (có giá, bỏ trống, giá 0 hoặc âm, cọc lớn hơn giá thoả thuận, cọc lớn hơn giá niêm yết khi không có giá thoả thuận, sự kiện chỉ ghi khi có giá); `cd backend && npm test` xanh.
- [x] 1.2 `findDetail` và `getPublic` trả `agreedPrice`; `findAll` không đổi. Verify: test đơn vị cho `getPublic` có và không có giá thoả thuận.

## 2. FE-48: luồng 3 dùng giá thoả thuận

- [x] 2.1 Sửa `luong-3-hop-dong.json` theo design D2: SQL `Lấy dữ liệu hợp đồng`, node `Soạn hợp đồng` (giá hiệu lực, điều khoản hai dòng giá, cờ lệch 20%), `priceText` trong thư. Verify: JSON hợp lệ; import vào n8n local; chạy hai hợp đồng thử (có và không giá thoả thuận): văn bản đúng, hợp đồng không có giá thoả thuận soạn y như bản cũ (so sánh `content`).
- [x] 2.2 Thêm `scripts/check-contract-draft.cjs` đọc node `Soạn hợp đồng` từ JSON, chạy với dữ liệu mẫu và kiểm: có giá thoả thuận thì có hai dòng giá và phần trăm theo giá thoả thuận; không có thì giống bản cũ; lệch 25% thì có cảnh báo. Verify: `node scripts/check-contract-draft.cjs` in PASS.

## 3. FE-48: web

- [x] 3.1 `web/src/lib/api.ts`: `createContract(leadId, depositAmount, propertyId?, agreedPrice?)` và kiểu chi tiết hợp đồng có `agreedPrice`. Form "Lập hợp đồng" trong `LeadActions.tsx` thêm ô "Giá thoả thuận (tuỳ chọn)" hiện kèm giá niêm yết của căn đã chọn, kiểm cọc không vượt giá hiệu lực trước khi gửi. Verify: `npm run lint && npm run build`; thử trên trình duyệt 375 px (không cuộn ngang, ô nhập cao tối thiểu 44 px, chữ 16 px).
- [x] 3.2 Hiển thị giá thoả thuận (kèm giá niêm yết) ở `/admin/hop-dong/[id]`, `/ky/[token]`, trang in và danh sách hợp đồng; không có thì như cũ. Verify: duyệt tay bốn trang với hợp đồng có và không có giá thoả thuận.

## 4. FE-48: nền lưu trữ

- [x] 4.1 Tạo `backend/src/contracts/archive/contract-archive.service.ts` (`store`, `read`, `summary`) và khai báo trong `contracts.module.ts`; biến `CONTRACT_ARCHIVE_DIR` (design D3). Verify: test tích hợp PostgreSQL + thư mục tạm: lưu một buffer thì có file, mã băm khớp `sha256sum`, sự kiện `CONTRACT_ARCHIVED`; lưu lần hai không đổi gì; hợp đồng chưa ký bị 409; sửa một byte thì `verified = false`; xoá file thì `verified = false`; mode `auto` trên file đã sửa hoặc đã mất trả 409 và không đổi file, mã băm hay sự kiện; mode `restore` trên file đã sửa giữ file lệch dưới tên `.hong-<giờ UTC>`, ghi file mới và một sự kiện nêu người phục hồi, lý do, hai mã băm; mode `restore` trên file đã mất ghi file mới và sự kiện lý do "mất".
- [x] 4.2 `GET /api/contracts/:id/signed-file` (JWT), và `findDetail` thêm khối `archive`, bỏ `signedFilePath` (design D5). Verify: test HTTP: chưa đăng nhập 401; chưa lưu 404; đã lưu trả đúng byte và tiêu đề `Content-Type: application/pdf`; kết quả `findDetail` không chứa tên cột đường dẫn.
- [x] 4.3 Compose: thêm volume `contract_files` và `CONTRACT_ARCHIVE_DIR` vào `docker-compose.yml`, `docker-compose.prod.yml`; thêm `backend/storage/` vào `.gitignore`. Verify: `docker compose config` hợp lệ cho cả hai cấu hình; khởi động local, tạo được thư mục và ghi được file.
- [x] 4.4 Web: khối "Bản lưu trữ" trên `/admin/hop-dong/[id]` (mã băm, giờ lưu, trạng thái Khớp / cảnh báo, nút tải bằng `fetch` kèm token rồi lưu blob). Hiện "Chưa lưu" khi chưa có. Verify: `npm run lint && npm run build`; thử với bản lưu giả ở local, thấy cả ba trạng thái.

## 5. FE-48: tài liệu và đóng PR

- [x] 5.1 `docs/nghiep-vu/02-document-signing.md` mục 1: đổi "Sắp làm FE-48" thành "Đang chạy", bỏ chữ "đề xuất" của hai dòng cọc và báo cáo (báo cáo giữ "làm sau"), sửa "mỗi lần ghi hoặc đổi" thành "mỗi lần lập hợp đồng có giá" (design D1). `docs/api-contract.md`: route mới, trường `agreedPrice`, `archive`. `docs/luong/luong-3-hop-dong.md`: điều khoản giá. Verify: mỗi route ghi trong `api-contract.md` có trong controller; `grep -n "FE-48" docs/nghiep-vu/02-document-signing.md` không còn "Sắp làm".
- [x] 5.2 `docs/trien-khai.md`: bước tay thêm volume và biến, và dòng sao lưu `contract_files`. Verify: các lệnh chạy được như viết trên môi trường local.
- [ ] 5.3 Mở PR nháp `[FE-48]` base là nhánh FE-43; ghi rõ điểm sửa `api.ts` ngoài PR nền. Verify: CI xanh.

## 6. FE-49: dựng PDF

- [ ] 6.1 Thêm `pdfkit` (và `@types/pdfkit`) vào `backend/package.json`, phông Noto Sans Regular và Bold cùng giấy phép vào `backend/assets/fonts/`, và `COPY --from=builder /app/assets ./assets` vào `Dockerfile`. Verify: `npm ci` thành công; ảnh Docker build được và `ls /app/assets/fonts` trong container thấy phông.
- [ ] 6.2 Viết `buildContractPdf` (design D4) trong `backend/src/contracts/archive/contract-pdf.ts`. Verify: test đơn vị: kết quả bắt đầu bằng `%PDF-`, nhiều trang với hợp đồng dài, không ném lỗi khi thiếu IP hay tên căn, chữ ký không phải PNG hợp lệ thì dùng khung trống; chạy với chuỗi chứa mọi dấu tiếng Việt rồi mở file kiểm bằng mắt (`pdftoppm -png`) và ghi kết quả vào mô tả PR.

## 7. FE-49: endpoint, luồng 3 và nút lưu lại

- [ ] 7.1 `POST /api/contracts/:id/archive` (webhook secret) và `POST /api/contracts/:id/archive-retry` (JWT, vai MANAGER) cùng gọi `buildContractPdf` rồi `store` (design D5). Verify: test HTTP: webhook gọi hai lần ra một file và một sự kiện; webhook gọi sau khi sửa hay xoá file trả 409 (không ghi đè); quản lý gọi `archive-retry` sau khi sửa hay xoá file phục hồi được; sale gọi `archive-retry` bị 403; hợp đồng chưa ký bị 409.
- [ ] 7.2 `luong-3-hop-dong.json`: thêm ba node `Lưu bản đã ký` (đặt **trước** `Email xác nhận đã ký`, nhận cả hai đường "đã ký lần 1" và "lần 2", `onError: continueRegularOutput`), `Báo lỗi lưu trữ?` và `Dừng vì lưu lỗi` ở cuối nhánh (design D6); tô màu nhóm theo quy ước và cập nhật sticky note. Verify: import vào n8n local; chạy trọn một hợp đồng từ lập đến ký: có file, mã băm khớp `sha256sum`, trang chi tiết hiện "Khớp"; (a) chặn thư mục lưu (đổi quyền): khách và sale vẫn nhận thư, execution kết thúc lỗi, Error workflow gửi email, hợp đồng vẫn "Đã ký"; trả quyền rồi bấm "Lưu lại bản đã ký" thành công; (b) tắt SMTP rồi ký: file và mã băm vẫn có, execution lỗi ở bước thư và Error workflow báo; thêm `scripts/check-contract-archive-order.cjs` kiểm trong JSON rằng `Lưu bản đã ký` đứng trước cả hai email ở cả hai đường.
- [ ] 7.3 Web: nút "Lưu lại bản đã ký" (chỉ quản lý, chỉ khi `SIGNED` và chưa lưu hoặc không khớp; hộp xác nhận nói rõ file cũ sẽ được giữ lại làm chứng cứ khi phục hồi) trên `/admin/hop-dong/[id]`. Verify: `npm run lint && npm run build`; thử bằng tài khoản quản lý và sale.

## 8. FE-49: tài liệu và tích hợp

- [ ] 8.1 `docs/nghiep-vu/02-document-signing.md` mục 5: "Sắp làm FE-49" thành "Đang chạy", ghi rõ giới hạn của mã băm (design Non-Goals); `docs/luong/luong-3-hop-dong.md` thêm bước lưu và số node mới; `docs/danh-sach-lo-hong.md` đóng LH-28; `docs/api-contract.md` ba route. Verify: số node trong tài liệu luồng 3 bằng số node trong JSON; LH-28 ghi FE-49.
- [ ] 8.2 Chạy một hành trình hoàn chỉnh trên local: lập hợp đồng có giá thoả thuận, quản lý duyệt, khách ký, kiểm file và mã băm, sửa file kiểm cảnh báo. Verify: ghi kết quả (ảnh chụp trang chi tiết ba trạng thái) vào mô tả PR.
- [ ] 8.3 Mở PR nháp `[FE-49]` base là nhánh FE-48. Verify: CI xanh.

## Workflow follow-up

- Sau khi FE-43 rồi FE-48 merge, đổi base các PR chồng sang `dev` và rebase.
- Không sửa `docs/danh-sach-task.md` trong hai PR này (CH-13 cập nhật sổ).
- Bước tay trên VPS (volume, biến, import luồng 3, lưu lại hợp đồng cũ) thuộc CH-12 đợt 2.
