WITH latest_viewings AS (
 SELECT DISTINCT ON (lead_id) * FROM viewings ORDER BY lead_id,id DESC
), candidates AS (
SELECT 'REMINDER' AS type, l.id AS lead_id, l.name, l.email, l.phone, l.needs, l.level,
       v.property_id, v.viewing_time, l.mautic_contact_id, v.id AS viewing_id
FROM leads l JOIN latest_viewings v ON v.lead_id = l.id
WHERE l.status = 'CONFIRMED' AND v.status = 'NEW'
  AND v.viewing_time BETWEEN now() AND now() + interval '24 hours'
  AND NOT EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id = l.id AND e.type = 'REMINDER_SENT' AND (e.note IS NULL OR e.note NOT LIKE 'L2 REMINDER:%') AND e.created_at >= COALESCE((SELECT max(r.created_at) FROM lead_events r WHERE r.lead_id=l.id AND r.type='VIEWING_RESCHEDULED'), '-infinity'::timestamptz))
  AND NOT EXISTS (SELECT 1 FROM lead_events f WHERE f.lead_id = l.id AND f.type = 'FOLLOWUP_FAILED' AND COALESCE(f.note, '') LIKE 'REMINDER:%' AND f.created_at > now() - interval '6 hours')
UNION ALL
SELECT 'FEEDBACK', l.id, l.name, l.email, l.phone, l.needs, l.level,
       v.property_id, v.viewing_time, l.mautic_contact_id, v.id AS viewing_id
FROM leads l JOIN latest_viewings v ON v.lead_id = l.id
WHERE l.status = 'VIEWED' AND v.status = 'ATTENDED' AND v.viewing_time < now() - interval '2 hours'
  AND NOT EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id = l.id AND e.type = 'FEEDBACK_ASKED')
  AND NOT EXISTS (SELECT 1 FROM feedbacks fb WHERE fb.lead_id=l.id AND fb.submitted_at IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM lead_events f WHERE f.lead_id = l.id AND f.type = 'FOLLOWUP_FAILED' AND COALESCE(f.note, '') LIKE 'FEEDBACK:%' AND f.created_at > now() - interval '6 hours')
UNION ALL
-- khách WARM đã xem nhà, được hỏi cảm nhận hơn 3 ngày: chuyển Mautic nuôi dưỡng tự động (D-10)
SELECT 'WARM_NUDGE', l.id, l.name, l.email, l.phone, l.needs, l.level,
       v.property_id, v.viewing_time, l.mautic_contact_id, v.id AS viewing_id
FROM leads l JOIN latest_viewings v ON v.lead_id = l.id
WHERE l.level = 'WARM' AND l.status = 'VIEWED' AND v.status = 'ATTENDED'
  AND COALESCE(l.consent_marketing, false) = true
  AND NOT EXISTS (SELECT 1 FROM feedbacks fb WHERE fb.lead_id = l.id AND fb.submitted_at IS NOT NULL)
  AND EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id = l.id AND e.type = 'FEEDBACK_ASKED' AND e.created_at < now() - interval '3 days')
  AND NOT EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id = l.id AND e.type IN ('WARM_NUDGE_SENT', 'WARM_NURTURE_STARTED'))
  AND NOT EXISTS (SELECT 1 FROM lead_events f WHERE f.lead_id = l.id AND f.type = 'FOLLOWUP_FAILED' AND COALESCE(f.note, '') LIKE 'WARM_NUDGE:%' AND f.created_at > now() - interval '6 hours')
UNION ALL
-- khách HOT/WARM đăng ký hơn 3 ngày chưa duyệt: nhắc nhân viên qua Sub-workflow
SELECT 'STAFF_NUDGE', l.id, l.name, l.email, l.phone, l.needs, l.level,
       v.property_id, v.viewing_time, l.mautic_contact_id, v.id AS viewing_id
FROM leads l JOIN latest_viewings v ON v.lead_id = l.id
WHERE l.status = 'NEW' AND l.level IN ('HOT', 'WARM') AND v.status = 'NEW'
  AND l.created_at < now() - interval '3 days'
  AND NOT EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id = l.id AND e.type = 'STAFF_NUDGE_SENT')
  AND NOT EXISTS (SELECT 1 FROM lead_events f WHERE f.lead_id = l.id AND f.type = 'FOLLOWUP_FAILED' AND COALESCE(f.note, '') LIKE 'STAFF_NUDGE:%' AND f.created_at > now() - interval '6 hours')

UNION ALL
SELECT 'ATTENDANCE_CHECK',l.id,l.name,l.email,l.phone,l.needs,l.level,v.property_id,v.viewing_time,l.mautic_contact_id,v.id AS viewing_id
FROM leads l JOIN latest_viewings v ON v.lead_id=l.id
WHERE l.status='CONFIRMED' AND v.status='NEW' AND v.viewing_time < now() - interval '2 hours' AND NOT EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type='ATTENDANCE_CHECK_SENT' AND (e.note IS NULL OR e.note NOT LIKE 'L2 ATTENDANCE_CHECK:%') AND e.created_at > COALESCE((SELECT max(r.created_at) FROM lead_events r WHERE r.lead_id=l.id AND r.type='VIEWING_RESCHEDULED'), '-infinity'::timestamptz))
 AND NOT EXISTS (SELECT 1 FROM lead_events f WHERE f.lead_id=l.id AND f.type='FOLLOWUP_FAILED' AND f.note LIKE 'ATTENDANCE_CHECK:%' AND f.created_at > now()-interval '6 hours')

UNION ALL
SELECT 'ATTENDANCE_ESCALATE',l.id,l.name,l.email,l.phone,l.needs,l.level,v.property_id,v.viewing_time,l.mautic_contact_id,v.id AS viewing_id
FROM leads l JOIN latest_viewings v ON v.lead_id=l.id
WHERE l.status='CONFIRMED' AND v.status='NEW' AND EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type='ATTENDANCE_CHECK_SENT' AND e.created_at > COALESCE((SELECT max(r.created_at) FROM lead_events r WHERE r.lead_id=l.id AND r.type='VIEWING_RESCHEDULED'), '-infinity'::timestamptz) AND e.created_at < now()-interval '24 hours' AND ((e.note IS NULL OR e.note NOT LIKE 'L2 ATTENDANCE_CHECK:%') OR EXISTS (SELECT 1 FROM followup_tasks t WHERE t.lead_id=l.id AND t.type='ATTENDANCE_CHECK' AND t.state='COMPLETED' AND t.viewing_id=v.id AND t.viewing_time=v.viewing_time AND e.note='L2 '||t.task_key))) AND NOT EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type='ATTENDANCE_ESCALATED' AND (e.note IS NULL OR e.note NOT LIKE 'L2 ATTENDANCE_ESCALATE:%') AND e.created_at > COALESCE((SELECT max(r.created_at) FROM lead_events r WHERE r.lead_id=l.id AND r.type='VIEWING_RESCHEDULED'), '-infinity'::timestamptz))
 AND NOT EXISTS (SELECT 1 FROM lead_events f WHERE f.lead_id=l.id AND f.type='FOLLOWUP_FAILED' AND f.note LIKE 'ATTENDANCE_ESCALATE:%' AND f.created_at > now()-interval '6 hours')
), recoverable AS (
 SELECT t.type,l.id,l.name,l.email,l.phone,l.needs,l.level,v.property_id,t.viewing_time,l.mautic_contact_id,t.viewing_id
 FROM followup_tasks t JOIN leads l ON l.id=t.lead_id JOIN viewings v ON v.id=t.viewing_id
 WHERE t.state='ACTION_DONE' AND t.available_at<=now() AND t.lease_until<=now()
), selected AS (
 SELECT * FROM (SELECT * FROM candidates UNION SELECT * FROM recoverable) tasks
 WHERE NOT EXISTS (SELECT 1 FROM followup_tasks f WHERE f.lead_id=tasks.lead_id AND f.type=tasks.type
   AND (f.type NOT IN ('REMINDER','ATTENDANCE_CHECK','ATTENDANCE_ESCALATE') OR (f.viewing_id=tasks.viewing_id AND f.viewing_time=tasks.viewing_time))
   AND (f.state IN ('COMPLETED','REVIEW') OR f.available_at>now() OR f.lease_until>now()))
 ORDER BY lead_id,type LIMIT 50
)
SELECT s.*,NULL::jsonb AS diagnostics FROM selected s
UNION ALL
SELECT 'NO_TASKS',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
 jsonb_build_object('databaseTime',now(),'totalLeads',(SELECT count(*) FROM leads),
 'warmViewed',(SELECT count(*) FROM leads WHERE level='WARM' AND status='VIEWED'),
 'warmViewedWithoutConsent',(SELECT count(*) FROM leads WHERE level='WARM' AND status='VIEWED' AND NOT COALESCE(consent_marketing,false)),
 'reviewTasks',(SELECT count(*) FROM followup_tasks WHERE state='REVIEW'))
WHERE NOT EXISTS(SELECT 1 FROM selected);
