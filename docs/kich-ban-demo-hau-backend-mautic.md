# Kịch bản demo phần Hậu: Backend, chăm sóc khách và Mautic

Người trình bày: Hậu. Phạm vi: backend và các luồng L2, L4, L5, L7, L8 theo tài liệu phân công. L1, L1b, L3, L6 là điểm phối hợp với phần Hoàng.

Bản đầy đủ khoảng 15–20 phút; nếu cần 5 phút, dùng phần rút gọn cuối file. Mỗi bước gồm trang cần mở, thao tác, vị trí cần chỉ và lời thuyết trình.

## Chuẩn bị trước buổi demo

- Dùng một môi trường xuyên suốt: local hoặc server. Web, backend, database, n8n và Mautic phải kết nối đúng môi trường đó.
- Mở sẵn các tab bên dưới, đăng nhập tài khoản quản lý và tài khoản dịch vụ cần thiết.
- Dùng dữ liệu thử với email của người tham gia thử nghiệm. Không gửi email demo tới khách thật.
- Chuẩn bị các khách riêng: DEMO-NHAC-LICH, DEMO-CAM-NHAN, DEMO-WARM và DEMO-CHO-DUYET. Mỗi hồ sơ nên có email riêng để minh họa các contact độc lập; dùng chung email có thể cập nhật cùng contact Mautic.
- Với L2 mới: cập nhật backend có API `/api/followups` và bảng `followup_tasks` trước khi import workflow. Chọn credential và sub-workflow thật, publish các workflow cần dùng.
- Chuẩn bị dữ liệu đúng thời gian trước buổi trình bày. Không bỏ bộ lọc để ép chạy, không đổi đồng hồ máy. Không chạy script tạo dữ liệu cũ vào database chung nếu chưa kiểm tra nội dung.
- Mautic cần field `ai_nudge_text`, segment nhận tag `nuoi-warm`, campaign và email đã cấu hình, cron/worker hoạt động.
- Có ảnh/video của lần chạy thành công để dự phòng. Khi dùng phải nói rõ là kết quả lần thử trước.
- Không chiếu mật khẩu, credential, header secret hoặc URL chứa token.

| Tab | Địa chỉ local tham khảo |
|---|---|
| Web khách | http://localhost:3000 |
| Danh sách khách | http://localhost:3000/admin/leads |
| Báo cáo | http://localhost:3000/admin/bao-cao |
| Swagger backend | http://localhost:8081/api/docs |
| n8n | http://localhost:5678 |
| Mautic | http://localhost:8082 |
| Kênh nhận kết quả | Gmail và Telegram đã cấu hình |

Thay địa chỉ theo môi trường và cổng thực tế. Không trộn Mautic server với credential Mautic local.

## Bước 1 — Giới thiệu tại danh sách khách (1 phút)

**Mở trang:** `http://localhost:3000/admin/leads`.

**Chỉ vào:** tên khách, trạng thái bán hàng, điểm AI, điểm tương tác Mautic và tình trạng xử lý.

**Nói:**

> Em là Hậu, phụ trách backend và các luồng chăm sóc khách, phân tích cảm nhận, báo cáo và tích hợp Mautic. Sau khi khách đăng ký xem nhà, hệ thống cần biết khách đang ở bước nào, lúc nào cần chăm sóc và khi nào nên báo nhân viên liên hệ lại. Đây là phần em sẽ trình bày.

**Chuyển tiếp:** bấm tên một khách để mở chi tiết.

## Bước 2 — Giải thích công nghệ qua hồ sơ khách (1 phút)

**Mở trang:** chi tiết khách vừa chọn.

**Chỉ vào:** thông tin khách, lịch xem và dòng thời gian. Chưa cần mở code.

**Nói:**

> Giao diện dùng Next.js và React. Khi người dùng thao tác, giao diện gọi API của backend NestJS. Backend kiểm tra dữ liệu, quyền truy cập và quy tắc nghiệp vụ, rồi lưu vào PostgreSQL thông qua TypeORM.
>
> n8n điều phối các tác vụ gọi AI, gửi email và đồng bộ Mautic. Gemini hỗ trợ phân tích nội dung; Mautic quản lý chiến dịch nuôi dưỡng. Có thể nhớ đơn giản: backend giữ dữ liệu và nghiệp vụ, n8n điều phối công việc, Mautic quản lý tiếp thị.

Nếu thầy hỏi thêm công nghệ:

| Công nghệ | Vai trò |
|---|---|
| NestJS + TypeScript | API, nghiệp vụ, kiểm tra đầu vào |
| TypeORM + PostgreSQL | Lưu khách, lịch xem, cảm nhận, sự kiện, báo cáo và tác vụ L2 |
| REST API + webhook | Giao tiếp giữa web, backend, n8n và Mautic |
| JWT và phân quyền | Xác thực người dùng và giới hạn quyền thao tác |
| Webhook secret | Xác thực các API nội bộ dành cho dịch vụ |
| n8n | Lịch chạy, rẽ nhánh, gọi dịch vụ và theo dõi execution |
| Gemini qua node AI của n8n | Soạn nội dung, phân tích phản hồi, nhận định báo cáo |
| Mautic 5 + MySQL | Contact, tag, segment, campaign và điểm tương tác; MySQL là database riêng của Mautic |
| SMTP và Telegram | Email nghiệp vụ và thông báo nhân viên |
| Docker Compose | Chạy các dịch vụ và cấu hình kết nối |
| Next.js + React | Giao diện khách và quản trị, thuộc phần giao diện chung của nhóm |

## Bước 3 — Cho xem API backend (30–45 giây)

**Mở tab:** `http://localhost:8081/api/docs`.

**Thao tác:** cuộn đến các API khách hàng, lịch xem, cảm nhận và báo cáo. Nếu backend mới đã cập nhật, chỉ thêm nhóm followups. Không cần chạy từng API hoặc nhập secret khi đang chiếu.

**Chỉ vào:** đường dẫn API và phương thức GET/POST/PUT.

**Nói:**

> Đây là tài liệu API của backend. Web và n8n dùng các API này để truy cập chức năng. Ví dụ, web gửi cảm nhận của khách, còn n8n gửi kết quả phân tích về backend. Việc cập nhật dữ liệu nghiệp vụ được kiểm soát tập trung.

**Chuyển tiếp:** quay lại tab hồ sơ khách.

## Bước 4 — Nêu điểm nối với phần Hoàng (30 giây)

**Mở trang:** hồ sơ khách đã được L1 xử lý.

**Chỉ vào:** AI score, mức HOT/WARM/COLD và lý do AI.

**Nói:**

> Khi khách đặt lịch, backend tiếp nhận dữ liệu và gọi luồng 1 để xử lý ban đầu. Luồng đặt lịch và chấm điểm ban đầu là phần phối hợp với bạn Hoàng. Phần của em tiếp tục sử dụng hồ sơ và kết quả đó để chăm sóc khách, đồng bộ Mautic và theo dõi tương tác.

Không cần chạy lại toàn bộ L1 nếu Hoàng đã demo trước.

## Bước 5 — L7: đồng bộ hồ sơ sang Mautic (2 phút)

**Mở trang:** hồ sơ khách thử trên web admin.

**Thao tác theo thứ tự:**

1. Dùng nút nghiệp vụ có sẵn để thực hiện một chuyển trạng thái hợp lệ. Ví dụ: với khách đang NEW và có lịch phù hợp, bấm Duyệt lịch xem nếu giao diện đang cho phép. Không chọn lại cùng trạng thái.
2. Sang tab n8n → mở `luong-7-dong-bo-mautic` → chọn **Executions** → mở lần chạy mới nhất đúng thời điểm vừa thao tác.
3. Chỉ đường chạy: Webhook → chuẩn hóa → Tìm Contact Mautic → tạo/cập nhật → lưu contact ID → ghi sự kiện.
4. Sang tab Mautic → **Contacts** → tìm đúng email khách → mở contact.
5. Quay lại hồ sơ backend và xem timeline.

**Chỉ vào:** contact đúng email, tag mức độ/trạng thái/nguồn và sự kiện `MAUTIC_SYNCED` ở backend.

**Nói khi mở n8n:**

> Khi thông tin nghiệp vụ thay đổi, backend phát sự kiện tới luồng 7. Luồng tìm contact đúng email: đã có thì cập nhật, chưa có thì tạo mới. Sau đó mã contact được lưu lại để liên kết hai hệ thống.

**Nói khi mở Mautic:**

> Đây là hồ sơ tương ứng bên Mautic. Tag giúp phân loại khách để dùng trong chiến dịch. Backend giữ hồ sơ nghiệp vụ, còn Mautic quản lý phần tiếp thị.
>
> Khi khách đã đặt cọc, ký hợp đồng hoặc mất khách, L7 gỡ tag nuôi WARM. Campaign phải được cấu hình để khách không còn thuộc nhóm nuôi thì ngừng nhận các bước tiếp theo.

**Nếu không có execution mới:** kiểm tra trạng thái đã thay đổi thật, workflow đã publish và backend trỏ đúng môi trường. Không mở URL webhook bằng thanh địa chỉ để thử vì trình duyệt gửi GET, trong khi webhook này nhận POST.

Không chỉ dựa vào dòng Succeeded: cần xem đường chạy có đi vào nhánh lỗi hay không và kết quả backend/Mautic.

## Bước 6 — L2: giải thích bốn công việc trước khi chạy (1 phút)

**Mở trang:** n8n → `luong-2-follow-up` → **Editor**.

**Chỉ vào:** trigger Mỗi giờ, Chạy tay và node Lấy lead cần follow-up.

**Nói:**

> Luồng 2 chạy mỗi giờ để tìm công việc đến hạn. Luồng có bốn nhánh: nhắc lịch xem, hỏi cảm nhận, chuyển khách WARM đủ điều kiện sang Mautic và nhắc nhân viên xử lý khách chờ lâu.
>
> Không phải tạo một khách WARM là luồng sẽ chạy. Hệ thống còn kiểm tra trạng thái, thời gian, lịch sử xử lý và sự đồng ý nhận tiếp thị.

| Tác vụ | Điều kiện chuẩn bị | Kết quả cần chứng minh |
|---|---|---|
| REMINDER | CONFIRMED, lịch xem trong 24 giờ tới, chưa nhắc lịch hiện tại | Email nhắc lịch, REMINDER_SENT |
| FEEDBACK | VIEWED và lịch qua hơn 2 giờ; hoặc CONFIRMED và lịch qua hơn 1 ngày; chưa hỏi và chưa phản hồi | Email chứa link cảm nhận, FEEDBACK_ASKED |
| WARM_NUDGE | WARM + VIEWED + đồng ý tiếp thị + đã hỏi cảm nhận hơn 3 ngày + chưa phản hồi + chưa bắt đầu nuôi | ai_nudge_text, tag nuoi-warm, WARM_NURTURE_STARTED |
| STAFF_NUDGE | HOT/WARM + NEW + tạo hơn 3 ngày + chưa nhắc nhân viên | Thông báo nhân viên, STAFF_NUDGE_SENT |

Không đọc hết SQL. Giải thích điều kiện rồi cho thấy kết quả thật. Các điều kiện về lỗi gần đây, tác vụ đã giữ hoặc cần REVIEW cũng có thể khiến khách chưa được chọn.

## Bước 7 — L2: chạy khách nhắc lịch (1–2 phút)

**Dữ liệu chuẩn bị:** khách CONFIRMED, lịch xem trong 24 giờ tới, chưa nhận nhắc lịch hiện tại.

**Thao tác theo thứ tự:**

1. Chạy L2 bằng trigger **Chạy tay**.
2. Mở output node **Lấy lead cần follow-up**, chọn Table hoặc JSON.
3. Chỉ trường `type = REMINDER`, tên khách và giờ xem.
4. Theo đường chạy đến node gửi email.
5. Sang Gmail → mở email nhắc lịch vừa nhận.
6. Quay lại hồ sơ khách → chỉ sự kiện `REMINDER_SENT` trong timeline.
7. Nếu còn thời gian, chạy lại để kiểm tra tác vụ đã hoàn tất không được gửi lại. Các khách khác đủ điều kiện vẫn có thể được xử lý.

**Nói:**

> Ở lần chạy này, hệ thống chọn khách có lịch xem sắp tới. Đầu ra xác định công việc là REMINDER nên dữ liệu đi vào nhánh nhắc lịch. Đây là email thực nhận, còn timeline ghi lại việc đã xử lý để nhân viên kiểm tra.

**Nếu đã triển khai bản L2 mới, nói thêm:**

> Trước khi gửi, backend kiểm tra lại điều kiện và giữ quyền xử lý tác vụ. Nếu có hai execution cùng chạy, chúng không cùng nhận một tác vụ đã được giữ. Nếu dịch vụ ngoài xác nhận thành công nhưng cập nhật dữ liệu lỗi, lần sau chỉ hoàn tất dữ liệu. Trường hợp kết quả gửi không rõ, tác vụ được đưa vào REVIEW để kiểm tra trước khi quyết định gửi lại.

**Nếu output NO_TASKS:**

> Hiện không có tác vụ đủ điều kiện. Em sẽ xem dữ liệu chẩn đoán để xác định thiếu điều kiện thời gian, trạng thái hay lịch sử xử lý. Đây không mặc nhiên là lỗi workflow.

Không trình bày cơ chế API tác vụ mới như bằng chứng live nếu backend và workflow mới chưa triển khai.

## Bước 8 — L2: chuyển WARM sang chiến dịch (1–2 phút)

**Mở trang:** hồ sơ DEMO-WARM, khác khách sẽ gửi cảm nhận ở bước sau.

**Chỉ vào các điều kiện đã chuẩn bị:** WARM, VIEWED, đồng ý tiếp thị, đã hỏi cảm nhận hơn ba ngày, chưa phản hồi và chưa bắt đầu nuôi.

**Nói:**

> Đây là khách đã xem nhà nhưng vẫn chưa phản hồi sau thời gian chờ. Khách có đồng ý tiếp thị nên hệ thống mới cho phép đưa vào nhánh nuôi dưỡng này.

**Thao tác theo thứ tự:**

1. Chạy L2 với dữ liệu đó, mở execution nhánh WARM.
2. Sang Mautic → Contacts → mở đúng contact.
3. Xem field `ai_nudge_text` và tag `nuoi-warm`.
4. Mở **Segments** → **Nuôi WARM** để kiểm tra thành viên.
5. Mở campaign tương ứng để giải thích chuỗi email đã cấu hình.
6. Nếu đã gửi, mở lịch sử campaign/email thực nhận.

**Nói:**

> L2 quyết định ai đủ điều kiện và chuẩn bị nội dung. Mautic nhận khách vào segment để thực hiện chuỗi email theo campaign. Email nhắc lịch là nghiệp vụ do n8n gửi; email nuôi dưỡng là chiến dịch do Mautic quản lý.

Chỉ nói email đã gửi khi có lịch sử gửi hoặc email thực nhận. Cập nhật segment/campaign có thể cần chờ cron và worker; có tag không có nghĩa campaign đã gửi email.

## Bước 9 — L5: khách gửi cảm nhận, AI gợi ý xử lý (2 phút)

**Mở trang:** Gmail của DEMO-CAM-NHAN → email hỏi cảm nhận → bấm link.

**Thao tác theo thứ tự:**

1. Chọn 4 sao, chọn xem căn khác.
2. Nhập: “Nhà phù hợp nhưng hơi xa nơi làm việc, tôi muốn xem căn gần trung tâm hơn.”
3. Bấm Gửi.
4. Sang n8n → `luong-5-cam-nhan` → Executions → mở lần chạy mới.
5. Quay lại web admin → hồ sơ khách → phần cảm nhận. Có thể cần chờ tải lại.
6. Mở email nhân viên nếu đã nhận.

**Chỉ vào:** phản hồi gốc, tóm tắt AI, gợi ý bước tiếp theo và sự kiện `FEEDBACK_RECEIVED` / `FEEDBACK_ANALYZED`.

**Nói:**

> Backend lưu phản hồi của khách trước, rồi gọi luồng 5 để AI phân tích. Trong ví dụ này, nhân viên biết khách vẫn quan tâm nhưng cần vị trí khác. AI giúp tóm tắt và gợi ý; nhân viên quyết định tư vấn căn nào tiếp theo.
>
> AI không tự quyết định khách đã đặt cọc hoặc tự tạo hợp đồng. Những thao tác nghiệp vụ đó vẫn cần người phụ trách xử lý.

Nếu có thời gian, dùng hồ sơ khác với 1–2 sao để minh họa nhánh cảnh báo quản lý. Không sửa phản hồi đã gửi chỉ để chạy lại cùng tình huống. Không dùng khách vừa phản hồi để chứng minh nhánh WARM chưa phản hồi.

## Bước 10 — L8: nhận tín hiệu tương tác trở lại (2 phút)

**Mở trang:** contact Mautic đã liên kết với lead backend.

**Thao tác theo thứ tự:**

1. Dùng tương tác campaign/tracking đã thử trước buổi demo. Hoặc gửi sự kiện thử hợp lệ qua công cụ gửi POST và nói rõ là mô phỏng.
2. Ví dụ: điểm backend ban đầu 10, sự kiện mới đưa lên 25 khi ngưỡng cấu hình là 20.
3. Sang n8n → `luong-8-mautic-bao-ve` → Executions → mở lần chạy mới.
4. Chỉ các bước xác thực → tìm lead → cập nhật điểm → ghi sự kiện → thông báo nhân viên.
5. Quay lại hồ sơ web → chỉ điểm Mautic đã cập nhật cạnh điểm AI.
6. Mở Telegram hoặc Gmail để xem thông báo thực nhận.

**Nói:**

> Luồng 7 đưa hồ sơ sang Mautic; luồng 8 nhận tín hiệu theo chiều ngược lại. Khi điểm vượt ngưỡng đã cấu hình, hệ thống báo nhân viên để cân nhắc liên hệ lại.
>
> Điểm AI phản ánh đánh giá mức phù hợp ban đầu; điểm Mautic phản ánh tương tác được ghi nhận. Hai điểm hỗ trợ nhân viên ưu tiên khách, không khẳng định chắc chắn khách sẽ mua.

**Nếu dùng dữ liệu thử, nói trước khi gửi:**

> Em dùng sự kiện thử để minh họa chiều dữ liệu Mautic báo về backend. Phần này chứng minh cách xử lý webhook, chưa phải bằng chứng tracking thật từ một lượt truy cập.

**Giới hạn cần hiểu:**

- Không phải cứ mở trang là tự tăng điểm: quy tắc điểm cần cấu hình riêng trong Mautic, tracking phải nhận diện được contact.
- L8 có thể báo nhân viên khi ghi nhận PAGE_HIT tới trang căn nhà thuộc website được cấu hình; không phải mọi pageview đều được báo.
- Mở email không chứng minh chắc chắn khách đã đọc.
- L8 hiện còn hạn chế về chống webhook trùng, sự kiện cũ ghi đè điểm và phục hồi thông báo. Không hứa xử lý đúng một lần hoặc luôn phản hồi trong một số giây cố định.

## Bước 11 — L4: tạo báo cáo cho quản lý (2 phút)

**Mở trang:** `http://localhost:3000/admin/bao-cao`, bằng tài khoản quản lý.

**Thao tác theo thứ tự:**

1. Bấm **Tạo báo cáo ngay**.
2. Trong lúc chờ, sang n8n → `luong-4-bao-cao`.
3. Chỉ node Số liệu tuần này, Số liệu tuần trước, Tính phễu và cảnh báo, AI Agent phân tích và Tra cứu cơ sở dữ liệu.
4. Quay lại web, mở báo cáo vừa tạo, kiểm tra đúng kỳ báo cáo.
5. Chỉ một chỉ số cụ thể, so sánh hai kỳ, cảnh báo và đề xuất. Đối chiếu chỉ số với dữ liệu đã chuẩn bị.

**Nói:**

> L4 giúp quản lý xem kết quả chung. SQL tính số liệu, các quy tắc cố định xác định cảnh báo, còn AI viết nhận định và đề xuất. Điểm khác của L4 là AI Agent có công cụ tra cứu thêm dữ liệu. Các luồng như L2 và L5 chủ yếu thực hiện bước AI trong quy trình đã xác định.
>
> Công cụ database cần dùng tài khoản chỉ đọc đã cấu hình quyền phù hợp, để hạn chế việc AI thực hiện thao tác ghi ngoài ý muốn.

Chỉ khẳng định tài khoản readonly đang được áp dụng khi đã kiểm tra credential và quyền thật; tên credential không chứng minh được quyền database.

**Nếu báo cáo chưa chạy xong:** mở báo cáo đã có và nói rõ ngày tạo, kỳ dữ liệu; không giới thiệu báo cáo cũ là kết quả vừa chạy.

## Bước 12 — Kết thúc tại hồ sơ khách hoặc dashboard (30 giây)

**Mở trang:** web admin, đóng các cửa sổ chi tiết node để người nghe thấy lại kết quả nghiệp vụ.

**Nói:**

> Phần của em kết nối quá trình chăm sóc khách từ backend đến tự động hóa: L7 đồng bộ hồ sơ, L2 chăm sóc đúng thời điểm, L5 xử lý cảm nhận, L8 nhận lại tín hiệu tương tác và L4 tổng hợp báo cáo.
>
> Kết quả là nhân viên giảm việc theo dõi thủ công, có lịch sử để kiểm tra và có thêm dữ liệu để quyết định. AI hỗ trợ phân tích; backend và người phụ trách vẫn kiểm soát nghiệp vụ.

Mỗi luồng chỉ cần chứng minh đầu vào → quyết định chính → kết quả. Không đọc hết node. Nếu một bước chờ lâu, chuyển sang bằng chứng chuẩn bị sẵn và nói rõ nguồn, thời điểm của bằng chứng đó.

## Câu hỏi phản biện thường gặp

### Vì sao cần cả n8n và backend?

> Backend kiểm soát nghiệp vụ, xác thực và dữ liệu. n8n điều phối lịch chạy, gọi AI, email và dịch vụ ngoài, đồng thời cho xem từng bước. Quy tắc quan trọng trước khi gửi của L2 được backend kiểm tra lại.

### Mautic khác n8n ở đâu?

> n8n điều phối công việc giữa các hệ thống. Mautic quản lý contact, phân khúc, chiến dịch tiếp thị và tương tác. Email nhắc lịch/cảm nhận do n8n gửi; email chiến dịch nuôi dưỡng do Mautic gửi.

### Tại sao không thấy mọi khách trong Mautic?

> Cần kiểm tra L7 có được gọi và đồng bộ thành công không, có đúng môi trường không, email có trùng contact cũ không. Số contact không nhất thiết bằng số lead backend.

### Chỉ cần khách WARM là gửi tiếp thị được không?

> Không. Nhánh hiện tại còn yêu cầu VIEWED, đồng ý tiếp thị, đã hỏi cảm nhận hơn ba ngày, chưa phản hồi và chưa bắt đầu nuôi. Điều kiện đồng ý là một biện pháp của hệ thống; không đủ để tự khẳng định toàn bộ hệ thống đáp ứng mọi yêu cầu pháp lý.

### Nếu AI lỗi thì sao?

> Các luồng có bước kiểm tra đầu ra và nội dung dự phòng theo thiết kế. Cần phân biệt lỗi AI có thể dùng mẫu với lỗi xác thực, database hoặc dịch vụ gửi vẫn phải ghi nhận và xử lý.

### Có bảo đảm không bao giờ gửi trùng không?

> L2 mới có khóa tác vụ và checkpoint để giảm gửi trùng, hỗ trợ phục hồi. SMTP vẫn có trường hợp kết quả không rõ khi mất phản hồi; hệ thống chuyển REVIEW. Không khẳng định gửi đúng một lần trên mọi dịch vụ ngoài.

### Nếu n8n dừng thì dữ liệu có mất không?

> Các thao tác đã ghi thành công vào backend vẫn còn trong database, nhưng bước tự động có thể chưa hoàn tất. Cần xem trạng thái và chạy phục hồi phù hợp. L2 không thay thế toàn bộ việc phục hồi L1 hoặc L7.

### Phần nào em làm, phần nào dùng công cụ có sẵn?

> Em triển khai API, dữ liệu và quy tắc tích hợp thuộc phạm vi backend; thiết kế các luồng L2/L4/L5/L7/L8 và cấu hình Mautic. n8n, Mautic, Gemini và NestJS là công nghệ sử dụng. Phần đặt lịch ban đầu, Telegram Agent và triển khai server phối hợp với bạn Hoàng theo phân công.

## Bản rút gọn khi chỉ có 5 phút

1. 30 giây: giới thiệu vai trò backend/n8n/Mautic.
2. 1 phút: hồ sơ backend → L7 → contact Mautic.
3. 1 phút: L2 nhắc lịch hoặc chuyển WARM, chỉ email/tag và timeline.
4. 1 phút: L8 → điểm trên web → thông báo; dùng kết quả chuẩn bị sẵn nếu cần và nói rõ đó là kết quả trước.
5. 1 phút: cảm nhận đã phân tích và báo cáo đã lưu, nêu vai trò L5/L4.
6. 30 giây: kết lại giá trị và ranh giới AI hỗ trợ/người quyết định.

## Các câu tránh nói khi chưa có bằng chứng

- “Hệ thống luôn xử lý dưới ba giây” — chỉ nêu thời gian đo được của lần thử cụ thể.
- “Tự động hoàn toàn, không bao giờ lỗi hoặc gửi trùng” — giải thích cơ chế xử lý lỗi và giới hạn.
- “Tất cả luồng đều là AI Agent” — phân biệt Agent có tool ở L4 với bước gọi mô hình trong quy trình cố định.
- “L2 tự khôi phục mọi luồng” — L2 chỉ xử lý các tác vụ mà nó quản lý.
- “Gắn tag là chắc chắn đã gửi email chiến dịch” — kiểm tra segment, campaign, cron, worker và lịch sử gửi.
- “Đã kiểm thử code nghĩa là đã chạy thành công trên server” — trình bày riêng kiểm tra tự động và bằng chứng chạy thật.
