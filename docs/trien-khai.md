# Triển khai lên server

File này ghi mọi thứ cần để đưa code lên server và kiểm tra sau khi đưa lên: server ở đâu, CI tự làm gì, phần nào phải làm tay, và các bước riêng của từng bản phát hành. Quy trình nhánh và PR xem [quy-trinh-git.md](quy-trinh-git.md); lịch phát hành xem mục "Mốc phát hành" trong [danh-sach-task.md](danh-sach-task.md).

Trạng thái server ghi trong file này là ngày **4/11/2026** (đang chạy `v0.2.1`, commit `b37eb1a`). Mỗi lần phát hành, người chạy cập nhật lại mục 4 và mục 8.

## 1. Server

| | |
|---|---|
| Máy | VPS iNET, dùng chung với ứng dụng khác của Hoàng |
| Web khách và admin | https://hoanhoan.hiennguyen.io.vn (API ở `/api`) |
| n8n | https://n8n.hoanhoan.hiennguyen.io.vn |
| Mautic | https://mautic.hoanhoan.hiennguyen.io.vn |
| Thư mục dự án | `/root/realestate-ai-agent`, là bản git của nhánh `main` |
| Người vào server | Hoàng (SSH). Hậu kiểm tra các bước trong file này trước khi Hoàng chạy, không cần vào server |

**Không đụng vào ứng dụng khác trên máy.** Cổng 80 và 443 do container `javis-proxy` giữ, nó tự cấp HTTPS cho cả ba tên miền trên. Không dừng, không xoá các container `javis-*`, `portfolio`, `watchtower-portfolio`, và không chạy service `caddy` trong `docker-compose.prod.yml` (đã tắt bằng file của server).

**File chỉ có trên server**, không có trong Git:

| File | Nội dung |
|---|---|
| `.env` | Mật khẩu, khoá, token (mục 3) |
| `docker-compose.server.yml` | Gắn web, backend, n8n, Mautic vào `javis-proxy`; tắt `caddy`; giảm RAM cho máy nhỏ |
| `.deployed-commit` | Commit đang chạy, do script deploy ghi |

**Container** (tên cố định): `realestate-web`, `realestate-backend`, `realestate-db`, `realestate-n8n`, `realestate-mautic-web`, `realestate-mautic-db`, `realestate-mautic-cron`, `realestate-mautic-worker`.

**Sao lưu tự động** lúc 03:15 mỗi ngày (`/etc/cron.d/realestate-backup` chạy `/root/realestate-backup.sh`): database dự án, database Mautic, dữ liệu n8n, cấu hình Mautic, `.env`. Giữ 7 bản gần nhất trong `/root/backups/realestate/<ngày-giờ>/`. Bản sao lưu nằm cùng ổ đĩa với server, mất máy là mất cả bản sao lưu.

Mọi lệnh `docker compose` trên server phải gọi đủ ba file và tên dự án như sau, nếu không compose sẽ tạo container và volume mới:

```bash
cd /root/realestate-ai-agent
DC() { docker compose -p realestate-ai-agent -f docker-compose.prod.yml -f docker-compose.mautic.yml -f docker-compose.server.yml --env-file .env "$@"; }
DC ps
```

## 2. CI tự deploy

Merge vào `main` thì GitHub Actions chạy workflow **Deploy** (`.github/workflows/deploy.yml`). Workflow SSH vào server bằng key riêng của CI; key này chỉ được phép chạy `/root/realestate-ai-agent-deploy.sh`. Script làm:

1. `git fetch` và `git reset --hard origin/main`.
2. `DC up -d --build`: build lại image đã đổi, tạo lại container có cấu hình đổi.
3. Ghi `.deployed-commit`, xoá image cũ.
4. Chờ ba địa chỉ trả 200 (tối đa 3 phút mỗi địa chỉ): trang web, `/api/properties`, `n8n/healthz`. Không đạt thì job đỏ và in `DC ps`.

Xem kết quả ở tab **Actions** trên GitHub. Job đỏ thì đọc log bước "Deploy tren server", sửa bằng `hotfix/*` (xem quy-trinh-git.md mục 4).

**CI không làm** những việc sau, phải làm tay sau mỗi lần deploy có liên quan:

- Import workflow n8n. n8n lưu workflow trong database của nó, không đọc file trong repo.
- Chạy file SQL trong `backend/sql/`.
- Thêm biến vào `.env` của server.
- Cấu hình bên trong Mautic (field, segment, campaign, webhook).

Bảng `followup_tasks`, cột và index mới của backend thì **tự tạo** khi backend khởi động (TypeORM `synchronize`), không cần SQL tay.

Người mở PR ghi các việc tay của PR đó vào mục "Bước deploy làm tay" của PR. PR release gom các mục đó lại và đối chiếu với mục 8 của file này.

## 3. Biến môi trường trên server

Sửa bằng `nano /root/realestate-ai-agent/.env`. Không dán giá trị vào chat, ảnh chụp hay Git. Thêm hoặc đổi biến thì phải tạo lại container dùng biến đó: `DC up -d <service>` (chỉ `restart` thì container vẫn giữ biến cũ).

| Biến | Dùng ở | Ghi chú |
|---|---|---|
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | db, backend | Đổi `DB_PASSWORD` sau khi đã có dữ liệu thì phải chạy thêm `ALTER USER` trong database |
| `WEBHOOK_SECRET` | backend, n8n | Header `X-Webhook-Secret` giữa backend và n8n |
| `JWT_SECRET`, `SEED_USER_PASSWORD` | backend | Đăng nhập admin |
| `PUBLIC_HOST`, `PUBLIC_WEB_URL` | tất cả | Tên miền web; link trong email |
| `N8N_ENCRYPTION_KEY` | n8n | Khoá mã hoá credential. **Không bao giờ đổi**, đổi là mất hết credential |
| `N8N_LEAD_CHANGED_URL` | backend | Webhook luồng 7 (`http://n8n:5678/webhook/lead-changed`) |
| `MAUTIC_DB_*`, `MAUTIC_MYSQL_ROOT_PASSWORD` | Mautic | |
| `MAUTIC_API_USER`, `MAUTIC_API_PASSWORD` | n8n | Tài khoản API Mautic `n8n-api`; credential Mautic của n8n lấy từ đây (mục 9) |
| `MAUTIC_URL` | n8n | `https://mautic.<PUBLIC_HOST>/api`. Gọi `http://mautic_web` trên server bị chuyển hướng 301 nên luồng 7 lỗi |
| `MAUTIC_WEBHOOK_SECRET` | n8n | **Thêm ở `v0.3.1`.** Token Mautic gửi kèm khi gọi luồng 8, ít nhất 24 ký tự. Trống thì luồng 8 từ chối mọi sự kiện (403) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SALE_CHAT_ID` | n8n | Bot báo sale (Thông báo nhân viên) |
| `TELEGRAM_KHACH_BOT_TOKEN`, `TELEGRAM_KHACH_WEBHOOK_SECRET` | n8n | Bot tư vấn khách (luồng 6) |
| `BOOKING_RATE_LIMIT`, `BOOKING_RATE_TTL_MS`, `TRUST_PROXY_HOPS` | backend | Có giá trị mặc định trong compose (5 lần / 10 phút / 1 proxy). Chỉ thêm vào `.env` khi muốn đổi |

## 4. n8n trên server

Phiên bản 2.45.5. Workflow và credential dùng **id cố định** giống trong file JSON của repo, nên import đè lên đúng workflow cũ và không phải chọn lại credential.

**Credential**

| Id | Loại | Tên | Dùng ở | Trên server (4/11) |
|---|---|---|---|---|
| `hfJ9bBGUGsjH8qDP` | SMTP | SMTP account | Gửi email (đăng nhập `nhadn2457@gmail.com`) | Có |
| `wU5LeG7gXaoUdMXQ` | Gemini | Google Gemini(PaLM) Api account | AI chấm điểm, soạn thư, embedding RAG | Có |
| `iYLrhsH8b8dDkZ0n` | Header Auth | Header Auth account | Webhook backend gọi n8n | Có |
| `postgres_account_id` | Postgres | Postgres account | Đọc ghi database dự án | Có |
| `pgReadonly00001` | Postgres | Postgres readonly | Luồng 4, tra cứu của luồng 6 (user `n8n_readonly`, chỉ đọc) | Có |
| `mautic_api_credential` | Basic Auth | Mautic API | Luồng 2, 7 gọi API Mautic | **Chưa có**, tạo ở `v0.3.1` |

**Workflow**

| File | Id | Kích hoạt bằng | Trên server (4/11) |
|---|---|---|---|
| `error-workflow.json` | `errorWfRealestat` | Luồng khác lỗi | Bật |
| `thong-bao-nhan-vien.json` | `thongBaoNhanVien` | Luồng khác gọi | Bật |
| `luong-1-dat-lich.json` | `prt5invo7qugQx74` | Webhook `viewing-requested` | Bật, bản cũ |
| `luong-1b-chot-lich-thu-cong.json` | `luong1bRealestat` | Webhook `viewing-admin-action` | Bật, bản cũ |
| `luong-2-follow-up.json` | `luong2Realestat0` | Mỗi giờ | **Tắt**, bản cũ |
| `luong-3-hop-dong.json` | `luong3Realestat0` | Webhook `contract-requested` | Bật |
| `luong-4-bao-cao.json` | `luong4Realestat0` | 8 giờ sáng thứ Hai, webhook `report-requested` | Bật, bản cũ |
| `luong-5-cam-nhan.json` | `luong5Realestat0` | Webhook `feedback-submitted` | Bật |
| `luong-6-telegram-agent.json` | `luong6Realestat0` | Webhook `telegram-khach` | Bật, bản cũ |
| `luong-6b-nap-tri-thuc.json` | `luong6bRagNap001` | 2 giờ sáng mỗi ngày | **Chưa có** |
| `luong-7-dong-bo-mautic.json` | `luong7Realestat0` | Webhook `lead-changed` | Bật, bản cũ |
| `luong-8-mautic-bao-ve.json` | `luong8Realestat0` | Webhook `mautic-event` | Bật, bản cũ |

"Bản cũ" là bản trên server khác file trong `dev`; mục 8 và 9 ghi bản phát hành nào import lại. Error workflow và Thông báo nhân viên phải luôn **bật** (published), nếu không các luồng khác lỗi mà không ai được báo.

Xem nhanh trạng thái trên server:

```bash
docker exec realestate-n8n n8n list:workflow --active=true
```

## 5. Import một workflow

Làm trên server, trong `/root/realestate-ai-agent` sau khi CI đã deploy commit mới (file JSON trong thư mục là bản mới).

```bash
cd /root/realestate-ai-agent
B=/root/n8n-backup/$(date +%Y%m%d-%H%M); mkdir -p "$B"

import_wf() { # import_wf <file-trong-n8n-workflows> <id>
  docker exec realestate-n8n n8n export:workflow --id="$2" --output="/home/node/bak-$2.json" >/dev/null 2>&1 \
    && docker cp "realestate-n8n:/home/node/bak-$2.json" "$B/" || echo "($2 chưa có trên server, bỏ qua sao lưu)"
  docker cp "n8n-workflows/$1" realestate-n8n:/home/node/import.json
  docker exec realestate-n8n n8n import:workflow --input=/home/node/import.json
  docker exec realestate-n8n n8n publish:workflow --id="$2"
}
```

Gọi `import_wf` cho từng luồng, xong hết thì:

```bash
docker restart realestate-n8n
docker exec realestate-n8n n8n list:workflow --active=true
```

Những điều đã gặp:

- Import xong workflow bị **tắt**, phải `publish:workflow`. Publish xong vẫn phải **restart n8n** thì webhook và lịch chạy mới nhận bản mới.
- Muốn để một luồng tắt (ví dụ luồng 2 trước `v0.3.1`) thì import mà không publish.
- Trong container n8n, ghi file vào `/home/node/`, không dùng `/tmp/`: file cũ do root tạo trong `/tmp` không ghi đè được, lệnh export báo lỗi nhưng `docker cp` vẫn chép file cũ.
- Trên máy Windows (Git Bash) lệnh có đường dẫn `/home/...` hay `/tmp/...` phải thêm `MSYS_NO_PATHCONV=1` ở đầu. Trên server không cần.
- Không gọi `/rest/...` của n8n từ console trình duyệt: thiếu header `browser-id` thì n8n đăng xuất phiên đang dùng. Cần id thì dùng lệnh `n8n list:workflow`.
- Kiểm tra webhook đã đăng ký chưa: gọi không kèm secret, trả **403** là đã đăng ký, **404** là chưa (chưa publish hoặc chưa restart):

  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' -X POST https://n8n.hoanhoan.hiennguyen.io.vn/webhook/viewing-requested
  ```

**Quay lại bản cũ của một luồng:** import file trong `$B` (thư mục sao lưu của lần đó) theo đúng cách trên.

## 6. Các bước chung mỗi lần phát hành

1. **Trước khi merge PR release:** đọc mục "Bước deploy làm tay" của các PR trong lô và mục riêng của bản đó trong file này (mục 8, 9, ...). Có biến `.env` mới thì thêm trước. Sao lưu tay một lần: `/root/realestate-backup.sh`.
2. **Merge** PR `dev` → `main` (Create a merge commit). Chờ job Deploy xanh.
3. **Bước tay** của bản đó.
4. **Kiểm tra sau deploy** (mục 7).
5. **Gắn tag** theo quy-trinh-git.md mục 3, cập nhật bảng "Mốc phát hành" trong danh-sach-task.md và mục 4 của file này.

## 7. Kiểm tra sau deploy

```bash
cat /root/realestate-ai-agent/.deployed-commit          # đúng commit vừa merge
docker ps --format '{{.Names}} {{.Status}}' | grep realestate
docker logs realestate-backend --since 15m 2>&1 | grep -iE 'error|warn' | tail -20
docker exec realestate-n8n n8n list:workflow --active=true
```

Trên trình duyệt:

1. Mở trang khách và một trang chi tiết nhà.
2. Đặt một lịch test bằng email `nhadn2457+test<ngày>@gmail.com`. Trong n8n, mục Executions, luồng 1 chạy thành công; email "đã nhận yêu cầu" đến hộp thư; sale nhận báo qua email, Telegram, ...
3. Đăng nhập trang admin, thấy lead vừa đặt, duyệt lịch, khách nhận email chốt lịch.
4. Mở link quản lý lịch `/lich/<mã>` trong email chốt lịch: trang mở được, có nút huỷ và xin đổi giờ.
5. Kiểm tra thêm phần riêng của bản phát hành (mục 8, 9).

Lead test dùng xong thì bấm "Không mua" với lý do "Lý do khác" để luồng 2 không gửi thư cho nó nữa. Riêng lead #4 (`nhadn2457+khach2@gmail.com`) giữ lại làm lead test của luồng 2.

## 8. Bản `v0.3.0`

Gồm FE-18 (RAG), FE-19 (vá lỗ hổng từ đặt lịch đến đặt cọc), FE-29 (backend follow-up), BF-06, CH-06 và các task xong trước đó. Luồng 2, 7, 8 **chưa** import ở bản này: luồng 7, 8 trên server giữ bản cũ (vẫn chạy được với backend mới), luồng 2 vẫn tắt.

**Đã làm trước (4/11):** kiểm tra mỗi căn có tối đa một hợp đồng còn hiệu lực (đạt); thống nhất giữ lead #4 làm lead test.

**Trước khi merge:** không có biến `.env` mới bắt buộc. Chạy `/root/realestate-backup.sh`.

**Sau khi CI deploy xong:**

1. Backend đã khởi động với bảng và index mới:

   ```bash
   docker logs realestate-backend --since 15m 2>&1 | grep -iE 'error|RESERVED' | tail
   docker exec realestate-db psql -U realestate -d realestate -Atc \
     "select to_regclass('followup_tasks'), to_regclass('uq_contracts_active_property')"
   ```

   Hai giá trị đều phải khác rỗng. Căn có hợp đồng còn hiệu lực tự chuyển "Đang giữ cọc" khi backend khởi động (log có dòng `Marked ... as RESERVED`).

2. Nạp tài liệu tri thức cho RAG (chạy lại nhiều lần không sao):

   ```bash
   docker cp backend/sql/rag-kb.sql realestate-db:/tmp/rag-kb.sql
   docker exec realestate-db psql -U realestate -d realestate -v ON_ERROR_STOP=1 -f /tmp/rag-kb.sql
   docker exec realestate-db psql -U realestate -d realestate -Atc "select count(*) from kb_documents"
   ```

   Database server đã có extension `vector` (0.8.7).

3. Import và bật luồng 1, 1b, 4, 6, 6b (khai báo `import_wf` ở mục 5 trước):

   ```bash
   import_wf luong-1-dat-lich.json prt5invo7qugQx74
   import_wf luong-1b-chot-lich-thu-cong.json luong1bRealestat
   import_wf luong-4-bao-cao.json luong4Realestat0
   import_wf luong-6-telegram-agent.json luong6Realestat0
   import_wf luong-6b-nap-tri-thuc.json luong6bRagNap001
   docker restart realestate-n8n
   ```

4. Chạy luồng 6b một lần để có dữ liệu RAG ngay, không chờ 2 giờ sáng: mở n8n, vào "Luồng 6b: Nạp tri thức RAG", bấm **Execute workflow**. Kiểm tra:

   ```bash
   docker exec realestate-db psql -U realestate -d realestate -Atc \
     "select metadata->>'source', count(*) from rag_chunks group by 1"
   ```

   Phải có cả nguồn nhà và nguồn tài liệu.

5. Backend thấy đúng IP khách khi đi qua `javis-proxy` (OpenSpec 10.5). Từ máy mình gửi 6 yêu cầu đặt lịch rỗng liên tiếp:

   ```bash
   for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w '%{http_code} ' -X POST -H 'Content-Type: application/json' -d '{}' https://hoanhoan.hiennguyen.io.vn/api/viewings; done; echo
   ```

   Đúng là `400 400 400 400 400 429`. Sau đó chạy đúng lệnh đó **trên server**: lần đầu phải là `400`. Nếu trên server cũng ra `429` ngay thì backend đang đếm theo IP của proxy (mọi khách chung một giới hạn): thử `TRUST_PROXY_HOPS=2` trong `.env`, rồi `DC up -d backend` và kiểm tra lại. Máy mình bị chặn đặt lịch 10 phút sau bước này.

6. Kiểm tra sau deploy theo mục 7, thêm:
   - Bot Telegram tư vấn khách: hỏi một câu về quy trình (ví dụ "đặt cọc cần giấy tờ gì?"), bot trả lời theo tài liệu tri thức.
   - Trang admin: lead đang đặt cọc không còn nút "Không mua" (BF-06).
   - Phần điểm danh (nhắc nhân viên ghi nhận khách có đến không) để sang `v0.3.1`, vì cần luồng 2.

7. Gắn tag `v0.3.0`.

## 9. Bản `v0.3.1`

Gồm phần n8n của FE-29 (luồng 2, 7, 8 bản mới) và FE-22 (cấu hình Mautic trên server). **Hạn 8/11.** Hoàng chạy, Hậu kiểm tra các bước này trước.

**Điều kiện:** `v0.3.0` đã chạy ổn; Hậu đã xong FE-22 trên Mautic server: custom field `ai_nudge_text`, segment "Nuôi WARM" nhận tag `nuoi-warm` (segment này đã có từ 29/10), segment "Bản tin hằng tháng", campaign gửi thư nuôi WARM. Trạng thái Mautic server ngày 4/11: có segment "Nuôi WARM", webhook id 1 "n8n Luong 8"; chưa có field `ai_nudge_text`, campaign, form.

1. **Token cho luồng 8.** Tạo chuỗi ngẫu nhiên và thêm vào `.env`:

   ```bash
   openssl rand -hex 24          # chép kết quả
   nano /root/realestate-ai-agent/.env   # thêm dòng MAUTIC_WEBHOOK_SECRET=<kết quả>
   DC up -d n8n                  # tạo lại n8n để nhận biến mới (khai báo DC ở mục 1)
   ```

   Biến này được truyền vào n8n từ commit DC-09 (`docker-compose.prod.yml`); commit đó phải đã có trên `main`.

2. **Credential Mautic** với id cố định, lấy tài khoản từ biến `MAUTIC_API_USER`, `MAUTIC_API_PASSWORD` mà n8n đã có, không phải gõ mật khẩu:

   ```bash
   docker exec realestate-n8n sh -c 'node -e "require(\"fs\").writeFileSync(\"/home/node/cred-mautic.json\", JSON.stringify([{id:\"mautic_api_credential\",name:\"Mautic API\",type:\"httpBasicAuth\",data:{user:process.env.MAUTIC_API_USER,password:process.env.MAUTIC_API_PASSWORD}}]))" && n8n import:credentials --input=/home/node/cred-mautic.json; rm -f /home/node/cred-mautic.json'
   ```

   Kiểm tra trong n8n, mục Credentials có "Mautic API"; bấm vào, **Test** báo thành công.

3. **Import luồng 7, 8 và bật**; import luồng 2 nhưng **chưa bật**:

   ```bash
   import_wf luong-7-dong-bo-mautic.json luong7Realestat0
   import_wf luong-8-mautic-bao-ve.json luong8Realestat0
   docker cp n8n-workflows/luong-2-follow-up.json realestate-n8n:/home/node/import.json
   docker exec realestate-n8n n8n import:workflow --input=/home/node/import.json
   docker restart realestate-n8n
   ```

   (Sao lưu bản luồng 2 cũ trước bằng `export:workflow` như trong `import_wf`.)

4. **Gắn token vào webhook Mautic.** Mautic, Settings, Webhooks, "n8n Luong 8": đổi URL thành `http://n8n:5678/webhook/mautic-event?token=<token ở bước 1>`, lưu. Kiểm tra trên server:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST https://n8n.hoanhoan.hiennguyen.io.vn/webhook/mautic-event
   ```

   Không có token phải ra `403`. Trong Mautic, mở một contact test, cộng điểm tay: luồng 8 chạy thành công trong Executions và lead tương ứng có dòng điểm Mautic trong dòng thời gian.

5. **Xem trước luồng 2 sẽ làm gì** trước khi bật (chỉ đọc, không gửi gì):

   ```bash
   docker cp backend/sql/preview-follow-up.sql realestate-db:/tmp/preview-follow-up.sql
   docker exec realestate-db psql -U realestate -d realestate -f /tmp/preview-follow-up.sql
   ```

   Danh sách chỉ nên có lead test. Có lead cũ của khách thật hoặc dữ liệu demo cũ thì dừng, bàn với Hậu trước khi bật (đóng lead đó bằng "Không mua" nếu không cần chăm sóc nữa).

6. **Bật luồng 2**: `docker exec realestate-n8n n8n publish:workflow --id=luong2Realestat0`, rồi `docker restart realestate-n8n`.

7. **Kiểm tra**: chờ lượt chạy đầu (đầu giờ kế tiếp) hoặc bấm Execute workflow trong n8n. Lead #4 (`CONFIRMED`, giờ hẹn 1/11 đã qua) phải có dòng "Đã nhắc xác nhận buổi xem" trong dòng thời gian, và nhân viên nhận lời nhắc qua email, Telegram, ... Nếu sau 24 giờ vẫn chưa ai ghi nhận buổi xem, luồng 2 báo tiếp quản lý. Kiểm tra bảng tác vụ:

   ```bash
   docker exec realestate-db psql -U realestate -d realestate -c \
     "select id, lead_id, type, state, error, updated_at from followup_tasks order by id desc limit 10"
   ```

   Tác vụ ở trạng thái `REVIEW` là cần người xem (xem [luong-2-follow-up.md](luong/luong-2-follow-up.md)).

8. Gắn tag `v0.3.1`, cập nhật mục 4 của file này (luồng 2 bật, credential Mautic đã có).

## 10. Sự cố thường gặp

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Webhook n8n trả 404 | Workflow chưa publish hoặc chưa restart sau khi import | `publish:workflow`, `docker restart realestate-n8n` |
| Luồng báo "credential not found" | Id credential trong JSON khác server | Mở node, chọn lại credential, lưu, publish. Hoặc tạo credential đúng id như mục 9 bước 2 |
| Luồng 7 lỗi 301 | `MAUTIC_URL` trống hoặc là `http://mautic_web` | Đặt `MAUTIC_URL=https://mautic.<PUBLIC_HOST>/api`, `DC up -d n8n` |
| Luồng 8 trả 403 với mọi sự kiện | Thiếu `MAUTIC_WEBHOOK_SECRET` hoặc URL webhook Mautic thiếu `?token=` | Mục 9 bước 1 và 4 |
| Luồng lỗi mà không ai nhận email báo | Error workflow bị tắt | Publish `errorWfRealestat` |
| Web trả trang cũ sau khi deploy | Image web build từ cache cũ | `DC up -d --build --force-recreate web` |
| Database báo cảnh báo collation | Đổi image Postgres sang `pgvector/pgvector` | `REINDEX DATABASE realestate;` rồi `ALTER DATABASE realestate REFRESH COLLATION VERSION;` |
| Deploy CI đỏ ở bước kiểm tra sức khoẻ | Container chưa lên kịp hoặc lỗi khởi động | SSH vào, `DC ps`, `docker logs <container> --tail 100` |

**Quay lại code bản trước:** trên GitHub, mở PR release vừa merge, bấm **Revert**, merge PR revert đó vào `main` (CI deploy lại bản cũ). Workflow n8n quay lại bằng file trong thư mục sao lưu (mục 5). Database chỉ khôi phục từ `/root/backups/realestate/` khi dữ liệu hỏng thật, và phải bàn trước vì sẽ mất dữ liệu phát sinh sau lần sao lưu.
