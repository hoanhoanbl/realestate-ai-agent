# Tài liệu các luồng n8n

Hệ thống có **14 workflow n8n** (gồm L9 local chưa phát hành), file JSON ở `n8n-workflows/`. Mỗi workflow có một tài liệu trong thư mục này, viết theo cùng một khung để người đọc biết tìm thông tin ở đâu.

Quy tắc nghiệp vụ (khi nào áp dụng, ai xử lý, khách thấy gì) nằm ở [docs/nghiep-vu/](../nghiep-vu/). Tài liệu luồng **chỉ link sang đó**, không chép lại. Cách đưa workflow lên server, credential và biến `.env` nằm ở [trien-khai.md](../trien-khai.md); mục "Triển khai lên server" của mỗi luồng chỉ ghi phần riêng của luồng đó.

## Bảng các luồng

Luồng 1, 1b, 2, 3, 4, 5, 6, 6b cùng Thông báo và Error là **phần lõi đề tài** (Visits, Document signing, Lead follow-up, Sales analytics). Luồng 7 và 8 là **mở rộng Marketing Automation (Mautic), đóng băng từ 13/11**, ngoài bốn vế đề tài. Riêng luồng 2: phần nuôi khách WARM và COLD qua Mautic cũng là mở rộng, sẽ bị xoá ở FE-46.

Tài liệu luồng mô tả **đúng file JSON đang có trong repo**, không mô tả kế hoạch. Cột "Sắp thay đổi" chỉ báo trước luồng nào sắp bị sửa và trỏ sang quy tắc đích trong [docs/nghiep-vu/](../nghiep-vu/vai-tro-va-trang-thai.md); nội dung tài liệu của luồng đó được sửa trong cùng PR sửa JSON (quy định 7 ở [quy-trinh-git.md](../quy-trinh-git.md)). Chi tiết: mục "Phạm vi" của [tong-quan-du-an.md](../tong-quan-du-an.md).

| Luồng | Việc chính | Kích hoạt | Id trên server | Tài liệu | Sắp thay đổi |
|---|---|---|---|---|---|
| 1 | Nhận đặt lịch, chấm điểm AI, báo sale duyệt | Webhook `viewing-requested` | `prt5invo7qugQx74` | [luong-1-dat-lich.md](luong-1-dat-lich.md) | Không |
| 1b | Chốt hoặc đổi giờ xem nhà do nhân viên làm tay | Webhook `viewing-admin-action` | `luong1bRealestat` | [luong-1b-chot-lich-thu-cong.md](luong-1b-chot-lich-thu-cong.md) | FE-50 đã ghi sự kiện `VIEWING_CONFIRMATION_SENT` sau thư chốt lịch; FE-54 (luồng 2) đọc sự kiện này ([01 mục 3.1](../nghiep-vu/01-visits.md)) |
| 2 | Follow-up tự động theo giờ | Mỗi giờ (và chạy tay) | `luong2Realestat0` | [luong-2-follow-up.md](luong-2-follow-up.md) | FE-45: selector local đã chuyển chăm khách im lặng sang L9. FE-46: xoá nhánh Mautic, thêm thư mời hẹn lại ([01 mục 4.3](../nghiep-vu/01-visits.md)). FE-54 (chờ chốt): bỏ nhắc lịch thừa ([01 mục 3.1](../nghiep-vu/01-visits.md)) |
| 3 | Hợp đồng và đặt cọc | Webhook `contract-requested` | `luong3Realestat0` | [luong-3-hop-dong.md](luong-3-hop-dong.md) | FE-49: tạo PDF, tính hash, lưu bản ký ([02 mục 5](../nghiep-vu/02-document-signing.md)) |
| 4 | Báo cáo tuần bằng AI | 8 giờ sáng thứ Hai, webhook `report-requested` | `luong4Realestat0` | [luong-4-bao-cao.md](luong-4-bao-cao.md) | FE-23: số liệu theo nguồn. FE-47: thời gian liên hệ được, lý do mất khách theo nhóm ([04 mục 2](../nghiep-vu/04-sales-analytics.md)) |
| 5 | Phân tích cảm nhận sau buổi xem | Webhook `feedback-submitted` | `luong5Realestat0` | [luong-5-cam-nhan.md](luong-5-cam-nhan.md) | Không |
| 6 | Bot Telegram tư vấn khách (AI Agent) | Webhook `telegram-khach` | `luong6Realestat0` | [luong-6-telegram-agent.md](luong-6-telegram-agent.md) | Không |
| 6b | Nạp tri thức vào kho vector cho bot | 2 giờ sáng mỗi ngày (và chạy tay) | `luong6bRagNap001` | [luong-6b-nap-tri-thuc.md](luong-6b-nap-tri-thuc.md) | Không (FE-50 đã bật retry, LH-53) |
| 7 (mở rộng) | Đồng bộ khách sang Mautic | Webhook `lead-changed` | `luong7Realestat0` | [luong-7-dong-bo-mautic.md](luong-7-dong-bo-mautic.md) | Đóng băng từ 13/11, không làm thêm |
| 8 (mở rộng) | Mautic báo hành vi khách về backend | Webhook `mautic-event` | `luong8Realestat0` | [luong-8-mautic-bao-ve.md](luong-8-mautic-bao-ve.md) | Đóng băng từ 13/11, không làm thêm |
| Thông báo | Gửi tin cho nhân viên (email, Telegram, push) | Luồng khác gọi | `thongBaoNhanVien` | [thong-bao-nhan-vien.md](thong-bao-nhan-vien.md) | Luồng 9 sẽ gọi. Nhánh push chỉ có tác dụng khi có app Expo (dời) |
| Theo dõi phản hồi (phụ trợ L5) | Giao thông báo việc mới, nhắc sale, báo quản lý | L2/L5 gọi; chạy tay để test | `feedbackWorkNotifications` (ID trong repo, chưa triển khai server) | [luong-5-theo-doi-sau-phan-hoi.md](luong-5-theo-doi-sau-phan-hoi.md) | Không |
| Error | Báo quản lý khi một luồng khác lỗi | Luồng khác lỗi | `errorWfRealestat` | [error-workflow.md](error-workflow.md) | Không (FE-50 đã thêm báo Telegram, LH-52) |
| 9 (local) | Chăm khách theo bậc, sale duyệt thư, đóng STALE | Mỗi giờ 08:00–20:00; webhook khi sale duyệt | `luong9FollowupLadder` (repo, chưa lên server) | [luong-9-follow-up-bac.md](luong-9-follow-up-bac.md) | FE-45: đã kiểm local, chờ review/tích hợp FE-56 và nghiệm thu dịch vụ thật |

Bảng "Kích hoạt" và id lấy từ [trien-khai.md](../trien-khai.md) mục 4. Nếu hai nơi khác nhau, file JSON trong repo là bản đúng.

L4 mở rộng local 12/11/2026: [hiệu suất sale gọn và hiệu quả từng căn nhà](luong-4-sale-va-can-nha.md), có API `/reports/breakdowns`, cấu trúc dữ liệu và checklist cho bạn n8n. Cần deploy backend trước khi import JSON mới; chưa nghiệm thu server.

## Khung chung

Mỗi tài liệu luồng mở đầu bằng tên file JSON và cách kích hoạt, rồi có các mục sau (luồng nào không có nội dung cho một mục thì ghi "Không có" thay vì bỏ mục, để người đọc không phải đoán):

1. **Làm gì trong thực tế.** Vài dòng cho người chưa biết hệ thống: việc ngoài đời mà luồng thay cho người làm.
2. **Ai tham gia.** Khách, sale, quản lý, hệ thống ngoài (Gemini, Mautic, Telegram, email).
3. **Từng bước.** Theo thứ tự chạy, bám theo các nhóm node trong workflow. Quy tắc nghiệp vụ thì link sang `nghiep-vu/`.
4. **Nối với hệ thống.** Ai gọi luồng này, luồng này gọi endpoint backend nào, gọi workflow con nào. Chi tiết hợp đồng API ở [api-contract.md](../api-contract.md).
5. **Khi lỗi thì sao.** Luồng dừng ở đâu, ai biết, làm sao chạy lại.
6. **Triển khai lên server.** Id workflow, credential và biến `.env` luồng cần, việc làm tay khi import lại, trạng thái đã kiểm tra hay chưa.
7. **Cách chạy thử.** Lệnh hoặc thao tác thử trên local, kèm kết quả mong đợi.

Điều gì chưa chạy thử trên n8n thật hoặc trên server thì ghi rõ "chưa kiểm trên server" ở mục 6, không viết như đã chắc chắn.

Các tài liệu cũ của luồng 2, 4, 5, 7, 8 có thêm mục riêng (ví dụ ca kiểm thử, giới hạn còn lại). Giữ các mục đó, đặt sau 7 mục chung.

## Quy ước trình bày

- Tên node trong tài liệu giống hệt tên hiển thị trong n8n (có dấu), để tìm được trong giao diện.
- Workflow chia thành các nhóm bằng sticky note ("Nhóm 1: ...") theo quy ước ở mục 6 của [tong-quan-du-an.md](../tong-quan-du-an.md). Phần "Từng bước" đi theo các nhóm này.
- Đường dẫn endpoint ghi dạng `/api/...` khi gọi backend, `/webhook/...` khi gọi n8n.
