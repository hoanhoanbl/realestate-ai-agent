<!--
Base của PR:
- feature/*, bugfix/*  -> dev
- hotfix/*             -> main (merge xong mở thêm PR main -> dev)
- Release              -> PR dev -> main, đặt tên "Release vX.Y.Z"
Quy trình đầy đủ: docs/quy-trinh-git.md
-->

## Làm gì

<!-- 1–3 dòng: chức năng / lỗi nào, vì sao -->

## Thay đổi chính

-

## Cách test

<!-- Các bước để người review làm lại được trên máy mình: dữ liệu cần có, thao tác, kết quả mong đợi -->

1.

## Bước deploy làm tay sau khi lên main

<!-- Ghi "Không có" nếu không cần. CI chỉ build và chạy lại container, KHÔNG làm các việc dưới đây -->

- [ ] Chạy SQL:
- [ ] Import + publish workflow n8n:
- [ ] Biến `.env` mới (đã thêm vào `.env.example`):
- [ ] Không có

## Tự kiểm tra trước khi mở PR

- [ ] Đã kéo `dev` mới nhất về nhánh và giải xong xung đột
- [ ] Backend / web: `npm run lint` và `npm run build` chạy được (nếu có sửa)
- [ ] n8n: đã import vào n8n local, chạy ít nhất một ca end-to-end, export JSON lại vào repo
- [ ] Chỉ sửa luồng n8n và file của mình (file dùng chung đã báo người kia)
- [ ] Không commit `.env`, mật khẩu, token

## Ảnh chụp (nếu sửa giao diện)
