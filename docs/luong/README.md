# Tài liệu các luồng n8n

Hệ thống có **12 workflow n8n**, file JSON ở `n8n-workflows/`. Mỗi workflow có một tài liệu trong thư mục này, viết theo cùng một khung để người đọc biết tìm thông tin ở đâu.

Quy tắc nghiệp vụ (khi nào áp dụng, ai xử lý, khách thấy gì) nằm ở [docs/nghiep-vu/](../nghiep-vu/). Tài liệu luồng **chỉ link sang đó**, không chép lại. Cách đưa workflow lên server, credential và biến `.env` nằm ở [trien-khai.md](../trien-khai.md); mục "Triển khai lên server" của mỗi luồng chỉ ghi phần riêng của luồng đó.

## Bảng các luồng

Luồng 1, 1b, 2, 3, 4, 5, 6, 6b cùng Thông báo và Error là **phần lõi đề tài** (Visits, Document signing, Lead follow-up, Sales analytics). Luồng 7 và 8 là **mở rộng Marketing Automation (Mautic), phát triển sau**, ngoài bốn vế đề tài. Riêng luồng 2: phần nuôi khách WARM và COLD qua Mautic cũng là mở rộng. Chi tiết: mục "Phạm vi" của [tong-quan-du-an.md](../tong-quan-du-an.md).

| Luồng | Việc chính | Kích hoạt | Id trên server | Tài liệu |
|---|---|---|---|---|
| 1 | Nhận đặt lịch, chấm điểm AI, báo sale duyệt | Webhook `viewing-requested` | `prt5invo7qugQx74` | [luong-1-dat-lich.md](luong-1-dat-lich.md) |
| 1b | Chốt hoặc đổi giờ xem nhà do nhân viên làm tay | Webhook `viewing-admin-action` | `luong1bRealestat` | [luong-1b-chot-lich-thu-cong.md](luong-1b-chot-lich-thu-cong.md) |
| 2 | Follow-up tự động theo giờ | Mỗi giờ (và chạy tay) | `luong2Realestat0` | [luong-2-follow-up.md](luong-2-follow-up.md) |
| 3 | Hợp đồng và đặt cọc | Webhook `contract-requested` | `luong3Realestat0` | [luong-3-hop-dong.md](luong-3-hop-dong.md) |
| 4 | Báo cáo tuần bằng AI | 8 giờ sáng thứ Hai, webhook `report-requested` | `luong4Realestat0` | [luong-4-bao-cao.md](luong-4-bao-cao.md) |
| 5 | Phân tích cảm nhận sau buổi xem | Webhook `feedback-submitted` | `luong5Realestat0` | [luong-5-cam-nhan.md](luong-5-cam-nhan.md) |
| 6 | Bot Telegram tư vấn khách (AI Agent) | Webhook `telegram-khach` | `luong6Realestat0` | [luong-6-telegram-agent.md](luong-6-telegram-agent.md) |
| 6b | Nạp tri thức vào kho vector cho bot | 2 giờ sáng mỗi ngày (và chạy tay) | `luong6bRagNap001` | [luong-6b-nap-tri-thuc.md](luong-6b-nap-tri-thuc.md) |
| 7 (mở rộng) | Đồng bộ khách sang Mautic | Webhook `lead-changed` | `luong7Realestat0` | [luong-7-dong-bo-mautic.md](luong-7-dong-bo-mautic.md) |
| 8 (mở rộng) | Mautic báo hành vi khách về backend | Webhook `mautic-event` | `luong8Realestat0` | [luong-8-mautic-bao-ve.md](luong-8-mautic-bao-ve.md) |
| Thông báo | Gửi tin cho nhân viên (email, Telegram, push) | Luồng khác gọi | `thongBaoNhanVien` | [thong-bao-nhan-vien.md](thong-bao-nhan-vien.md) |
| Error | Báo quản lý khi một luồng khác lỗi | Luồng khác lỗi | `errorWfRealestat` | [error-workflow.md](error-workflow.md) |

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
