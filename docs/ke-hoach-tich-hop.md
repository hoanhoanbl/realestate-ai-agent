# Kế hoạch tích hợp: Mautic, Agentic AI và app

Ghi lại các quyết định đã chốt ngày **20/10/2026**, sau khi đối chiếu source trên `main` với `docs/use-case.md` và tài liệu môn học (*AI Agent and Agentic AI Workflows with n8n*, *Marketing Automation / Mautic*, hình "Popular Agentic AI Frameworks", hình n8n Mautic + Telegram).

Dùng file này để đối chiếu khi làm. Quyết định nào đổi thì sửa bảng ở mục 2 và ghi vào mục 11.

## 1. Hiện trạng trên `main` (20/10)

- Backend NestJS có 9 module (auth, leads + lead_events, viewings, properties, contracts, feedback, reports, stats, users). Web Next.js có khu khách và web admin (kể cả RBAC). n8n có 7 workflow: L1, L1b, L2, L3, L4, L5 và Error workflow.
- AI: Gemini, gọi qua node AI của n8n (chính là LangChain.js). 4 chỗ là chain (L1, L2, L3, L5). Chỉ **L4 là AI Agent có tool**.
- Đủ use case K01–K08, S01–S08, Q01–Q08, SYS-01–SYS-12 trên web.

Chỗ còn hở:

| Hở | Chi tiết |
|---|---|
| App Expo | Chỉ có trên `dev`. Thiếu UC-S09, S10 và phần thông báo đẩy của S02 |
| Nút Gọi / Email | Web admin chưa có `tel:` / `mailto:` (UC-S10) |
| Nguồn khách | `leads` không có cột `source`, chưa trả lời được "nguồn khách nào tốt" |
| Đo lường | Chưa có bộ 20 lead có nhãn để đo độ chính xác HOT/WARM/COLD |
| Tài liệu | `use-case.md` trỏ tới file chỉ có trên `dev`. `tong-quan-du-an.md` còn ghi `/sign` (thực tế `/ky`), "4 luồng" (thực tế 6 + Error), ma trận công nghệ đã cũ |
| Agentic AI | Chưa có memory, RAG, multi-agent, kênh chat; tool chỉ có ở L4 |
| Marketing Automation | Điểm AI chỉ chấm một lần; chưa theo dõi hành vi, chưa có phân khúc, chiến dịch |

## 2. Quyết định đã chốt

| Mã | Quyết định |
|---|---|
| D-01 | Bản được chấm là **`main`**. Mọi việc dưới đây làm trên `main`. `dev` chỉ để tham khảo |
| D-02 | Marketing Automation dùng **Mautic thật** (không tự làm trong n8n, không dùng Listmonk) |
| D-03 | Mautic chạy trên **`realestate-vm`**, **không nâng cấp máy**. Đo ngày 20/10: e2-standard-2, 8 GB RAM, còn khoảng 6,4 GB; ổ đĩa còn 37 GB. Mautic cần khoảng 1–1,5 GB |
| D-04 | Mautic nằm trong file compose riêng **`docker-compose.mautic.yml`** (Hậu sở hữu). Deploy bằng cách thêm `-f docker-compose.mautic.yml`. Không mở cổng MySQL ra ngoài. Subdomain `mautic.` qua Caddy |
| D-05 | Hậu **không có SSH**. Hậu làm ở local và giao bằng PR. Hoàng đặt giá trị bí mật trong `.env` server và deploy. Cấu hình bên trong Mautic (segment, chiến dịch, email mẫu) Hậu làm **thẳng trên server qua trình duyệt** |
| D-06 | **Web làm xong trước, app làm sau.** App vẫn bắt buộc, làm ở giai đoạn 4 |
| D-07 | **Không** viết code bằng framework Python (CrewAI, AutoGen…). Mọi thứ làm trong n8n. Báo cáo ghi rõ node AI của n8n là LangChain.js và ánh xạ sang hình các framework |
| D-08 | Dùng **Langfuse Cloud bản miễn phí**. Che tên, SĐT, email khách trước khi gửi. Áp vào L1 trước |
| D-09 | **Phân vai email:** email nghiệp vụ (xác nhận, nhắc lịch, hợp đồng, cảm nhận) giữ ở n8n. Email nuôi khách và chiến dịch do Mautic gửi. Cả hai dùng Gmail nhóm (chung hạn mức khoảng 500 mail/ngày) |
| D-10 | **Nhắc khách WARM im lặng chuyển từ L2 sang Mautic** (chi tiết mục 5) |
| D-11 | Người chỉ đăng ký nhận tin là **contact trong Mautic**, không phải lead. Khi đặt lịch mới thành lead trong backend. Bảng `leads` không đổi ràng buộc |
| D-12 | Mọi thông báo cho nhân viên đi qua **một sub-workflow "Thông báo nhân viên"**. Đầu vào cố định: `{ leadId, level, title, message, actions?: [{label, url}] }`. Tuần 1 có email + Telegram, giai đoạn 4 thêm Expo Push |
| D-13 | **Không xoá** phần push token (cột `users.push_token`, `POST/DELETE /users/me/push-token`, nhánh push trong L1). App sẽ dùng lại |
| D-14 | **Không đổi image DB trước demo 24/10.** pgvector làm từ tuần 2 |
| D-15 | Mốc thời gian: **demo thứ Bảy 24/10**, **web hoàn thành 22/11**, **khoá code 3/12**, **nộp thứ Bảy 5/12** |
| D-16 | Phân việc theo tên như mục 7: **Hoàng** lo Agentic AI, **Hậu** lo Mautic. Giai đoạn 2 và 3 làm song song |

## 3. Ba quy tắc giữ suốt quá trình

1. Tính năng mới nào cũng phải có **API ở backend**. Web và app chỉ gọi API, không tự xử lý nghiệp vụ.
2. Thông báo nhân viên chỉ đi qua sub-workflow ở D-12.
3. Mỗi PR chỉ sửa file trong phần mình sở hữu (mục 8). Phải sửa file của người kia thì nhắn trước.

## 4. Kiến trúc đích

```
 KÊNH        Web khách · Web admin · Email · Telegram (sale, khách) · App Expo (giai đoạn 4)
                                     │
 n8n         Đã có: L1 L1b L2 L3 L4 L5 + Error
             Mới:   Sub-workflow "Thông báo nhân viên"
                    L6 Telegram Agent  (Hoàng)
                    L7 Đồng bộ sang Mautic, L8 Mautic báo về  (Hậu)
                                     │
 DỊCH VỤ     Backend NestJS · Postgres (+ pgvector) · Gemini · Mautic + MySQL · Langfuse Cloud
             Tất cả chạy trên realestate-vm (Langfuse là dịch vụ cloud)
```

Ba vòng lặp hệ thống có sau khi tích hợp:

| Vòng | Diễn ra thế nào |
|---|---|
| Hội thoại (Agentic) | Khách chat Telegram → Agent dùng tool + RAG → gợi ý nhà → đặt lịch = gọi backend → L1 (vẫn có bước sale duyệt) → Agent nhớ ngữ cảnh |
| Marketing (MA) | Lead → Mautic (tag) → chiến dịch nuôi khách → khách mở / bấm → điểm tăng → webhook về n8n → vượt ngưỡng thì báo sale |
| Học hỏi (data flywheel) | Kết quả SIGNED / LOST và cảm nhận (L5) đối chiếu với điểm AI ban đầu → đo trên Langfuse → chỉnh prompt L1 |

Chấm điểm hai trục: **AI score** (độ phù hợp, L1 chấm khi đăng ký) và **Mautic points** (mức tương tác). Sale ưu tiên gọi khách cao ở cả hai trục.

## 5. Chuyển nhắc khách WARM sang Mautic (D-10)

L2 vẫn quyết định ai cần nuôi. Mautic lo chuỗi email.

| Tiêu chí | Trước (L2 gửi) | Sau (Mautic) |
|---|---|---|
| Điều kiện chọn khách | WARM, `VIEWED`, đã hỏi cảm nhận hơn 3 ngày, chưa nhắc | **Giữ nguyên** câu SQL trong L2 |
| Việc L2 làm | Gemini viết email, gửi, email nhân viên, ghi `WARM_NUDGE_SENT` | Gemini viết đoạn mở đầu (giữ guardrail) → ghi vào trường contact `ai_nudge_text` → thêm contact vào segment **"Nuôi WARM"** → ghi `WARM_NURTURE_STARTED` |
| Số email | 1 | Chuỗi 2–3 email, rẽ nhánh theo hành vi |
| Nội dung | AI viết riêng | Mẫu Mautic chèn `{contactfield=ai_nudge_text}` + 2–3 căn tương tự (link có tracking) |
| Biết khách đọc chưa | Không | Có lượt mở (độ tin thấp) và lượt bấm (độ tin cao) |
| Báo nhân viên | Luôn báo khi gửi | Chỉ báo khi khách **bấm xem căn** (qua L8 → sub-workflow) |
| Dừng khi khách tiến triển | Không cần | Lead đổi sang DEPOSIT / SIGNED / LOST → L7 gỡ khỏi segment → tự thoát chiến dịch |
| Huỷ nhận email | Không có | Mautic lo |
| Chống gửi trùng | `NOT EXISTS WARM_NUDGE_SENT` | `NOT EXISTS WARM_NURTURE_STARTED` |
| Khi Mautic lỗi | — | Ghi `FOLLOWUP_FAILED`, lượt sau thử lại (cơ chế có sẵn của L2) |

Chiến dịch "Nuôi WARM" trong Mautic:

```
Ngày 0  Email 1 = {ai_nudge_text} + căn tương tự
          ├ bấm link căn → +điểm → webhook → L8 → báo sale "khách vừa xem căn X"
          ├ mở mail, không bấm, sau 3 ngày → Email 2 (nội dung khác)
          └ không mở sau 3 ngày → Email 2 (tiêu đề khác)
Ngày 7  vẫn im → gắn tag "nguội", thoát chiến dịch
```

L2 giữ nguyên `REMINDER`, `FEEDBACK`, `STAFF_NUDGE`. `STAFF_NUDGE` chuyển sang gọi sub-workflow thông báo.

## 6. Các giai đoạn và mức ưu tiên

### Giai đoạn 1: Hoàn thiện web với nghiệp vụ hiện có

| # | Việc | Ai |
|---|---|---|
| 1.1 | Cột `leads.source`, form đặt lịch nhận `?utm_source=`, chi tiết lead hiện nguồn | Hậu |
| 1.2 | Nút Gọi (`tel:`) và Email (`mailto:`) ở chi tiết lead | Hoàng |
| 1.3 | Kiểm tra web admin trên màn hình điện thoại, sửa chỗ vỡ (nhất là danh sách lead) | Hoàng |
| 1.4 | Sửa tài liệu cho khớp `main` (link hỏng, `/ky`, 6 luồng + Error, ma trận công nghệ, SYS-06 "AI rà soát", app ở giai đoạn 4). Bàn trước khi sửa mục chung | Hậu |
| 1.5 | Bộ 20 lead có nhãn và cách chạy đo | Hoàng |

### Giai đoạn 2: Mautic (Hậu)

| # | Việc |
|---|---|
| 2.1 | Hạ tầng: `docker-compose.mautic.yml` (web, cron, worker, MySQL), tên biến trong `.env.example`, ghi chú block Caddy, sao lưu volume MySQL. Đọc repo `mautic/docker-mautic` trước khi viết |
| 2.2 | Phân vai email theo D-09 |
| 2.3 | **L7 Đồng bộ sang Mautic:** webhook `lead-changed` → tạo / cập nhật contact kèm tag (thành phố, level, source, trạng thái) |
| 2.4 | **L8 Mautic báo về:** webhook Mautic (đổi điểm, mở mail, bấm link, gửi form) → ghi `lead_events` và điểm qua API → vượt ngưỡng thì gọi sub-workflow thông báo |
| 2.5 | Chấm điểm hai trục: API backend + component `MauticScoreCard` ở chi tiết lead |
| 2.6 | Gắn script tracking của Mautic vào web khách |
| 2.7 | Form đăng ký nhận tin của Mautic (D-11) |
| 2.8 | Ô đồng ý nhận email trên form (Nghị định 13/2023) |
| 2.9 | Chuyển WARM sang Mautic (mục 5). L5 "xem căn khác" → gắn tag. L4 thêm số liệu theo nguồn và chiến dịch |

### Giai đoạn 3: Agentic AI (Hoàng)

| # | Việc |
|---|---|
| 3.1 | Sub-workflow "Thông báo nhân viên" (D-12). L1 chuyển sang gọi nó |
| 3.2 | Telegram cho sale: lead HOT kèm nút Duyệt / Đổi giờ (mở `approvalUrl`), lệnh `/homnay` |
| 3.3 | **L6 Telegram Agent cho khách:** AI Agent + Postgres Chat Memory. Tool: tìm nhà, hỏi đáp RAG, đặt lịch (đi vào L1), tra trạng thái |
| 3.4 | RAG trên pgvector: mô tả nhà, quy trình đặt cọc, FAQ |
| 3.5 | Langfuse cho L1, đo bộ 20 lead |
| 3.6 | Mục báo cáo ánh xạ framework (LangChain qua n8n, RAG ~ LlamaIndex, Langfuse) |
| 3.7 | *(Tuỳ chọn)* Multi-agent cho L4 |

### Giai đoạn 4: App Expo

| # | Việc | Ai |
|---|---|---|
| 4.1 | Đưa `app/` từ `dev` sang `main` | Hoàng |
| 4.2 | Hiển thị điểm Mautic và nguồn khách trong app | Hậu |
| 4.3 | Thêm nhánh Expo Push vào sub-workflow thông báo | Hoàng |
| 4.4 | `npx eas init`, chạy thử trên điện thoại thật | Hoàng |

Dự phòng: nếu tới 22/11 còn trễ, chỉ làm 4.1 + 4.3 + 4.4 (đưa app sang nguyên trạng).

### Giai đoạn 5: Hoàn thiện

Báo cáo (mỗi người viết phần luồng của mình), video dự phòng, khoá code 3/12, nộp 5/12.

### Mức ưu tiên (để cắt khi thiếu giờ)

| Mức | Việc |
|---|---|
| **Bắt buộc** | Nền móng · giai đoạn 1 · Mautic + L7 + L8 + chuyển WARM · sub-workflow + Telegram sale · L6 (memory + tool tìm nhà + tool đặt lịch) · đo 20 lead (có hay không có Langfuse) · app đưa sang nguyên trạng + push · báo cáo |
| **Nên có** | RAG pgvector · Langfuse · tracking web Mautic · form nhận tin · hai trục điểm trên web |
| **Bỏ nếu thiếu giờ** | Màn điểm Mautic trong app · L5 gắn tag Mautic · multi-agent L4 |

Nếu tuần 16–22/11 trễ thì cắt mục "Nên có" trước, để giữ mốc web hoàn thành.

## 7. Phân việc

| | **Hoàng** | **Hậu** |
|---|---|---|
| Luồng đang sở hữu | L1, L1b, L3, Error | L2, L4, L5 |
| Nền móng (tuần 1) | **PR-F2:** sub-workflow thông báo; chừa chỗ ở trang chi tiết lead; mục menu mới; commit compose prod + Caddyfile lên `main`. pgvector để tuần 2 (D-14) | **PR-F1:** cột `source`, `mautic_contact_id`, `mautic_points`; loại event mới; webhook `lead-changed` trong `leads.service` (không có URL thì bỏ qua) |
| Giai đoạn 1 | 1.2, 1.3, 1.5 | 1.1, 1.4 |
| Giai đoạn 2–3 | Giai đoạn 3 | Giai đoạn 2 |
| Luồng mới ≥ 12 node | L6 | L7, L8 |
| Giai đoạn 4 | 4.1, 4.3, 4.4 | 4.2 |
| Giai đoạn 5 | Báo cáo L1, L3, L6, Agentic, đo lường | Báo cáo L2, L4, L5, L7, L8, Marketing Automation, mục framework (3.6) |
| Hạ tầng server | Có SSH, deploy, giữ `.env` server | Không SSH, giao bằng PR, cấu hình Mautic qua trình duyệt |

Hoàng cần làm cho Hậu: tạo tài khoản n8n trên server cho Hậu (nếu bản n8n đang chạy cho mời thành viên; không được thì Hậu gửi JSON qua PR để Hoàng import). Nên chốt lịch deploy cố định, ví dụ tối thứ Tư và tối thứ Sáu.

## 8. File dùng chung và cách tránh đụng nhau

| File | Cách gỡ |
|---|---|
| `backend/src/leads/entities/lead.entity.ts` | Mọi cột mới thêm một lần trong PR-F1 |
| `backend/src/leads/lead.constants.ts` | Mọi loại event mới thêm trong PR-F1 |
| `backend/src/leads/leads.service.ts` | PR-F1 thêm lời gọi webhook `lead-changed`, sau đó không ai sửa |
| `web/src/lib/api.ts` | Hàm mới viết ở file riêng: `lib/api/mautic.ts` (Hậu), `lib/api/telegram.ts` (Hoàng) |
| `web/src/app/admin/leads/[id]/page.tsx` | PR-F2 chừa chỗ; mỗi người viết component riêng (`MauticScoreCard.tsx`, `ContactButtons.tsx`) |
| `web/src/components/AdminShell.tsx` | Mục menu mới thêm trong PR-F2 |
| `docker-compose.prod.yml` | Hoàng sở hữu. Mautic ở file riêng của Hậu (D-04) |
| `n8n-workflows/*.json` | Mỗi người chỉ sửa luồng của mình. Gọi nhau qua sub-workflow có đầu vào cố định |
| `docs/tong-quan-du-an.md`, `docs/use-case.md`, file này | Mỗi người sửa mục của mình, bàn trước khi sửa mục chung |

Quy tắc Git: PR nhỏ; kéo `main` về mỗi ngày trước khi làm; có thể thêm `.github/CODEOWNERS` để PR đụng file của người kia tự gắn người đó vào review.

## 9. Lịch

### Tuần demo (20–24/10)

| Ngày | Hậu | Hoàng |
|---|---|---|
| T3 20/10 | PR-F1 | Commit compose prod + Caddyfile lên `main`, tạo bot Telegram |
| T4 21/10 | UTM / source; dựng Mautic ở local | Merge F1; sub-workflow + L1 gửi Telegram kèm nút Duyệt. **Tối: tạo tài khoản n8n server cho Hậu** |
| T5 22/10 | Mautic + L7 chạy ở local → mở PR (compose Mautic, L7 JSON, ghi chú Caddy) | Nút Gọi / Email; chạy thử local. **Tối: deploy Mautic lên server** |
| T6 23/10 | Qua trình duyệt: cài Mautic server, API user, import L7, chạy thử | Deploy bản cuối, chạy thử toàn bộ, kịch bản demo. **21h khoá code** |
| T7 24/10 | **Demo** | **Demo** |

Kịch bản demo (khoảng 10 phút):

1. Khách mở `…/nha/3?utm_source=facebook` và đặt lịch.
2. Khách nhận email; **sale nhận Telegram** kèm điểm AI và nút Duyệt.
3. Sale bấm Duyệt trên Telegram → khách nhận email chốt lịch.
4. Mở Mautic: contact mới có tag HOT, thành phố, facebook.
5. Web admin, chi tiết lead: nguồn khách, nút Gọi / Email, dòng thời gian.
6. Slide kế hoạch còn lại.

Dự phòng:

| Nếu | Thì |
|---|---|
| Tối T5 Mautic chưa lên server | Demo Mautic + L7 trên máy local của Hậu |
| Telegram trục trặc | Sub-workflow vẫn gửi email |
| Server lỗi sáng T7 | Chạy `docker compose` local, chuẩn bị sẵn từ tối T6 |

### Tới hạn nộp

| Tuần | Ngày | Hậu | Hoàng |
|---|---|---|---|
| 1 | 20–24/10 | Nền móng + lát demo | Nền móng + lát demo |
| 2 | 26/10–1/11 | L8 + chuyển WARM | pgvector + L6 (memory, tìm nhà, đặt lịch) |
| 3 | 2–8/11 | Tracking web + form + ô đồng ý | RAG + Telegram `/homnay` |
| 4 | 9–15/11 | Hai trục điểm trên web, L4 thêm nguồn / chiến dịch | 20 lead + Langfuse L1, giao diện điện thoại |
| 5 | 16–22/11 | Tích hợp chéo, sửa lỗi, tài liệu → **web hoàn thành 22/11** | như bên trái |
| 6 | 23–29/11 | App: 4.2 | App: 4.1, 4.3, 4.4 |
| 7 | 30/11–5/12 | Báo cáo, video, **khoá code 3/12**, **nộp 5/12** | như bên trái |

## 10. Còn chưa chốt / cần kiểm tra khi làm

| # | Việc | Ghi chú |
|---|---|---|
| O-01 | Telegram cho khách, cho sale, hay cả hai | Kế hoạch đang mặc định **cả hai, sale trước** (3.2 rồi 3.3) |
| O-02 | API tạo contact của Mautic có gộp vào contact cũ khi trùng email không | Ảnh hưởng L7 |
| O-03 | Trình dựng chiến dịch Mautic rẽ nhánh được theo "đã mở" / "đã bấm" không | Ảnh hưởng mục 5 |
| O-04 | n8n trên server có mời thêm thành viên được không | Ảnh hưởng mục 7 |
| O-05 | Cách gửi trace từ n8n lên Langfuse (node cộng đồng hay HTTP Request), cách lấy các bước của agent | Ảnh hưởng 3.5 |
| O-06 | `docker-compose.prod.yml` và Caddyfile hiện chỉ có ở nhánh local `claude/gcl-cli-auth-check-f804f8`, chưa lên `main` | Hoàng commit lên `main` ở PR-F2 (không kèm `.env`) |

## 11. Nhật ký thay đổi

| Ngày | Thay đổi |
|---|---|
| 20/10/2026 | Tạo file. Chốt D-01 đến D-16 |
