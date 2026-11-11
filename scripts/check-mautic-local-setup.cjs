// Read-only FE-22 audit. Deliberately fixed to local Mautic; never sends mail.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const values = { ...process.env };
if (fs.existsSync('.env')) for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = /^(MAUTIC_API_USER|MAUTIC_API_PASSWORD)=(.*)$/.exec(line);
  if (match && !values[match[1]]) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
}
async function get(path) {
  const response = await fetch('http://localhost:8082/api/' + path, {
    headers: { Authorization: 'Basic ' + Buffer.from(values.MAUTIC_API_USER + ':' + values.MAUTIC_API_PASSWORD).toString('base64') },
    redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  assert(response.ok, `Mautic local ${path.split('?')[0]}: HTTP ${response.status}`);
  return response.json();
}
(async () => {
  assert(values.MAUTIC_API_USER && values.MAUTIC_API_PASSWORD, 'Thiếu credential Mautic local');
  const fields = Object.values((await get('fields/contact?limit=100')).fields);
  const field = fields.find(x => x.alias === 'ai_nudge_text');
  assert(field?.isPublished && field.type === 'textarea', 'ai_nudge_text phải là textarea đã publish');
  console.log('PASS custom field ai_nudge_text');
  const segments = Object.values((await get('segments?limit=100')).lists);
  const warm = segments.find(x => x.alias === 'nuoi-warm');
  const monthly = segments.find(x => x.alias === 'ban-tin-hang-thang');
  assert(warm?.isPublished && monthly?.isPublished, 'Thiếu segment WARM/bản tin');
  const tagIds = new Map();
  for (const segment of [warm, monthly]) for (const filter of segment.filters) {
    assert.equal(filter.field, 'tags', 'Segment có filter ngoài thiết kế');
    for (const id of filter.properties.filter) if (!tagIds.has(String(id))) {
      const data = await get('tags/' + Number(id));
      tagIds.set(String(id), data.tag?.tag);
    }
  }
  const has = (segment, operator, tag) => segment.filters.some(f => f.operator === operator && f.properties.filter.some(id => tagIds.get(String(id)) === tag));
  assert(has(warm, 'in', 'nuoi-warm'));
  for (const status of ['DEPOSIT', 'SIGNED', 'LOST']) assert(has(warm, '!in', status), 'Thiếu loại trừ ' + status);
  assert(has(monthly, 'in', 'ban-tin-hang-thang'));
  console.log('PASS segment membership tags and converted/lost exclusions');
  const emails = Object.values((await get('emails?limit=100')).emails).filter(x => x.name.startsWith('FE-22 | Nuôi WARM |'));
  assert.equal(emails.length, 3, 'Cần đúng 3 email FE-22');
  for (const email of emails) {
    const detail = (await get('emails/' + email.id)).email;
    assert.equal(detail.emailType, 'template');
    assert(detail.isPublished);
    assert(detail.customHtml?.includes('{unsubscribe_text}'), 'Thiếu unsubscribe token');
    if (email.name.includes('01 Hỏi thăm')) assert(/\{contactfield=ai_nudge_text(?:\|[^}]*)?\}/.test(detail.customHtml), 'Thiếu AI token');
  }
  console.log('PASS three triggered email templates and required tokens');
  const campaigns = Object.values((await get('campaigns?limit=100')).campaigns);
  const campaign = campaigns.find(x => x.name === 'FE-22 | Nuôi WARM sau xem nhà');
  assert(campaign && !campaign.isPublished, 'Campaign local phải giữ Inactive');
  assert(campaign.lists.some(x => Number(x.id) === Number(warm.id)));
  const events = Object.values(campaign.events);
  const initial = events.find(x => x.type === 'email.send' && !x.parent);
  const decision = events.find(x => x.type === 'email.open');
  assert(initial && decision && Number(decision.parent?.id) === Number(initial.id));
  for (const path of ['yes', 'no']) {
    const action = events.find(x => x.type === 'email.send' && x.decisionPath === path);
    assert(action && Number(action.parent?.id) === Number(decision.id));
    assert.equal(action.triggerMode, 'interval'); assert.equal(Number(action.triggerInterval), 3); assert.equal(action.triggerIntervalUnit, 'd');
    assert(emails.some(x => Number(x.id) === Number(action.channelId)));
  }
  console.log('PASS inactive campaign: segment source, initial email, open/yes/no with 3-day delays');
  console.log('FE-22 local configuration PASS. Delivery, DNC and server activation remain Hoàng acceptance steps. No writes performed.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
