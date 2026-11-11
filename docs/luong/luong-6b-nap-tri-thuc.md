# Luồng 6b: Nạp tri thức cho bot

File: `n8n-workflows/luong-6b-nap-tri-thuc.json` (11 node, không tính ghi chú; id `luong6bRagNap001`).
Kích hoạt: bấm tay (`Chạy tay`) hoặc tự chạy **2 giờ sáng mỗi ngày** (`Mỗi đêm 2h`, cron `0 2 * * *`). Không có webhook.

Khung chung của các tài liệu luồng: [README.md](README.md).

## 1. Làm gì trong thực tế

Bot ở [luồng 6](luong-6-telegram-agent.md) cần trả lời câu "đặt cọc cần giấy tờ gì?" hay "căn này gần chợ không?" mà không bịa. Luồng 6b là người **chép tài liệu vào sổ tra cứu** của bot:

- Đọc mọi căn nhà chưa bán (bảng `properties`) và các tài liệu quy trình, hỏi đáp (bảng `kb_documents`).
- Cắt nhỏ thành đoạn, đổi mỗi đoạn thành một dãy số đại diện cho ý nghĩa (embedding, bằng Gemini).
- Lưu vào kho vector pgvector (bảng `rag_chunks`). Công cụ `Hỏi đáp tri thức` của luồng 6 tìm đoạn gần nghĩa nhất với câu khách hỏi.

Có luồng này nên sửa tài liệu hoặc thêm nhà thì bot biết mà không phải sửa lời nhắc.

## 2. Ai tham gia

| Bên | Vai trò |
|---|---|
| Hoàng | Sửa `kb_documents`, bấm chạy tay sau khi sửa |
| Bot khách (luồng 6) | Người đọc kho vector |
| Gemini | Tạo embedding |
| Database | Nguồn (`properties`, `kb_documents`) và đích (`rag_chunks`) |

Luồng 6b không có khách hay sale tham gia trực tiếp.

## 3. Từng bước

```
Chạy tay / Mỗi đêm 2h
      |
[1 Kích hoạt và đọc dữ liệu] Đọc căn nhà -> Đọc tài liệu -> Gom tài liệu
      |
[2 Embedding và lưu pgvector] Lưu vào pgvector  <- Nạp tài liệu <- Cắt đoạn
      |                       <- Gemini Embedding
[3 Dọn bản cũ và thống kê] Xoá bản cũ -> Thống kê
```

**1. Kích hoạt và đọc dữ liệu.**
- `Đọc căn nhà`: mọi căn có trạng thái khác `SOLD` (gồm cả `RESERVED`).
- `Đọc tài liệu`: mọi dòng của `kb_documents`.
- `Gom tài liệu` đổi mỗi căn và mỗi tài liệu thành một mục có `text`, `source`, `ref`, `title`, `category`. Với căn nhà, `text` gồm mã, tên, loại (tiếng Việt), địa chỉ, giá (đổi ra tỷ), diện tích, trạng thái ("đã có người đặt cọc, không nhận lịch xem" hoặc "đang bán") và mô tả. `source` là `property` với căn nhà (`ref` là mã căn) và `kb` với tài liệu (`ref` là `slug`). Không có căn nào lẫn tài liệu nào thì luồng báo lỗi.

**2. Embedding và lưu pgvector.**
`Cắt đoạn` cắt nội dung (đoạn chồng nhau 150 ký tự), `Nạp tài liệu` gắn metadata `source`, `ref`, `title`, `category` và `batch`, `Gemini Embedding` tạo embedding, `Lưu vào pgvector` ghi vào `rag_chunks`. `batch` là mã lần chạy (`$execution.id`).

**3. Dọn bản cũ và thống kê.**
`Xoá bản cũ` xoá các đoạn có `batch` khác lần chạy này, **sau khi** nạp xong. Vì vậy nếu lỗi giữa chừng thì bản cũ vẫn còn và bot không bị trống tri thức. `Thống kê` trả số đoạn và số tài liệu theo `source`.

## 4. Nối với hệ thống

| Thành phần | Quan hệ |
|---|---|
| `kb_documents` | Do [`backend/sql/rag-kb.sql`](../../backend/sql/rag-kb.sql) tạo và nạp 10 tài liệu hỏi đáp. File chạy lại được, dùng `ON CONFLICT` nên sửa nội dung không tạo bản ghi trùng |
| `properties` | Thêm hoặc sửa nhà trên web admin (Quản lý nhà) thì lần nạp sau mới phản ánh vào bot |
| `rag_chunks` | Đọc bởi công cụ `Hỏi đáp tri thức` của luồng 6 (4 đoạn gần nhất mỗi lần hỏi) |

Luồng 6b không gọi API backend, chỉ đọc ghi thẳng database bằng credential Postgres của dự án.

**Độ trễ.** Sửa nhà hoặc tài liệu xong, bot chỉ biết sau lần nạp kế tiếp (đêm 2 giờ) hoặc khi bấm chạy tay. Trong lúc chờ, bot có thể nói giá hoặc trạng thái cũ; lời nhắc của Agent dặn kiểm tra lại giá và trạng thái bằng `Tìm nhà` trước khi báo giá hay đặt lịch.

## 5. Khi lỗi thì sao

| Lỗi | Điều xảy ra |
|---|---|
| Không có dữ liệu để nạp | `Gom tài liệu` báo lỗi, luồng dừng, [Error workflow](error-workflow.md) báo quản lý |
| Gemini hoặc database lỗi giữa chừng | Lần chạy thất bại; do bước xoá bản cũ nằm cuối nên `rag_chunks` vẫn giữ dữ liệu lần trước. Có thể còn sót một phần đoạn của lần lỗi (có `batch` mới), và lần chạy kế sẽ xoá |
| Bảng `kb_documents` chưa có | `Đọc tài liệu` lỗi. Chạy `rag-kb.sql` trước (mục 6) |

Cách chạy lại: mở workflow trong n8n và bấm **Execute workflow**.

## 6. Triển khai lên server

| Mục | Giá trị |
|---|---|
| Workflow id | `luong6bRagNap001` |
| Credential | Gemini `wU5LeG7gXaoUdMXQ`, Postgres `postgres_account_id` |
| Biến `.env` | Không có biến riêng |
| Việc làm tay | Chạy `backend/sql/rag-kb.sql` một lần để có bảng `kb_documents`; database phải có extension `vector` (image `pgvector/pgvector:pg16` đi kèm; database tạo mới tự bật qua `db/init/01-pgvector.sql`, database cũ chạy `CREATE EXTENSION IF NOT EXISTS vector;`). Sau đó bấm chạy tay luồng 6b để có dữ liệu ngay, không chờ 2 giờ sáng |
| Error workflow | Chọn `errorWfRealestat` trong Settings |

Hiện trạng:

- **Server:** luồng 6b đã bật (5/11). Bước 1 đến 5 của `v0.3.0` (mục 8 của [trien-khai.md](../trien-khai.md)) đã chạy ngày 5/11, gồm nạp `rag-kb.sql`, import và chạy luồng 6b. Bot trả lời đúng câu "đặt cọc cần giấy tờ gì" theo tài liệu tri thức.
- **Sau khi sửa tri thức:** chạy lại `rag-kb.sql` (nếu sửa tài liệu) rồi bấm chạy tay luồng 6b. Lệnh kiểm tra:

  ```bash
  docker exec realestate-db psql -U realestate -d realestate -Atc "select metadata->>'source', count(*) from rag_chunks group by 1"
  ```

  Mong đợi có hai dòng: `kb` và `property`.
- **Chưa kiểm trên server:** chất lượng truy xuất khi tri thức dài hơn 10 tài liệu hiện tại; chưa có số đo.

## 7. Cách chạy thử

1. Có bảng `kb_documents`: chạy `rag-kb.sql` như hướng dẫn trong đầu file.
2. Trong n8n, mở "Luồng 6b: Nạp tri thức RAG" và bấm **Execute workflow**.
3. Mong đợi: các node đều xanh; `Thống kê` trả hai dòng (`kb` với 10 tài liệu và số đoạn lớn hơn hoặc bằng 10, `property` với số căn chưa bán).
4. Hỏi bot khách "Đặt cọc cần giấy tờ gì?" (xem [luồng 6](luong-6-telegram-agent.md) mục 7): câu trả lời nêu giấy tờ theo tài liệu, không bịa.
5. Sửa mô tả một căn trên web admin, chạy lại luồng 6b, hỏi bot về căn đó: bot nêu mô tả mới.
