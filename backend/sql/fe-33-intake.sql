-- FE-33: chạy trên bản sao lưu trước, sau đó chạy trước khi khởi động backend bản mới.
-- Không gộp/xoá lead cũ, không đổi status hay người phụ trách cũ.
-- psql -v ON_ERROR_STOP=1 -f backend/sql/fe-33-intake.sql
BEGIN;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_normalized varchar(20);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_user_id integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS response_due_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_response_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS interested_property_ids integer[];
ALTER TABLE leads ALTER COLUMN email DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN budget DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id varchar(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepting_leads boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_assigned_at timestamptz;
ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS actor_user_id integer;
ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS lead_id integer;

UPDATE leads
SET phone_normalized = regexp_replace(regexp_replace(phone, '[[:space:].()\-]', '', 'g'), '^\+84', '0')
WHERE phone_normalized IS NULL
  AND phone ~ '^[+0-9[:space:].()\-]+$'
  AND regexp_replace(regexp_replace(phone, '[[:space:].()\-]', '', 'g'), '^\+84', '0') ~ '^[0-9]{8,15}$';
CREATE INDEX IF NOT EXISTS idx_leads_phone_normalized ON leads(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_user ON leads(assigned_user_id);
COMMIT;

-- Báo cáo khách cũ trùng số để nhóm xử lý riêng; KHÔNG tạo unique index khi chưa chốt cách gộp.
SELECT phone_normalized, array_agg(id ORDER BY id) AS lead_ids
FROM leads WHERE phone_normalized IS NOT NULL
GROUP BY phone_normalized HAVING count(*) > 1;
