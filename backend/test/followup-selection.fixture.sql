BEGIN;
CREATE TEMP TABLE leads(id int,name text,email text,phone text,needs text,level text,status text,created_at timestamptz,consent_marketing boolean,mautic_contact_id int,lost_reason text) ON COMMIT DROP;
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
 (25,'ATTENDANCE_CHECK',25,date_trunc('milliseconds',now()-interval '2 days'),'COMPLETED',now(),now(),'ATTENDANCE_CHECK:25:25:current-time');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id BETWEEN 20 AND 26 AND type='FEEDBACK') THEN RAISE EXCEPTION 'Unconfirmed attendance must not receive feedback surveys'; END IF;
 IF NOT EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id=20 AND type='ATTENDANCE_CHECK') THEN RAISE EXCEPTION 'Missing attendance reminder'; END IF;
 IF NOT EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id IN (21,25) AND type='ATTENDANCE_ESCALATE' GROUP BY type HAVING count(*)=2) THEN RAISE EXCEPTION 'Missing escalation for legacy or task-based reminders'; END IF;
 IF EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id IN (22,26)) THEN RAISE EXCEPTION 'Cancelled or already escalated viewing selected'; END IF;
 IF (SELECT count(*) FROM selected_tasks WHERE lead_id IN (23,24) AND type='ATTENDANCE_CHECK')<>2 THEN RAISE EXCEPTION 'Rescheduled reminders must be allowed again'; END IF;
 IF EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id IN (23,24) AND type='ATTENDANCE_ESCALATE') THEN RAISE EXCEPTION 'Old schedule reminder must not trigger escalation'; END IF;
END $$;
-- FE-30: COLD chưa duyệt, HOT/COLD im lặng, hết hạn và tiếp tục riêng thông báo hết hạn.
INSERT INTO leads(id,name,email,phone,needs,level,status,created_at,consent_marketing,lost_reason)
 SELECT id,'FE30 test','fe30@example.invalid','','',
 CASE WHEN id IN (40,45,47,48,50,51) THEN 'COLD' WHEN id=59 THEN 'WARM' ELSE 'HOT' END,
 CASE WHEN id IN (44,45,46,47,48,49,50,51,59) THEN 'VIEWED' WHEN id BETWEEN 54 AND 57 THEN 'LOST' WHEN id=42 THEN 'CONFIRMED' ELSE 'NEW' END,
 CASE WHEN id=43 THEN now()-interval '1 day' ELSE now()-interval '4 days' END,
 id NOT IN (46,47),CASE WHEN id IN (54,56,57) THEN 'EXPIRED' WHEN id=55 THEN 'NOT_INTERESTED' ELSE NULL END
 FROM generate_series(40,60) id;
INSERT INTO viewings(id,lead_id,property_id,viewing_time,status)
 SELECT id,id,1,CASE WHEN id IN (40,43) THEN now()+interval '2 days' WHEN id=53 THEN now() WHEN id=60 THEN NULL ELSE now()-interval '6 days' END,
 CASE WHEN id IN (44,45,46,47,48,49,50,51,59) THEN 'ATTENDED' WHEN id=52 OR id BETWEEN 54 AND 57 THEN 'CANCELLED' ELSE 'NEW' END
 FROM generate_series(40,60) id;
INSERT INTO lead_events SELECT id,'FEEDBACK_ASKED','fixture',now()-interval '4 days' FROM generate_series(44,51) id;
INSERT INTO lead_events VALUES
 (49,'HOT_NUDGE_SENT','fixture',now()),(50,'COLD_NURTURE_STARTED','fixture',now()),
 (51,'FEEDBACK_ASKED','recent',now()-interval '1 day'),
 (59,'FEEDBACK_ASKED','old',now()-interval '4 days'),(59,'FEEDBACK_ASKED','recent',now()-interval '1 day');
INSERT INTO feedbacks VALUES(48,now());
INSERT INTO followup_tasks(lead_id,type,viewing_id,viewing_time,state,available_at,lease_until,task_key)
 SELECT id,'EXPIRE_LEAD',id,date_trunc('milliseconds',now()-interval '6 days'),CASE WHEN id=57 THEN 'REVIEW' ELSE 'FAILED' END,now()-interval '1 hour',now()-interval '1 hour','EXPIRE_LEAD:'||id
 FROM generate_series(54,57) id;
INSERT INTO lead_events SELECT id,'LEAD_EXPIRED','L2 EXPIRE_LEAD:'||id,now()-interval '7 hours' FROM generate_series(54,57) id WHERE id<>56;
INSERT INTO followup_tasks VALUES(58,'EXPIRE_LEAD',58,date_trunc('milliseconds',now()-interval '6 days'),'CLAIMED',now(),now()+interval '1 hour');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id=40 AND type='STAFF_NUDGE') THEN RAISE EXCEPTION 'Must nudge old NEW COLD before viewing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id=41 AND type='EXPIRE_LEAD') THEN RAISE EXCEPTION 'Must expire past NEW appointment'; END IF;
 IF EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id=41 AND type='STAFF_NUDGE') THEN RAISE EXCEPTION 'Expired appointment must not receive approval nudge'; END IF;
 IF NOT EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id=44 AND type='HOT_NUDGE') THEN RAISE EXCEPTION 'Missing HOT call nudge'; END IF;
 IF NOT EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id=45 AND type='COLD_NURTURE') THEN RAISE EXCEPTION 'Missing COLD newsletter'; END IF;
 IF EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id IN (43,46,47,48,49,50,51,52,55,56,57,58,59,60)) THEN RAISE EXCEPTION 'FE30 consent/feedback/expiry/lock guard failed'; END IF;
 IF EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id=42 AND type='EXPIRE_LEAD') THEN RAISE EXCEPTION 'Do not expire confirmed attendance'; END IF;
 IF NOT EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id=54 AND type='EXPIRE_LEAD') THEN RAISE EXCEPTION 'Must resume failed expiry notification after closure'; END IF;
 IF NOT EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id=53 AND type='STAFF_NUDGE') OR EXISTS(SELECT 1 FROM selected_tasks WHERE lead_id=53 AND type='EXPIRE_LEAD') THEN RAISE EXCEPTION 'Boundary time mismatch'; END IF;
END $$;
TRUNCATE pg_temp.leads,pg_temp.viewings,pg_temp.lead_events,pg_temp.feedbacks,pg_temp.followup_tasks;
DO $$ BEGIN
 IF (SELECT count(*) FROM selected_tasks WHERE type='NO_TASKS' AND lead_id IS NULL) <> 1 THEN RAISE EXCEPTION 'Empty selection must produce exactly one NO_TASKS row'; END IF;
END $$;
ROLLBACK;
