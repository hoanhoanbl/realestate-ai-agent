# Danh sách lỗ hổng theo vòng đời khách

Cách làm: rà từng quy trình theo vòng đời khách, xếp mức, sửa từng lỗ, mỗi lỗ có điều kiện "Xong khi" rõ ràng, thử lại cả quy trình. Quy trình này chặt rồi mới sang quy trình sau.

```
Quy trình 1: Tiếp nhận, gán sale
      │
      ▼
Quy trình 2: Duyệt lịch ─▶ Xem nhà ─▶ Đặt cọc, ký
                              │
                              └─▶ Quy trình 3: Chăm sóc sau xem, báo cáo (marketing Mautic là mở rộng)

+ xuyên suốt: AI, bảo mật, lỗi và giám sát, dữ liệu trùng
```

Số quy trình khớp tên file trong `docs/nghiep-vu/` (`01-…`, `02-…`, `03-…`).

Mốc xuất phát: server chạy bản `cd8dd5c`, cả 12 luồng đang bật (kiểm tra ngày 9/11/2026).

**Mức:**

- **Nghiêm trọng:** mất khách, sai dữ liệu, hoặc không ai chịu trách nhiệm.
- **Trung bình:** khách hoặc sale gặp phiền, phải làm tay.
- **Nhỏ:** thiếu tiện ích, không làm sai nghiệp vụ.

Cập nhật lần cuối: 18/11/2026 (CH-11: đối chiếu trạng thái với các PR đã merge tới #85). "Đã merge" nghĩa là code đã ở `dev` và `main` (tới bản `v0.4.2`); nghiệm thu trên server làm ở CH-12.

## Quy trình 1: Tiếp nhận và gán sale

Đã rà kỹ ngày 10/11. Quy trình đích: [nghiep-vu/00-tiep-nhan.md](nghiep-vu/00-tiep-nhan.md); task đóng từng lỗ ở cột Trạng thái bên dưới.

| Mã | Lỗ hổng | Mức | Xong khi | Trạng thái |
|---|---|---|---|---|
| LH-01 | Lead chỉ được tạo khi khách đặt lịch. Khách chat Telegram, hỏi giá, để lại số mà chưa đặt thì không có trong hệ thống | Nghiêm trọng | Khách để lại số điện thoại trong bot thì có lead "Đang tư vấn" và sale được báo | Đã merge (FE-36, PR #68) |
| LH-02 | Không có cách đưa khách ngoài hệ thống vào (gọi hotline, biển treo tại căn, đến văn phòng, Zalo cá nhân, người quen giới thiệu). Admin không có nút tạo khách | Nghiêm trọng | Sale tạo được lead trên web admin, chọn được nguồn, lead hiện trong báo cáo theo nguồn | Đã merge (FE-37, PR #67) |
| LH-03 | Mỗi lần đặt lịch là một lead. Một khách xem 2 căn thành 2 lead: AI chấm 2 lần, khách nhận 2 email, 2 sale có thể cùng xử lý, báo cáo đếm 2 khách | Nghiêm trọng | Một khách đặt 2 căn thì có 1 lead với 2 buổi xem; báo cáo đếm 1 khách | Đã merge (FE-33 PR #60, FE-34 PR #61) |
| LH-04 | Lead không có người phụ trách. Ai bấm Duyệt trước thì người đó duyệt, không ai chịu trách nhiệm khách | Nghiêm trọng | Mọi lead có người phụ trách ngay khi tạo, theo quy tắc chia lần lượt; quản lý chuyển được | Đã merge (FE-33 PR #60, FE-39 PR #63) |
| LH-05 | Khách huỷ một buổi xem (qua link `/lich`) hoặc không đến thì cả lead thành "Không mua", dù khách còn đặt căn khác hoặc vẫn còn nhu cầu | Trung bình | Huỷ hoặc không đến chỉ đổi trạng thái buổi xem; lead hết buổi chờ thì về "Đang tư vấn" | Đã merge (FE-34, PR #61) |
| LH-06 | Thông báo gửi một email cứng và một nhóm Telegram chung; thông báo đẩy gửi mọi nhân viên có app | Trung bình | Lead mới chỉ báo cho sale phụ trách; quản lý chỉ nhận khi quá hạn | Đã merge (FE-35, PR #68) |
| LH-07 | Hạn duyệt quá dài: 24 giờ mới báo quản lý, 3 ngày mới nhắc sale. Nút Duyệt trong thông báo hết hiệu lực sau 24 giờ | Trung bình | Quá 2 giờ làm việc chưa có thao tác đầu tiên thì quản lý được báo; nút Duyệt dùng được tới giờ hẹn | Đã merge (FE-35 PR #68, FE-38 PR #64) |
| LH-08 | Form đặt lịch không hiện các giờ đã có khách hẹn. Khách chỉ biết trùng sau khi gửi (lỗi 409) | Trung bình | Form hiện khung 1 tiếng, khung đã kín bị gạch trước khi khách gửi | Đã merge (FE-34, PR #61) |
| LH-09 | Giờ hẹn không giới hạn: đặt được lúc 3:00 sáng, 1 phút sau lúc đặt, hay 2 năm sau. `parseViewingTime` chỉ kiểm tra giờ ở tương lai | Trung bình | Khách chỉ đặt được 8:00–19:00, sớm nhất sau 3 giờ làm việc, xa nhất 14 ngày; backend chặn cả khi gọi API thẳng | Đã merge (FE-34, PR #61) |
| LH-10 | Nhận ra khách cũ bằng email (kiểm tra trùng lịch, "khách đã đặt N lần khác"). Khách đổi email hoặc không dùng email thì không nhận ra | Trung bình | Kiểm tra trùng bằng số điện thoại đã chuẩn hoá ở mọi kênh | Đã merge (FE-33, PR #60) |
| LH-11 | Lịch sử chat Telegram (`chat_logs`) không gắn với lead. Sale muốn xem khách đã hỏi gì phải mở Executions của n8n | Nhỏ | Trang lead hiện lịch sử chat của khách đã để lại số | Đã merge (FE-36, PR #68) |

## Quy trình 2 và 3: rà theo hành trình khách ngày 13/11

Rà từ [ke-hoach-hanh-trinh-va-luong-n8n.md](ke-hoach-hanh-trinh-va-luong-n8n.md), đã đối chiếu code `dev` cho các lỗ ghi "đã kiểm". Kế hoạch làm: change OpenSpec `journey-followup-ladder` (FE-43 đến FE-46) và các task FE-47 đến FE-50 trong [danh-sach-task.md](danh-sach-task.md).

| Mã | Lỗ hổng | Mức | Xong khi | Trạng thái |
|---|---|---|---|---|
| LH-20 | Khách WARM, COLD hoặc không tick đồng ý nhận tin: sau buổi xem không có việc tự động nào. Luồng 2 chỉ nhắc sale với khách HOT có đồng ý; WARM, COLD đi qua Mautic (phần mở rộng). Lead nằm ở `VIEWED` vô thời hạn. Đã kiểm (`followup-policy.ts`, `followup-sql.ts`) | Nghiêm trọng | Mọi lead `VIEWED` im 7 ngày được nhắc sale, bất kể mức điểm hay đồng ý nhận tin | Kế hoạch FE-45 (luồng 9), FE-46 (bỏ nhánh cũ ở luồng 2) |
| LH-21 | `CONSULTING` và `VIEWED` không có hạn xử lý. Hạn 2 giờ chỉ đo thao tác đầu tiên; khách huỷ hoặc không đến về `CONSULTING` thì không ai bị nhắc gọi lại; không có cách tự đóng lead bị bỏ quên | Nghiêm trọng | Lead im 7 ngày được nhắc, im 14 ngày không ai xử lý thì tự đóng với lý do `STALE` và báo quản lý | Kế hoạch FE-45 |
| LH-22 | Hợp đồng lấy căn của buổi xem đã đến gần nhất (`contracts.service.ts`, đã kiểm). Khách xem căn A rồi căn B, muốn cọc căn A thì hợp đồng ra căn B; sale không chọn được căn | Nghiêm trọng | Sale chọn căn khi lập hợp đồng, mặc định là căn của buổi xem gần nhất | Đã merge phần chọn căn (PR #82, 13/11). Phần còn lại của FE-48 (giá thoả thuận, lưu file ký) không thuộc lỗ này |
| LH-23 | Sau `SIGNED` không có đường lui: khách bỏ cọc, hoàn cọc, hoặc quản lý quên xác nhận "đã nhận cọc" đều không có trạng thái hay nhắc việc. Căn thành `SOLD` thì khách dự phòng đang giữ lịch xem căn đó vẫn giữ lịch | Nghiêm trọng | Có đường hoàn cọc hoặc huỷ sau ký; nhắc quản lý xác nhận cọc; dọn lịch khách dự phòng khi căn `SOLD` | Không làm: ghi vào hạn chế đã biết của báo cáo (mục 3.5 của [danh-sach-task.md](danh-sach-task.md)) |
| LH-24 | Chống trùng lịch chỉ tính theo căn (`BOOKING_GAP_MINUTES`, 60 phút, đã kiểm), không tính theo sale. Một sale có thể bị chia hai buổi xem cùng giờ ở hai căn | Trung bình | Không chia hoặc không duyệt hai buổi trùng giờ cho cùng một sale | Đã xử lý trong FE-53 (PR chờ Hậu duyệt, chưa merge), gồm cả chuyển sale và buổi đã điểm danh (chốt review 18/11, mục 3.1 của [danh-sach-task.md](danh-sach-task.md)). Quy tắc: [01-visits.md](nghiep-vu/01-visits.md) mục 1.6 |
| LH-25 | Lý do "Không mua" quá thô (`LOST_REASONS` chỉ có `NO_SHOW`, `NOT_INTERESTED`, `CUSTOMER_CANCELLED`, `EXPIRED`, `OTHER`, đã kiểm). Báo cáo không trả lời được "mất khách vì giá, vì chọn căn khác hay vì mua nơi khác" | Trung bình | Sale chọn được lý do chi tiết khi đóng lead; báo cáo tuần chia theo nhóm lý do | Kế hoạch FE-44 (nhập), FE-47 (báo cáo) |
| LH-26 | Không ghi nhận được "đã liên hệ được": hệ thống chỉ biết sale đã thao tác lần đầu (`first_response_at`), không biết sale đã nói chuyện được với khách chưa. Nhắc việc và báo cáo không phân biệt hai trường hợp | Trung bình | Sale đánh dấu "đã liên hệ được" hoặc ghi lần gọi không được; mốc này dừng chuỗi nhắc | Kế hoạch FE-44 |
| LH-27 | Khách không đến buổi xem không nhận lời mời hẹn lại; lead chỉ chờ sale gọi | Trung bình | Khách không đến nhận một thư mời hẹn lại, không gửi trùng | Kế hoạch FE-46; không gửi khi lead đang cọc hoặc căn không còn mở bán (chốt review 18/11) |
| LH-28 | Hợp đồng đã ký không được lưu thành file có dấu vết chống sửa (không có PDF, đường dẫn hay mã băm trong luồng 3). Đề bài của thầy ghi "compliant archiving" | Trung bình | Sau khi khách ký có file PDF lưu lại, mã băm và đường dẫn ghi vào nhật ký | Kế hoạch FE-48, FE-49 |

## Phần xuyên suốt

Kiểm lại trong code ngày 18/11 (CH-11).

| Mã | Thuộc | Lỗ hổng | Mức | Trạng thái |
|---|---|---|---|---|
| LH-50 | AI | Cả 6 luồng có AI (1, 2, 3, 4, 5, 6) dùng chung một model Gemini, không có model dự phòng. Hết quota thì mọi luồng AI cùng ngừng. Đã kiểm: không workflow nào có model thứ hai | Trung bình | Kế hoạch FE-55, làm nếu còn sức |
| LH-51 | Bảo mật | Link riêng `/lich/<mã>` bị gửi sang Mautic qua script theo dõi | Trung bình | Đã merge (BF-07, PR #56); test `check-mautic-privacy.cjs` đạt. Chưa kiểm trên server |
| LH-52 | Giám sát | Error workflow chỉ gửi email, không báo Telegram. Đã kiểm: `error-workflow.json` không có nhánh Telegram | Nhỏ | Đã xử lý (FE-50): thêm nhánh Telegram song song với email. Chưa kiểm trên server |
| LH-53 | Giám sát | Luồng 6b (nạp tri thức) không bật thử lại khi lỗi. Đã kiểm: không node nào bật `retryOnFail` | Nhỏ | Đã xử lý (FE-50): 5 node bật thử lại 3 lần. Chưa kiểm trên server |
| LH-54 | Quy trình 1 | Luồng 1: node `Lưu kết quả AI` lỗi thì nhánh lỗi chỉ tới `Callback failed`, không báo `FAILED`. Lead giữ `automationStatus = PENDING`, backend từ chối duyệt ("AI chưa chấm điểm xong", `leads.service.ts`), tới giờ hẹn luồng 2 đóng lead `EXPIRED`. Đã kiểm | Nghiêm trọng | Đã sửa ở BF-09: nhánh lỗi đi `Report FAILED`, bỏ node `Callback failed`; test `check-approval-links-workflow.cjs` đạt. Chưa kiểm trên n8n thật |
