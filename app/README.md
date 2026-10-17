# App nhân viên (Expo)

Ứng dụng điện thoại cho **nhân viên sale**: xem việc hôm nay, duyệt lịch xem nhà, đổi giờ, đánh dấu đã xem / mất khách, gọi hoặc email khách, và nhận **thông báo đẩy** khi có khách mới. Quản lý duyệt hợp đồng và xem báo cáo trên web admin.

## Màn hình

| Màn hình | Làm gì |
|---|---|
| Đăng nhập | Email và mật khẩu của nhân viên (tài khoản mẫu xem `README-dev.md`). Phiên lưu trong SecureStore |
| Hôm nay | Khách chờ duyệt (có nút **Duyệt lịch xem** ngay trên thẻ) và các lịch xem trong ngày |
| Khách | Danh sách mọi khách, kéo xuống để tải lại |
| Chi tiết khách | Gọi, Email, Duyệt, Đổi giờ, Đã xem nhà, Mất khách, thông tin, dòng thời gian |

App chỉ gọi các API đã có ở `docs/api-contract-dev.md`, cùng quy tắc với web admin. Nút Duyệt đi qua n8n như mọi nơi khác.

## Chạy thử

1. Chạy hệ thống: `docker compose up -d --build` ở thư mục gốc.
2. Điện thoại và máy tính **cùng Wi-Fi**. Lấy địa chỉ IP của máy tính (ví dụ `192.168.1.10`).
3. Trong thư mục `app/`:

```bash
npm install
EXPO_PUBLIC_API_URL=http://192.168.1.10:8081/api npx expo start
```

(Windows PowerShell: `$env:EXPO_PUBLIC_API_URL="http://192.168.1.10:8081/api"; npx expo start`)

4. Cài **Expo Go** trên điện thoại, quét mã QR.

## Thông báo đẩy

- Khi đăng nhập, app xin quyền và gửi token Expo Push cho backend (`POST /api/users/me/push-token`).
- Luồng 1 của n8n, sau khi AI chấm điểm và gửi email nhân viên, đọc token từ bảng `users` rồi gọi Expo Push API (`https://exp.host/--/api/v2/push/send`). Lỗi ở bước này **không** làm hỏng luồng.
- Lấy token cần `projectId` của EAS: chạy `npx eas init` một lần trong `app/`. Chưa có thì app vẫn dùng được, chỉ không có thông báo đẩy (app hiện dòng ghi chú).
- Thông báo đẩy chỉ chạy trên **điện thoại thật**, không chạy trên giả lập hay trình duyệt.

## Đã kiểm tra và chưa kiểm tra

- Đã kiểm tra: `npx tsc --noEmit` không lỗi; `npx expo export --platform android` đóng gói được; n8n gọi được Expo Push API với token thử.
- **Chưa chạy trên điện thoại thật**: cần bạn tự thử bằng Expo Go (đăng nhập, duyệt lịch, nhận thông báo).
