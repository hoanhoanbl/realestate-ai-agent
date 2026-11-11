# Thông báo nhân viên (dùng chung)

File: `n8n-workflows/thong-bao-nhan-vien.json` (12 node, không tính ghi chú; id `thongBaoNhanVien`).
Kích hoạt: do workflow khác gọi bằng node **Execute Workflow** (`Khi được gọi`). Không có webhook và không tự chạy. Chỉ workflow cùng chủ sở hữu được gọi (`callerPolicy: workflowsFromSameOwner`).

Khung chung của các tài liệu luồng: [README.md](README.md).

## 1. Làm gì trong thực tế

Nhiều luồng cần "báo người": lead HOT mới, khách muốn gặp nhân viên, khách đã nóng lên trên Mautic, nhắc điểm danh. Thay vì mỗi luồng tự soạn email và tin Telegram, mọi luồng gọi một chỗ chung. Chỗ này:

- Chọn **đúng người** cần báo (sale phụ trách của khách, hoặc quản lý nếu chưa có ai).
- Gửi qua **ba kênh**: email, Telegram cá nhân, thông báo đẩy trên app. Kênh nào người đó không có thì bỏ qua.
- Trả về kết quả từng kênh để luồng gọi biết có báo được không.

Quy tắc nghiệp vụ (ai nhận thông báo, quản lý nhận khi nào): [nghiep-vu/01-tiep-nhan-va-phan-cong.md](../nghiep-vu/01-tiep-nhan-va-phan-cong.md) mục 4.1.

## 2. Ai tham gia

| Bên | Vai trò |
|---|---|
| Luồng gọi | Soạn nội dung (tiêu đề, bảng thông tin, nút) và xác định người nhận |
| Sale phụ trách | Nhận qua email riêng, Telegram cá nhân, push |
| Quản lý | Nhận thay khi lead chưa có sale hoặc sale không có kênh nào dùng được |
| Backend | Cho biết kênh của một nhân viên (`GET /api/users/:id/notify-target`) |
| SMTP, Telegram, Expo | Dịch vụ gửi |

## 3. Từng bước

```
Luồng gọi (Execute Workflow)
      |
[1 Nhận yêu cầu thông báo] Khi được gọi -> Cấu hình -> Có người phụ trách?
      |  có assigneeId, mode ≠ update          không
      v                                         |
 Lấy kênh người phụ trách                       |
      +-------------------+--------------------+
                          v
                      Chuẩn hoá
                          |
[2 Gửi email, Telegram và thông báo đẩy]
   Gửi email? -> Email nhân viên -> Có Telegram? -> Gửi Telegram -> Có push? -> Gửi thông báo đẩy -> Kết quả
```

**1. Nhận yêu cầu thông báo.**
Đầu vào là một mục JSON:

| Trường | Ý nghĩa |
|---|---|
| `title` | Tiêu đề (bắt buộc). Lead HOT tự thêm tiền tố "[ƯU TIÊN] " |
| `fields` | Các dòng thông tin `{ icon, label, value }` hoặc đường kẻ `{ sep: true }` |
| `message`, `note` | Đoạn chữ thêm; `note` hiện trong khung trích dẫn |
| `actions` | Nút bấm `{ label, url }`. Telegram chỉ nhận link `https://`; link khác hiện dạng chữ |
| `level`, `leadId` | Mức HOT, WARM, COLD (chọn biểu tượng) và mã khách (đi kèm push) |
| `assigneeId` | Mã người phụ trách. **Có khoá này** (kể cả `0` hoặc `null` = chưa có ai) là cách gọi mới |
| `emailTo`, `emailHtml` | Cách gọi cũ: địa chỉ email và thân thư tự soạn |
| `mode` | `send` (mặc định) hoặc `update` (sửa tin Telegram cũ) |

`Chuẩn hoá` chọn người nhận:

- **Cách gọi mới (có `assigneeId`):** lấy kênh của người đó qua `Lấy kênh người phụ trách`. Có ít nhất một kênh hợp lệ (email đúng dạng, chat id Telegram số, token Expo) thì chỉ gửi cho người đó qua các kênh họ có. Không có kênh nào dùng được, hoặc `assigneeId` là `0`, hoặc không tìm thấy người đó, thì **gửi email cho quản lý** và đặt `fallbackToManager = true`.
- **Cách gọi cũ (không có `assigneeId`):** gửi email tới `emailTo` (mặc định `staffEmail`) và tin Telegram tới nhóm chung `TELEGRAM_SALE_CHAT_ID`. Không gửi push.

**2. Gửi email, Telegram và thông báo đẩy.**
Ba kênh chạy **độc lập**: kênh nào lỗi cũng không dừng kênh khác. Email dùng nội dung `emailHtml` của luồng gọi, hoặc tự dựng từ `title`, `fields`, `message`, `note`, `actions`. Telegram gửi bằng bot sale (`TELEGRAM_BOT_TOKEN`) dạng HTML, tối đa 4000 ký tự, nút 2 cái mỗi hàng. Push gửi qua dịch vụ Expo (`https://exp.host/--/api/v2/push/send`).

`Kết quả` trả về:

| Trường | Ý nghĩa |
|---|---|
| `recipient` | `assignee`, `manager` hoặc `legacy` |
| `fallbackToManager` | `true` nếu phải chuyển cho quản lý |
| `emailSent`, `emailError` | Kết quả email |
| `telegramSent`, `telegramSkipped`, `telegramError`, `telegramMessageId`, `telegramChatId` | Kết quả Telegram; `Skipped` khi không có chat id hoặc chưa bật bot |
| `pushSent`, `pushSkipped`, `pushError` | Kết quả push |

Với cách gọi cũ, email lỗi vẫn **ném lỗi** cho luồng gọi (giữ hành vi trước FE-35). Với cách gọi mới thì chỉ ghi vào `emailError`.

Chế độ `update` (sửa tin Telegram bằng `telegramMessageId`) vẫn còn trong sub-workflow, nhưng sau FE-35 luồng 1 không còn dùng, và không luồng nào hiện gọi nó.

## 4. Nối với hệ thống

| Luồng gọi | Khi nào | Cách gọi |
|---|---|---|
| [Luồng 1](luong-1-dat-lich.md) | Lead mới đặt lịch, kèm điểm AI và nút Duyệt, Đổi giờ | Mới (`assigneeId`) |
| [Luồng 6](luong-6-telegram-agent.md), `Báo nhân viên` | Khách muốn gặp người, hoặc bot chưa trả lời được | Cũ (nhóm sale chung) |
| [Luồng 6](luong-6-telegram-agent.md), `Báo sale khách mới` | Khách để lại số trong bot | Mới (`assigneeId` của lead) |
| [Luồng 2](luong-2-follow-up.md) | Nhắc và cảnh báo của follow-up | Cũ, `emailTo` là quản lý |
| [Luồng 8](luong-8-mautic-bao-ve.md) | Khách vượt ngưỡng điểm hoặc xem trang nhà | Cũ |

[Luồng 3](luong-3-hop-dong.md) **không** gọi sub-workflow này: nó gửi email trực tiếp.

Backend chỉ cung cấp `GET /api/users/:id/notify-target` (header `X-Webhook-Secret`), trả `{ id, name, email, role, telegramChatId, pushToken }`, không trả mật khẩu. Hợp đồng chi tiết: [api-contract.md](../api-contract.md). Sale tự nhập chat id Telegram ở trang Tài khoản (FE-39) và backend có `POST /api/users/me/push-token` để app Expo (FE-27, chưa đưa sang `main`) lưu push token. Thiết kế thông báo đúng người: [FE-35](../fe-35-thong-bao-phu-trach.md).

## 5. Khi lỗi thì sao

| Tình huống | Điều xảy ra |
|---|---|
| Không lấy được kênh người phụ trách | `Lấy kênh người phụ trách` bắt lỗi và đi tiếp; coi như người đó không có kênh, chuyển quản lý |
| Một kênh gửi lỗi (SMTP, Telegram, Expo) | Thử lại, rồi ghi `…Error` vào kết quả và chạy tiếp các kênh còn lại |
| Thiếu `title`, hoặc thiếu cả `message` lẫn `fields` | `Chuẩn hoá` ném lỗi, luồng gọi nhận lỗi |
| Cách gọi cũ và email hỏng | Ném lỗi cho luồng gọi |

Luồng gọi tự quyết làm gì với kết quả. Ví dụ luồng 1 chỉ coi `staffNotified` là đúng khi ít nhất một kênh gửi được, và luồng 8 đánh dấu lỗi nếu không kênh nào gửi được. Sub-workflow này **không** gắn Error workflow riêng; lỗi nổi lên trong lần chạy của luồng gọi.

## 6. Triển khai lên server

| Mục | Giá trị |
|---|---|
| Workflow id | `thongBaoNhanVien` |
| Credential | SMTP `hfJ9bBGUGsjH8qDP` |
| Biến `.env` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SALE_CHAT_ID` (bot sale). Để trống thì không gửi Telegram, chỉ email |
| Cấu hình trong node `Cấu hình` | `staffEmail`, `managerEmail`, `backendUrl`. Hai email đang ghi sẵn trong node, kiểm tra trước khi dùng thật |
| Trạng thái | Phải **bật (published)** để các luồng gọi được |

Hiện trạng:

- **Server:** [trien-khai.md mục 4](../trien-khai.md) ghi đã bật (5/11), là bản trước FE-35. Bản mô tả ở đây (có `assigneeId`, push, `notify-target`) **chưa lên server**.
- **Thứ tự phát hành:** deploy backend (có `notify-target`), rồi import sub-workflow **trước** luồng 1b và luồng 1. Chi tiết: [trien-khai.md mục 9d](../trien-khai.md#9d-thông-báo-theo-sale-và-duyệt-lịch-qua-link-fe-35). Không SQL, không biến `.env` mới.
- **Đã kiểm:** `node scripts/check-notification-routing.cjs` (người nhận, kênh thiếu, dự phòng quản lý, cách gọi cũ) và thử trong n8n cô lập với SMTP giả.
- **Chưa kiểm trên server:** Telegram cá nhân và push thật (mới thử bằng script và nhánh "bỏ qua").

## 7. Cách chạy thử

1. Bảo đảm sub-workflow đang bật và backend có `notify-target`.
2. Trên trang Tài khoản, nhập chat id Telegram cho một sale; gán một lead cho sale đó.
3. Đặt một lịch xem cho lead (xem [luồng 1](luong-1-dat-lich.md) mục 7). Mong đợi: **chỉ** sale đó nhận email, Telegram và push (nếu có token); nhóm sale chung không nhận.
4. Gán lead cho người không có kênh nào, hoặc để lead chưa có người phụ trách. Mong đợi: quản lý nhận email, kết quả có `fallbackToManager = true`.
5. Trong n8n Executions, mở lần chạy của sub-workflow và xem node `Kết quả` có đủ `emailSent`, `telegramSent` hoặc `telegramSkipped`, `pushSent` hoặc `pushSkipped`.
