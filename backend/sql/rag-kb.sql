-- Tài liệu kiến thức (Knowledge Base) cho công cụ RAG của Luồng 6 (Telegram Agent).
--
-- File này tạo bảng kb_documents và nạp 10 tài liệu hỏi-đáp bằng tiếng Việt,
-- hướng đến khách hàng của văn phòng môi giới RealEstate AI. Mỗi tài liệu tập trung
-- một chủ đề để việc truy xuất (retrieval) chính xác hơn.
--
-- Idempotent: chạy lại bất kỳ lúc nào cũng được; ON CONFLICT cập nhật nội dung
-- mà không tạo bản ghi trùng.
--
-- Chạy:
--   docker cp backend/sql/rag-kb.sql realestate-db:/tmp/rag-kb.sql
--   MSYS_NO_PATHCONV=1 docker exec realestate-db psql -U realestate -d realestate -v ON_ERROR_STOP=1 -f /tmp/rag-kb.sql

CREATE TABLE IF NOT EXISTS kb_documents (
  id          serial          PRIMARY KEY,
  slug        varchar(100)    UNIQUE NOT NULL,
  title       varchar(255)    NOT NULL,
  category    varchar(50)     NOT NULL,
  content     text            NOT NULL,
  updated_at  timestamptz     NOT NULL DEFAULT now()
);

-- ─── Tài liệu 1: Giới thiệu văn phòng ──────────────────────────────────────

INSERT INTO kb_documents (slug, title, category, content)
VALUES (
  'gioi-thieu-van-phong',
  'Giới thiệu văn phòng và loại bất động sản',
  'gioi-thieu',
  $kb$Chúng tôi là văn phòng môi giới bất động sản RealEstate AI, hoạt động tại Việt Nam. Chúng tôi ứng dụng công nghệ tự động hoá kết hợp với đội ngũ nhân viên tư vấn giàu kinh nghiệm, giúp anh/chị trải qua toàn bộ hành trình từ tìm kiếm nhà, đặt lịch xem, cho đến ký hợp đồng cọc một cách thuận tiện và nhanh chóng.

Danh mục của chúng tôi hiện có các bất động sản tại nhiều khu vực như Thành phố Hồ Chí Minh, Hà Nội, Đà Nẵng và Phú Quốc, với nhiều loại hình khác nhau. Thông tin chi tiết về từng căn, bao gồm giá, diện tích và tiện ích, được cập nhật và hiển thị trực tiếp trên trang web. Vì giá và tình trạng căn có thể thay đổi, nhân viên sẽ xác nhận lại thông tin mới nhất khi anh/chị liên hệ.

Anh/chị có thể duyệt danh sách bất động sản, lọc theo khu vực hoặc ngân sách ngay trên trang web. Nếu quan tâm đến một căn cụ thể, anh/chị có thể đặt lịch xem nhà trực tiếp từ trang chi tiết đó, hoặc nhắn tin qua Telegram bot để được hỗ trợ. Hệ thống sẽ tự động ghi nhận yêu cầu và thông báo đến nhân viên có thẩm quyền duyệt lịch.

Nếu anh/chị chưa tìm thấy căn phù hợp trong danh sách hiện có, hãy liên hệ để nhân viên gợi ý thêm theo nhu cầu và ngân sách cụ thể. Chúng tôi luôn sẵn sàng hỗ trợ anh/chị tìm được căn nhà ưng ý.$kb$
)
ON CONFLICT (slug) DO UPDATE SET
  title      = EXCLUDED.title,
  category   = EXCLUDED.category,
  content    = EXCLUDED.content,
  updated_at = now();

-- ─── Tài liệu 2: Quy trình đặt lịch xem nhà ────────────────────────────────

INSERT INTO kb_documents (slug, title, category, content)
VALUES (
  'quy-trinh-dat-lich',
  'Quy trình đặt lịch xem nhà',
  'quy-trinh',
  $kb$Anh/chị có thể đặt lịch xem nhà theo hai cách: điền form trên trang web hoặc nhắn tin cho Telegram bot của chúng tôi.

Đặt lịch qua trang web: mở trang chi tiết của căn nhà anh/chị muốn xem, kéo xuống phần form đặt lịch và điền đầy đủ các thông tin sau: họ tên, địa chỉ email, số điện thoại, ngân sách dự kiến (đơn vị VND), mô tả nhu cầu nếu muốn, và thời gian anh/chị mong muốn xem nhà. Có hai ô đồng ý ở cuối form. Ô "Đồng ý xử lý dữ liệu cá nhân" là bắt buộc theo quy định tại Nghị định 13/2023/NĐ-CP. Ô "Nhận thông tin thị trường" là tuỳ chọn.

Sau khi gửi form, màn hình hiển thị mã xác nhận và hệ thống gửi email thông báo đã nhận yêu cầu đến địa chỉ anh/chị vừa nhập. Đội ngũ nhân viên sẽ xem xét và duyệt lịch. Khi nhân viên duyệt, anh/chị nhận email xác nhận lịch xem với đầy đủ thông tin về căn nhà, giờ hẹn và một đường dẫn để tự quản lý lịch (huỷ hoặc xin đổi giờ nếu cần).

Đặt lịch qua Telegram bot: nhắn tin trực tiếp cho bot, bot sẽ hỏi lần lượt các thông tin cần thiết, tóm tắt lại để anh/chị xác nhận rồi gửi yêu cầu đặt lịch. Anh/chị cũng sẽ nhận email xác nhận sau khi nhân viên duyệt, tương tự như đặt qua web.

Lưu ý: căn nhà đang trong giai đoạn đặt cọc (hiển thị trạng thái "Đã có người đặt cọc") sẽ không nhận lịch xem mới cho đến khi được mở lại. Căn đã bán hoặc tạm ẩn sẽ không hiển thị trên trang web.$kb$
)
ON CONFLICT (slug) DO UPDATE SET
  title      = EXCLUDED.title,
  category   = EXCLUDED.category,
  content    = EXCLUDED.content,
  updated_at = now();

-- ─── Tài liệu 3: Quản lý, huỷ và xin đổi lịch ──────────────────────────────

INSERT INTO kb_documents (slug, title, category, content)
VALUES (
  'quan-ly-lich-xem',
  'Quản lý lịch xem: huỷ lịch và xin đổi giờ',
  'quy-trinh',
  $kb$Sau khi nhân viên duyệt lịch, email xác nhận gửi đến anh/chị có kèm một đường dẫn quản lý lịch riêng. Đường dẫn này cho phép anh/chị tự huỷ lịch hoặc gửi yêu cầu đổi sang giờ khác mà không cần gọi điện hay gửi email riêng.

Huỷ lịch: anh/chị nhấn "Huỷ lịch" trên trang quản lý bất kỳ lúc nào trước khi buổi xem diễn ra. Sau khi huỷ thành công, trang hiển thị thông báo xác nhận và lịch hẹn sẽ bị đóng lại.

Xin đổi giờ: nhấn "Xin đổi lịch", điền ghi chú nêu rõ ngày, giờ hoặc khoảng thời gian mong muốn rồi gửi yêu cầu. Anh/chị không cần chọn một khung giờ cụ thể ngay trên form; nhân viên sẽ nhận được thông báo và liên hệ anh/chị để trao đổi và sắp xếp giờ mới phù hợp. Sau khi lịch được cập nhật, anh/chị nhận email mới với giờ hẹn đã thay đổi.

Sau khi buổi xem đã diễn ra hoặc giờ hẹn đã qua, đường dẫn quản lý lịch sẽ không cho phép thay đổi nữa. Trường hợp cần hỗ trợ ngoài khung giờ đó, anh/chị có thể gửi email cho nhân viên.

Lưu ý bảo mật: đường dẫn quản lý lịch là riêng tư và chỉ dành cho anh/chị. Vui lòng không chia sẻ đường dẫn này cho người khác để tránh lịch hẹn bị huỷ ngoài ý muốn.$kb$
)
ON CONFLICT (slug) DO UPDATE SET
  title      = EXCLUDED.title,
  category   = EXCLUDED.category,
  content    = EXCLUDED.content,
  updated_at = now();

-- ─── Tài liệu 4: Không đến được buổi xem ───────────────────────────────────

INSERT INTO kb_documents (slug, title, category, content)
VALUES (
  'khong-den-duoc-buoi-xem',
  'Nếu không thể đến buổi xem đã hẹn',
  'quy-trinh',
  $kb$Nếu có việc đột xuất và không thể đến đúng giờ đã hẹn, anh/chị nên chủ động báo trước để chúng tôi sắp xếp lại.

Báo trước qua đường dẫn quản lý lịch: mở đường dẫn trong email xác nhận, chọn "Xin đổi lịch" và điền ghi chú về thời gian mong muốn. Nhân viên sẽ liên hệ sắp xếp lại buổi xem cho anh/chị. Anh/chị cũng có thể chọn "Huỷ lịch" nếu không còn nhu cầu xem căn đó nữa.

Trường hợp không mở được đường dẫn, anh/chị gửi email cho chúng tôi để nhân viên sắp xếp lại.

Nếu anh/chị vắng mặt mà không liên hệ trước: nhân viên sẽ ghi nhận tình trạng vắng mặt và sau đó liên hệ anh/chị để hỏi thêm. Tuỳ vào phản hồi, nhân viên có thể đề nghị sắp xếp lại buổi xem vào thời gian khác. Trường hợp không có phản hồi sau khi liên hệ, hồ sơ của anh/chị có thể được đóng lại.

Chúng tôi khuyến khích anh/chị thông báo sớm nhất có thể, dù chỉ là một email ngắn, để nhân viên và khách hàng khác không bị ảnh hưởng đến lịch của mình.$kb$
)
ON CONFLICT (slug) DO UPDATE SET
  title      = EXCLUDED.title,
  category   = EXCLUDED.category,
  content    = EXCLUDED.content,
  updated_at = now();

-- ─── Tài liệu 5: Sau buổi xem – cảm nhận và bước tiếp theo ─────────────────

INSERT INTO kb_documents (slug, title, category, content)
VALUES (
  'sau-buoi-xem',
  'Sau buổi xem: gửi cảm nhận và bước tiếp theo',
  'quy-trinh',
  $kb$Sau khi buổi xem kết thúc, nhân viên sẽ xác nhận anh/chị đã đến. Vài giờ sau đó, hệ thống gửi email hỏi cảm nhận với đường dẫn đến trang phản hồi riêng của anh/chị.

Trên trang cảm nhận, anh/chị có thể:
- Chọn số sao đánh giá buổi xem (từ 1 đến 5 sao).
- Chọn bước tiếp theo phù hợp với nhu cầu của mình: muốn đặt cọc căn này, muốn xem thêm căn khác, hoặc hiện không còn nhu cầu.
- Viết thêm góp ý hoặc câu hỏi nếu muốn (tuỳ chọn).

Sau khi anh/chị gửi phản hồi, hệ thống sẽ phân tích và thông báo đến nhân viên phụ trách. Nếu anh/chị chọn muốn đặt cọc, nhân viên sẽ được ưu tiên thông báo ngay và liên hệ anh/chị sớm để hướng dẫn các bước tiếp theo. Nếu anh/chị chưa hài lòng với căn đã xem, nhân viên sẽ chủ động gợi ý thêm các căn khác có thể phù hợp hơn.

Trang cảm nhận chỉ cho phép gửi một lần và đường dẫn là riêng tư. Nếu đường dẫn không còn hoạt động hoặc anh/chị cần trao đổi thêm sau buổi xem, hãy gửi email cho chúng tôi.

Lưu ý: chúng tôi lưu lại nhu cầu anh/chị phản hồi để tư vấn chính xác hơn trong các bước tiếp theo, nhưng không tự động thay đổi trạng thái hồ sơ hay tạo hợp đồng mà không có sự tham gia của nhân viên.$kb$
)
ON CONFLICT (slug) DO UPDATE SET
  title      = EXCLUDED.title,
  category   = EXCLUDED.category,
  content    = EXCLUDED.content,
  updated_at = now();

-- ─── Tài liệu 6: Quy trình đặt cọc và ký hợp đồng ──────────────────────────

INSERT INTO kb_documents (slug, title, category, content)
VALUES (
  'dat-coc-va-hop-dong',
  'Quy trình đặt cọc và ký hợp đồng cọc',
  'dat-coc',
  $kb$Khi anh/chị quyết định đặt cọc một căn nhà, nhân viên sẽ bắt đầu quy trình tạo hợp đồng cọc. Trạng thái hồ sơ của anh/chị sẽ chuyển sang "Đang làm hợp đồng cọc". Dưới đây là các bước tiếp theo:

Bước 1 – Soạn và duyệt hợp đồng: hệ thống soạn nháp hợp đồng cọc dựa trên thông tin căn nhà và thông tin của anh/chị. Quản lý văn phòng xem xét và duyệt bản nháp này.

Bước 2 – Gửi hợp đồng: sau khi quản lý duyệt, hệ thống gửi email cho anh/chị kèm đường dẫn đến trang ký hợp đồng trực tuyến. Anh/chị đọc kỹ toàn bộ nội dung hợp đồng trên trang đó.

Bước 3 – Ký hợp đồng trực tuyến: nếu đồng ý với nội dung, anh/chị ký tên trực tiếp trên trang web. Hệ thống lưu lại thông tin ký và tạo file PDF hợp đồng gửi đến cả anh/chị và quản lý.

Bước 4 – Xác nhận đặt cọc: sau khi anh/chị ký, quản lý xác nhận đã nhận tiền cọc. Trạng thái hồ sơ chuyển sang "Đã ký hợp đồng cọc". Căn nhà được chuyển sang trạng thái "Đã bán" khi quản lý hoàn tất thủ tục.

Một số điểm quan trọng cần biết:

Một căn nhà chỉ được làm hợp đồng cọc với một khách hàng tại một thời điểm. Trong thời gian đó, trang web hiển thị "Đã có người đặt cọc" và không nhận lịch xem mới cho căn này. Nếu hợp đồng hết hạn hoặc bị từ chối, căn sẽ được mở lại.

Số tiền cọc cụ thể, điều kiện và các chi tiết pháp lý liên quan sẽ được nhân viên tư vấn trực tiếp với anh/chị trước khi tiến hành ký. Anh/chị không bị ràng buộc gì cho đến khi ký tên trên hợp đồng.$kb$
)
ON CONFLICT (slug) DO UPDATE SET
  title      = EXCLUDED.title,
  category   = EXCLUDED.category,
  content    = EXCLUDED.content,
  updated_at = now();

-- ─── Tài liệu 7: Giấy tờ cần chuẩn bị (tham khảo) ──────────────────────────

INSERT INTO kb_documents (slug, title, category, content)
VALUES (
  'giay-to-tham-khao',
  'Giấy tờ anh/chị nên chuẩn bị (tham khảo chung)',
  'chinh-sach',
  $kb$Thông tin dưới đây mang tính chất tham khảo chung. Nhân viên sẽ hướng dẫn cụ thể tuỳ vào loại giao dịch và yêu cầu của từng căn nhà khi anh/chị tiến đến bước đặt cọc.

Khi ký hợp đồng cọc, anh/chị thường cần chuẩn bị:
- Căn cước công dân (CCCD) hoặc hộ chiếu còn hạn, mang theo bản gốc để đối chiếu. Nếu hồ sơ yêu cầu, có thể cần thêm bản photo công chứng.
- Nếu mua chung với người khác (vợ/chồng, người thân), cần có giấy tờ tuỳ thân của tất cả các bên đồng mua.
- Nếu anh/chị uỷ quyền cho người khác ký thay, cần có giấy uỷ quyền được công chứng hợp lệ.

Đối với giao dịch có vay vốn ngân hàng, ngân hàng thường yêu cầu thêm các tài liệu chứng minh thu nhập và hồ sơ tài sản đảm bảo. Chúng tôi không tư vấn trực tiếp về điều kiện vay, nhưng nhân viên có thể hỗ trợ anh/chị tìm đúng đơn vị chuyên môn.

Về tình trạng pháp lý của căn nhà (sổ đỏ, sổ hồng, quy hoạch, tranh chấp...), nhân viên sẽ cung cấp thông tin liên quan đến căn cụ thể khi anh/chị đặt lịch xem hoặc hỏi trực tiếp. Chúng tôi không đưa ra cam kết pháp lý ngoài phạm vi thông tin đã được kiểm chứng từ chủ sở hữu và cơ quan có thẩm quyền.

Nếu anh/chị có câu hỏi cụ thể về hồ sơ một căn, hãy liên hệ nhân viên trực tiếp để được giải đáp trước buổi xem.$kb$
)
ON CONFLICT (slug) DO UPDATE SET
  title      = EXCLUDED.title,
  category   = EXCLUDED.category,
  content    = EXCLUDED.content,
  updated_at = now();

-- ─── Tài liệu 8: Dữ liệu cá nhân và quyền huỷ nhận tin ─────────────────────

INSERT INTO kb_documents (slug, title, category, content)
VALUES (
  'du-lieu-ca-nhan',
  'Dữ liệu cá nhân, đồng ý và quyền huỷ nhận tin',
  'chinh-sach',
  $kb$Khi đặt lịch xem nhà qua trang web của chúng tôi, anh/chị sẽ thấy hai ô liên quan đến dữ liệu cá nhân ở cuối form.

Đồng ý xử lý dữ liệu cá nhân (bắt buộc): anh/chị đồng ý cho phép RealEstate AI thu thập và xử lý họ tên, địa chỉ email và số điện thoại để phục vụ việc liên hệ, tư vấn và xếp lịch xem nhà. Việc xử lý thực hiện theo quy định tại Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân. Nếu anh/chị không tick ô này, form sẽ không cho phép gửi yêu cầu.

Nhận thông tin thị trường (tuỳ chọn): nếu anh/chị tick ô này, hệ thống có thể gửi email bản tin, thông tin biến động giá và gợi ý bất động sản phù hợp. Đây là hoàn toàn tuỳ chọn và không ảnh hưởng đến việc đặt lịch hay được phục vụ.

Huỷ nhận tin: nếu anh/chị đã đăng ký nhận tin nhưng muốn ngừng, hãy gửi email cho chúng tôi và yêu cầu huỷ nhận tin. Chúng tôi sẽ xử lý trong thời gian sớm nhất.

Dữ liệu cá nhân của anh/chị chỉ được dùng cho mục đích tư vấn và thực hiện giao dịch bất động sản. Chúng tôi không chia sẻ thông tin cá nhân của anh/chị cho bên thứ ba ngoài những mục đích đó.

Nếu anh/chị có câu hỏi về quyền truy cập, chỉnh sửa hoặc xoá dữ liệu của mình, hãy gửi email cho chúng tôi.$kb$
)
ON CONFLICT (slug) DO UPDATE SET
  title      = EXCLUDED.title,
  category   = EXCLUDED.category,
  content    = EXCLUDED.content,
  updated_at = now();

-- ─── Tài liệu 9: Câu hỏi về pháp lý, vay vốn và thuế ───────────────────────

INSERT INTO kb_documents (slug, title, category, content)
VALUES (
  'phap-ly-vay-von-thue',
  'Câu hỏi về pháp lý, vay vốn và thuế',
  'faq',
  $kb$Chúng tôi hiểu anh/chị có nhiều thắc mắc liên quan đến pháp lý, vay vốn ngân hàng và các loại thuế khi mua bất động sản. Đây là những vấn đề quan trọng và câu trả lời thường phụ thuộc vào từng trường hợp cụ thể, nên chúng tôi luôn khuyến khích anh/chị trao đổi trực tiếp với nhân viên.

Về pháp lý căn nhà: nhân viên có thể cung cấp thông tin pháp lý cơ bản của từng căn (loại sổ, tình trạng quy hoạch, tranh chấp...) khi anh/chị hỏi trực tiếp. Tuy nhiên, chúng tôi khuyến nghị anh/chị tham khảo thêm ý kiến của luật sư hoặc công chứng viên để được tư vấn pháp lý toàn diện và đầy đủ trước khi ký kết bất kỳ hợp đồng nào.

Về vay vốn ngân hàng: mỗi ngân hàng có điều kiện, lãi suất và danh mục hồ sơ yêu cầu khác nhau. Nhân viên của chúng tôi không tư vấn về sản phẩm vay vốn cụ thể, nhưng có thể hỗ trợ anh/chị kết nối với đơn vị chuyên môn phù hợp.

Về thuế liên quan đến giao dịch bất động sản: các khoản thuế (thuế thu nhập cá nhân từ chuyển nhượng, lệ phí trước bạ...) phụ thuộc vào loại giao dịch và giá trị hợp đồng. Nhân viên sẽ giải thích các khoản cụ thể liên quan khi anh/chị tiến đến bước làm hợp đồng.

Để được tư vấn cụ thể về một căn nhà hoặc một tình huống cụ thể của anh/chị, hãy gửi email cho chúng tôi, hoặc đặt lịch xem nhà để trao đổi trực tiếp với nhân viên.$kb$
)
ON CONFLICT (slug) DO UPDATE SET
  title      = EXCLUDED.title,
  category   = EXCLUDED.category,
  content    = EXCLUDED.content,
  updated_at = now();

-- ─── Tài liệu 10: Kênh liên hệ ─────────────────────────────────────────────

INSERT INTO kb_documents (slug, title, category, content)
VALUES (
  'kenh-lien-he',
  'Kênh liên hệ với chúng tôi',
  'faq',
  $kb$Anh/chị có thể liên hệ với chúng tôi qua các kênh sau:

Email: gửi email đến địa chỉ nhadn2457@gmail.com. Nhân viên sẽ đọc và phản hồi trong giờ làm việc.

Telegram bot: nhắn tin cho Telegram bot của RealEstate AI. Bot có thể hỗ trợ anh/chị tìm kiếm bất động sản, đặt lịch xem nhà, hỏi đáp về quy trình và chính sách. Bot là trợ lý tự động, nhân viên không đọc tin nhắn trong bot. Việc cần nhân viên xử lý (đổi lịch, đặt cọc, câu hỏi pháp lý cụ thể) anh/chị vui lòng gửi email hoặc dùng đường dẫn trong email xác nhận.

Trang web: anh/chị có thể duyệt danh sách bất động sản, lọc theo khu vực hoặc ngân sách, xem thông tin chi tiết từng căn và điền form đặt lịch xem trực tiếp. Khi đến bước đặt cọc, anh/chị ký hợp đồng cọc trực tuyến trên trang web qua đường dẫn gửi trong email.

Nếu anh/chị đã đặt lịch và cần thay đổi hoặc huỷ, cách nhanh nhất là dùng đường dẫn quản lý lịch có trong email xác nhận (không cần liên hệ nhân viên).

Lưu ý: các kênh trên là kênh liên lạc chính thức của chúng tôi. Chúng tôi không chịu trách nhiệm về thông tin, hợp đồng hoặc giao dịch phát sinh từ các nguồn khác tự xưng là đại diện của văn phòng.$kb$
)
ON CONFLICT (slug) DO UPDATE SET
  title      = EXCLUDED.title,
  category   = EXCLUDED.category,
  content    = EXCLUDED.content,
  updated_at = now();

-- ─── Cấp quyền cho n8n_readonly nếu role tồn tại ────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'n8n_readonly') THEN
    GRANT SELECT ON kb_documents TO n8n_readonly;
  END IF;
END;
$$;
