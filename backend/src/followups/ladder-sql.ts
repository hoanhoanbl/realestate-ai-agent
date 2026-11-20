import { LEAD_ACTIVITY_EVENT_TYPES } from '../leads/lead.constants';

// All values originate in the FE-43 constant, never request input.
const activityTypes = LEAD_ACTIVITY_EVENT_TYPES.map(t => `'${t}'`).join(',');
export const LADDER_SNAPSHOT_SQL = `SELECT l.id AS lead_id,l.name,l.email,l.phone,l.needs,l.status,l.level,l.lost_reason,
 l.consent_marketing,l.created_at,l.assigned_at,l.assigned_user_id,l.contacted_at,
 u.name AS assignee_name,
 GREATEST(l.created_at,l.assigned_at,l.contacted_at,a.activity_at) AS activity_at,
 GREATEST(l.created_at,l.assigned_at,a.reopened_at) AS reach_anchor,
 GREATEST(l.created_at,l.assigned_at,a.reopened_at,a.eligible_at) AS eligible_since,
 EXISTS(SELECT 1 FROM viewings v WHERE v.lead_id=l.id AND v.status='NEW') AS has_open_viewing,
 EXISTS(SELECT 1 FROM contracts c WHERE c.lead_id=l.id AND c.status NOT IN ('REJECTED','EXPIRED')) AS has_live_contract,
 EXISTS(SELECT 1 FROM feedback_work f WHERE f.lead_id=l.id AND f.status<>'COMPLETED') AS has_open_feedback,
 (SELECT p.name FROM viewings v JOIN properties p ON p.id=v.property_id WHERE v.lead_id=l.id ORDER BY v.viewing_time DESC,v.id DESC LIMIT 1) AS property_name
 FROM leads l LEFT JOIN users u ON u.id=l.assigned_user_id
 LEFT JOIN LATERAL (
 SELECT max(e.created_at) FILTER(WHERE e.type IN (${activityTypes})) AS activity_at,
 max(e.created_at) FILTER(WHERE e.type='LEAD_REOPENED') AS reopened_at,
 max(e.created_at) FILTER(WHERE e.type='STATUS_CHANGED' AND (e.note LIKE '% -> NEW%' OR e.note LIKE '% -> CONSULTING%')) AS eligible_at
 FROM lead_events e WHERE e.lead_id=l.id
 ) a ON true`;

// Predicate deliberately mirrors ladderDecision; claim/start still re-check under the lead lock.
export const LADDER_DUE_SQL = `WITH snapshots AS MATERIALIZED (${LADDER_SNAPSHOT_SQL}), candidates AS (
 SELECT s.*,CASE
 WHEN s.status IN ('CONSULTING','VIEWED') AND NOT s.has_open_viewing AND NOT s.has_open_feedback AND s.activity_at<=now()-interval '14 days' THEN 'STALE'
 WHEN s.status IN ('CONSULTING','NEW') AND s.contacted_at IS NULL AND
   s.eligible_since<=s.reach_anchor + (CASE WHEN s.reach_anchor<=now()-interval '7 days' THEN 7 WHEN s.reach_anchor<=now()-interval '3 days' THEN 3 ELSE 1 END)*interval '1 day'
   AND s.reach_anchor<=now()-interval '1 day' THEN 'REACH'
 WHEN s.status IN ('CONSULTING','VIEWED') AND NOT s.has_open_viewing AND NOT s.has_open_feedback AND s.activity_at<=now()-interval '7 days'
   AND (s.contacted_at IS NOT NULL OR s.reach_anchor+interval '7 days'<s.eligible_since) THEN 'QUIET'
 END AS kind,
 CASE WHEN s.reach_anchor<=now()-interval '7 days' THEN 7 WHEN s.reach_anchor<=now()-interval '3 days' THEN 3 ELSE 1 END AS reach_step
 FROM snapshots s WHERE NOT s.has_live_contract AND s.activity_at<=now()
), keyed AS (
 SELECT lead_id,kind,CASE WHEN kind='REACH' THEN reach_step ELSE NULL END AS step,
 CASE WHEN kind='REACH' THEN reach_anchor ELSE activity_at END AS anchor,
 assigned_user_id AS "assigneeId",
 'LADDER_'||kind||':'||lead_id||':'||CASE WHEN kind='REACH' THEN reach_step||':' ELSE '' END||
 to_char((CASE WHEN kind='REACH' THEN reach_anchor ELSE activity_at END) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS task_key
 FROM candidates WHERE kind IS NOT NULL
), pending AS (
 SELECT k.lead_id AS "leadId",k.kind,k.step,k.anchor,k."assigneeId",NULL::int AS "taskId" FROM keyed k
 WHERE NOT EXISTS(SELECT 1 FROM followup_tasks t WHERE t.task_key=k.task_key AND
 (t.state IN ('COMPLETED','REVIEW','ACTION_DONE','ACTION_STARTED') OR t.lease_until>now() OR t.available_at>now()))
 UNION ALL
 SELECT t.lead_id,substring(t.type from 8),NULLIF(split_part(t.task_key,':',3),'')::int,t.viewing_time,l.assigned_user_id,t.id
 FROM followup_tasks t JOIN leads l ON l.id=t.lead_id
 WHERE t.type='LADDER_REACH' AND t.state IN ('ACTION_DONE','ACTION_STARTED') AND t.available_at<=now() AND t.lease_until<=now()
 UNION ALL
 SELECT t.lead_id,substring(t.type from 8),NULL::int,t.viewing_time,l.assigned_user_id,t.id
 FROM followup_tasks t JOIN leads l ON l.id=t.lead_id
 WHERE t.type IN ('LADDER_QUIET','LADDER_STALE') AND t.available_at<=now() AND t.lease_until<=now()
 AND (t.state IN ('ACTION_DONE','ACTION_STARTED') OR (t.type='LADDER_STALE' AND t.state IN ('CLAIMED','FAILED') AND l.status='LOST' AND l.lost_reason='STALE'
 AND EXISTS(SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type='LEAD_STALE_CLOSED' AND e.note='L9 '||t.task_key)))
)
SELECT DISTINCT * FROM pending ORDER BY "leadId",kind LIMIT 50`;
