# Quy trình 1: Tiếp nhận khách và phân công sale

Quy tắc cho chặng đầu tiên của vòng đời khách: khách vào hệ thống từ đâu, ai phụ trách, sale phải phản hồi trong bao lâu, khách được hẹn xem vào giờ nào. Quy trình sau: [02-dat-lich-den-dat-coc.md](02-dat-lich-den-dat-coc.md) (duyệt lịch, xem nhà, đặt cọc). Vai trò và trạng thái chung: [vai-tro-va-trang-thai.md](vai-tro-va-trang-thai.md). Các lỗ hổng dẫn tới tài liệu này: [../danh-sach-lo-hong.md](../danh-sach-lo-hong.md), quy trình 1.

**Trạng thái:** đã chốt ngày 10/11/2026. Đã làm ở local, chưa triển khai server: FE-33 (dữ liệu, API nhận khách và tra trùng, chia và chuyển sale, ghi chú, hạn phản hồi; hợp đồng API và bước nâng cấp: [FE-33](../fe-33-nen-tiep-nhan.md)) và FE-34 (khung giờ đặt lịch ở mục 6, khách cũ đặt thêm lịch trên cùng lead ở mục 3) và FE-37 (form "Thêm khách" ở mục 1.1). FE-35 (thông báo gửi đúng sale phụ trách, nút Duyệt/Đổi giờ dùng tới giờ hẹn). FE-36 (bot Telegram lưu liên hệ khách, báo sale, gắn lịch sử chat vào lead ở mục 3.4). Còn lại: giao diện người phụ trách (FE-39), cảnh báo quá hạn và báo cáo (FE-38). Phần ghi "đang chạy" đã làm; phần còn lại là thiết kế đã chốt.

## Tóm tắt thay đổi

| | Hiện tại | Mới |
|---|---|---|
| Lead sinh ra khi | Khách đặt lịch | Khách liên hệ lần đầu, qua bất kỳ kênh nào |
| Một khách xem 2 căn | 2 lead | 1 lead, 2 buổi xem |
| Nhận ra khách cũ bằng | Email | Số điện thoại |
| Người phụ trách | Không có | Gán ngay khi tạo lead |
| Ai nhận thông báo | Một email chung, một nhóm Telegram chung | Sale phụ trách |
| Hạn phản hồi | 24 giờ báo quản lý, 3 ngày nhắc sale | 2 giờ làm việc, quá hạn báo quản lý (FE-38) |
| Chọn giờ xem | Ô tự gõ, biết trùng lịch sau khi gửi | Chọn khung 1 tiếng, thấy ngay khung đã kín |
| Giờ được hẹn | Bất kỳ, miễn ở tương lai | 8:00–19:00, sớm nhất sau 3 giờ, xa nhất 14 ngày |

## 1. Kênh tiếp nhận

| Kênh | Tạo lead khi | Nguồn ghi vào lead |
|---|---|---|
| Web: form đặt lịch ở trang chi tiết nhà | Khách gửi form (giữ như hiện tại) | Lấy từ `?utm_source=`, không có thì "Trực tiếp" |
| Telegram bot (luồng 6) | Khách để lại số điện thoại trong chat, kể cả khi chưa đặt lịch (FE-36, local); bot hỏi tên và số, nhắc lại, chờ khách xác nhận rồi mới lưu | Telegram |
| Nhân viên nhập tay trên web admin | **Mới:** sale hoặc quản lý bấm "Thêm khách" | Một trong các nguồn ở mục 1.1 |

Không làm:

- Form "nhờ tư vấn" chung trên web khách: đã cân nhắc và bỏ. Khách chưa chọn được căn thì hỏi bot Telegram.
- Form đăng ký nhận tin của Mautic (FE-21): chỉ tạo contact Mautic để gửi bản tin, **không** tạo lead.
- Zalo OA, Facebook, các sàn rao vặt: để sau. Khi làm, các kênh này dùng chung cửa vào như ba kênh trên.

### 1.1. Nhân viên nhập tay

**Đang chạy ở local từ FE-37:** trang `Thêm khách` (nút ở đầu danh sách khách, đường dẫn `/admin/leads/them`) cho mọi nhân viên đã đăng nhập. Chưa có ô "Đặt lịch xem luôn" (để task sau); sale đặt lịch hộ cho khách bằng cách vào hồ sơ khách sau khi lưu.

Dành cho khách đến thẳng tay sale, không đi qua web hay bot. Trước đây những khách này chỉ nằm trong điện thoại của sale: công ty không biết, AI không chấm, báo cáo không đếm, sale nghỉ việc thì khách đi theo.

Nguồn chọn trong form:

| Nguồn | Ví dụ |
|---|---|
| Gọi hotline | Số in trên bảng quảng cáo, tờ rơi, tin đăng |
| Biển treo tại căn | Khách đi ngang thấy biển "Bán nhà", gọi số trên biển |
| Đến văn phòng | Khách vãng lai ghé hỏi |
| Zalo cá nhân của sale | Khách cũ gửi Zalo của sale cho bạn bè |
| Người quen giới thiệu | Khách đã mua giới thiệu người nhà |
| Khác | Ghi rõ trong ghi chú |

Các ô của form:

| Ô | Bắt buộc | Ghi chú |
|---|---|---|
| Nguồn | Có | Danh sách ở trên |
| Họ tên | Có | |
| Số điện thoại | Có | Gõ đủ số thì tự kiểm tra trùng sau 0,4 giây, báo "Số này đã có: lead #…" kèm link mở hồ sơ và khoá nút Lưu (mục 2) |
| Email | Không | Khách Việt Nam nhiều người không dùng email |
| Ngân sách | Không | Không có thì AI chấm với dữ liệu đang có |
| Căn quan tâm | Không | Chọn được nhiều căn |
| Ghi chú | Không | Nội dung cuộc gọi, nhu cầu |
| Người phụ trách | Có | Mặc định là người nhập (mục 4). Danh sách chỉ có sale đang nhận khách và quản lý; người nhập đã tắt "Đang nhận khách" thì phải chọn người khác |
| Đặt lịch xem luôn | Không | **Chưa làm** (task sau, khi đó dùng bộ chọn khung giờ ở mục 6) |

## 2. Nhận ra khách cũ

- Khoá nhận ra khách là **số điện thoại đã chuẩn hoá**: bỏ dấu cách, dấu chấm, gạch ngang, đổi `+84` thành `0`. Email chỉ là thông tin phụ.
- Kênh nào cũng kiểm tra trùng trước khi tạo lead. Trùng thì không tạo lead mới:
  - Web và bot: gắn yêu cầu mới (buổi xem, tin nhắn) vào lead cũ, giữ sale cũ.
  - Nhập tay: form báo "Số này đã có: lead #… …, đang do … phụ trách" và mời mở lead cũ.
- Lead cũ đã "Không mua" mà khách quay lại thì mở lại lead đó về "Đang tư vấn", vẫn giao sale cũ nếu sale đó còn nhận khách.

## 3. Lead và buổi xem

**Hiện tại:** mỗi lần đặt lịch tạo một lead mới. **Mới:** một lead là một khách; một lead có thể có nhiều buổi xem.

Ví dụ chị Bình:

| Việc | Hiện tại | Mới |
|---|---|---|
| Chat bot hỏi giá, để lại số | Không có gì trong hệ thống | Lead #42 "Đang tư vấn", gán sale Minh |
| Đặt xem căn Sơn Trà | Lead #42, AI chấm, email, báo nhân viên | Buổi xem 1 dưới lead #42 |
| Đặt xem thêm căn Hải Châu (sau khi đã xem Sơn Trà) | Lead #43, AI chấm lại, email lại, sale khác có thể duyệt | Buổi xem 2 dưới lead #42, vẫn Minh *(đang chạy, FE-34)* |
| Huỷ lịch Sơn Trà (khi chưa xem) | Lead #42 "Không mua" | Buổi xem 1 "Đã huỷ", lead về "Đang tư vấn" *(đang chạy, FE-34)* |
| Báo cáo tuần | 2 khách, 1 mất | 1 khách, xem 2 căn |

### 3.1. Trạng thái lead

Thêm một trạng thái đầu **"Đang tư vấn"** (`CONSULTING`), đứng trước "Mới" (`NEW`). Các trạng thái khác giữ nguyên.

```
Đang tư vấn ─▶ Mới (chờ duyệt lịch) ─▶ Đã chốt lịch ─▶ Đã xem nhà ─▶ Làm HĐ cọc ─▶ Đã ký
     │                  │                     │               │
     └──────────────────┴─────────────────────┴───────────────┴──▶ Không mua
```

| Trạng thái | Khi nào |
|---|---|
| Đang tư vấn | Lead chưa có buổi xem nào đang chờ |
| Mới | Có ít nhất một buổi xem chờ duyệt |
| Đã chốt lịch trở đi | Như hiện tại |

**Đang chạy (FE-34):** mỗi khách có **tối đa một buổi xem đang mở** (chờ duyệt hoặc đã chốt). Muốn đặt buổi tiếp theo, buổi đang mở phải xong (đã xem, không đến, đã huỷ). Lead đi theo buổi đang mở: khách đã xem căn A rồi đặt căn B thì lead về "Mới" (chờ duyệt buổi 2), còn buổi 1 vẫn "Khách đã đến" trong lịch sử. Hợp đồng cọc lấy căn của buổi **đã đến** gần nhất.

**Chưa làm:** nhiều buổi xem mở cùng lúc, mỗi buổi duyệt riêng, trạng thái lead lấy theo buổi tiến xa nhất. Cần chuyển nút Duyệt và luồng 1, 1b, 2 sang theo từng buổi xem, nên để sau FE-35 và FE-38.

### 3.2. Huỷ buổi xem không có nghĩa là mất khách

- Khách tự huỷ, hoặc khách không đến: chỉ buổi xem đó chuyển "Đã huỷ" / "Khách không đến" *(đang chạy, FE-34)*.
- Lead quay về "Đã xem nhà" nếu khách từng đến một buổi khác, không thì về "Đang tư vấn", để sale gọi lại. Sale quyết định có đóng lead hay không.
- Lead chỉ "Không mua" khi sale (hoặc quản lý) đóng, hoặc khi hệ thống đóng vì quá hạn (mục 5).

### 3.3. AI chấm điểm

- AI chấm **khi tạo lead**, không chấm lại mỗi lần đặt lịch.
- Lead thiếu ngân sách (nhập tay, bot) vẫn được chấm với dữ liệu đang có; AI không đủ căn cứ thì để WARM.
- Sale bổ sung ngân sách hoặc nhu cầu thì chấm lại.

### 3.4. Telegram

Khi khách để lại số điện thoại trong bot (FE-36, đã làm ở local), chat Telegram đó được gắn vào lead: các log cũ của chat chưa thuộc lead nào chuyển sang lead, log sau tự theo lead. Một chat theo lead đầu tiên; để lại số thứ hai trong cùng chat không chuyển chat sang lead mới. Sale phụ trách nhận thông báo ngay ("Khách Telegram để lại số", hoặc "Khách cũ nhắn lại" nếu số đã có hồ sơ) và đọc lịch sử chat trong trang lead, không phải mở n8n. Bot không hỏi email, ngân sách và không thu đồng ý nhận tin quảng cáo. Chi tiết và giới hạn: [FE-36](../fe-36-bot-ghi-nhan-khach.md).

## 4. Gán sale

| Khách đến từ | Ai phụ trách |
|---|---|
| Web, bot (kênh của hệ thống) | **Chia lần lượt** cho các sale đang nhận khách, không phân biệt mức HOT/WARM/COLD |
| Nhân viên nhập tay | Người nhập (đổi được trong form) |
| Khách cũ quay lại (mục 2) | Sale cũ, nếu sale đó còn nhận khách; không thì chia lần lượt |

- Mỗi sale có công tắc **"Đang nhận khách"**. Nghỉ phép, ốm thì tắt; lượt chia bỏ qua người đang tắt.
- Lead nhập tay cũng tính một lượt cho người nhập, để số khách giữa các sale cân bằng.
- Quản lý chuyển lead sang sale khác bất cứ lúc nào. Mỗi lần chuyển ghi vào nhật ký lead.
- Không có sale nào đang nhận khách thì lead giao cho quản lý.

Vì sao chia lần lượt mà không chọn cách khác:

| Cách | Vì sao không chọn |
|---|---|
| Quản lý tự chia | Khách gửi buổi tối hay Chủ nhật thì phải chờ quản lý |
| Ai nhận trước thì được | Sale nhanh tay giành hết khách HOT, khách COLD không ai nhận |
| Chia theo khu vực | Bảng nhân viên chưa có khu vực; nhóm nhỏ thì mỗi khu vực chỉ có 1 người |

Ví dụ một ngày với 3 sale An, Bình, Chi:

```
09:00  Khách Hùng đặt lịch trên web          → An    (lượt 1)
09:20  Khách Lan để số trong bot Telegram    → Bình  (lượt 2)
10:00  Khách Tú gọi hotline, Chi nghe máy    → Chi   (nhập tay, tính lượt 3)
11:00  Khách Mai đặt lịch trên web           → An    (vòng lại)
14:00  Hùng đặt thêm căn thứ hai             → vẫn An (khách cũ)
Chiều  Bình tắt "Đang nhận khách"            → khách mới chỉ chia cho An và Chi
```

### 4.1. Thông báo

- Lead mới, buổi xem mới: báo **sale phụ trách** qua Telegram cá nhân, thông báo đẩy trên app và email của sale đó.
- Quản lý chỉ nhận khi quá hạn (mục 5), khi không có sale nào nhận khách, hoặc khi gửi thông báo lỗi.
- Bảng nhân viên cần thêm: Telegram chat id cá nhân, công tắc "Đang nhận khách".

**Hiện tại:** mọi thông báo gửi một email cứng (`nhadn2457+nhanvien@gmail.com`) và một nhóm Telegram chung; thông báo đẩy gửi mọi nhân viên có app.

## 5. Hạn phản hồi

Hệ thống **chỉ đo những gì xảy ra trong hệ thống**. Gọi điện, nhắn Zalo là việc của sale ngoài hệ thống, tài liệu này không mô tả; sale ghi lại kết quả bằng một thao tác bên dưới.

**Thao tác đầu tiên** của sale phụ trách là bất kỳ việc nào:

- duyệt lịch, hoặc đổi giờ;
- đặt lịch hộ khách;
- ghi một dòng ghi chú vào lead (ví dụ "đã gọi, hẹn thứ 7");
- đóng lead.

| Mốc | Hiện tại | Mới |
|---|---|---|
| Hạn thao tác đầu tiên | Không có | **2 giờ**, chỉ tính trong giờ làm việc **8:00–21:00** |
| Quá hạn | 24 giờ sau khi đặt mới báo quản lý; 3 ngày mới nhắc sale | Báo quản lý ngay khi quá hạn. Quản lý duyệt thay hoặc chuyển sale khác |
| Nút Duyệt trong thông báo | Hết hiệu lực sau 24 giờ (node "Chờ duyệt" của luồng 1) | Dùng được tới giờ hẹn. **FE-35 đã làm ở local**: nút mở trang xác nhận trên web, luồng 1 không còn chờ. Xem [FE-35](../fe-35-thong-bao-phu-trach.md) |
| Qua giờ hẹn mà chưa duyệt | Đóng "Không mua", lý do "Quá hạn không xử lý" | Giữ như hiện tại |

- Khách đã đặt lịch thì "duyệt lịch" thường chính là thao tác đầu tiên, nên không cần một hạn duyệt riêng.
- Hạn chuyển sang sale mới khi lead được chuyển: sale mới có 2 giờ làm việc tính từ lúc nhận.

Ví dụ:

```
Lead vào 09:00          → hạn 11:00 cùng ngày
Lead vào 20:00          → hạn 09:00 sáng mai (còn 1 giờ hôm nay, 1 giờ sáng mai)
Lead vào 23:00          → hạn 10:00 sáng mai
```

## 6. Đặt lịch xem: khung giờ

**Đang chạy ở local từ FE-34** (danh sách khung: `GET /api/viewings/slots`, xem [api-contract.md](../api-contract.md) mục 3.1; thông báo lỗi: [02-dat-lich-den-dat-coc.md](02-dat-lich-den-dat-coc.md) mục 1.2). Luồng 6 (bot) nhận các quy tắc này qua mô tả công cụ đặt lịch.

| | Hiện tại | Mới |
|---|---|---|
| Giờ được hẹn | Bất kỳ | **8:00–19:00** |
| Cách chọn | Ô tự gõ ngày giờ | Chọn ngày, rồi chọn **khung 1 tiếng** (8:00, 9:00, …, 19:00) |
| Hai lịch cùng căn cách nhau | 60 phút | Giữ 60 phút (`BOOKING_GAP_MINUTES`) |
| Thấy khung đã kín | Chỉ khi gửi xong (lỗi 409) | Khung đã có khách hẹn căn đó bị gạch ngay trên form |
| Đặt sớm nhất | Bất kỳ thời điểm nào trong tương lai | **3 giờ** sau lúc đặt, tính trong giờ làm việc |
| Đặt xa nhất | Không giới hạn | **14 ngày** |

- Khung 1 tiếng khớp quy tắc cách 60 phút: mỗi lịch đã đặt gạch đúng một khung.
- Danh sách khung đã kín chỉ trả về giờ, không kèm thông tin khách.
- Lúc gửi, backend **vẫn kiểm tra lại** trùng lịch trong khoá theo căn (như hiện tại), vì hai khách có thể chọn cùng khung một lúc.
- Vì sao sớm nhất 3 giờ: hạn duyệt là 2 giờ; còn 1 giờ để sale gọi chủ nhà, báo khách và di chuyển.
- Vì sao xa nhất 14 ngày: sau vài tuần căn có thể đã có người cọc hoặc đổi giá; khách hẹn quá xa dễ quên.
- **Sale đặt hộ** trên web admin không bị giới hạn 14 ngày và 3 giờ, chỉ cần giờ hẹn ở tương lai và trong 8:00–19:00.

Cách tính khung sớm nhất:

| Khách đặt lúc | Khung sớm nhất |
|---|---|
| 09:00 | 12:00 cùng ngày |
| 15:30 | 19:00 cùng ngày |
| 17:00 | 8:00 sáng mai (20:00 đã quá khung cuối; sale còn làm tới 21:00 nên kịp duyệt) |
| 22:00 hoặc 2:00 sáng | 11:00 sáng mai (giờ làm việc bắt đầu 8:00, cộng 3 giờ) |

Đổi giờ (của nhân viên, hoặc khi hẹn lại sau khi khách không đến) dùng cùng bộ chọn khung giờ.

## 7. Chia việc: ai làm phần nào

Chia theo khu vực mỗi người đang giữ (bảng "Ai giữ phần nào" ở mục 6 của [quy-trinh-git.md](../quy-trinh-git.md)): Hậu giữ backend lead, nhân viên, follow-up, luồng 2, 4, 5, 7, 8; Hoàng giữ backend buổi xem, luồng 1, 1b, 3, 6, sub-workflow thông báo và giao diện web.

**Thứ tự:** FE-33 là PR nền, merge vào `dev` trước. Các task còn lại tạo nhánh từ `dev` **sau khi** FE-33 đã merge, làm song song được.

```
FE-33 (Hậu, PR nền) ──merge──┬─▶ FE-34 Buổi xem, khung giờ          (Hoàng)
                             ├─▶ FE-35 Luồng 1, 1b, thông báo         (Hoàng)
                             ├─▶ FE-36 Luồng 6 tạo lead               (Hoàng)
                             ├─▶ FE-37 Form "Thêm khách"              (Hoàng)
                             ├─▶ FE-38 Luồng 2 hạn phản hồi, báo cáo  (Hậu)
                             └─▶ FE-39 Admin: phụ trách, chuyển sale  (Hậu)
FE-40 Luồng 7 lead không email (Hậu): chờ chốt mục 8
```

| Mã | Ai | Việc | Đóng lỗ |
|---|---|---|---|
| FE-33 | Hậu | **PR nền.** Mọi thay đổi dữ liệu của quy trình này, làm một lần: bảng lead (người phụ trách, `CONSULTING`, số điện thoại chuẩn hoá), bảng nhân viên (Telegram cá nhân, "Đang nhận khách"), loại sự kiện mới (gán sale, chuyển sale, ghi chú, quá hạn phản hồi). API tạo lead dùng chung cho mọi kênh có kiểm tra trùng số điện thoại; chia lần lượt; API chuyển sale; API ghi chú. Thêm sẵn hàm gọi API mới vào `web/src/lib/api.ts` | LH-03, LH-04, LH-10 |
| FE-34 | Hoàng | Backend buổi xem: khách cũ đặt thêm lịch trên cùng lead (mỗi lúc tối đa một buổi xem đang mở), huỷ hoặc không đến không đóng lead, hợp đồng lấy buổi đã đến gần nhất. API khung giờ đã kín, chặn giờ hẹn ngoài 8:00–19:00, sớm hơn 3 giờ, xa hơn 14 ngày. Web khách: bộ chọn ngày và khung giờ. **Đã làm ở local** (change OpenSpec `fe34-repeat-viewings-time-slots`); chưa chạy thử luồng 1, 6, 7 trên n8n thật | LH-05, LH-08, LH-09 |
| FE-35 | Hoàng | Luồng 1: chấm điểm khi tạo lead, tách khỏi duyệt lịch; nút Duyệt dùng được tới giờ hẹn; bỏ mốc 24 giờ. Luồng 1b theo buổi xem. Sub-workflow thông báo nhân viên gửi cho sale phụ trách (Telegram cá nhân, push, email) thay email cứng | LH-06 |
| FE-36 | Hoàng | Luồng 6: khách để lại số điện thoại thì gọi API tạo lead; gắn `chat_logs` vào lead; trang lead hiện lịch sử chat. **Đã làm ở local** (change OpenSpec `fe36-bot-lead-capture`); chưa chạy thử với Gemini và Telegram thật | LH-01, LH-11 |
| FE-37 | Hoàng | Web admin: form "Thêm khách" (mục 1.1), báo trùng số điện thoại ngay khi gõ | LH-02 |
| FE-38 | Hậu | Luồng 2: báo quản lý khi quá 2 giờ làm việc chưa có thao tác đầu tiên, bỏ mốc nhắc 3 ngày; nhắc và điểm danh theo từng buổi xem. Luồng 4 và thống kê: đếm theo khách, thêm số lead theo nguồn và theo sale | LH-07 |
| FE-39 | Hậu | Web admin: cột người phụ trách ở danh sách lead, khối người phụ trách, nút chuyển sale và ô ghi chú trên trang lead, công tắc "Đang nhận khách" ở trang tài khoản | LH-04 |
| FE-40 | Hậu | Luồng 7: đồng bộ lead không có email sang Mautic. Chờ chốt mục 8 | |

Mỗi task sửa tài liệu này và [02-dat-lich-den-dat-coc.md](02-dat-lich-den-dat-coc.md) trong cùng PR: phần đã làm thì bỏ chữ "Mới" / "chưa làm", ghi thành quy tắc đang chạy.

## 8. Còn mở

- Mautic hiện tìm contact theo email. Lead không có email (nhập tay, bot) thì có đồng bộ sang Mautic không, và bằng gì.
- Dữ liệu cũ: các lead trùng email hoặc số điện thoại trong database hiện tại có gộp lại không.
