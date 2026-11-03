BEGIN;
CREATE TEMP TABLE leads(id int,name text,email text,phone text,needs text,level text,status text,created_at timestamptz,consent_marketing boolean,mautic_contact_id int) ON COMMIT DROP;
CREATE TEMP TABLE viewings(id int,lead_id int,property_id int,viewing_time timestamptz,status text DEFAULT 'NEW') ON COMMIT DROP;
CREATE TEMP TABLE lead_events(lead_id int,type text,note text,created_at timestamptz) ON COMMIT DROP;
CREATE TEMP TABLE feedbacks(lead_id int,submitted_at timestamptz) ON COMMIT DROP;
CREATE TEMP TABLE followup_tasks(lead_id int,type text,viewing_id int,viewing_time timestamptz,state text,available_at timestamptz,lease_until timestamptz,task_key text) ON COMMIT DROP;

INSERT INTO leads
SELECT id,'Test','test@example.invalid','0900000000','',
 CASE WHEN id IN (2,3,9) THEN 'WARM' ELSE 'HOT' END,
 CASE WHEN id=4 THEN 'NEW' WHEN id IN (2,3,5,9) THEN 'VIEWED' WHEN id=13 THEN 'SIGNED' ELSE 'CONFIRMED' END,
 now()-interval '4 days',id<>3,NULL
FROM generate_series(1,13) id;
-- Only the intended cases have a viewing. Lead 6/10 were rescheduled.
INSERT INTO viewings(id,lead_id,property_id,viewing_time)
SELECT id,id,1,CASE WHEN id IN (2,3,9) THEN now()-interval '6 days'
 WHEN id=5 THEN now()-interval '3 hours' WHEN id=4 THEN now()+interval '3 days'
 WHEN id=13 THEN now()-interval '2 days' ELSE now()+interval '5 hours' END
FROM generate_series(1,13) id WHERE id<>11;
INSERT INTO viewings VALUES(11,11,1,now()+interval '6 hours');
UPDATE viewings SET status='ATTENDED' WHERE lead_id IN (2,3,5,9);
INSERT INTO lead_events SELECT id,'FEEDBACK_ASKED','test',now()-interval '4 days' FROM generate_series(2,3) id;
INSERT INTO lead_events VALUES(9,'FEEDBACK_ASKED','test',now()-interval '4 days');
INSERT INTO feedbacks VALUES(9,now()-interval '1 day');
INSERT INTO lead_events VALUES
 (6,'REMINDER_SENT','legacy',now()-interval '1 day'),(6,'VIEWING_RESCHEDULED','changed',now()-interval '1 hour'),
 (7,'FOLLOWUP_FAILED','REMINDER: failed',now()-interval '1 hour'),
 (8,'FOLLOWUP_FAILED','Lỗi đồng bộ Mautic cho lead #8: 401',now()-interval '1 hour'),
 (10,'VIEWING_RESCHEDULED','changed',now()-interval '1 hour'),
 (10,'REMINDER_SENT','L2 REMINDER:10:10:old-time',now());
INSERT INTO followup_tasks VALUES
 (10,'REMINDER',10,now()+interval '4 hours','COMPLETED',now(),now()),
 (11,'REMINDER',11,now()+interval '4 hours','ACTION_DONE',now()-interval '1 hour',now()-interval '1 hour'),
 (12,'REMINDER',12,now()+interval '5 hours','REVIEW',now(),now()-interval '1 hour'),
 (13,'FEEDBACK',13,now()-interval '2 days','ACTION_DONE',now()-interval '1 hour',now()-interval '1 hour');

CREATE TEMP VIEW selected_tasks AS
-- SELECTOR
;
DO $$ BEGIN
 IF (SELECT count(*) FROM selected_tasks) <> 10 THEN RAISE EXCEPTION 'Expected ten tasks, got %',(SELECT count(*) FROM selected_tasks); END IF;
 IF EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id IN (3,7,9,12)) THEN RAISE EXCEPTION 'Consent, feedback, cooldown or REVIEW filter failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id=8 AND type='REMINDER') THEN RAISE EXCEPTION 'L7 failure must not block reminder'; END IF;
 IF NOT EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id=10 AND type='REMINDER') THEN RAISE EXCEPTION 'Old reminder completion must not suppress rescheduled viewing'; END IF;
 IF (SELECT count(*) FROM selected_tasks WHERE lead_id=11) <> 2 THEN RAISE EXCEPTION 'Expected old metadata recovery and new reminder'; END IF;
 IF NOT EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id=13 AND type='FEEDBACK') THEN RAISE EXCEPTION 'Must recover metadata even after lead progressed'; END IF;
 IF EXISTS(SELECT 1 FROM selected_tasks GROUP BY type,lead_id,viewing_id,viewing_time HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate task'; END IF;
END $$;
-- Dev attendance rules: elapsed time is not proof of attendance; reminder state resets per schedule.
INSERT INTO leads SELECT id,'Attendance test','attendance@example.invalid','','','HOT','CONFIRMED',now()-interval '4 days',true,NULL FROM generate_series(20,26) id;
INSERT INTO viewings(id,lead_id,property_id,viewing_time,status)
 SELECT id,id,1,now()-interval '2 days',CASE WHEN id=22 THEN 'CANCELLED' ELSE 'NEW' END FROM generate_series(20,26) id;
INSERT INTO lead_events VALUES
 (21,'ATTENDANCE_CHECK_SENT','legacy',now()-interval '25 hours'),
 (23,'ATTENDANCE_CHECK_SENT','legacy',now()-interval '25 hours'),
 (23,'VIEWING_RESCHEDULED','changed',now()-interval '1 hour'),
 (24,'ATTENDANCE_CHECK_SENT','L2 ATTENDANCE_CHECK:24:24:old-time',now()-interval '25 hours'),
 (24,'ATTENDANCE_ESCALATED','L2 ATTENDANCE_ESCALATE:24:24:old-time',now()),
 (25,'ATTENDANCE_CHECK_SENT','L2 ATTENDANCE_CHECK:25:25:current-time',now()-interval '25 hours'),
 (26,'ATTENDANCE_CHECK_SENT','legacy',now()-interval '25 hours'),
 (26,'ATTENDANCE_ESCALATED','legacy',now());
INSERT INTO followup_tasks(lead_id,type,viewing_id,viewing_time,state,available_at,lease_until,task_key) VALUES
 (24,'ATTENDANCE_CHECK',24,now()-interval '3 days','COMPLETED',now(),now(),'ATTENDANCE_CHECK:24:24:old-time'),
 (24,'ATTENDANCE_ESCALATE',24,now()-interval '3 days','COMPLETED',now(),now(),'ATTENDANCE_ESCALATE:24:24:old-time'),
 (25,'ATTENDANCE_CHECK',25,now()-interval '2 days','COMPLETED',now(),now(),'ATTENDANCE_CHECK:25:25:current-time');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id BETWEEN 20 AND 26 AND type='FEEDBACK') THEN RAISE EXCEPTION 'Unconfirmed attendance must not receive feedback surveys'; END IF;
 IF NOT EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id=20 AND type='ATTENDANCE_CHECK') THEN RAISE EXCEPTION 'Missing attendance reminder'; END IF;
 IF NOT EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id IN (21,25) AND type='ATTENDANCE_ESCALATE' GROUP BY type HAVING count(*)=2) THEN RAISE EXCEPTION 'Missing escalation for legacy or task-based reminders'; END IF;
 IF EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id IN (22,26)) THEN RAISE EXCEPTION 'Cancelled or already escalated viewing selected'; END IF;
 IF (SELECT count(*) FROM selected_tasks WHERE lead_id IN (23,24) AND type='ATTENDANCE_CHECK')<>2 THEN RAISE EXCEPTION 'Rescheduled reminders must be allowed again'; END IF;
 IF EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id IN (23,24) AND type='ATTENDANCE_ESCALATE') THEN RAISE EXCEPTION 'Old schedule reminder must not trigger escalation'; END IF;
END $$;
TRUNCATE pg_temp.leads,pg_temp.viewings,pg_temp.lead_events,pg_temp.feedbacks,pg_temp.followup_tasks;
DO $$ BEGIN
 IF (SELECT count(*) FROM selected_tasks WHERE type='NO_TASKS' AND lead_id IS NULL) <> 1 THEN RAISE EXCEPTION 'Empty selection must produce exactly one NO_TASKS row'; END IF;
END $$;
ROLLBACK;
