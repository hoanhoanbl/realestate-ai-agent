-- Additive schema only. Does not backfill old feedback or change demo records.
BEGIN;
CREATE TABLE IF NOT EXISTS feedback_work (
  id SERIAL PRIMARY KEY,
  feedback_id INTEGER NOT NULL,
  lead_id INTEGER NOT NULL,
  viewing_id INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  version INTEGER NOT NULL DEFAULT 1,
  due_at TIMESTAMPTZ NOT NULL,
  escalate_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_work_feedback ON feedback_work(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_work_lead ON feedback_work(lead_id);
CREATE TABLE IF NOT EXISTS feedback_work_history (
  id SERIAL PRIMARY KEY,
  work_id INTEGER NOT NULL,
  actor_user_id INTEGER NOT NULL,
  actor_name VARCHAR(255) NOT NULL,
  outcome VARCHAR(30) NOT NULL,
  note TEXT NOT NULL,
  next_due_at TIMESTAMPTZ,
  next_viewing_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_work_history_work ON feedback_work_history(work_id);
CREATE TABLE IF NOT EXISTS feedback_work_alerts (
  id SERIAL PRIMARY KEY,
  work_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  kind VARCHAR(20) NOT NULL,
  assignee_id INTEGER NOT NULL DEFAULT 0,
  state VARCHAR(20) NOT NULL,
  token VARCHAR(64) NOT NULL,
  lease_until TIMESTAMPTZ NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_work_alert ON feedback_work_alerts(work_id,version,kind,assignee_id);
COMMIT;
