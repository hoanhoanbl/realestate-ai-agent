# Danh sách task và mã nhánh

Mỗi nhánh làm một task và có một **mã**. Bảng này là nơi duy nhất cấp mã, để Hoàng và Hậu không đặt trùng số. Quy trình Git đầy đủ: [quy-trinh-git.md](quy-trinh-git.md).

Cập nhật lần cuối: 18/11/2026 (DC-16: nới phụ thuộc của FE-43, FE-53, FE-54, FE-56; kéo FE-50 lên trước FE-48; CH-11 sang mục 4).

## 1. Quy ước đặt tên

| Loại | Mã | Tên nhánh | Tạo từ → PR vào |
|---|---|---|---|
| Chức năng | `FE-nn` | `feature/FE-nn-<ten-ngan>` | `dev` → `dev` |
| Sửa lỗi trên dev | `BF-nn` | `bugfix/BF-nn-<ten-ngan>` | `dev` → `dev` |
| Sửa gấp production | `HF-nn` | `hotfix/HF-nn-<ten-ngan>` | `main` → `main` |
| Tài liệu | `DC-nn` | `docs/DC-nn-<ten-ngan>` | `dev` → `dev` |
| Cấu hình, CI, quy trình | `CH-nn` | `chore/CH-nn-<ten-ngan>` | `dev` → `dev` |

- Mỗi loại đếm số riêng, tăng dần, **không dùng lại** số đã cấp, kể cả khi task bị bỏ.
- Tên ngắn viết thường, không dấu, nối bằng gạch ngang. Ví dụ: `feature/FE-20-telegram-homnay`.
- Dùng cùng mã ở tiêu đề PR (`[FE-20] Luồng 6: lệnh /homnay`) và trong commit (`feat(FE-20): ...`).

**Nhận task mới:**
1. Lấy số tiếp theo của loại đó (mục 5), thêm một dòng vào mục 3 với tên mình và trạng thái "Chưa làm".
2. Đưa dòng đó lên `dev` bằng một PR nhỏ riêng (`chore/CH-nn-...`), merge xong mới tạo nhánh task. Làm vậy người kia thấy số đã có chủ, không đặt trùng.
3. Khi PR của task merge, chuyển dòng của task đó sang mục 4 (đã xong) với số PR và ngày merge. Việc này làm ngay trong PR của task.

Bảng chỉ liệt kê các việc có nhánh riêng. Việc nhỏ không cần nhánh (sửa lỗi chính tả, đổi một dòng cấu hình) vẫn đi qua nhánh theo quy trình nhưng không cần cấp mã nếu mất dưới 30 phút.

## 2. Mốc

| Mốc | Ngày |
|---|---|
| Khoá code | 3/12 |
| Nộp bài | 5/12 |

Không chia việc theo ngày hay tuần. Thứ tự làm nằm ở mục 3: hết việc trước mới tới việc sau, theo cột "Làm sau". Việc kế tiếp còn bị chặn (chờ người kia merge hay duyệt) thì làm việc sau nó mà không bị chặn, rồi quay lại. Phân việc chỉ ghi tại file này; đổi người hay đổi thứ tự thì sửa tại đây.

Mỗi quy tắc nghiệp vụ, ngoại lệ hay bước làm tay phải được ghi vào `docs/` bằng tiếng Việt, trong cùng task làm ra nó. Tài liệu nghiệp vụ đặt trong `docs/nghiep-vu/`; tài liệu luồng chỉ link sang đó, không chép lại quy tắc.

## 3. Việc còn lại theo thứ tự

Mục tiêu: **mọi luồng chạy đúng trên server**, không chỉ có code ở `dev`. Hai người làm song song theo hai bảng 3.2 và 3.3; một dòng chỉ bắt đầu khi các mã ở cột "Làm sau" đã merge vào `dev`.

```
 HOANG                                      HAU
 -----                                      ---
 1 DC-16 chot 9 diem review  --(Hau duyet)  1 CH-12 dot 1: nghiem thu server
 2 FE-43 PR nen (song song DC-16) -(Hau duyet)-+   cac luong cua Hau (2, 4, 5, 5b)
 3 BF-09 L1 ket PENDING                        +-> 2 FE-44 da lien he, ly do
 4 FE-53 trung lich theo sale                  |   3 FE-45 backend bac nhac + link duyet
 5 FE-50 viec nho n8n, su kien thu da gui      |     (can DC-16 va FE-43 da merge)
 6 FE-48 gia thoa thuan, file ky               +-> 4 FE-54 bo nhac lich thua
 7 FE-56 trang /duyet-thu (API da chot o DC-16)    5 FE-45 luong 9 n8n
 8 FE-49 L3 luu ban ky                             6 FE-46 luong 2 bo nhanh, moi hen lai
 9 FE-24 bo 20 lead                                7 FE-47 L4 lien he, ly do
10 FE-25 Langfuse (cat dau tien)
                 \                               /
                  +--> CH-12 dot 2: nghiem thu server ca 12 luong + luong 9
                                  |
                       FE-55 model AI du phong (neu con suc)
                                  |
                          DC-05 / DC-06 bao cao
```

Đường găng là chuỗi FE-43 → FE-44 → FE-45 → FE-46 của Hậu. Vì vậy Hoàng làm DC-16 và FE-43 song song (FE-43 chỉ cần danh sách cột và hằng số đã chốt ở mục 3.1, không cần chờ DC-16 merge), nhận trang duyệt thư (FE-56) thay Hậu, và làm BF-09, FE-53 trong lúc chờ Hậu duyệt. DC-16 và FE-43 phải cùng merge trước khi Hậu bắt đầu FE-45. FE-50 làm trước FE-48 vì FE-54 của Hậu cần sự kiện FE-50 ghi khi chạy thật trên server, còn FE-48 chỉ mở đường cho FE-49 của Hoàng.

### 3.1. Chốt review của Hậu về DC-15 (18/11)

Hậu review DC-15 và kế hoạch hành trình, nêu 9 điểm; cả 9 đều đúng khi đối chiếu code `dev`. Hướng chốt dưới đây, DC-16 ghi vào change `journey-followup-ladder` và `docs/nghiep-vu/`.

| # | Điểm | Hướng chốt | Task |
|---|---|---|---|
| 1 | Bậc nhắc sau khi khách huỷ lịch: D4 cho bậc ngày 1 sống tới trước ngày 3, trái scenario "huỷ ngày 2 không nhận bậc ngày 1" | Thêm mốc "đủ điều kiện từ lúc" (lần gần nhất lead vào `CONSULTING`/`NEW`, hoặc lúc giao). Bậc chỉ gửi khi mốc đó ≤ giờ của bậc ≤ hiện tại < giờ bậc kế tiếp | FE-45 |
| 2 | Chuyển sale có thể làm trùng lịch | **Chặn**: lead có buổi xem đang mở mà sale mới bận trong 90 phút quanh giờ đó thì không chuyển được, báo "Sale … đã có lịch xem căn … lúc …; chọn sale khác hoặc đổi giờ trước". Lý do: quản lý thấy xung đột ngay lúc chuyển; nếu chỉ cảnh báo thì trùng lịch chỉ lộ ra vào ngày xem | FE-53 |
| 3 | Điểm danh sớm làm sale được coi là rảnh | Lịch bận tính mọi buổi xem trừ "Đã huỷ" và "Không đến", kể cả buổi đã điểm danh "Có đến": bận theo giờ hẹn, không theo trạng thái | FE-53 |
| 4 | FE-54 dựa vào sự kiện ghi trước khi gọi n8n | Luồng 1, 1b ghi sự kiện mới `VIEWING_CONFIRMATION_SENT` (kèm buổi xem và giờ hẹn) **sau** khi gửi thư thành công; FE-54 chỉ dựa vào sự kiện này | FE-43 (loại sự kiện), FE-50 (ghi), FE-54 (dùng) |
| 5 | Ngày 7: lead chưa liên hệ được đủ cả `LADDER_REACH` bậc 7 và `LADDER_QUIET` | `LADDER_QUIET` chỉ áp dụng cho lead đã liên hệ được (`contacted_at` có giá trị). Lead chưa liên hệ được chỉ đi chuỗi REACH. `STALE` 14 ngày áp dụng cho cả hai | FE-45 |
| 6 | FE-47 có thể ra thời gian liên hệ âm khi chuyển sale | Không thêm cột. Tính từ sự kiện: `CONTACTED` đầu tiên sau sự kiện giao/chuyển sale của phiên đó; chỉ số ghi rõ "theo phiên giao" | FE-47 |
| 7 | Thư mời hẹn lại thiếu điều kiện loại trừ | Không gửi khi lead "Đang làm hợp đồng cọc", "Đã ký hợp đồng cọc", hoặc căn không còn "Đang mở bán"; kiểm tra lại lúc bắt đầu gửi; không gửi được thì ghi sự kiện | FE-46 |
| 8 | Gộp nhắc sale và gửi thư khách trong một việc; `actionDone()` ghi đè `result` | Việc `LADDER_*` hoàn tất ngay sau khi nhắc sale. Sale xác nhận thì tạo việc riêng `LADDER_EMAIL` (key `LADDER_EMAIL:{mã việc bậc}`) đi đủ claim → start → action-done → complete; key duy nhất nên hai lần xác nhận chỉ gửi một thư. `actionDone()` gộp vào `result`, không ghi đè | FE-43 (loại việc), FE-45 |
| 9 | Đóng `STALE` xong mà execution dừng trước khi báo quản lý thì mất thông báo | Làm như `EXPIRE_LEAD`: lead `LOST`/`STALE` có sự kiện `LEAD_STALE_CLOSED` ghi đúng key của việc vẫn được lượt quét lấy lại để chạy nốt bước báo quản lý | FE-45 |

### 3.2. Hoàng

| # | Mã | Nhánh | Việc | Làm sau | Trạng thái |
|---|---|---|---|---|---|
| 1 | DC-16 | `docs/DC-16-chot-review-hanh-trinh` | Ghi 9 hướng chốt ở mục 3.1 vào change `journey-followup-ladder` (`design.md` D1, D4, D5, D6, D9, D10; spec `lead-followup-ladder`, `missed-viewing-rebooking`; `tasks.md`) và `docs/nghiep-vu/` (`01-visits.md` mục 1.6, 3.1, 4.3, `03-lead-follow-up.md`, `04-sales-analytics.md`). Thêm hai chỗ hở tìm thấy khi rà plan: định dạng ghi chú của `VIEWING_CONFIRMATION_SENT` (`viewing=<id>;time=<ISO UTC>`, D10) và đủ nguồn của mốc "đủ điều kiện từ lúc" cùng ngoại lệ nhắc im lặng cho lead chưa liên hệ được đã lỡ hết bậc (D4). Chốt hình dạng API link duyệt thư ở `api-contract.md` mục 3.10 để FE-56 làm trước. Hậu duyệt | | Đang làm (18/11) |
| 2 | FE-43 | `feature/FE-43-nen-hanh-trinh` | PR nền: cột `contacted_at` của lead, lý do "Không mua" mới (`STALE` và nhóm lý do chi tiết), loại sự kiện và loại việc mới (thêm `LADDER_EMAIL`, `VIEWING_CONFIRMATION_SENT` theo mục 3.1, kèm hàm dựng và đọc ghi chú của sự kiện này), cột hợp đồng (giá thoả thuận, file đã ký, chỉ là cột), `backend/sql/fe-43-journey.sql`, kiểu trong `web/src/lib/api.ts`. Sửa file thuộc phần Hậu giữ nên Hậu duyệt | | Chưa làm. Song song DC-16: danh sách cột và hằng số đã chốt ở mục 3.1 |
| 3 | BF-09 | `bugfix/BF-09-l1-ket-pending` | Luồng 1: node `Lưu kết quả AI` lỗi thì chỉ tới `Callback failed`, lead kẹt `automationStatus = PENDING`, backend chặn duyệt ("AI chưa chấm điểm xong"), tới giờ hẹn luồng 2 đóng `EXPIRED`. Sửa để nhánh lỗi đi `Report FAILED` (sale duyệt tay được). LH-54 | | Chưa làm. Làm trong lúc chờ Hậu duyệt FE-43 |
| 4 | FE-53 | `feature/FE-53-trung-lich-theo-sale` | Chống trùng lịch theo sale (LH-24): hai buổi xem của một sale ở hai căn khác nhau cách nhau ít nhất 90 phút (`SALE_GAP_MINUTES`). Chia sale lần lượt bỏ qua sale đang bận; duyệt, đổi giờ, sale đặt hộ, hẹn xem tiếp trong theo dõi phản hồi **và chuyển sale** bị chặn khi sale phụ trách bận; buổi đã điểm danh "Có đến" vẫn tính bận (mục 3.1, điểm 2 và 3); khoá theo sale trong transaction. Sửa `lead-intake.service.ts`, `leads.service.ts`, `feedback-work.service.ts` của Hậu nên Hậu duyệt | | Chưa làm. Không phụ thuộc FE-43. Quy tắc ở `01-visits.md` mục 1.6 (DC-16). Nên merge trước khi Hậu bắt đầu FE-44 vì cùng sửa `leads.service.ts` |
| 5 | FE-50 | `feature/FE-50-viec-nho-n8n` | Việc nhỏ ở luồng của Hoàng: luồng 1 và 1b ghi sự kiện `VIEWING_CONFIRMATION_SENT` **sau** khi gửi thư thành công, ghi chú theo định dạng của FE-43 (mục 3.1, điểm 4); sự kiện này cũng là mốc "thư tự động tới khách" cho báo cáo; luồng 6b bật retry (LH-53); Error workflow báo Telegram (LH-52) | FE-43 | Chưa làm |
| 6 | FE-48 | `feature/FE-48-hop-dong-gia-file-ky` | Hợp đồng: ô giá thoả thuận, endpoint lưu file đã ký (backend và web). **Phần chọn căn khi lập hợp đồng, soạn lại và huỷ hợp đồng kẹt đã xong ở PR #82 (13/11)** | FE-43 | Một phần xong |
| 7 | FE-56 | `feature/FE-56-trang-duyet-thu` | Trang `/duyet-thu/[token]` cho sale duyệt và sửa thư AI soạn (việc 5.1 của change `journey-followup-ladder`). Tách khỏi FE-45 để Hoàng làm vì thuộc web khách; Hậu duyệt. Làm với API giả theo `api-contract.md` mục 3.10 | DC-16 (hình dạng API), FE-43 (helper `api.ts`). Merge sau FE-45 phần API link duyệt (việc 4.4) | Đã làm xong trang (PR chồng lên FE-43), đã kiểm ở 375 px với API giả đủ các trạng thái. Chạy với backend thật cần FE-45 việc 4.4 |
| 8 | FE-49 | `feature/FE-49-l3-luu-ban-ky` | Luồng 3: sau khi khách ký tạo PDF, lưu file, tính hash, ghi nhật ký kèm đường dẫn (LH-28) | FE-48 | Chưa làm |
| 9 | FE-24 | `feature/FE-24-bo-20-lead` | Bộ 20 lead có nhãn và cách chạy đo, lấy số cho báo cáo (mục đo lường của DC-05). Không phụ thuộc gì, lấp chỗ trống khi việc trước bị chặn | | Chưa làm |
| 10 | FE-25 | `feature/FE-25-langfuse-l1` | Langfuse cho luồng 1, đo trên bộ 20 lead. Việc đầu tiên bị cắt nếu thiếu giờ | FE-24 | Chưa làm |

### 3.3. Hậu

| # | Mã | Nhánh | Việc | Làm sau | Trạng thái |
|---|---|---|---|---|---|
| 1 | CH-12 (đợt 1) | | Nghiệm thu trên server các luồng của Hậu đang có ở `main` (`v0.4.2`): luồng 2, 4 (số `EXPIRED`, theo nguồn, theo sale và căn), 5, 5b theo dõi phản hồi. Hoàng chạy bước tay trên VPS. Xem dòng CH-12 ở mục 3.4 | | Chưa làm. Làm trong lúc chờ DC-16, FE-43 |
| 2 | FE-44 | `feature/FE-44-lien-he-ly-do` | Nút "đã liên hệ được" và ghi lần gọi không được ở trang lead; chọn lý do "Không mua" chi tiết (backend và web). Điểm danh "Có đến" tự ghi đã liên hệ được | FE-43 | Chưa làm |
| 3 | FE-45 | `feature/FE-45-l9-follow-up-bac` | Phần backend: bậc nhắc, danh sách việc đến hạn, claim, đóng `STALE` và đường phục hồi, link duyệt, việc `LADDER_EMAIL` (việc 4.1 đến 4.8 của change, kèm điểm 1, 5, 8, 9 ở mục 3.1). Link duyệt làm đúng hình dạng ở `api-contract.md` mục 3.10, vì FE-56 làm trang theo đó | FE-44, DC-16 | Chưa làm |
| 4 | FE-54 | `feature/FE-54-bo-nhac-lich-thua` | Luồng 2 không gửi nhắc lịch khi sự kiện `VIEWING_CONFIRMATION_SENT` của đúng buổi xem và giờ hẹn đó ghi lúc giờ hẹn còn dưới 24 giờ. Sửa `followup-policy.ts`, `followup-sql.ts` kèm test (test tự tạo sự kiện, không cần FE-50). Quy tắc: [01-visits.md](nghiep-vu/01-visits.md) mục 3.1 | FE-43 | Chưa làm. Chạy thật trên server cần FE-50 |
| 5 | FE-45 | (cùng nhánh hoặc PR thứ hai cùng mã) | Phần n8n: luồng 9 (`luong-9-follow-up-bac.json`), script kiểm guardrail, chạy thử local, tài liệu luồng 9 (việc 6.1 đến 6.4 của change) | FE-45 phần backend | Chưa làm |
| 6 | FE-46 | `feature/FE-46-l2-bo-nhanh-im-lang` | Luồng 2 bỏ nhánh nhắc khách im lặng sau buổi xem (chuyển sang luồng 9) và nhánh Mautic; thêm thư mời hẹn lại khi khách không đến, kèm điều kiện loại trừ ở mục 3.1 điểm 7 | FE-45 | Chưa làm |
| 7 | FE-47 | `feature/FE-47-l4-lien-he-ly-do` | Luồng 4 thêm thời gian tới lúc liên hệ được (theo phiên giao, mục 3.1 điểm 6), số lead chưa liên hệ được sau bậc 7 ngày, số lead đóng `STALE`, lý do mất khách theo nhóm. Theo nguồn đã có ở FE-23, theo sale và căn đã có ở FE-51 | FE-44, FE-45 | Chưa làm |

### 3.4. Chung, làm sau cùng

| Mã | Nhánh | Việc | Ai | Làm sau | Trạng thái |
|---|---|---|---|---|---|
| CH-12 | `chore/CH-12-nghiem-thu-server` | Nghiệm thu trên server mọi luồng, ghi kết quả vào `docs/trien-khai.md` và mục "Triển khai lên server" của từng tài liệu luồng (thay các dòng "chưa kiểm trên server"). **Đợt 1** (ngay): bản `v0.4.2` đang ở `main`, vì chưa có ghi chép bước tay của `v0.4.x` (SQL `fe-33-intake.sql`, import luồng 1, 1b, 2, 5, 5b, 6, Thông báo). **Đợt 2**: sau khi các task ở 3.2 và 3.3 merge, phát hành `v0.5.0` (chạy `fe-43-journey.sql` trước khi backend mới khởi động), import luồng 1, 1b, 2, 3, 4, 6b, Error, thêm luồng 9. Mỗi người kiểm luồng của mình | Hoàng chạy VPS; Hậu kiểm luồng 2, 4, 5, 5b, 9 | Đợt 2: các task code ở 3.2, 3.3 | Chưa làm |
| FE-55 | `feature/FE-55-model-du-phong` | Model AI dự phòng cho các node AI khi Gemini lỗi hoặc hết quota (LH-50). Mỗi người sửa JSON của mình: Hoàng luồng 1, 3, 6; Hậu luồng 2, 4, 5 | Hoàng, Hậu | CH-12 đợt 2 | Nếu còn sức |
| DC-05 | `docs/DC-05-bao-cao-hoang` | Báo cáo: luồng 1, 3, 6, Agentic, đo lường | Hoàng | CH-12 đợt 2, FE-24 | Chưa làm |
| DC-06 | `docs/DC-06-bao-cao-hau` | Báo cáo: luồng 2, 4, 5, 9, Marketing Automation (phần mở rộng), mục framework | Hậu | CH-12 đợt 2 | Chưa làm |

Video dự phòng làm không cần nhánh.

### 3.5. Không làm, ghi vào "hạn chế đã biết" của báo cáo

Làm nếu mọi việc ở mục 3 đã xong trước khoá code.

- Lỗ hổng LH-23: đường lui sau `SIGNED` (khách bỏ cọc, hoàn cọc, quản lý quên xác nhận đã nhận cọc) và dọn khách dự phòng đang giữ lịch khi căn thành `SOLD`.
- Giới hạn còn lại của luồng 7, 8 (đóng băng từ 13/11): chống trùng sự kiện, khoá theo contact.
- Banner đồng ý theo dõi theo Nghị định 13/2023 cho script Mautic (khoảng 2 giờ).
- Luồng 5 gắn tag Mautic cho "xem căn khác"; multi-agent cho luồng 4.
- Việc tuỳ chọn tăng độ khó: OCR CCCD trước khi soạn hợp đồng, đồng bộ Google Calendar, Voice. Chọn tối đa một.
- **App Expo, dời 13/11:** FE-27 (đưa app Expo sang `main`, Expo Push, chạy thử điện thoại thật; lấy `app/` từ commit `6a64517` của `dev` cũ) và FE-28 (Hậu: điểm Mautic và nguồn khách trong app, sau FE-27). Hai mã giữ chỗ, không dùng lại. Lý do: ngoài bốn vế của đề, sale đã dùng được web trên điện thoại (FE-26) và Telegram.
- FE-20 (lệnh Telegram `/homnay`): **bỏ** 11/11 vì web đã có lịch hôm nay; không dùng lại mã.

### 3.6. Mốc phát hành

| Phiên bản | Gồm | Bước làm tay trên VPS |
|---|---|---|
| `v0.2.1` | HF-01 | Xong 04/11 |
| `v0.3.0` | FE-18, FE-19, FE-29, BF-06, CH-06, DC-09 (PR #43, 05/11) | Xong 05–06/11 (mục 8 của `trien-khai.md`) |
| (không tag) | FE-31, FE-26, BF-08, FE-30 (PR #52, 06/11); FE-32, CH-07 (PR #55, 06/11) | Bước tay `v0.3.1` (mục 9 của `trien-khai.md`: token luồng 8, credential Mautic, import luồng 2, 7, 8) **chưa có ghi chép**: kiểm ở CH-12 đợt 1 |
| `v0.4.0`, `v0.4.1` | Quy trình 1: FE-33 đến FE-40 và các việc merge tới 11/11 (PR #71, #74) | **Chưa có ghi chép** SQL `fe-33-intake.sql` và import luồng 1, 1b, 6, 7, Thông báo: kiểm ở CH-12 đợt 1 |
| `v0.4.2` (chưa tag) | FE-41, FE-42, FE-51, FE-52, phần chọn căn của FE-48 (PR #82), CH-10 (PR #83). Release PR #84, 14/11 | Import luồng 4, 5, 5b: kiểm ở CH-12 đợt 1 |
| `v0.5.0` | Mọi task code ở mục 3.2 và 3.3 | Sao lưu DB, chạy `backend/sql/fe-43-journey.sql` trước khi backend mới khởi động, import các luồng đã đổi, thêm luồng 9 (CH-12 đợt 2) |
| `v1.0.0` | Bản nộp, sau khoá code 3/12 | |

Tag đã có: `v0.1.0`, `v0.2.0`, `v0.2.1`, `v0.3.0`, `v0.4.0`, `v0.4.1`.

## 4. Việc đã xong

Mã cấp bổ sung cho các nhánh đã merge, theo thứ tự PR đầu tiên của nhánh. Các nhánh cũ đặt tên theo kiểu cũ (không có mã trong tên). "Merge" là ngày vào `dev`; mọi việc dưới đây đã lên `main` tới bản `v0.4.2`, phần nghiệm thu trên server ở CH-12.

### Chức năng (FE)

| Mã | Nhánh | Việc | Ai | PR | Merge |
|---|---|---|---|---|---|
| FE-01 | `feature/n8n-workflow` | Workflow n8n đầu tiên (luồng 1 đặt lịch) | Hoàng | #1 | 08/10 |
| FE-02 | `feature/web` | Ghép web thành một bản: form, danh sách, thanh điều hướng | Hoàng | #3 | 09/10 |
| FE-03 | `feature/backend-api` | Hoàn thiện API backend, `timestamptz`, thống kê | Hậu | #4 | 09/10 |
| FE-04 | `feature/lead-events-api` | HA1: bảng `lead_events`, `PUT status`, `POST/GET event` | Hậu | #7 | 12/10 |
| FE-05 | `feature/n8n-luong-2` | HA2, HA3: luồng 2 follow-up | Hậu | #8 | 12/10 |
| FE-06 | `feature/auth-admin-foundation` | Nền tảng JWT, bảng `users`, `N8nService`, khung web admin | Hậu | #10 | 19/10 |
| FE-07 | `feature/followup-and-feedback` | Luồng 2 tự động, luồng 5 phân tích cảm nhận, module feedback | Hậu | #11 | 19/10 |
| FE-08 | `feature/sales-analytics-ai` | Luồng 4 báo cáo tuần bằng AI, quản lý nhà, trang admin hợp đồng | Hậu | #12 | 19/10 |
| FE-09 | `feature/rbac-user-management` | Giao diện quản trị tài khoản, ma trận phân quyền | Hậu | #13 | 19/10 |
| FE-10 | `feature/foundation-source-mautic` | PR-F1: cột `source` và `mautic`, webhook `lead-changed`, xử lý UTM trên web | Hậu | #17 | 21/10 |
| FE-11 | `feature/mautic-setup` | Hạ tầng Mautic 5, luồng 7 đồng bộ, sửa các lỗi phản hồi của luồng 7 | Hậu | #18, #19, #20 | 21–22/10 |
| FE-12 | `feature/thong-bao-telegram` | Sub-workflow "Thông báo nhân viên" qua Telegram | Hoàng | #21, #24 | 21/10, 28/10 |
| FE-13 | `feature/luong-8-mautic-feedback` | Luồng 8: Mautic báo về, cập nhật điểm | Hậu | #22 | 26/10 |
| FE-14 | `feature/luong-6-telegram-agent` | Luồng 6 Telegram Agent cho khách, lọc nhà, đổi DB sang pgvector | Hoàng | #23 | 27/10 |
| FE-15 | `feature/ci-cd-deploy` | GitHub Actions tự deploy lên VPS khi merge vào `main` | Hoàng | #25 | 29/10 |
| FE-16 | `feature/web-giao-dien-dot-1-2` | Làm mới giao diện web (đợt 1–5): component, ảnh và mô tả nhà, trang admin, PDF hợp đồng | Hoàng | #27, #29 | 29–30/10 |
| FE-17 | `feature/luong-2-va-mautic-web` | Luồng 2 chuyển WARM sang Mautic, tracking, hai trục điểm, ô đồng ý nhận tin | Hậu | #28 | 30/10 |
| FE-18 | `feature/rag-tri-thuc` | Luồng 6b nạp tri thức vào pgvector, tool "Hỏi đáp tri thức" cho luồng 6 | Hoàng | #32 | 03/11 |
| FE-19 | `feature/FE-19-close-booking-gaps` | Vá 12 lỗ hổng từ đặt lịch đến đặt cọc (OpenSpec `close-booking-to-deposit-gaps`) | Hoàng | #35 | 03/11 |
| FE-29 | `feature/luong-2-va-mautic-web` (lần 2) | Backend follow-up (module `followups`, bảng `followup_tasks`, test), làm lại luồng 2, 7, 8 | Hậu | (merge trực tiếp, `202d8b3`) | 03/11 |
| FE-31 | `feature/FE-31-chi-tiet-nha` | Trang chi tiết nhà đầy đủ: nhiều ảnh, xem 360°, thông tin cơ bản, tiện ích, nội thất, bản đồ; form nhập ở Quản lý nhà | Hoàng | #44 | 05/11 |
| FE-26 | `feature/FE-26-web-dien-thoai` | Web khách và admin trên điện thoại theo checklist ui-ux-pro-max. Quy ước: `docs/giao-dien-web.md` | Hoàng | #45 | 05/11 |
| FE-22 | `feature/FE-22-mautic-server` | Cấu hình Mautic trên server (field `ai_nudge_text`, segment "Nuôi WARM", email, campaign), tài liệu `docs/mautic-setup.md`, biên bản nghiệm thu local và bàn giao server | Hậu | #48, #66 | 05/11, 11/11 |
| FE-30 | `feature/FE-30-l2-quy-tac-0411` | Luồng 2 theo quy tắc 4/11: lead quá giờ hẹn vẫn `NEW` thì `LOST` (`EXPIRED`) và báo quản lý; luồng 4 đếm `EXPIRED` | Hậu | #47 | 06/11 |
| FE-32 | `feature/FE-32-l6-guardrails` | Luồng 6 đủ bước theo bài Agentic AI: Guardrails, phân loại ý định, tool Think, báo sale, ghi log hội thoại (`chat_logs`) | Hoàng | #53 | 06/11 |
| FE-21 | `feature/FE-21-mautic-form-nhan-tin` | Form đăng ký bản tin Mautic trên web khách | Hậu | #46 | 10/11 |
| FE-23 | `feature/FE-23-l4-nguon-chien-dich` | Luồng 4 thêm số liệu theo nguồn khách và chiến dịch | Hậu | #57 | 10/11 |
| FE-33 | `feature/FE-33-nen-tiep-nhan` | PR nền quy trình 1: một khách một lead theo số điện thoại, người phụ trách, chia sale lần lượt, chuyển sale, ghi chú, SQL `fe-33-intake.sql` | Hậu | #60 | 10/11 |
| FE-34 | `feature/FE-34-buoi-xem-khung-gio` | Khách cũ đặt thêm lịch trên cùng lead, huỷ hoặc không đến không đóng lead, khung giờ đã kín, giới hạn giờ hẹn | Hoàng | #61 | 10/11 |
| FE-39 | `feature/FE-39-admin-phu-trach` | Web admin: người phụ trách, chuyển sale, ghi chú, công tắc "Đang nhận khách" | Hậu | #63 | 11/11 |
| FE-38 | `feature/FE-38-l2-han-phan-hoi` | Luồng 2 báo quản lý khi quá 2 giờ làm việc; follow-up từng buổi xem; luồng 4 đếm theo khách, nguồn, sale | Hậu | #64 | 11/11 |
| FE-40 | `feature/FE-40-l7-khong-email` | Luồng 7 đồng bộ lead không có email sang Mautic | Hậu | #65 | 11/11 |
| FE-37 | `feature/FE-37-them-khach` | Web admin: form "Thêm khách" cho khách ngoài hệ thống | Hoàng | #67 | 11/11 |
| FE-35 | `feature/FE-35-l1-bao-sale-phu-trach` | Luồng 1 tách chấm điểm khỏi duyệt lịch, nút Duyệt tới giờ hẹn, luồng 1b, thông báo gửi sale phụ trách. Merge cùng PR của FE-36 | Hoàng | #68 | 11/11 |
| FE-36 | `claude/apply-fe-36-2c9d78` | Luồng 6: bot lưu liên hệ khi khách để lại số, báo sale phụ trách, gắn lịch sử chat vào lead | Hoàng | #68 | 11/11 |
| FE-41 | `feature/FE-41-sale-mau` | Thêm 10 sale demo vào `SEED_USERS` | Hoàng | #73 | 11/11 |
| FE-42 | `feature/FE-42-doi-sale` | Trang "Đội sale" cho quản lý và ô lọc "Phụ trách" ở trang Khách hàng | Hoàng | #75 | 12/11 |
| FE-51 | `feature/l4-sale-va-can-nha` (đặt tên trước khi có mã) | Luồng 4 thêm hiệu suất sale bản gọn và hiệu quả từng căn nhà. [L4 sale/căn nhà](luong/luong-4-sale-va-can-nha.md) | Hậu | #78 | 13/11 |
| FE-52 | `feature/l5-theo-doi-sau-phan-hoi` (đặt tên trước khi có mã) | Theo dõi sau phản hồi: mỗi phản hồi tạo một việc cho sale có hạn, nhắc, báo quản lý; trang `/admin/theo-doi-phan-hoi`. [L5 theo dõi phản hồi](luong/luong-5-theo-doi-sau-phan-hoi.md) | Hậu | #79 | 13/11 |

FE-48 đã xong một phần ở PR #82 (13/11, nhánh `feature/hop-dong-chon-can-soan-lai`): sale chọn căn khi lập hợp đồng, soạn lại và huỷ hợp đồng kẹt. Phần còn lại ở mục 3.2.

### Sửa lỗi (BF)

| Mã | Nhánh | Việc | Ai | PR | Merge |
|---|---|---|---|---|---|
| BF-01 | `fix/n8n-failed-callback` | Nhánh lỗi báo FAILED, URL gọi ngược sang `backend:8081` | Hoàng | #5 | 09/10 |
| BF-02 | `fix/n8n-luong-2-switch-fallback` | Luồng 2: Switch dùng fallback `extra` | Hậu | (merge trực tiếp, `7b21c70`) | 15/10 |
| BF-03 | `fix/compose-env-auth` | Truyền `JWT_SECRET`, `SEED_USER_PASSWORD` vào backend | Hoàng | #15 | 19/10 |
| BF-04 | `fix/mautic-url-env` | Luồng 7 đọc URL Mautic từ `MAUTIC_URL` | Hoàng | #26 | 29/10 |
| BF-06 | `bugfix/BF-06-chan-khong-mua-khi-dang-coc` | Chặn "Không mua" khi lead đang `DEPOSIT` ở backend và web | Hoàng | #40 | 04/11 |
| BF-08 | `bugfix/FE-22-fix-mautic-server` (đặt tên trước khi có mã) | Worker và cron Mautic chạy nhầm vai trò web (thiếu `DOCKER_MAUTIC_ROLE`) | Hậu | #49 | 06/11 |
| BF-07 | `bugfix/BF-07-mautic-tracking-va-nguong` | Chặn tracking/referrer trên các link riêng, thống nhất ngưỡng HOT từ 70 | Hậu | #56 | 10/11 |

BF-05 đã cấp cho việc nâng Next.js rồi bỏ (chuyển thành HF-01), không dùng lại.

### Sửa gấp production (HF)

| Mã | Nhánh | Việc | Ai | PR | Merge |
|---|---|---|---|---|---|
| HF-01 | `hotfix/HF-01-nang-cap-nextjs` | Nâng Next.js 16.4.0 → 16.4.4 vá lỗi RCE và DoS. Tag `v0.2.1`, đồng bộ về `dev` ở PR #38 | Hoàng | #37 | 04/11 |

### Tài liệu (DC)

| Mã | Nhánh | Việc | Ai | PR | Merge |
|---|---|---|---|---|---|
| DC-01 | `docs/dong-bo-hop-dong` | Đồng bộ hợp đồng API, thêm quy tắc phối hợp | Hoàng | #2 | 09/10 |
| DC-02 | `docs/ke-hoach-tuan-2` | Kế hoạch tuần 2, tổng quan dự án | Hoàng | #6 | 12/10 |
| DC-07 | `docs/DC-07-nghiep-vu-dat-lich-den-dat-coc` | Thư mục `docs/nghiep-vu/` (bản đầu) | Hoàng | #39 | 04/11 |
| DC-09 | `docs/DC-09-trien-khai` | `docs/trien-khai.md` và bản đồ tài liệu trong `README.md` | Hoàng | #42 | 04/11 |
| DC-13 | `docs/DC-13-tiep-nhan-phan-cong` | Quy trình 1 tiếp nhận và phân công sale, danh sách lỗ hổng | Hoàng | #58 | 09/11 |
| DC-03 | `docs/DC-03-tai-lieu-luong` | Tài liệu cả 12 luồng theo một khung chung, `api-contract.md`, `tong-quan-du-an.md` | Hoàng | #69 | 11/11 |
| DC-14 | `docs/DC-14-ke-hoach-hanh-trinh` | Kế hoạch hành trình khách, lỗ hổng quy trình 2 và 3, change `journey-followup-ladder` | Hoàng | #81 | 13/11 |
| DC-15 | `docs/DC-15-nghiep-vu-theo-4-ve` | Viết lại `docs/nghiep-vu/` theo 4 vế đề tài, thêm FE-53, FE-54, sửa logic FE-45 | Hoàng | #85 | 18/11 |

Các mã DC-04, DC-08, DC-10, DC-11, DC-12 cấp ngày 4/11 đã gộp vào DC-03, DC-07, DC-09, không dùng lại.

### Cấu hình, quy trình (CH)

| Mã | Nhánh | Việc | Ai | PR | Merge |
|---|---|---|---|---|---|
| CH-01 | `claude/magical-albattani-4a06ae` | Dọn tài liệu tuần cũ, sửa nhỏ `viewings.service` | Hoàng | #14 | 19/10 |
| CH-02 | `claude/source-analysis-integration-proposal-831874` | Kế hoạch tích hợp Mautic, Agentic AI và app | Hoàng | #16 | 20/10 |
| CH-03 | `chore/quy-trinh-git` | Chuyển sang git-flow (`dev` → `main`), CI kiểm tra PR, PR template | Hoàng | #31 | 03/11 |
| CH-04 | `chore/sua-quy-trinh-merge` | Mọi PR dùng "Create a merge commit" | Hoàng | #33 | 03/11 |
| CH-05 | `chore/CH-05-danh-sach-task` | File danh sách task và mã nhánh | Hoàng | #34 | 03/11 |
| CH-06 | `chore/CH-06-sua-npm-test` | Sửa `npm test` của backend, CI chạy "Backend test" | Hoàng | #41 | 04/11 |
| CH-07 | `chore/CH-07-to-mau-node` | Tô màu nhóm node cho 12 workflow n8n | Hoàng | #54 | 06/11 |
| CH-08 | `chore/CH-08-skill-ui-ux` | Skill `ui-ux-pro-max` trong `.claude/skills/` | Hoàng | #62 | 11/11 |
| CH-09 | `chore/CH-09-cap-ma-hanh-trinh` | Cấp mã hành trình khách, đăng ký FE-51, FE-52, dời app Expo | Hoàng | #80 | 13/11 |
| CH-10 | `chore/ci-docker-hub-push` (đặt tên trước khi có mã) | CI build image backend và web, đẩy lên Docker Hub, server chỉ pull | Hoàng | #83 | 14/11 |
| CH-11 | `chore/CH-11-chia-lai-task` | Dọn sổ task: chuyển task đã merge sang mục 4, bỏ chia theo tuần, xếp việc còn lại theo phụ thuộc, cấp CH-10 đến CH-12, DC-16, BF-09, FE-55, FE-56, chốt 9 điểm review DC-15 của Hậu | Hoàng | #86 | 18/11 |

Việc nhỏ không cấp mã: PR #59 (cài OpenSpec), #70, #72 (đóng task OpenSpec), #76 (tách phần lõi đề tài và phần mở rộng Mautic).

### Nhánh cũ không có PR riêng

Đã vào `main` trước khi dùng PR cho mọi thay đổi hoặc gộp qua PR của nhánh khác, nên không cấp mã: `feature/n8n-luong-1`, `feature/n8n-luong-1-push`, `feature/n8n-luong-1b`, `feature/n8n-error-workflow`, `feature/web-khu-khach`, `feature/web-lead-detail`, `feature/contracts-luong-3`, `fix/validate-dat-lich`, `fix/viewing-lost-update`, `docs/don-tuan-1-2`, `docs/ke-hoach-tich-hop`.

### Nhánh cũ chưa merge

| Nhánh | Xử lý |
|---|---|
| `docs/luong-hoang` | Nội dung đã vào DC-03, xoá nhánh |
| `docs/api-contract-hoang` | Nội dung đã vào DC-03, xoá nhánh |

Lệnh xoá nhánh cũ xem mục 8 của `quy-trinh-git.md`.

## 5. Mã tiếp theo

| Loại | Mã tiếp theo |
|---|---|
| FE | FE-57 (FE-27, FE-28 giữ chỗ cho app Expo) |
| BF | BF-10 |
| HF | HF-02 |
| DC | DC-17 (DC-05, DC-06 đã cấp cho báo cáo) |
| CH | CH-13 |
