const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const workflow = JSON.parse(read('n8n-workflows/luong-2-follow-up.json'));
const query = workflow.nodes.find(n => n.name === 'Lấy lead cần follow-up').parameters.query;
if (process.argv.includes('--sql')) {
  const source = read('backend/src/followups/followups.service.ts');
  const snapshot = source.match(/m\.query\(`(SELECT l\.status[\s\S]+?)`, \[leadId,/);
  assert(snapshot, 'Missing snapshot query');
  const fixture = read('backend/test/followup-selection.fixture.sql')
    .replace('-- SELECTOR', query.trim().replace(/;$/, ''))
    .replace('TRUNCATE pg_temp.leads', `PREPARE followup_snapshot(int,text) AS ${snapshot[1]};\nEXECUTE followup_snapshot(1,'REMINDER:%');\nDEALLOCATE followup_snapshot;\nTRUNCATE pg_temp.leads`);
  process.stdout.write(fixture);
  return;
}
assert.equal(query.replace(/\r\n/g, '\n'), read('backend/sql/preview-follow-up.sql').replace(/\r\n/g, '\n'));
const names = new Set(workflow.nodes.map(n => n.name));
assert.equal(names.size, workflow.nodes.length);
for (const node of workflow.nodes) {
  if (node.parameters.jsCode) new Function('$', '$json', '$input', node.parameters.jsCode);
  for (const match of JSON.stringify(node.parameters).matchAll(/\$\('([^']+)'\)/g)) assert(names.has(match[1]), `Missing reference ${match[1]}`);
  for (const groups of Object.values(workflow.connections[node.name] ?? {})) {
    for (const edges of groups) for (const edge of edges) assert(names.has(edge.node), `Missing target ${edge.node}`);
  }
  if (node.onError === 'continueErrorOutput') assert(workflow.connections[node.name]?.main?.[1]?.length, `Missing error route for ${node.name}`);
}
const code = name => workflow.nodes.find(n => n.name === name).parameters.jsCode;
const ctx = { type: 'WARM_NUDGE', name: 'Test', email: 'test@example.invalid' };
const fallback = new Function('$', '$json', code('Kiểm tra nội dung AI'))(() => ({ item: { json: ctx } }), { error: 'AI unavailable' });
assert.equal(fallback.json.usedFallback, true);
assert(fallback.json.body.length <= 250);
const merged = new Function('$input', code('Tổng hợp'))({ all: () => [
  { json: { type: 'REMINDER' } }, { json: { type: 'SKIPPED' } }, { json: { type: 'ERROR' } },
] });
assert.equal(merged[0].json.total, 1);
assert.equal(merged[0].json.failed, 1);
assert.equal(merged[0].json.skipped, 1);
assert.equal(workflow.nodes.find(n => n.name === 'Email khách').retryOnFail, false);
assert(workflow.nodes.find(n => n.name === 'Hoàn tất tác vụ'));
assert(!names.has('Chuyển VIEWED'));
for (const type of ['STAFF_NUDGE','ATTENDANCE_CHECK','ATTENDANCE_ESCALATE','HOT_NUDGE','EXPIRE_LEAD']) {
  const lead = { type,lead_id:20,name:'Demo',email:'demo@example.invalid',level:'HOT' };
  const get = name => ({item:{json:lead},first:()=>({json:{managerEmail:'manager@example.invalid',publicWebUrl:'http://localhost:3000'}})});
  const output = new Function('$', code('Chuẩn bị thông báo NV'))(get);
  assert(output.json.title && output.json.message, `Missing notification for ${type}`);
  if (['ATTENDANCE_ESCALATE','EXPIRE_LEAD'].includes(type)) assert.equal(output.json.emailTo,'manager@example.invalid');
  const restore = new Function('$', code('Khôi phục nội dung'))(name=>({item:{json:name==='Chuẩn bị ngữ cảnh'?lead:output.json}}));
  assert.equal(restore.json.title,output.json.title);
  for (const name of ['Có dữ liệu?','Là thông báo sale?','Cần qua AI?']) {
    const expr=workflow.nodes.find(n=>n.name===name).parameters.conditions.conditions[0].leftValue.slice(3,-2);
    assert.equal(new Function('$','$json',`return (${expr});`)(get,lead),name!=='Cần qua AI?',`Wrong ${name} route for ${type}`);
  }
}
const expression = name => workflow.nodes.find(n => n.name === name).parameters.conditions.conditions[0].leftValue.slice(3,-2);
for (const type of ['WARM_NUDGE','COLD_NURTURE']) {
  const lead={type,lead_id:20,email:'demo@example.invalid'};
  const get=name=>({item:{json:lead}});
  for (const name of ['Có dữ liệu?','Cần tìm contact?','Là chuyển Mautic?']) {
    assert.equal(new Function('$','$json',`return (${expression(name)});`)(get,lead),true,`${type}: ${name}`);
  }
  const expr=workflow.nodes.find(n=>n.name==='Gửi Mautic nuôi dưỡng').parameters.jsonBody.slice(3,-2);
  const payload=JSON.parse(new Function('$json',`return (${expr});`)({...lead,bodyHtml:'AI text'}));
  assert.deepEqual(payload.tags,type==='COLD_NURTURE'?['ban-tin-hang-thang']:['nuoi-warm','WARM']);
  assert.equal('ai_nudge_text' in payload,type==='WARM_NUDGE');
}
const saleCheck=code('Kiểm tra gửi sale');
const getHot=()=>({item:{json:{type:'HOT_NUDGE'}}});
assert.throws(()=>new Function('$','$json',saleCheck)(getHot,{emailSent:true,telegramSent:false}),/Telegram/);
assert.doesNotThrow(()=>new Function('$','$json',saleCheck)(getHot,{telegramSent:true}));
const getExpired=()=>({item:{json:{type:'EXPIRE_LEAD'}}});
assert.throws(()=>new Function('$','$json',saleCheck)(getExpired,{telegramSent:true,emailSent:false}),/email quản lý/);
assert.doesNotThrow(()=>new Function('$','$json',saleCheck)(getExpired,{emailSent:true}));
const coldCtx={type:'COLD_NURTURE',lead_id:20};
const coldOutput=new Function('$',code('Chuẩn bị bản tin COLD'))(()=>({item:{json:coldCtx}}));
const coldRestore=new Function('$',code('Khôi phục nội dung'))(name=>({item:{json:name==='Chuẩn bị ngữ cảnh'?coldCtx:coldOutput.json}}));
assert.equal(coldRestore.json.type,'COLD_NURTURE');
assert.equal(workflow.connections['Chuẩn bị bản tin COLD'].main[0][0].node,'Cần tìm contact?');
console.log('PASS: L2 node references, error branches, selector, fallback and summary.');
