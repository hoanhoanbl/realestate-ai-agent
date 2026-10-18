# Web (Next.js + Tailwind)

Cổng `3000`. Gọi backend qua `NEXT_PUBLIC_API_URL` (mặc định `http://localhost:8081/api`). Biến này được nhúng lúc **build**.

## Các trang

| Địa chỉ | Dành cho | Nội dung |
|---|---|---|
| `/`, `/nha/[id]` | Khách | Danh sách nhà có lọc; chi tiết và form đặt lịch |
| `/cam-nhan/[token]` | Khách | Gửi cảm nhận (link trong email) |
| `/ky/[token]` | Khách | Đọc và ký hợp đồng (link trong email) |
| `/admin/login` | Nhân viên, quản lý | Đăng nhập |
| `/admin` | Nhân viên, quản lý | Tổng quan |
| `/admin/leads`, `/admin/leads/[id]` | Nhân viên, quản lý | Khách và dòng thời gian, nút thao tác |
| `/admin/lich-xem` | Nhân viên, quản lý | Lịch xem, đổi giờ |
| `/admin/hop-dong`, `/admin/hop-dong/[id]` | Nhân viên, quản lý | Hợp đồng; quản lý duyệt |
| `/admin/bao-cao`, `/admin/nha` | Chỉ quản lý | Báo cáo tuần; quản lý nhà |

## Cấu trúc `src/`

- `app/(khach)/`: khu khách, có thanh điều hướng riêng, không có đường dẫn sang khu admin.
- `app/admin/`: khu quản trị; `components/AdminShell.tsx` kiểm tra đăng nhập.
- `lib/api.ts`: toàn bộ lời gọi backend (kèm token đăng nhập); `lib/auth.ts`: lưu phiên.

## Lệnh

```bash
npm install
npm run dev        # chạy thử
npm run lint && npm run build
```

Next.js ở đây là phiên bản mới, một số API khác với bản cũ: xem `AGENTS.md` và `node_modules/next/dist/docs/` trước khi sửa code.
