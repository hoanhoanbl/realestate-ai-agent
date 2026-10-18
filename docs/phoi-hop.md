# Phối hợp và phân công (Hoàng và Hậu)

Kế hoạch làm lại hệ thống trên `main`, dựa theo bản mẫu `dev`. Không có ngày demo cố định: mỗi tuần làm xong và chạy thử được **mốc** nào thì demo tới mốc đó. Hạn nộp: cuối tháng 12/2026.

## 1. Nguyên tắc chia

- Chia theo **hai vế của đề tài**. Ai sở hữu một luồng thì sở hữu luôn backend và trang web của luồng đó, và **người đó trình bày**.
- Mỗi người sở hữu **3 luồng n8n**, trong đó có ít nhất một luồng ≥ 12 bước (thầy chấm n8n theo từng người).
- **Hậu không phụ thuộc Hoàng**: phần nền (đăng nhập, khung admin) do Hậu làm trước. Hoàng chờ phần đó thì chạm vào được, trong lúc chờ làm phần chưa cần đăng nhập.
- Mỗi người chạy cả hệ thống trên máy mình bằng `docker compose`; hai người gặp nhau qua Git và [api-contract-dev.md](api-contract-dev.md).

## 2. Bảng phân công

| | **Hoàng: Visits và Document signing** | **Hậu: Lead follow-up và Sales analytics** |
|---|---|---|
| **Luồng n8n** | Luồng 1 (đặt lịch, thêm thông báo đẩy), luồng 1b, **luồng 3** (hợp đồng), Error workflow | **Luồng 2** (follow-up), **luồng 5** (cảm nhận), **luồng 4** (báo cáo AI Agent) |
| **Backend** | Module hợp đồng (`contracts`); kiểm tra đầu vào đặt lịch (giờ quá khứ, `:id`, tên, SĐT) | **Nền:** đăng nhập JWT, bảng `users`, guard, `N8nService`; API duyệt, đổi giờ, đổi trạng thái, phễu; module `feedback`, `reports`, quản lý nhà; tài khoản DB chỉ đọc |
| **Web** | Khu khách (`/`, `/nha/[id]`), trang ký `/ky/[token]` (vẽ chữ ký), trang admin hợp đồng | Khung admin và đăng nhập, Tổng quan, Khách, Lịch xem, Quản lý nhà, Báo cáo, trang `/cam-nhan/[token]` |
| **Khác** | App Expo (làm cuối), triển khai server | Dữ liệu mẫu, đo độ chính xác chấm điểm bằng 20 khách mẫu |
| **Ước lượng** | khoảng 60 giờ | khoảng 58 giờ |

### Điểm nhấn để mỗi người trình bày

- **Hoàng:** kiến trúc chung (n8n, backend, Docker); vế Visits (human-in-the-loop, link duyệt bấm được từ email và web); vế Document signing (**hai lần Wait**, token ký, hết hạn, vì sao AI chỉ rà soát mà không viết hợp đồng).
- **Hậu:** vế Lead follow-up (chống gửi trùng nhờ `lead_events`, một khách lỗi không chặn cả lượt, chống chèn lệnh trong ô góp ý); vế Sales analytics (**AI Agent có công cụ**, cảnh báo bằng quy tắc cố định, tài khoản chỉ đọc).
- **Cả hai thuộc lòng:** monitoring (Error workflow, `lead_events`, retry) để trả lời chung.

## 3. Thứ tự làm

1. **Hậu:** đăng nhập, khung admin, `N8nService` (nền). **Hoàng** song song: sửa luồng 1, khu khách, luồng 3 (chưa cần đăng nhập).
2. **Hoàng:** trang admin hợp đồng, luồng 1b. **Hậu:** luồng 2, luồng 5.
3. **Hậu:** luồng 4, báo cáo. **Hoàng:** app Expo.
4. **Cả hai:** đo kết quả, báo cáo môn học, chạy thử trọn kịch bản, quay video dự phòng.

Dùng `dev` làm bản tham khảo: đọc file swimlane của phần mình trong [luong/](luong/) rồi dựng lại trên `main`. **Không chép nguyên code**: thầy hay hỏi "node này để làm gì", người chép nguyên sẽ không trả lời được.

## 4. Cách phối hợp trên `main` (để không lộn xộn)

1. **Một việc, một chủ.** Mỗi file hoặc thư mục có một chủ theo bảng trên. Không sửa file của người kia, kể cả "sửa nhanh cho tiện". Cần sửa thì nhắn chủ (kèm file và lý do) hoặc mở Issue.
2. **Hợp đồng đi trước code.** Muốn đổi tên field, thêm API, đổi kiểu dữ liệu: sửa `api-contract` trước (qua Pull Request, người kia duyệt), rồi mới sửa code.
3. **Không push thẳng vào `main`.** Mỗi việc một nhánh `feature/<việc>` hoặc `fix/<việc>`, mở Pull Request, người kia xem nhanh và bấm Approve, người tạo PR bấm Merge.
4. **Mỗi sáng và trước khi bắt đầu việc mới:** `git checkout main`, `git pull`, rồi tạo nhánh mới (hoặc `git merge main` vào nhánh đang làm). Không để nhánh sống quá một ngày.
5. **Commit nhỏ, nói rõ làm gì:** `feat:`, `fix:`, `docs:`, `chore:`. Không commit `.env`, khóa, `node_modules`, file build.
6. **"Xong" nghĩa là đã merge vào `main` và chạy được từ `main`**, không phải "chạy được trên máy tôi".
7. **Đóng băng trước khi nộp:** sau khi hai bên chạy thử trọn luồng trên `main` bằng `docker compose up -d --build`, chỉ sửa lỗi, không thêm tính năng.
8. **Báo ngay khi lệch.** Thấy tài liệu và code không khớp, hoặc việc của mình bị chặn bởi việc của người kia: nhắn luôn, đừng tự vá phần của họ.
9. Hai chỗ dễ đụng nhau là `web/src/lib/api.ts` và `docs/`: ai thêm hàm vào `api.ts` thì thêm **cuối file**, và tài liệu của luồng nào do chủ luồng đó sửa.

## 5. Khóa bí mật dùng chung

- `WEBHOOK_SECRET` phải **giống nhau** trong `.env` của hai máy. Gửi cho nhau qua tin nhắn riêng, không đưa lên GitHub.
- Key Gemini, mật khẩu email (SMTP): chỉ nhập trong **n8n (Credentials)**, không để trong repo.
