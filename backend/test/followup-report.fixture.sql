BEGIN;
CREATE TEMP TABLE leads(id int,created_at timestamptz,level text,status text,automation_status text,source text,assigned_user_id int,response_due_at timestamptz,first_response_at timestamptz) ON COMMIT DROP;
CREATE TEMP TABLE lead_events(lead_id int,type text,note text,created_at timestamptz) ON COMMIT DROP;
CREATE TEMP TABLE contracts(status text,signed_at timestamptz,deposit_amount bigint,created_at timestamptz,lead_id int) ON COMMIT DROP;
CREATE TEMP TABLE feedbacks(submitted_at timestamptz,rating int) ON COMMIT DROP;
INSERT INTO leads VALUES(1,'2026-09-01','COLD','LOST','COMPLETED','facebook');
INSERT INTO leads(id,created_at,level,status,automation_status,source,assigned_user_id) VALUES(2,'2026-11-03','HOT','SIGNED','COMPLETED','hotline',9);
INSERT INTO lead_events VALUES
 (1,'LEAD_EXPIRED','fixture','2026-11-04'),
 (1,'LEAD_EXPIRED','duplicate event must not double count','2026-11-05'),
 (2,'LEAD_EXPIRED','previous period','2026-10-31'),
 (3,'LEAD_EXPIRED','exclusive end boundary','2026-11-08'),
 (4,'VIEWING_NO_SHOW','not expiry','2026-11-04'),
 (5,'LEAD_EXPIRED_NOTIFIED','notification is not closure','2026-11-04');
INSERT INTO lead_events VALUES(2,'APPROVED','first viewing','2026-11-04'),(2,'APPROVED','second viewing','2026-11-05'),(4,'VIEWING_NO_SHOW','repeat','2026-11-05');
INSERT INTO contracts(status,signed_at,deposit_amount,created_at,lead_id) VALUES('SIGNED','2026-11-05',100,'2026-11-04',2),('SIGNED','2026-11-06',50,'2026-11-05',2);
PREPARE current_report(timestamptz,timestamptz) AS
-- CURRENT_QUERY
;
PREPARE previous_report(timestamptz,timestamptz) AS
-- PREVIOUS_QUERY
;
CREATE TEMP TABLE actual_current AS EXECUTE current_report('2026-11-01','2026-11-08');
CREATE TEMP TABLE actual_previous AS EXECUTE previous_report('2026-10-25','2026-11-01');
DO $$ BEGIN
 IF (SELECT expired FROM actual_current) <> 1 THEN RAISE EXCEPTION 'Current expiry count must use unique lead, closure time and exclusive end'; END IF;
 IF (SELECT expired FROM actual_previous) <> 1 THEN RAISE EXCEPTION 'Previous expiry count wrong'; END IF;
 IF (SELECT no_show FROM actual_current) <> 1 THEN RAISE EXCEPTION 'Do not conflate expiry and no-show'; END IF;
 IF (SELECT confirmed FROM actual_current) <> 1 OR (SELECT signed FROM actual_current) <> 1 THEN RAISE EXCEPTION 'One customer must not be counted per viewing/contract'; END IF;
 IF (SELECT (assignees_breakdown->>'9')::int FROM actual_current) <> 1 THEN RAISE EXCEPTION 'Missing assignee breakdown'; END IF;
END $$;
ROLLBACK;
