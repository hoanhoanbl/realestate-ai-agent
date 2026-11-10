WITH snapshots AS MATERIALIZED (SELECT l.id AS lead_id,l.name,l.email,l.phone,l.needs,l.status,l.level,l.consent_marketing,l.created_at,l.lost_reason,
 l.assigned_user_id,l.assigned_at,l.response_due_at,l.first_response_at,l.mautic_contact_id,
 COALESCE(v.id,0) AS viewing_id,v.property_id,v.viewing_time,v.status AS viewing_status,
 (EXISTS(SELECT 1 FROM followup_tasks t WHERE t.lead_id=l.id AND t.type='REMINDER' AND t.state='COMPLETED' AND t.viewing_id=v.id AND date_trunc('milliseconds',t.viewing_time)=date_trunc('milliseconds',v.viewing_time)) OR EXISTS(SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type='REMINDER_SENT'
 AND v.id=(SELECT min(first_v.id) FROM viewings first_v WHERE first_v.lead_id=l.id)
 AND (e.note IS NULL OR e.note NOT LIKE 'L2 %') AND e.created_at>=COALESCE(
 (SELECT max(r.created_at) FROM lead_events r WHERE r.lead_id=l.id AND r.type='VIEWING_RESCHEDULED'),'-infinity'::timestamptz))) AS reminder_sent,
 (EXISTS(SELECT 1 FROM followup_tasks t WHERE t.lead_id=l.id AND t.type='FEEDBACK' AND t.state='COMPLETED' AND t.viewing_id=v.id AND date_trunc('milliseconds',t.viewing_time)=date_trunc('milliseconds',v.viewing_time)) OR EXISTS(SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type='FEEDBACK_ASKED'
 AND v.id=(SELECT min(first_v.id) FROM viewings first_v WHERE first_v.lead_id=l.id)
 AND (e.note IS NULL OR e.note NOT LIKE 'L2 %') AND e.created_at>=COALESCE(
 (SELECT max(r.created_at) FROM lead_events r WHERE r.lead_id=l.id AND r.type='VIEWING_RESCHEDULED'),'-infinity'::timestamptz))) AS feedback_asked,
 (SELECT max(e.created_at) FROM lead_events e WHERE e.lead_id=l.id AND e.type='FEEDBACK_ASKED' AND (
 (v.id=(SELECT min(first_v.id) FROM viewings first_v WHERE first_v.lead_id=l.id) AND (e.note IS NULL OR e.note NOT LIKE 'L2 %'))
 OR EXISTS(SELECT 1 FROM followup_tasks t WHERE t.lead_id=l.id AND t.type='FEEDBACK' AND t.state='COMPLETED' AND t.viewing_id=v.id AND date_trunc('milliseconds',t.viewing_time)=date_trunc('milliseconds',v.viewing_time) AND e.note='L2 '||t.task_key))) AS feedback_asked_at,
 EXISTS(SELECT 1 FROM feedbacks f WHERE f.lead_id=l.id AND f.submitted_at IS NOT NULL AND
 (split_part(f.token,'_',1)='v'||v.id::text OR ((f.token IS NULL OR f.token !~ '^v[0-9]+_') AND v.id=(SELECT min(first_v.id) FROM viewings first_v WHERE first_v.lead_id=l.id)))) AS has_feedback,
 EXISTS(SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type IN ('WARM_NUDGE_SENT','WARM_NURTURE_STARTED')) AS nurture_started,
 EXISTS(SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type='HOT_NUDGE_SENT') AS hot_nudged,
 EXISTS(SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type='COLD_NURTURE_STARTED') AS cold_nurture_started,
 EXISTS(SELECT 1 FROM followup_tasks t WHERE t.lead_id=l.id AND t.type='STAFF_NUDGE' AND t.state='COMPLETED'
 AND date_trunc('milliseconds',t.viewing_time)=date_trunc('milliseconds',l.assigned_at)) AS staff_nudged,
 (EXISTS(SELECT 1 FROM followup_tasks t WHERE t.lead_id=l.id AND t.type='ATTENDANCE_CHECK' AND t.state='COMPLETED' AND t.viewing_id=v.id AND date_trunc('milliseconds',t.viewing_time)=date_trunc('milliseconds',v.viewing_time)) OR EXISTS(SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type='ATTENDANCE_CHECK_SENT'
 AND v.id=(SELECT min(first_v.id) FROM viewings first_v WHERE first_v.lead_id=l.id)
 AND (e.note IS NULL OR e.note NOT LIKE 'L2 %') AND e.created_at>=COALESCE(
 (SELECT max(r.created_at) FROM lead_events r WHERE r.lead_id=l.id AND r.type='VIEWING_RESCHEDULED'),'-infinity'::timestamptz))) AS attendance_check_sent,
 (SELECT max(e.created_at) FROM lead_events e WHERE e.lead_id=l.id AND e.type='ATTENDANCE_CHECK_SENT' AND (
 (v.id=(SELECT min(first_v.id) FROM viewings first_v WHERE first_v.lead_id=l.id)
 AND (e.note IS NULL OR e.note NOT LIKE 'L2 %') AND e.created_at>=COALESCE((SELECT max(r.created_at) FROM lead_events r WHERE r.lead_id=l.id AND r.type='VIEWING_RESCHEDULED'),'-infinity'::timestamptz))
 OR EXISTS(SELECT 1 FROM followup_tasks t WHERE t.lead_id=l.id AND t.type='ATTENDANCE_CHECK' AND t.state='COMPLETED' AND t.viewing_id=v.id AND date_trunc('milliseconds',t.viewing_time)=date_trunc('milliseconds',v.viewing_time) AND e.note='L2 '||t.task_key))) AS attendance_check_at,
 (EXISTS(SELECT 1 FROM followup_tasks t WHERE t.lead_id=l.id AND t.type='ATTENDANCE_ESCALATE' AND t.state='COMPLETED' AND t.viewing_id=v.id AND date_trunc('milliseconds',t.viewing_time)=date_trunc('milliseconds',v.viewing_time)) OR EXISTS(SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type='ATTENDANCE_ESCALATED'
 AND v.id=(SELECT min(first_v.id) FROM viewings first_v WHERE first_v.lead_id=l.id)
 AND (e.note IS NULL OR e.note NOT LIKE 'L2 %') AND e.created_at>=COALESCE(
 (SELECT max(r.created_at) FROM lead_events r WHERE r.lead_id=l.id AND r.type='VIEWING_RESCHEDULED'),'-infinity'::timestamptz))) AS attendance_escalated,
 EXISTS(SELECT 1 FROM followup_tasks t JOIN lead_events e ON e.lead_id=t.lead_id AND e.type='LEAD_EXPIRED' AND e.note='L2 '||t.task_key
 WHERE t.lead_id=l.id AND t.type='EXPIRE_LEAD' AND t.viewing_id=v.id AND date_trunc('milliseconds',t.viewing_time)=date_trunc('milliseconds',v.viewing_time)) AS expired_for_schedule
 FROM leads l LEFT JOIN viewings v ON v.lead_id=l.id), due AS (
 SELECT s.*,k.type FROM snapshots s CROSS JOIN (VALUES ('REMINDER'),('FEEDBACK'),('WARM_NUDGE'),('HOT_NUDGE'),('COLD_NURTURE'),('EXPIRE_LEAD'),('ATTENDANCE_CHECK'),('ATTENDANCE_ESCALATE')) k(type)
 WHERE s.viewing_id>0 AND (k.type IN ('REMINDER','EXPIRE_LEAD','ATTENDANCE_CHECK','ATTENDANCE_ESCALATE')
 OR s.viewing_id=(SELECT max(latest_v.id) FROM viewings latest_v WHERE latest_v.lead_id=s.lead_id)) AND CASE k.type
 WHEN 'REMINDER' THEN s.status='CONFIRMED' AND s.viewing_status='NEW' AND s.email IS NOT NULL AND s.viewing_time BETWEEN now() AND now()+interval '24 hours' AND NOT s.reminder_sent
 WHEN 'FEEDBACK' THEN s.status='VIEWED' AND s.viewing_status='ATTENDED' AND s.email IS NOT NULL AND s.viewing_time<now()-interval '2 hours' AND NOT s.feedback_asked AND NOT s.has_feedback
 WHEN 'WARM_NUDGE' THEN s.status='VIEWED' AND s.viewing_status='ATTENDED' AND s.level='WARM' AND s.email IS NOT NULL AND s.consent_marketing AND NOT s.nurture_started AND NOT s.has_feedback AND s.feedback_asked_at<now()-interval '3 days'
 WHEN 'HOT_NUDGE' THEN s.status='VIEWED' AND s.viewing_status='ATTENDED' AND s.level='HOT' AND s.consent_marketing AND NOT s.hot_nudged AND NOT s.has_feedback AND s.feedback_asked_at<now()-interval '3 days'
 WHEN 'COLD_NURTURE' THEN s.status='VIEWED' AND s.viewing_status='ATTENDED' AND s.level='COLD' AND s.email IS NOT NULL AND s.consent_marketing AND NOT s.cold_nurture_started AND NOT s.has_feedback AND s.feedback_asked_at<now()-interval '3 days'
 WHEN 'EXPIRE_LEAD' THEN s.status='NEW' AND s.viewing_status='NEW' AND s.viewing_time<now()
 WHEN 'ATTENDANCE_CHECK' THEN s.status='CONFIRMED' AND s.viewing_status='NEW' AND s.viewing_time<now()-interval '2 hours' AND NOT s.attendance_check_sent
 WHEN 'ATTENDANCE_ESCALATE' THEN s.status='CONFIRMED' AND s.viewing_status='NEW' AND NOT s.attendance_escalated AND s.attendance_check_at<now()-interval '24 hours'
 END
), candidates AS (
 SELECT type,lead_id,name,email,phone,needs,level,property_id,viewing_time,mautic_contact_id,viewing_id,assigned_user_id,response_due_at FROM due WHERE NOT EXISTS(SELECT 1 FROM lead_events e WHERE e.lead_id=due.lead_id AND e.type='FOLLOWUP_FAILED' AND e.note LIKE due.type||':%' AND e.created_at>now()-interval '6 hours')
 UNION ALL
 SELECT 'STAFF_NUDGE',l.id,l.name,l.email,l.phone,l.needs,l.level,NULL::int,l.assigned_at,l.mautic_contact_id,0,l.assigned_user_id,l.response_due_at
 FROM leads l WHERE l.status IN ('CONSULTING','NEW','CONFIRMED','VIEWED') AND l.assigned_at IS NOT NULL AND l.first_response_at IS NULL AND l.response_due_at<=now()
 AND NOT EXISTS(SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type='FOLLOWUP_FAILED' AND e.note LIKE 'STAFF_NUDGE:%' AND e.created_at>now()-interval '6 hours' AND e.created_at>=l.assigned_at)
), recoverable AS (
 SELECT t.type,l.id AS lead_id,l.name,l.email,l.phone,l.needs,l.level,v.property_id,t.viewing_time,l.mautic_contact_id,t.viewing_id,l.assigned_user_id,l.response_due_at
 FROM followup_tasks t JOIN leads l ON l.id=t.lead_id LEFT JOIN viewings v ON v.id=t.viewing_id AND v.lead_id=l.id
 WHERE t.available_at<=now() AND t.lease_until<=now() AND (t.state='ACTION_DONE' OR (
 t.type='EXPIRE_LEAD' AND t.state IN ('CLAIMED','FAILED','ACTION_STARTED') AND l.status='LOST' AND l.lost_reason='EXPIRED' AND v.status='CANCELLED'
 AND date_trunc('milliseconds',t.viewing_time)=date_trunc('milliseconds',v.viewing_time)
 AND EXISTS(SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type='LEAD_EXPIRED' AND e.note='L2 '||t.task_key)))
), selected AS (
 SELECT * FROM (SELECT * FROM candidates UNION SELECT * FROM recoverable) tasks
 WHERE NOT EXISTS(SELECT 1 FROM followup_tasks f WHERE f.lead_id=tasks.lead_id AND f.type=tasks.type
 AND (f.type NOT IN ('REMINDER','FEEDBACK','ATTENDANCE_CHECK','ATTENDANCE_ESCALATE','EXPIRE_LEAD','STAFF_NUDGE') OR (f.viewing_id=tasks.viewing_id AND date_trunc('milliseconds',f.viewing_time)=date_trunc('milliseconds',tasks.viewing_time)))
 AND (f.state IN ('COMPLETED','REVIEW') OR f.available_at>now() OR f.lease_until>now())) ORDER BY lead_id,type LIMIT 50
)
SELECT s.*,NULL::jsonb AS diagnostics FROM selected s UNION ALL
SELECT 'NO_TASKS',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
 jsonb_build_object('databaseTime',now(),'totalLeads',(SELECT count(*) FROM leads),'reviewTasks',(SELECT count(*) FROM followup_tasks WHERE state='REVIEW'))
WHERE NOT EXISTS(SELECT 1 FROM selected);
