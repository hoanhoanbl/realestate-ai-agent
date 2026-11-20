// Executes the actual Code node from the exported workflow. No network or n8n credentials.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const wf=JSON.parse(fs.readFileSync(path.join(__dirname,'../n8n-workflows/luong-9-follow-up-bac.json'),'utf8'));
const get=name=>{const n=wf.nodes.find(x=>x.name===name);assert(n,`Missing ${name}`);return n;};
for(const n of wf.nodes.filter(n=>n.type==='n8n-nodes-base.code'))new Function('$','$json','$env',n.parameters.jsCode);
const run=output=>new Function('$','$json',get('Kiểm tra nháp').parameters.jsCode)(()=>({item:{json:{name:'An',propertyName:'Nhà A'}}}),{output}).json;
const valid={action:'CALL',reason:'Gọi để xác nhận nhu cầu.',emailDraft:'Chào anh/chị. Anh/chị còn nhu cầu tìm nhà không? Vui lòng phản hồi để em hỗ trợ.'};
assert.equal(run(valid).suggestion.emailDraft,valid.emailDraft);
for(const emailDraft of ['', ' '.repeat(5),'x'.repeat(1501),'Chào anh/chị, giảm giá 10%.','Anh có căn hộ gần biển.','Chào anh/chị, hồ bơi và sổ hồng đã sẵn sàng.','Anh đã được duyệt vay.','<script>alert(1)</script>'])
  assert.equal(run({...valid,emailDraft}).suggestion.emailDraft,null,emailDraft);
assert.equal(run({...valid,action:'WAIT'}).suggestion.emailDraft,null);
assert.equal(run(undefined).aiFailed,true);assert.equal(run(undefined).suggestion.action,'CALL');
const names=new Set(wf.nodes.map(n=>n.name));
for(const [from,kinds]of Object.entries(wf.connections)){
  assert(names.has(from));for(const outputs of Object.values(kinds))for(const group of outputs)for(const edge of group)assert(names.has(edge.node),edge.node);
}
const edge=(from,index=0)=>wf.connections[from]?.main?.[index]?.map(e=>e.node)??[];
assert(edge('Gửi thư đã duyệt').includes('Thư đã gửi'));
assert(edge('Bắt đầu thư').includes('Được gửi thư?'));
assert(edge('Được gửi thư?').includes('Dựng thư'));
assert(edge('Dựng thư').includes('Gửi thư đã duyệt'));
assert(edge('Ghi thất bại').includes('Dừng báo lỗi'));
for(const name of ['Kiểm tra checkpoint','Kiểm tra checkpoint thư']) {
  const check=new Function('$json',get(name).parameters.jsCode);
  assert.throws(()=>check({claimed:false,reason:'REVIEW'}),/REVIEW/);
  assert.equal(check({claimed:false,reason:'COMPLETED'}).json.claimed,false);
  assert(edge(name,1).includes('Thông tin lỗi'),'REVIEW must reach Error workflow');
}
assert.equal(wf.active,false,'Import inactive before manual acceptance');
assert.equal(wf.settings.timezone,'Asia/Ho_Chi_Minh');
assert.equal(get('08h đến 20h').parameters.rule.interval[0].expression,'0 8-20 * * *');
assert(get('Sale đã duyệt').credentials.httpHeaderAuth);
assert(get('Dựng thư').parameters.jsCode.includes("replace(/</g,'&lt;')"),'Escape the approved plain text');
const renderMail=new Function('$',get('Dựng thư').parameters.jsCode);
const delivery=renderMail(name=>({item:{json:name==='Bắt đầu thư'
  ?{allowed:true,delivery:{email:'current@example.test',text:'Current <b>text</b>'}}
  :{email:'old@example.test',text:'Stale context'}}})).json;
assert.equal(delivery.email,'current@example.test','Use recipient rechecked by start, not stale context');
assert.equal(delivery.html,'Current &lt;b&gt;text&lt;/b&gt;');
const allowed=new Set(['iYLrhsH8b8dDkZ0n','wU5LeG7gXaoUdMXQ','hfJ9bBGUGsjH8qDP']);
for(const n of wf.nodes)for(const c of Object.values(n.credentials??{}))assert(allowed.has(c.id),'Unknown credential '+c.id);
console.log(`PASS: L9 guardrail, fallback, WAIT, graph, consent-fenced email path, schedule, credential IDs (${wf.nodes.length} nodes).`);
