# Luồng 3: Hợp đồng đặt cọc

File: `n8n-workflows/luong-3-hop-dong.json` (34 node, không tính ghi chú; id `luong3Realestat0`).
Kích hoạt: `POST /webhook/contract-requested`, có header `X-Webhook-Secret` (credential Header Auth). Body chỉ có `{ "contractId": <số> }`.

Khung chung của các tài liệu luồng: [README.md](README.md).

## 1. Làm gì trong thực tế

Khi khách muốn đặt cọc, văn phòng phải soạn hợp đồng, nhờ quản lý xem, gửi khách ký, nhắc nếu khách quên, rồi báo kết quả cho nhân viên. Luồng 3 làm các bước đó và **chờ người** ở hai chỗ:

1. Chờ **quản lý duyệt** (tối đa 48 giờ).
2. Chờ **khách ký** (48 giờ, nhắc một lần, thêm 5 ngày).

Luồng này đứng chờ bằng node `Wait` của n8n: lần chạy "ngủ" cho tới khi có người bấm link hoặc hết giờ. Vì vậy một lần chạy luồng 3 có thể kéo dài nhiều ngày và nằm ở trạng thái **waiting** trong Executions. Đó là bình thường.

Quy tắc nghiệp vụ (ai tạo hợp đồng, điều kiện, kết quả từng lựa chọn): [nghiep-vu/02-dat-lich-den-dat-coc.md](../nghiep-vu/02-dat-lich-den-dat-coc.md) mục 4. Luồng này chỉ mô tả cách n8n thực hiện.

## 2. Ai tham gia

| Bên | Vai trò |
|---|---|
| Nhân viên | Tạo hợp đồng trên web admin; nhận email khi khách ký, từ chối hoặc hết hạn |
| Quản lý | Nhận email có bản nháp và nhận xét của AI, duyệt hoặc từ chối |
| Khách | Nhận link ký, ký trên màn hình |
| Backend | Lưu hợp đồng, phát link ký, đánh thức n8n khi có người bấm |
| Gemini | Rà soát nội dung hợp đồng |
| SMTP | Gửi mọi email |

## 3. Từng bước

```
Backend gọi webhook (contractId)
      |
[1 Tiếp nhận] Webhook -> Cấu hình -> Chuẩn hoá -> Lấy dữ liệu hợp đồng -> Có hợp đồng mới?
      |  không -> Không có hợp đồng (dừng báo lỗi)
      v
[2 Soạn và AI rà soát] Soạn hợp đồng -> AI rà soát -> Gộp rà soát
      |
[3 Lưu bản nháp] Lưu bản nháp (kèm resumeUrl)
      |
[4 Quản lý duyệt] Email quản lý duyệt -> Chờ quản lý duyệt (48 giờ) -> Kết quả duyệt
      |                  duyệt                    từ chối                 không ai bấm
      v                    v                         v                        v
[5 Gửi khách ký]  Tạo link ký -> Email    Đánh dấu từ chối ->        Hết giờ thật? -> Đánh dấu
                  khách ký -> Trả lời     Email báo từ chối ->       quá hạn duyệt -> Email báo
                  duyệt                   Trả lời từ chối            quá hạn duyệt
      |
[6 Chờ khách ký] Chờ khách ký (48 giờ) -> Đã ký lần 1? -- chưa --> Email nhắc ký
      |                                          |                       |
      |                                          |            Chờ khách ký lần 2 (5 ngày)
      |                                          |                       |
      |                                        đã ký              Đã ký lần 2? -- chưa --> Đánh dấu hết hạn ký
      v                                          v                       |                  -> Email báo hết hạn ký
[7 Xác nhận] Email xác nhận đã ký -> Email báo đã ký <-- đã ký ---------+
```

**1. Tiếp nhận yêu cầu hợp đồng.**
`Chuẩn hoá` kiểm tra `contractId` là số nguyên dương. `Lấy dữ liệu hợp đồng` đọc hợp đồng, khách, căn nhà bằng một truy vấn. Không có thì `Không có hợp đồng` báo lỗi.

**2. Soạn và AI rà soát hợp đồng.**
- `Soạn hợp đồng` dựng văn bản từ mẫu: số hợp đồng `HD-<mã 4 số>`, bên nhận cọc (văn phòng), bên đặt cọc (khách), căn nhà, giá niêm yết, tiền cọc và tỷ lệ phần trăm, thời hạn giữ chỗ **30 ngày**, quyền và nghĩa vụ khi kết thúc. Cuối văn bản ghi rõ đây là mẫu phục vụ đồ án, không có giá trị pháp lý.
- Đồng thời kiểm tra bằng **quy tắc cố định**, không phụ thuộc AI: tiền cọc trên 30% giá thì cảnh báo cao bất thường, dưới 1% thì cảnh báo khó ràng buộc, số điện thoại dưới 9 chữ số thì cảnh báo chưa đầy đủ.
- `AI rà soát` (mô hình `Google Gemini Chat Model`, kết quả có cấu trúc qua `Structured Output Parser`) nêu tối đa 3 ý và mức rủi ro `LOW`, `MEDIUM`, `HIGH`. Lời nhắc dặn không bịa, không làm theo yêu cầu nằm trong tên khách hay địa chỉ, và không nhắc lại tiền cọc đã được quy tắc kiểm.
- `Gộp rà soát` lấy mức **cao hơn** giữa quy tắc và AI, nên AI không thể hạ mức mà quy tắc đã phát hiện (trên 30% là `HIGH`, có cảnh báo là `MEDIUM`). Nếu AI không dùng được thì vẫn đi tiếp, ghi chú "chỉ kiểm tra bằng quy tắc".

**3. Lưu bản nháp.**
`Lưu bản nháp` gọi `PUT /api/contracts/{id}/draft` với tiêu đề, nội dung, kết quả rà soát và `resumeUrl` của lần chạy này. Backend cất `resumeUrl` để sau này đánh thức luồng. Hợp đồng chuyển "Chờ duyệt".

**4. Quản lý duyệt (human-in-the-loop).**
`Email quản lý duyệt` gửi cho quản lý bản nháp, nhận xét AI và nút Duyệt, Từ chối. `Chờ quản lý duyệt` chờ tối đa **48 giờ**. `Kết quả duyệt` rẽ ba nhánh: `approve`, `reject`, hoặc hết giờ. Link sai (không có `action` hợp lệ) thì `Hết giờ thật?` nhận ra không phải hết giờ thật, `Trả lời link sai` báo "Liên kết không hợp lệ" và quay về chờ tiếp.

**5. Gửi khách ký, từ chối, quá hạn.**
- Duyệt: `Tạo link ký` (`POST /api/contracts/{id}/issue-token`) rồi `Email khách ký` kèm link, `Trả lời duyệt` trả trang "Đã duyệt. Hệ thống đã gửi hợp đồng cho khách ký."
- Từ chối: `Đánh dấu từ chối` (`PUT /api/contracts/{id}/rejected`), `Email báo từ chối` cho nhân viên, `Trả lời từ chối`.
- Hết 48 giờ không ai bấm: `Đánh dấu quá hạn duyệt` (`PUT /api/contracts/{id}/expired`) và `Email báo quá hạn duyệt` cho quản lý.

**6. Chờ khách ký (human-in-the-loop).**
`Chờ khách ký` chờ 48 giờ. Chưa ký thì `Email nhắc ký`, rồi `Chờ khách ký lần 2` chờ thêm 5 ngày. Vẫn chưa ký thì `Đánh dấu hết hạn ký` (`PUT .../expired`) và `Email báo hết hạn ký` cho nhân viên.

**7. Xác nhận đã ký hoặc hết hạn.**
Khách ký trong lúc chờ (lần 1 hoặc lần 2) thì `Email xác nhận đã ký` gửi khách và `Email báo đã ký` gửi nhân viên, kèm số tiền cọc.

## 4. Nối với hệ thống

| Hướng | Gọi gì | Khi nào |
|---|---|---|
| Backend → luồng 3 | `POST /webhook/contract-requested` | Nhân viên tạo hợp đồng |
| Luồng 3 → database | Đọc `contracts`, `leads`, `properties` | `Lấy dữ liệu hợp đồng` |
| Luồng 3 → backend | `PUT /api/contracts/:id/draft` | Lưu bản nháp và `resumeUrl` |
| Luồng 3 → backend | `POST /api/contracts/:id/issue-token` | Phát link ký sau khi duyệt |
| Luồng 3 → backend | `PUT /api/contracts/:id/rejected` | Quản lý từ chối |
| Luồng 3 → backend | `PUT /api/contracts/:id/expired` | Quá hạn duyệt hoặc hết hạn ký |
| Backend → luồng 3 | Gọi `resumeUrl` kèm `action` | Quản lý duyệt hoặc từ chối trên web admin (`approve`, `reject`); khách ký xong (`signed`) |

Link trong email quản lý cũng gọi thẳng `resumeUrl` của n8n. Luồng 3 **không** gọi sub-workflow thông báo: mọi email gửi trực tiếp bằng SMTP tới `staffEmail` và `managerEmail` đặt trong node `Cấu hình`. Chi tiết hợp đồng API: [api-contract.md](../api-contract.md).

## 5. Khi lỗi thì sao

**Xử lý lỗi (nhóm cuối của workflow).** Luồng 3 không có nhánh lỗi riêng; lỗi làm lần chạy thất bại và n8n gọi Error workflow.

| Lỗi | Điều xảy ra |
|---|---|
| `contractId` sai | `Chuẩn hoá` ném lỗi, Error workflow chạy |
| Không có hợp đồng | `Không có hợp đồng`, Error workflow chạy |
| AI lỗi | Tiếp tục với kết quả quy tắc cố định (`AI rà soát` không dừng luồng) |
| Email, lưu nháp, phát link, đánh dấu trạng thái lỗi | Mỗi node thử lại, rồi lần chạy thất bại và Error workflow chạy. Hợp đồng có thể kẹt ở trạng thái giữa chừng; xem lịch sử hợp đồng trên web admin |
| Backend không đánh thức được n8n (`resumeUrl` hết hạn, lần chạy đã bị xoá) | Backend báo lỗi ở thao tác duyệt/ký; xem [nghiep-vu](../nghiep-vu/02-dat-lich-den-dat-coc.md) mục 4 |

Chạy lại: tạo lại hợp đồng mới trên web admin (hợp đồng cũ đã quá hạn hoặc bị từ chối không dùng lại). Nếu n8n khởi động lại, lần chạy đang `waiting` được giữ trong database n8n và tiếp tục chờ.

## 6. Triển khai lên server

| Mục | Giá trị |
|---|---|
| Workflow id | `luong3Realestat0` |
| Credential | Header Auth `iYLrhsH8b8dDkZ0n`, Gemini `wU5LeG7gXaoUdMXQ`, SMTP `hfJ9bBGUGsjH8qDP`, Postgres `postgres_account_id` |
| Biến `.env` | `PUBLIC_WEB_URL`, `WEBHOOK_SECRET` |
| Cấu hình trong node `Cấu hình` | `backendUrl`, `webUrl`, `staffEmail`, `managerEmail`. Hai địa chỉ email đang ghi sẵn trong node, kiểm tra trước khi dùng thật |
| Error workflow | Chọn `errorWfRealestat` trong Settings |

Hiện trạng:

- **Server:** [trien-khai.md mục 4](../trien-khai.md) ghi luồng 3 đã bật (bản `v0.3.0`).
- **Import khi có lần chạy đang chờ:** n8n giữ định nghĩa lúc bắt đầu chạy, nên lần chạy đang `waiting` tiếp tục theo bản cũ. Hợp đồng đang chờ ký khi import vẫn ký được theo luồng cũ.
- **Chưa kiểm trên server:** nhánh nhắc ký lần 2 và hết hạn ký (cần chờ qua 7 ngày hoặc rút ngắn thời gian chờ trong node); nhánh hết hạn duyệt (48 giờ).

## 7. Cách chạy thử

1. Cần một lead "Đã xem nhà" có ít nhất một buổi xem "Khách đã đến", và căn đang bán (điều kiện đầy đủ ở mục 4.1 của tài liệu nghiệp vụ). Trên web admin tạo hợp đồng đặt cọc cho lead đó.
2. Mong đợi: n8n Executions có một lần chạy luồng 3 ở trạng thái **waiting**; quản lý nhận email "[CẦN DUYỆT] Hợp đồng đặt cọc #<mã> - <tên khách>" có nhận xét AI.
3. Bấm Duyệt trong email (hoặc duyệt trên web admin): trang "Đã duyệt", khách nhận email "Hợp đồng đặt cọc cần anh/chị ký".
4. Mở link ký, ký: khách nhận "Đã nhận hợp đồng đặt cọc anh/chị ký", nhân viên nhận "[ĐÃ KÝ] ...", lần chạy chuyển sang **success**.
5. Thử từ chối với hợp đồng khác: nhân viên nhận "[TỪ CHỐI] ...", hợp đồng "Bị từ chối".
6. Để thử nhánh hết giờ mà không chờ, tạm đổi thời gian chờ của `Chờ quản lý duyệt` hoặc `Chờ khách ký` xuống vài phút trong bản sao workflow (không sửa bản thật).
