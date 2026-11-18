# Tasks

Nhánh `feature/FE-53-trung-lich-theo-sale` tạo từ `origin/dev`. Không phụ thuộc FE-43. Phần backend thuộc cả hai người giữ (xem design Context): PR cần Hậu duyệt. Test tích hợp theo kiểu `fe35.integration.spec.ts` (PostgreSQL tạm `localhost:55433/fe33_test`, biến `FE33_TEST_DATABASE_URL`).

## 1. Hằng, hàm kiểm tra và khoá (`backend/src/viewings/booking-rules.ts`)

- [ ] 1.1 Thêm `SALE_GAP_MINUTES = 90`, `SALE_LOCK_NAMESPACE = 1003`, `lockSale(em, saleId)`. Verify: unit test đọc hằng; `cd backend && npm test` xanh.
- [ ] 1.2 Thêm `findSaleConflict(em, saleId, time, { propertyId, excludeViewingId })` và `assertSaleFree(..., context)` theo design D1 và D5 (thông báo cho duyệt/đổi giờ và cho chuyển sale đúng chữ trong spec; tên căn lấy từ `properties.name`; giờ theo giờ Việt Nam). Verify: test tích hợp cho các scenario "Định nghĩa sale bận": 60 phút bận, đúng 90 phút rảnh, `CANCELLED` và `NO_SHOW` không tính, `ATTENDED` tính, cùng căn không tính, `NEW` của lead `LOST` không tính.

## 2. Chia sale bỏ qua sale bận (`lead-intake.service.ts`, Hậu giữ)

- [ ] 2.1 Thêm `slot` vào `IntakeOptions`; `chooseOwner(em, requestedId?, slot?)` lặp ứng viên theo thứ tự lượt, khoá từng sale rồi kiểm bận, chỉ cập nhật `lastAssignedAt` của người được chọn (design D3). Truyền `slot` ở đường lead mới và đường lead cũ cần chọn lại người (mở lại, chưa có người phụ trách) khi có giờ. Verify: test tích hợp "Chia sale bỏ qua sale đang bận": sale đầu lượt bận thì sale kế nhận và `lastAssignedAt` của sale bị bỏ qua không đổi; mọi sale bận thì chia như cũ; đường nhập tay không truyền `slot` chia như cũ; khách cũ còn sale nhận khách giữ sale cũ.
- [ ] 2.2 `ViewingsService.create` truyền `{ time: viewingDate, propertyId }` vào `intake.receive`. Verify: test tích hợp đặt lịch hai khách cùng giờ ở hai căn nhận hai sale khác nhau; hai khách cùng giờ cùng căn vẫn bị luật theo căn từ chối.

## 3. Đổi giờ, hẹn lại (`viewings.service.ts`, Hoàng giữ)

- [ ] 3.1 Trong `reschedule`, sau `assertNoBookingConflict`, lấy khoá `lockSale` cho sale phụ trách lead (đọc từ `currentLead.assignedUserId`) rồi gọi `assertSaleFree` với `excludeViewingId`. Lead không có người phụ trách thì bỏ qua kiểm tra. Verify: test tích hợp "Đổi giờ ra ngoài khoảng 90 phút thì được" và "Hẹn lại sau khi khách không đến" (409, buổi xem giữ giờ cũ, không ghi `VIEWING_NO_SHOW`).
- [ ] 3.2 Hàm dùng chung "kiểm sale của buổi xem đang chờ duyệt" (design D4) và gọi trong nhánh `approve` của `confirmStaffLink` trước khi gọi n8n; nhánh `reschedule_requested` không kiểm. Verify: test `fe35.integration.spec.ts`-style: Duyệt bằng link khi sale bận trả 409, không gọi webhook n8n, lead vẫn `NEW`; đổi giờ rồi duyệt được.

## 4. Duyệt, theo dõi phản hồi, chuyển sale (Hậu giữ)

- [ ] 4.1 `LeadsService.approve` gọi hàm ở 3.2 trước khi gọi n8n, cả hai cách (resume và webhook thủ công), kể cả khi người duyệt là quản lý. Verify: test đơn vị `leads.service.spec.ts` (mock) và một test tích hợp: quản lý duyệt lead của sale bận trả 409.
- [ ] 4.2 `FeedbackWorkService.record` với `NEXT_VIEWING`: sau khi khoá lead, lấy `lockSale` và gọi `assertSaleFree` cho sale phụ trách lead trước khi tạo buổi xem; 409 thì không đóng việc theo dõi, không tạo buổi xem. Verify: test tích hợp trong `feedback-work.integration.spec.ts`.
- [ ] 4.3 `LeadIntakeService.reassign`: sau khi khoá lead, kiểm sale mới với từng buổi xem mở của lead (design D5); 409 thì giữ người phụ trách, không ghi `LEAD_REASSIGNED`. Verify: test tích hợp ba scenario của "Chuyển sale bị chặn khi sale mới bận" (sale bận, sale rảnh, lead không có buổi xem mở).
- [ ] 4.4 Test đồng thời: hai thao tác `NEXT_VIEWING` cho hai lead của cùng một sale, giờ 09:00 và 09:30 ở hai căn, chạy bằng `Promise.all`. Verify: đúng một thành công, một 409; lặp 20 lần không lần nào cả hai cùng thành công.

## 5. Tài liệu (cùng PR)

- [ ] 5.1 `docs/nghiep-vu/01-visits.md`: bỏ nhãn "Sắp làm FE-53" ở tóm tắt, bảng mốc và mục 1.6, đổi sang "Đang chạy"; cập nhật ngày. Verify: `grep -n "FE-53" docs/nghiep-vu/01-visits.md` không còn nhãn "Sắp làm".
- [ ] 5.2 `docs/danh-sach-lo-hong.md`: đóng LH-24 (ghi PR). Verify: dòng LH-24 ghi "Đã xử lý" và mã FE-53 khớp `danh-sach-task.md`.
- [ ] 5.3 `docs/api-contract.md`: ghi mã 409 và thông báo mới ở các route duyệt, đổi giờ, chuyển sale, ghi kết quả theo dõi phản hồi. Verify: mỗi route được ghi có trong controller.

## 6. Web (kiểm chứng, không thêm màn hình)

- [ ] 6.1 Chạy web và backend local, tạo tình huống sale bận, rồi thử: duyệt ở `/duyet/<mã>`, duyệt và đổi giờ ở Lịch xem, chuyển sale ở trang Khách hàng. Verify: mỗi nơi hiện đúng thông báo 409; chụp màn hình ở 375 px, không cuộn ngang. Nơi nào nuốt `message` thì sửa nhỏ trong cùng PR.

## 7. Tích hợp

- [ ] 7.1 `cd backend && npm test` và `FE33_TEST_DATABASE_URL=... npm test` (có test tích hợp) cùng xanh; `cd web && npm run lint && npm run build` xanh. Verify: dán kết quả vào mô tả PR.
- [ ] 7.2 Chuẩn bị bước tay trên VPS cho `docs/trien-khai.md`: câu SELECT chỉ đọc liệt kê lead `NEW` mà sale đang bận (sẽ bị chặn lúc duyệt) để quản lý xử lý trước. Verify: chạy câu SELECT trên DB local có dữ liệu mẫu và ra đúng cặp bận đã dựng.

## Workflow follow-up

- Mở PR `[FE-53] ...`, Hậu duyệt; không sửa `docs/danh-sach-task.md` trong PR này (CH-13 cập nhật sổ sau).
- Sau khi merge và xác nhận ở CH-12 đợt 2, archive change.
