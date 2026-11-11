# Quy ước giao diện web

Áp dụng cho cả web khách (`web/src/app/(khach)`) và web admin (`web/src/app/admin`). Các quy ước lấy theo checklist của skill ui-ux-pro-max và đã áp dụng cho mọi trang ở FE-26. Skill nằm trong repo ở `.claude/skills/ui-ux-pro-max/` (bản `v2.15.0`, CH-08), Claude Code tự dùng khi làm giao diện; script tra cứu của skill cần Python 3.

## 1. Dùng component có sẵn

Thư mục `web/src/components/ui`:

| Cần | Dùng | Ghi chú |
|---|---|---|
| Nút | `Button`, hoặc `buttonClass(...)` cho `<Link>` | Đã đủ cao 44px trên điện thoại |
| Ô nhập, ô chọn, ô văn bản | class `INPUT` (+ `Field` cho nhãn và gợi ý) | Chữ 16px trên điện thoại để iPhone không tự phóng to khi chạm vào ô |
| Link quay lại đầu trang | `BackLink` | Có icon, vùng bấm 44px |
| Icon | `Icon` | Thêm icon mới vào `PATHS` trong `Icon.tsx` (SVG nét 24×24) |
| Tiêu đề trang admin | `PageHeader` | |
| Thẻ, cảnh báo, trạng thái trống, khung xương | `CARD`, `Alert`, `EmptyState`, `Skeleton` | |

Không tự viết lại class cho nút hoặc ô nhập. Nếu bắt buộc phải tự viết, vẫn giữ các mức tối thiểu ở mục 2.

## 2. Mức tối thiểu

- **Vùng bấm** (nút, link hành động, tab, chip lọc): cao tối thiểu 44px trên điện thoại (`min-h-11`); trên máy tính được nhỏ hơn (`sm:min-h-0`, `sm:min-h-9`, ...).
- **Ô nhập**: chữ 16px trên điện thoại (`text-base sm:text-sm`).
- **Không tràn ngang** ở bề ngang 375px:
  - Cột trong lưới (`grid`) có nội dung dài (dải ảnh cuộn ngang, email, số tiền) phải có `min-w-0`.
  - Chữ dài không có khoảng trắng (email, link) dùng `[overflow-wrap:anywhere]`.
  - Bảng rộng: trên điện thoại đổi sang dạng thẻ (`md:hidden` cho thẻ, `hidden md:block` cho bảng), như trang Quản lý nhà và Phân quyền.
- **Chữ**: không nhỏ hơn 12px (`text-xs`). Chữ phụ tối thiểu `text-slate-500`; không dùng `text-slate-400` cho chữ cần đọc.
- **Icon**: không dùng emoji hay ký tự (🔥 🚀 ★ ✓ ✕ ← → ↗) làm icon, dùng `Icon`. Mũi tên trong câu chữ có nghĩa (ví dụ "Khách mới → chốt lịch") thì giữ.
- **Nút chỉ có icon**: phải có `aria-label`.
- **Màu không phải tín hiệu duy nhất**: trạng thái có cả chữ hoặc icon, không chỉ đổi màu.

## 3. Font, màu, hiệu ứng

- **Font**: Be Vietnam Pro, tự lưu qua gói `@fontsource/be-vietnam-pro` (nạp ở `app/layout.tsx`). Không tải font từ Google Fonts lúc chạy hay lúc build, vì build Docker không có mạng.
- **Màu thương hiệu**: biến `--color-brand-*` trong `app/globals.css`. Đổi màu chủ đạo thì chỉ sửa ở đó, dùng `bg-brand-600`, `text-brand-700`, ...
- **Hiệu ứng**: ngắn (150–500ms), chỉ đổi `opacity` và `transform`. `globals.css` đã tự tắt hiệu ứng khi người dùng bật "giảm chuyển động" trong hệ điều hành. Hiệu ứng viết bằng JavaScript (ví dụ ảnh 360° tự xoay) phải tự kiểm tra `prefers-reduced-motion`.
- **Ảnh**: mọi `<img>` có `alt` (ảnh trang trí để `alt=""`).

## 4. Chỉ dựng giao diện cho chức năng đã có

Không thêm nút, cột, khối giao diện cho chức năng chưa làm xong ở backend hoặc n8n. Ví dụ:
- Cột trạng thái app điện thoại ở trang Phân quyền được ẩn đến khi làm app (FE-27).
- Biểu đồ xu hướng theo ngày ở trang Tổng quan chưa làm vì API chưa trả số liệu theo ngày.

Khi chức năng xong thì thêm giao diện trong cùng task đó.

## 5. Tự kiểm trước khi mở PR

- Mở trang ở bề ngang 375px (chế độ điện thoại của trình duyệt): không có thanh cuộn ngang, nút bấm vừa ngón tay.
- Mở lại ở bề ngang máy tính.
- Chạy `npx tsc --noEmit`, `npx eslint src` và `npm run build` trong `web/`.
