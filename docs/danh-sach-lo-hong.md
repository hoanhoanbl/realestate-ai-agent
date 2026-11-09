# Danh sách lỗ hổng theo vòng đời khách

Cách làm: rà từng quy trình theo vòng đời khách, xếp mức, sửa từng lỗ, mỗi lỗ có điều kiện "Xong khi" rõ ràng, thử lại cả quy trình. Quy trình này chặt rồi mới sang quy trình sau.

```
Quy trình 1: Tiếp nhận, gán sale
      │
      ▼
Quy trình 2: Duyệt lịch ─▶ Xem nhà ─▶ Đặt cọc, ký
                              │
                              └─▶ Quy trình 3: Chăm sóc sau xem, marketing (chạy song song)

+ xuyên suốt: AI, bảo mật, lỗi và giám sát, dữ liệu trùng
```

Số quy trình khớp tên file trong `docs/nghiep-vu/` (`01-…`, `02-…`, `03-…`).

Mốc xuất phát: server chạy bản `cd8dd5c`, cả 12 luồng đang bật (kiểm tra ngày 9/11/2026).

**Mức:**

- **Nghiêm trọng:** mất khách, sai dữ liệu, hoặc không ai chịu trách nhiệm.
- **Trung bình:** khách hoặc sale gặp phiền, phải làm tay.
- **Nhỏ:** thiếu tiện ích, không làm sai nghiệp vụ.

Cập nhật lần cuối: 10/11/2026.

## Quy trình 1: Tiếp nhận và gán sale

Đã rà kỹ ngày 10/11. Quy trình đích và chia việc (task nào đóng lỗ nào, ai làm): [nghiep-vu/01-tiep-nhan-va-phan-cong.md](nghiep-vu/01-tiep-nhan-va-phan-cong.md) mục 7.

| Mã | Lỗ hổng | Mức | Xong khi | Trạng thái |
|---|---|---|---|---|
| LH-01 | Lead chỉ được tạo khi khách đặt lịch. Khách chat Telegram, hỏi giá, để lại số mà chưa đặt thì không có trong hệ thống | Nghiêm trọng | Khách để lại số điện thoại trong bot thì có lead "Đang tư vấn" và sale được báo | Chưa làm |
| LH-02 | Không có cách đưa khách ngoài hệ thống vào (gọi hotline, biển treo tại căn, đến văn phòng, Zalo cá nhân, người quen giới thiệu). Admin không có nút tạo khách | Nghiêm trọng | Sale tạo được lead trên web admin, chọn được nguồn, lead hiện trong báo cáo theo nguồn | Chưa làm |
| LH-03 | Mỗi lần đặt lịch là một lead. Một khách xem 2 căn thành 2 lead: AI chấm 2 lần, khách nhận 2 email, 2 sale có thể cùng xử lý, báo cáo đếm 2 khách | Nghiêm trọng | Một khách đặt 2 căn thì có 1 lead với 2 buổi xem; báo cáo đếm 1 khách | Chưa làm |
| LH-04 | Lead không có người phụ trách. Ai bấm Duyệt trước thì người đó duyệt, không ai chịu trách nhiệm khách | Nghiêm trọng | Mọi lead có người phụ trách ngay khi tạo, theo quy tắc chia lần lượt; quản lý chuyển được | Chưa làm |
| LH-05 | Khách huỷ một buổi xem (qua link `/lich`) hoặc không đến thì cả lead thành "Không mua", dù khách còn đặt căn khác hoặc vẫn còn nhu cầu | Trung bình | Huỷ hoặc không đến chỉ đổi trạng thái buổi xem; lead hết buổi chờ thì về "Đang tư vấn" | Chưa làm |
| LH-06 | Thông báo gửi một email cứng và một nhóm Telegram chung; thông báo đẩy gửi mọi nhân viên có app | Trung bình | Lead mới chỉ báo cho sale phụ trách; quản lý chỉ nhận khi quá hạn | Chưa làm |
| LH-07 | Hạn duyệt quá dài: 24 giờ mới báo quản lý, 3 ngày mới nhắc sale. Nút Duyệt trong thông báo hết hiệu lực sau 24 giờ | Trung bình | Quá 2 giờ làm việc chưa có thao tác đầu tiên thì quản lý được báo; nút Duyệt dùng được tới giờ hẹn | Chưa làm |
| LH-08 | Form đặt lịch không hiện các giờ đã có khách hẹn. Khách chỉ biết trùng sau khi gửi (lỗi 409) | Trung bình | Form hiện khung 1 tiếng, khung đã kín bị gạch trước khi khách gửi | Chưa làm |
| LH-09 | Giờ hẹn không giới hạn: đặt được lúc 3:00 sáng, 1 phút sau lúc đặt, hay 2 năm sau. `parseViewingTime` chỉ kiểm tra giờ ở tương lai | Trung bình | Khách chỉ đặt được 8:00–19:00, sớm nhất sau 3 giờ làm việc, xa nhất 14 ngày; backend chặn cả khi gọi API thẳng | Chưa làm |
| LH-10 | Nhận ra khách cũ bằng email (kiểm tra trùng lịch, "khách đã đặt N lần khác"). Khách đổi email hoặc không dùng email thì không nhận ra | Trung bình | Kiểm tra trùng bằng số điện thoại đã chuẩn hoá ở mọi kênh | Chưa làm |
| LH-11 | Lịch sử chat Telegram (`chat_logs`) không gắn với lead. Sale muốn xem khách đã hỏi gì phải mở Executions của n8n | Nhỏ | Trang lead hiện lịch sử chat của khách đã để lại số | Chưa làm |

## Quy trình 2, 3 và phần xuyên suốt: chưa rà

Các lỗ dưới đây ghi từ lần đọc lướt trước, **chưa kiểm lại trong code**. Khi rà tới quy trình nào thì kiểm lại, xếp mức và thêm "Xong khi".

| Mã | Thuộc | Lỗ hổng (chưa kiểm lại) |
|---|---|---|
| LH-50 | Xuyên suốt: AI | Cả 6 luồng có AI dùng chung một model, không có model dự phòng. Hết quota thì mọi luồng AI cùng ngừng |
| LH-51 | Xuyên suốt: bảo mật | Link riêng `/lich/<mã>` bị gửi sang Mautic qua script theo dõi (việc (1) của BF-07) |
| LH-52 | Xuyên suốt: giám sát | Error workflow chỉ gửi email, không báo Telegram |
| LH-53 | Xuyên suốt: giám sát | Luồng 6b (nạp tri thức) không bật thử lại khi lỗi |
