-- Tài khoản CHỈ ĐỌC cho AI Agent của luồng 4 (báo cáo kinh doanh).
--
-- Vì sao cần: AI Agent tự viết câu SQL để tra cứu thêm. Nếu dùng tài khoản chính, một câu SQL sai (hoặc một
-- đoạn chữ độc hại do khách nhập vào ô "nhu cầu" lừa được AI) có thể sửa hoặc xoá dữ liệu. Tài khoản này
-- chỉ SELECT được, chỉ thấy các cột cần cho báo cáo (không thấy mật khẩu, token, chữ ký, link duyệt).
--
-- Chạy một lần (thay MAT_KHAU bằng chuỗi ngẫu nhiên, rồi nhập vào credential Postgres trong n8n):
--   docker exec -i realestate-db psql -U <DB_USER> -d <DB_NAME> -v pw=MAT_KHAU < backend/sql/readonly-role.sql

SELECT format('CREATE ROLE n8n_readonly LOGIN PASSWORD %L', :'pw')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'n8n_readonly') \gexec

SELECT format('ALTER ROLE n8n_readonly WITH PASSWORD %L', :'pw') \gexec

-- Mọi giao dịch của tài khoản này mặc định chỉ đọc và tối đa 10 giây mỗi câu lệnh
ALTER ROLE n8n_readonly SET default_transaction_read_only = on;
ALTER ROLE n8n_readonly SET statement_timeout = '10s';

SELECT format('GRANT CONNECT ON DATABASE %I TO n8n_readonly', current_database()) \gexec
GRANT USAGE ON SCHEMA public TO n8n_readonly;

-- Bảng không chứa dữ liệu nhạy cảm: cho đọc toàn bộ
GRANT SELECT ON properties, viewings, lead_events, weekly_reports TO n8n_readonly;

-- Bảng có cột nhạy cảm: chỉ cho đọc các cột cần thiết
GRANT SELECT (id, name, email, phone, budget, needs, score, level, reason, status,
              automation_status, automation_error, created_at, source, assigned_user_id,
              assigned_at, response_due_at, first_response_at) ON leads TO n8n_readonly;
GRANT SELECT (id, lead_id, property_id, title, deposit_amount, property_price, status,
              approved_by, created_by, signed_at, created_at) ON contracts TO n8n_readonly;
GRANT SELECT (id, lead_id, rating, interest, comment, submitted_at,
              ai_sentiment, ai_summary, ai_next_action, created_at) ON feedbacks TO n8n_readonly;
-- Bảng users (mật khẩu băm, push token) không được cấp gì.
