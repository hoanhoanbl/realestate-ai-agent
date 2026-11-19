-- FE-43: cột nền cho hành trình khách (change journey-followup-ladder, design D8 và D10).
-- Chạy trên bản sao lưu trước, sau đó chạy TRƯỚC khi khởi động backend bản mới.
-- Chỉ thêm cột nên backend cũ vẫn chạy được sau khi script chạy. Chạy lại nhiều lần không đổi gì thêm.
-- psql -v ON_ERROR_STOP=1 -f backend/sql/fe-43-journey.sql
BEGIN;

-- Lần đầu liên hệ được với khách (FE-44 ghi). Null nghĩa là chưa liên hệ được.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contacted_at timestamptz;

-- Hợp đồng: chỉ là cột. FE-48 ghi giá thoả thuận, FE-49 ghi bản đã ký.
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS agreed_price bigint;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_file_path varchar(300);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_file_sha256 varchar(64);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_file_stored_at timestamptz;

-- Khách đã từng đến xem thì đã liên hệ được: lấy giờ hẹn sớm nhất của buổi đã điểm danh "Có đến".
-- Chỉ điền chỗ còn trống, nên không ghi đè giá trị FE-44 đã ghi.
UPDATE leads l
SET contacted_at = v.first_attended
FROM (
  SELECT lead_id, min(viewing_time) AS first_attended
  FROM viewings
  WHERE status = 'ATTENDED' AND viewing_time IS NOT NULL
  GROUP BY lead_id
) v
WHERE v.lead_id = l.id AND l.contacted_at IS NULL;

COMMIT;

-- Báo số lead đã được điền để người chạy đối chiếu (không đổi dữ liệu).
SELECT count(*) AS leads_co_contacted_at, count(*) FILTER (WHERE status = 'VIEWED') AS trong_do_da_xem
FROM leads WHERE contacted_at IS NOT NULL;
