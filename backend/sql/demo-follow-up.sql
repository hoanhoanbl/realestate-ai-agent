-- Xoá dữ liệu mẫu cũ (chỉ các lead dùng email +demo)
DELETE FROM lead_events WHERE lead_id IN (SELECT id FROM leads WHERE email LIKE 'nhadn2457+demo%');
DELETE FROM viewings    WHERE lead_id IN (SELECT id FROM leads WHERE email LIKE 'nhadn2457+demo%');
DELETE FROM leads       WHERE email LIKE 'nhadn2457+demo%';

-- REMINDER: đã chốt lịch, xem sau 5 giờ nữa
WITH l AS (
  INSERT INTO leads (name, email, phone, budget, needs, score, level, reason, status, automation_status)
  VALUES ('Nguyễn Văn Nhắc', 'nhadn2457+demo1@gmail.com', '0900000001', 3000000000, 'Căn hộ 2PN', 85, 'HOT', 'Dữ liệu mẫu', 'CONFIRMED', 'COMPLETED')
  RETURNING id)
INSERT INTO viewings (property_id, lead_id, viewing_time, status) SELECT 1, id, now() + interval '5 hours', 'NEW' FROM l;

-- FEEDBACK: đã chốt lịch, giờ xem đã qua 2 ngày
WITH l AS (
  INSERT INTO leads (name, email, phone, budget, needs, score, level, reason, status, automation_status)
  VALUES ('Trần Thị Cảm', 'nhadn2457+demo2@gmail.com', '0900000002', 2800000000, 'Căn hộ gần trường học', 78, 'HOT', 'Dữ liệu mẫu', 'CONFIRMED', 'COMPLETED')
  RETURNING id)
INSERT INTO viewings (property_id, lead_id, viewing_time, status) SELECT 1, id, now() - interval '2 days', 'NEW' FROM l;

-- WARM_NUDGE: WARM, đăng ký 4 ngày trước, chưa tiến triển
WITH l AS (
  INSERT INTO leads (name, email, phone, budget, needs, score, level, reason, status, automation_status, created_at)
  VALUES ('Lê Minh Ấm', 'nhadn2457+demo3@gmail.com', '0900000003', 3000000000, '', 55, 'WARM', 'Dữ liệu mẫu', 'NEW', 'COMPLETED', now() - interval '4 days')
  RETURNING id)
INSERT INTO viewings (property_id, lead_id, viewing_time, status) SELECT 1, id, now() + interval '3 days', 'NEW' FROM l;
