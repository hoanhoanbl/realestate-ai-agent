# Luồng 9: Chăm khách theo bậc

**Trạng thái:** đã triển khai và kiểm thử local; chưa bật trên server. Chi tiết và giới hạn nghiệm thu: [FE-45](../fe-45-cham-khach-theo-bac.md).

## 1. Đầu vào

- Chạy tay hoặc mỗi giờ 08h–20h giờ Việt Nam, lấy tối đa 50 việc tại `GET /api/followups/ladder-due` và tối đa 50 thư cần khôi phục tại `GET /api/followups/ladder-email-due`.
- Webhook `POST /webhook/ladder-email-approved` (Header Auth) do backend gọi sau sale duyệt. Body gồm `taskId`, `ladderTaskId`, `leadId`, `viewingTime`; không nhận email hoặc text do người gọi tự quyết định. Nội dung gửi được đọc lại từ backend.

## 2. Ai tham gia

Sale đọc lời nhắc và duyệt nội dung; quản lý nhận cảnh báo STALE và lỗi. Khách chỉ nhận thư sau SEND và có consent. Backend giữ quyền quyết định điều kiện/checkpoint; n8n điều phối Gemini, SMTP và sub-workflow báo nhân viên.

## 3. Từng bước

57 node tổng cộng, 6 sticky note. Hai vòng lặp riêng cho việc nhắc và thư đã duyệt:

1. Trigger và cấu hình backend.
2. Đọc danh sách đến hạn.
3. Lặp từng việc.
4. Claim phiên làm việc; bỏ qua nếu execution khác đã giữ.
5. ACTION_DONE chỉ complete, không gửi lại.
6. Lấy ngữ cảnh hiện tại.
7. STALE đi thẳng thông báo quản lý.
8. REACH/QUIET qua Gemini với parser có cấu trúc.
9. Guardrail bỏ nháp không an toàn; AI lỗi dùng CALL dự phòng và ghi lỗi.
10. Lưu suggestion và cấp link duyệt.
11. Dựng thông báo sale hoặc quản lý.
12. Start kiểm điều kiện lần cuối.
13. Gọi sub-workflow báo nhân viên, kiểm ít nhất một kênh thành công.
14. Action-done và complete, quay lại vòng lặp.
15. Thư đã duyệt có vòng claim/context/start riêng, escape nội dung, SMTP rồi action-done/complete.
16. Lỗi có checkpoint ghi fail, sau đó Stop and Error để Error workflow báo quản lý.

Không gửi thư khách trên đường nhắc sale. Thư khách chỉ thuộc LADDER_EMAIL được backend tạo sau SEND.

## 4. Nối với hệ thống

Backend API, body và quyền: [api-contract mục 3.10](../api-contract.md#310-link-duyệt-thư-của-luồng-9-fe-45-fe-56-đã-triển-khai-local-chưa-phát-hành). Luồng gọi `thongBaoNhanVien` và dùng `errorWfRealestat`. Thư đọc email/nội dung lại từ backend; webhook không được tự cung cấp nội dung thay sale.

## 5. Khi lỗi

HTTP/AI/email thử 3 lần. Không biết gửi ngoài đã thành công hay chưa thì checkpoint vào REVIEW, cần người vận hành kiểm tra trước resolve. ACTION_DONE khôi phục bằng hoàn tất DB. Lỗi AI không chặn lời nhắc mẫu. Lỗi ghi fail cũng không ngăn Stop and Error.

## 6. Triển khai lên server

Import tắt, workflow ID `luong9FollowupLadder`. Cần backend FE-45, FE-43/44, bảng feedback_work và các credential/sub-workflow sẵn có. Không thêm biến bắt buộc; `PUBLIC_WEB_URL`, `WEBHOOK_SECRET` của backend cần đúng. Có thể dùng `MANAGER_EMAIL` trên n8n; mặc định email quản lý giống bộ luồng hiện tại.

Thứ tự: nền/schema → backend → FE-56 → import L9 tắt → L2 với selector FE-45 (hoặc FE-46 đã tích hợp) → test bằng dữ liệu demo → bật L9. Chưa bật khi L2 cũ còn nhánh chăm khách im lặng. Chi tiết VPS thuộc Hoàng/CH-12; chưa thực hiện trong lượt phát triển local này.

## 7. Cách chạy thử và kết quả local

Đã chạy trên n8n 2.42.4 cô lập với backend/DB thật và SMTP giả: REACH không lặp qua hai lần chạy; AI lỗi vẫn báo sale và có sự kiện; hai confirm đồng thời tạo một thư đã chỉnh sửa và escape HTML; QUIET báo sale; STALE đóng lead và chỉ báo quản lý. Gemini và sub-workflow báo nhân viên được thay bằng fixture; chưa xác nhận Gemini/Telegram thật. SMTP lỗi sau retry đã kiểm: checkpoint vào REVIEW, có sự kiện lỗi và Error workflow nhận lỗi; không có thư trong inbox giả.

Chạy `node scripts/check-ladder-guardrail.cjs` để kiểm Code node mà không cần credential. Với n8n/backend test riêng, tạo lead đến hạn, chạy hai lần và đối chiếu lead_events/inbox giả; không chạy fixture trên DB thật.

## 8. Danh sách node trong JSON

1. Chạy tay
2. 08h đến 20h
3. Cấu hình
4. Việc đến hạn
5. Từng việc
6. Nhận việc
7. Đã nhận?
8. Chỉ hoàn tất?
9. Ngữ cảnh
10. Đóng STALE?
11. AI gợi ý
12. Gemini
13. Khuôn gợi ý
14. Kiểm tra nháp
15. AI lỗi?
16. Ghi lỗi AI
17. Lưu gợi ý
18. Tạo link duyệt
19. Thông báo sale
20. Thông báo quản lý
21. Thông báo chờ gửi
22. Bắt đầu báo
23. Được báo?
24. Khôi phục thông báo
25. Báo nhân viên
26. Kiểm tra đã báo
27. Đã báo
28. Hoàn tất việc
29. Thư cần khôi phục
30. Từng thư
31. Sale đã duyệt
32. Thư đã duyệt
33. Nhận thư
34. Nhận thư được?
35. Thư chỉ hoàn tất?
36. Nội dung đã duyệt
37. Bắt đầu thư
38. Được gửi thư?
39. Dựng thư
40. Gửi thư đã duyệt
41. Thư đã gửi
42. Hoàn tất thư
43. Kết thúc thư
44. Còn thư trong lô?
45. Là lô thư?
46. Kiểm tra checkpoint
47. Kiểm tra checkpoint thư
48. Thông tin lỗi
49. Có checkpoint?
50. Ghi thất bại
51. Dừng báo lỗi
52. 1. Nhận và khoá việc
53. 2. AI gợi ý, người duyệt
54. 3. Báo sale / quản lý
55. 4. Thư sau khi duyệt
56. 5. Xử lý lỗi
57. Chú thích màu
