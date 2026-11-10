# FE-21 — Form đăng ký bản tin trên web

Nhánh: `feature/FE-21-mautic-form-nhan-tin`, tạo từ `dev` commit `df5871e`. Hậu thực hiện; Hoàng review và triển khai server. Không merge hoặc push trực tiếp vào `dev`.

## 1. Luồng hoạt động

Khách bấm **Đăng ký nhận bản tin** ở chân trang → `/nhan-tin` → nhập email, chủ động tick đồng ý → gửi form Standalone của Mautic → Mautic lưu contact và kết quả đăng ký → gắn tag `ban-tin-hang-thang` → lần cập nhật segment tiếp theo đưa contact vào **Bản tin hằng tháng**.

Form gửi thẳng tới Mautic, không gọi API đặt lịch, không gọi L1, không tạo lead/viewing và không chấm điểm AI. Cùng email đã có contact thì Mautic dùng nhận diện contact của form. FE-21 không thay đổi `consent_marketing` của lead backend đã có. Không gắn `WARM`, `COLD` hay `nuoi-warm` chỉ vì khách đăng ký bản tin.

Đăng ký không tự gửi email: form không có action gửi thư, không gọi webhook hoặc sub-workflow. Lịch/nội dung bản tin là cấu hình riêng. Không tự gỡ Do Not Contact khi contact đăng ký lại; người từng hủy nhận cần quy trình xác nhận nhận lại riêng trước khi tiếp tục gửi Marketing.

## 2. Tạo form trên từng Mautic

Pull code không sao chép đối tượng trong database Mautic. Hoàng tạo/đối chiếu trên server theo các bước dưới; ID local không dùng cố định cho server.

1. Kiểm tra tag `ban-tin-hang-thang` và segment **Bản tin hằng tháng** đã có từ FE-22. Segment dùng filter **Tags including ban-tin-hang-thang**, Active Yes. Không thêm contact thủ công vào segment. Trước khi bật segment trên môi trường khác, kiểm tra nơi đang sử dụng segment để tránh kích hoạt chiến dịch có sẵn ngoài ý muốn.
2. **Components → Forms → New → Standalone form**. Name: `FE-21 | Đăng ký bản tin hằng tháng`.
3. **Details**: Successful Submit Action = Display message. Message: `Cảm ơn bạn đã đăng ký nhận bản tin. Bạn có thể hủy nhận qua liên kết trong mỗi email.`
4. Available for use = Yes; Disable search indexing = Yes; Theme = Blank; Use theme style = Yes; Default language = Vietnamese (Viet Nam). Kiosk Mode = No.
5. Form attributes (tùy chọn, cho font thống nhất):

   ```html
   style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#0f172a;padding:12px;box-sizing:border-box"
   ```

6. **Fields**, theo thứ tự:

   | Trường | Thiết lập |
   |---|---|
   | Email | Label `Email nhận bản tin`; placeholder `ban@example.com`; map Contact → Email; Required Yes; Save result Yes |
   | Checkbox group | Label `Đồng ý nhận bản tin`; một option value `yes`, nội dung `Tôi đồng ý nhận email bản tin bất động sản hằng tháng và có thể hủy nhận qua liên kết trong mỗi email.`; Required Yes; Save result Yes; Default value trống, không chọn sẵn; không map vào field của lead |
   | Captcha | Label `Để trống trường này`; Properties → answer trống để dùng honeypot ẩn, không bắt khách giải câu hỏi |
   | Button | Label `Đăng ký nhận bản tin` |

7. **Actions → Modify contact's tags**: thêm tag `ban-tin-hang-thang`, không xóa tag khác. Không thêm Send email, Post results to another form, webhook, Remove contact from do not contact list hoặc gắn vào campaign Nuôi WARM.
8. Save & Close. **Embedded → Via iframe** phải có đường dẫn `/form/<ID>` trên đúng domain công khai của Mautic. Ghi ID form vào cấu hình web. Các field, đồng ý và thông báo thành công do Mautic xử lý; web không hiển thị thành công chỉ vì iframe tải xong.

## 3. Cấu hình web

Web dùng `NEXT_PUBLIC_MAUTIC_URL` có sẵn và biến mới `NEXT_PUBLIC_MAUTIC_NEWSLETTER_FORM_ID`. Giá trị là **ID form**, không phải ID segment/campaign. Không nhập user, mật khẩu, URL `/api` hay token.

Ví dụ local, trong `.env` ở gốc repo:

```dotenv
NEXT_PUBLIC_MAUTIC_URL=http://localhost:8082
NEXT_PUBLIC_MAUTIC_NEWSLETTER_FORM_ID=1
```

Chạy web bằng npm thì đặt hai biến trong `web/.env.local`, khởi động lại dev server. File `.env` và `.env.local` không đưa lên Git.

Build Docker local, thêm override FE-21 **sau** các compose đang dùng:

```powershell
docker compose -f docker-compose.yml -f docker-compose.mautic.yml -f docker-compose.newsletter.yml up -d --build --no-deps web
```

Trên server, dùng compose triển khai hiện tại của Hoàng và thêm `-f docker-compose.newsletter.yml` cuối danh sách; không thay compose/network server bằng bản local. File `docker-compose.prod.yml` có sẵn đã truyền domain Mautic HTTPS cho web, override FE-21 chỉ bổ sung ID form. Nếu pipeline dùng file override khác, Hoàng phải thêm cùng build arg vào bước build web của pipeline. Đây là biến được nhúng lúc build: đổi environment lúc khởi động container không cập nhật bản đã build.

Khi thiếu/sai ID hoặc URL, chân trang ẩn liên kết đăng ký; mở trực tiếp `/nhan-tin` thấy thông báo đang chuẩn bị. URL chấp nhận HTTPS công khai hoặc HTTP localhost để thử local; không chấp nhận URL có credential, query, fragment hay đường dẫn API. Iframe không gửi referrer; không nhúng trên trang lịch/hợp đồng có mã riêng. Nếu iframe bị chặn, khách có link **Mở trang đăng ký riêng**. CSS web không tác động vào nội dung iframe; sửa field/style trong Mautic.

## 4. Kiểm thử local ngày 05/11/2026

Mautic v5.2.11. Form ID `1`; tag ID `14`; segment ID `2`. Web bản thử chạy riêng cổng `3001`, bản cũ cổng `3000` không bị đổi. Chưa triển khai server.

| Ca | Kết quả quan sát |
|---|---|
| Gửi email đúng định dạng nhưng chưa tick đồng ý | Form báo `Điều này là bắt buộc.`; chưa gửi thành công |
| Tick đồng ý rồi gửi bằng email giả lập thuộc `example.com` | Hiện đúng thông báo cảm ơn |
| Contact sau gửi | Contact thử ID 7 có tag `ban-tin-hang-thang`, lịch sử Form submitted, không có action gửi email |
| Lead backend trước/sau | Giữ nguyên 31 lead; đăng ký không tạo lịch xem |
| Segment | Đã kiểm tra filter tag, bật riêng segment bản tin local; chưa dùng trong campaign. Rebuild riêng ID 2 thêm đúng 1 contact thử, giao diện hiển thị contact này |
| Giao diện | Trang có form nhúng, link mở riêng; ở viewport 390px không tràn ngang |
| Kiểm tra source | `npm run lint`, `npm run build` (Turbopack), `node scripts/check-newsletter-form.cjs` đạt |

Lần build đầu lỗi cache Turbopack khi tạo tiến trình CSS; sau xóa đúng output sinh tự động `web/.next`, build mặc định đã đạt. Không đổi cấu hình build của dự án để né lỗi. Không dùng kết quả Webpack không xử lý Tailwind làm nghiệm thu giao diện.

Để kiểm tra segment riêng khi cron chưa hoạt động, đã đọc `--help` của image local rồi chạy:

```powershell
docker exec -u www-data realestate-mautic-web php /var/www/html/bin/console mautic:segments:update --list-id=2 --batch-limit=10 --max-contacts=10 --no-interaction
```

Đổi ID theo môi trường. Lệnh này chỉ cập nhật segment; không chạy campaigns:trigger, broadcasts:send hoặc worker email. Đây là lần chạy tay, chưa chứng minh cron tự động hoạt động. Local FE-22 còn việc kiểm tra vai trò cron/worker; cấu hình server phải kiểm tra riêng.

Contact thử dùng `example.com` chỉ kiểm chứng lưu dữ liệu, không dùng để nghiệm thu phát thư. Không đưa contact thử vào đợt gửi thật. FE-21 chưa cài xác nhận email hai bước; form hiện chứng minh người gửi đã tick ô, chưa chứng minh quyền sở hữu hộp thư. Trước khi gửi Marketing thực tế, cần kiểm tra cách xác nhận địa chỉ, hủy nhận và cron của môi trường triển khai.

## 5. Bàn giao và demo

Hậu push nhánh và mở PR vào `dev`; Hoàng review code và tạo form tương ứng trên Mautic server. Sau deploy web với ID đúng, kiểm tra lại form, tag, kết quả submit, số lead và lần rebuild segment tự động. Không đánh dấu task đã merge khi chưa có PR được review.

Demo: mở trang chủ → chân trang **Đăng ký nhận bản tin** → nhập email thử → bấm khi chưa đồng ý để thấy kiểm tra → tick đồng ý và gửi → mở Contacts Mautic để chỉ tag + Form submitted → mở segment Bản tin hằng tháng. Nói: “Đây là người đăng ký nhận tin, chưa đặt lịch xem nhà nên chưa tạo lead bán hàng.” Không giới thiệu bản tin đã được gửi nếu chưa nghiệm thu phát thư.

Nguồn đối chiếu: [Mautic 5.2 — Forms](https://docs.mautic.org/en/5.2/components/forms.html), [Mautic 5.2 — Cron jobs](https://docs.mautic.org/en/5.2/configuration/cron_jobs.html). Tùy chọn `--list-id` đã xác minh thêm bằng `mautic:segments:update --help` trong image local.
