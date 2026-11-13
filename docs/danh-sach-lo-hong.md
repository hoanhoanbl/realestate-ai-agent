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

Cập nhật lần cuối: 13/11/2026.

## Quy trình 1: Tiếp nhận và gán sale

Đã rà kỹ ngày 10/11. Quy trình đích và chia việc (task nào đóng lỗ nào, ai làm): [nghiep-vu/01-tiep-nhan-va-phan-cong.md](nghiep-vu/01-tiep-nhan-va-phan-cong.md) mục 7.

| Mã | Lỗ hổng | Mức | Xong khi | Trạng thái |
|---|---|---|---|---|
| LH-01 | Lead chỉ được tạo khi khách đặt lịch. Khách chat Telegram, hỏi giá, để lại số mà chưa đặt thì không có trong hệ thống | Nghiêm trọng | Khách để lại số điện thoại trong bot thì có lead "Đang tư vấn" và sale được báo | Xong ở local (FE-36), chưa lên server |
| LH-02 | Không có cách đưa khách ngoài hệ thống vào (gọi hotline, biển treo tại căn, đến văn phòng, Zalo cá nhân, người quen giới thiệu). Admin không có nút tạo khách | Nghiêm trọng | Sale tạo được lead trên web admin, chọn được nguồn, lead hiện trong báo cáo theo nguồn | Xong ở local (FE-37), chưa lên server |
| LH-03 | Mỗi lần đặt lịch là một lead. Một khách xem 2 căn thành 2 lead: AI chấm 2 lần, khách nhận 2 email, 2 sale có thể cùng xử lý, báo cáo đếm 2 khách | Nghiêm trọng | Một khách đặt 2 căn thì có 1 lead với 2 buổi xem; báo cáo đếm 1 khách | Chưa làm |
| LH-04 | Lead không có người phụ trách. Ai bấm Duyệt trước thì người đó duyệt, không ai chịu trách nhiệm khách | Nghiêm trọng | Mọi lead có người phụ trách ngay khi tạo, theo quy tắc chia lần lượt; quản lý chuyển được | Chưa làm |
| LH-05 | Khách huỷ một buổi xem (qua link `/lich`) hoặc không đến thì cả lead thành "Không mua", dù khách còn đặt căn khác hoặc vẫn còn nhu cầu | Trung bình | Huỷ hoặc không đến chỉ đổi trạng thái buổi xem; lead hết buổi chờ thì về "Đang tư vấn" | Xong ở local (FE-34), chưa lên server |
| LH-06 | Thông báo gửi một email cứng và một nhóm Telegram chung; thông báo đẩy gửi mọi nhân viên có app | Trung bình | Lead mới chỉ báo cho sale phụ trách; quản lý chỉ nhận khi quá hạn | Xong ở local (FE-35), chưa lên server |
| LH-07 | Hạn duyệt quá dài: 24 giờ mới báo quản lý, 3 ngày mới nhắc sale. Nút Duyệt trong thông báo hết hiệu lực sau 24 giờ | Trung bình | Quá 2 giờ làm việc chưa có thao tác đầu tiên thì quản lý được báo; nút Duyệt dùng được tới giờ hẹn | Nút Duyệt tới giờ hẹn xong ở local (FE-35); báo quản lý sau 2 giờ làm việc ở FE-38 (PR #64) |
| LH-08 | Form đặt lịch không hiện các giờ đã có khách hẹn. Khách chỉ biết trùng sau khi gửi (lỗi 409) | Trung bình | Form hiện khung 1 tiếng, khung đã kín bị gạch trước khi khách gửi | Xong ở local (FE-34), chưa lên server |
| LH-09 | Giờ hẹn không giới hạn: đặt được lúc 3:00 sáng, 1 phút sau lúc đặt, hay 2 năm sau. `parseViewingTime` chỉ kiểm tra giờ ở tương lai | Trung bình | Khách chỉ đặt được 8:00–19:00, sớm nhất sau 3 giờ làm việc, xa nhất 14 ngày; backend chặn cả khi gọi API thẳng | Xong ở local (FE-34), chưa lên server |
| LH-10 | Nhận ra khách cũ bằng email (kiểm tra trùng lịch, "khách đã đặt N lần khác"). Khách đổi email hoặc không dùng email thì không nhận ra | Trung bình | Kiểm tra trùng bằng số điện thoại đã chuẩn hoá ở mọi kênh | Chưa làm |
| LH-11 | Lịch sử chat Telegram (`chat_logs`) không gắn với lead. Sale muốn xem khách đã hỏi gì phải mở Executions của n8n | Nhỏ | Trang lead hiện lịch sử chat của khách đã để lại số | Xong ở local (FE-36), chưa lên server |

## Quy trình 2 và 3: rà theo hành trình khách ngày 13/11

Rà từ [ke-hoach-hanh-trinh-va-luong-n8n.md](ke-hoach-hanh-trinh-va-luong-n8n.md), đã đối chiếu code `dev` cho các lỗ ghi "đã kiểm". Kế hoạch làm: change OpenSpec `journey-followup-ladder` (FE-43 đến FE-46) và các task FE-47 đến FE-50 trong [danh-sach-task.md](danh-sach-task.md).

| Mã | Lỗ hổng | Mức | Xong khi | Trạng thái |
|---|---|---|---|---|
| LH-20 | Khách WARM, COLD hoặc không tick đồng ý nhận tin: sau buổi xem không có việc tự động nào. Luồng 2 chỉ nhắc sale với khách HOT có đồng ý; WARM, COLD đi qua Mautic (phần mở rộng). Lead nằm ở `VIEWED` vô thời hạn. Đã kiểm (`followup-policy.ts`, `followup-sql.ts`) | Nghiêm trọng | Mọi lead `VIEWED` im 7 ngày được nhắc sale, bất kể mức điểm hay đồng ý nhận tin | Kế hoạch FE-45, FE-46 |
| LH-21 | `CONSULTING` và `VIEWED` không có hạn xử lý. Hạn 2 giờ chỉ đo thao tác đầu tiên; khách huỷ hoặc không đến về `CONSULTING` thì không ai bị nhắc gọi lại; không có cách tự đóng lead bị bỏ quên | Nghiêm trọng | Lead im 7 ngày được nhắc, im 14 ngày không ai xử lý thì tự đóng với lý do `STALE` và báo quản lý | Kế hoạch FE-45 |
| LH-22 | Hợp đồng lấy căn của buổi xem đã đến gần nhất (`contracts.service.ts`, đã kiểm). Khách xem căn A rồi căn B, muốn cọc căn A thì hợp đồng ra căn B; sale không chọn được căn | Nghiêm trọng | Sale chọn căn khi lập hợp đồng, mặc định là căn của buổi xem gần nhất | Kế hoạch FE-48. **Phần chọn căn đã làm ngày 13/11** (`propertyId` khi lập hợp đồng, ô chọn căn ở trang khách); còn lại ô giá thoả thuận và lưu file ký của FE-48 |
| LH-23 | Sau `SIGNED` không có đường lui: khách bỏ cọc, hoàn cọc, hoặc quản lý quên xác nhận "đã nhận cọc" đều không có trạng thái hay nhắc việc. Căn thành `SOLD` thì khách dự phòng đang giữ lịch xem căn đó vẫn giữ lịch | Nghiêm trọng | Có đường hoàn cọc hoặc huỷ sau ký; nhắc quản lý xác nhận cọc; dọn lịch khách dự phòng khi căn `SOLD` | Làm sau nếu có time; nếu bỏ thì ghi vào hạn chế đã biết của báo cáo |
| LH-24 | Chống trùng lịch chỉ tính theo căn (`BOOKING_GAP_MINUTES`, 60 phút, đã kiểm), không tính theo sale. Một sale có thể bị chia hai buổi xem cùng giờ ở hai căn | Trung bình | Không chia hoặc không duyệt hai buổi trùng giờ cho cùng một sale | Làm sau nếu có time; nếu bỏ thì ghi vào hạn chế đã biết |
| LH-25 | Lý do "Không mua" quá thô (`LOST_REASONS` chỉ có `NO_SHOW`, `NOT_INTERESTED`, `CUSTOMER_CANCELLED`, `EXPIRED`, `OTHER`, đã kiểm). Báo cáo không trả lời được "mất khách vì giá, vì chọn căn khác hay vì mua nơi khác" | Trung bình | Sale chọn được lý do chi tiết khi đóng lead; báo cáo tuần chia theo nhóm lý do | Kế hoạch FE-44 (nhập), FE-47 (báo cáo) |
| LH-26 | Không ghi nhận được "đã liên hệ được": hệ thống chỉ biết sale đã thao tác lần đầu (`first_response_at`), không biết sale đã nói chuyện được với khách chưa. Nhắc việc và báo cáo không phân biệt hai trường hợp | Trung bình | Sale đánh dấu "đã liên hệ được" hoặc ghi lần gọi không được; mốc này dừng chuỗi nhắc | Kế hoạch FE-44 |
| LH-27 | Khách không đến buổi xem không nhận lời mời hẹn lại; lead chỉ chờ sale gọi | Trung bình | Khách không đến nhận một thư mời hẹn lại, không gửi trùng | Kế hoạch FE-46 |
| LH-28 | Hợp đồng đã ký không được lưu thành file có dấu vết chống sửa (không có PDF, đường dẫn hay mã băm trong luồng 3). Đề bài của thầy ghi "compliant archiving" | Trung bình | Sau khi khách ký có file PDF lưu lại, mã băm và đường dẫn ghi vào nhật ký | Kế hoạch FE-48, FE-49 |

## Phần xuyên suốt: chưa rà

Các lỗ dưới đây ghi từ lần đọc lướt trước, **chưa kiểm lại trong code**. Khi rà tới quy trình nào thì kiểm lại, xếp mức và thêm "Xong khi".

| Mã | Thuộc | Lỗ hổng (chưa kiểm lại) |
|---|---|---|
| LH-50 | Xuyên suốt: AI | Cả 6 luồng có AI dùng chung một model, không có model dự phòng. Hết quota thì mọi luồng AI cùng ngừng |
| LH-51 | Xuyên suốt: bảo mật | Link riêng `/lich/<mã>` bị gửi sang Mautic qua script theo dõi (việc (1) của BF-07) |
| LH-52 | Xuyên suốt: giám sát | Error workflow chỉ gửi email, không báo Telegram |
| LH-53 | Xuyên suốt: giám sát | Luồng 6b (nạp tri thức) không bật thử lại khi lỗi |
