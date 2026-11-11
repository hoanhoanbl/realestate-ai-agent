const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const workflow=JSON.parse(fs.readFileSync(path.join(__dirname,'../n8n-workflows/luong-7-dong-bo-mautic.json'),'utf8'));
const node=name=>workflow.nodes.find(n=>n.name===name);
const normalize=body=>new Function('$',node('Chuẩn hoá dữ liệu').parameters.jsCode)(()=>({first:()=>({json:body})}))[0].json;
const choose=(context,response,linked)=>new Function('$','$json',node('Chọn Contact đúng định danh').parameters.jsCode)(name=>({first:()=>({json:name==='Chuẩn hoá dữ liệu'?context:{contact:linked}})}),response)[0].json;
const search=context=>{
 const expression=node('Tìm Contact Mautic').parameters.queryParameters.parameters.find(p=>p.name==='search').value.slice(3,-2);
 return new Function('$',`return (${expression});`)(()=>({first:()=>({json:context})}));
};
module.exports={workflow,normalize,choose,search};
if(require.main===module){
 const base={leadId:1,name:'Nguyễn Văn An',phone:'+84 901.234-567',status:'CONSULTING',source:'telegram',email:null};
 const p=normalize(base);
 assert.equal(p.phone,'0901234567');assert.equal(p.firstname,'An');assert.equal(p.lastname,'Nguyễn Văn');
 assert.equal(choose(p,{contacts:{}}).payload.email,undefined);
 assert(!('email' in choose(p,{contacts:{}}).payload));
 assert(search(p).includes('0901234567'));assert(!search(p).includes('email:'));
 for(const invalid of ['bad-email','a"b@example.test','a b@example.test'])assert.throws(()=>normalize({...base,email:invalid}),/Email/);
 for(const invalid of ['', 'abc0901234567', '090+1234567'])assert.throws(()=>normalize({...base,phone:invalid}),/điện thoại/);
 const c={id:17,fields:{all:{phone:'090 123 4567',email:'old@example.test'}}};
 assert.equal(choose(p,{contacts:{17:c}}).contactId,17);
 assert(!('email' in choose(p,{contacts:{17:c}}).payload));
 const linked={...p,mauticContactId:17};
 assert.equal(choose(linked,{contacts:{}},c).contactId,17);
 const added=normalize({...base,email:'NEW@EXAMPLE.TEST',mauticContactId:17});
 assert.equal(choose(added,{contacts:{}},{id:17,phone:p.phone}).payload.email,'new@example.test');
 assert(!('email' in choose(added,{contacts:{}},c).payload));
 assert.throws(()=>choose(p,{contacts:{17:c,18:{id:18,phone:'+84901234567'}}}),/nhiều contact/);
 assert.throws(()=>choose(added,{contacts:{18:{id:18,email:added.email,phone:'0909999999'}}},c),/xung đột/);
 assert.throws(()=>choose({...added,mauticContactId:null},{contacts:{18:{id:18,email:added.email,phone:'0909999999'}}}),/thuộc khách khác/);
 assert.throws(()=>choose(p,{contacts:{},total:101}),/Quá nhiều/);
 assert.throws(()=>choose(linked,{contacts:{}},{...c,id:18}),/không còn hợp lệ/);
 assert.equal(node('Tạo Contact mới').retryOnFail,false);
 const names=new Set(workflow.nodes.map(n=>n.name));
 for(const n of workflow.nodes){
  if(n.parameters.jsCode)new Function('$','$json','$input',n.parameters.jsCode);
  for(const groups of Object.values(workflow.connections[n.name]??{}))for(const edges of groups)for(const edge of edges)assert(names.has(edge.node),`Missing target ${edge.node}`);
  for(const ref of JSON.stringify(n.parameters).matchAll(/\$\('([^']+)'\)/g))assert(names.has(ref[1]),`Missing node ${ref[1]}`);
 }
 console.log('PASS: FE-40 no-email creation, phone matching, linked ID, email preservation, ambiguity and workflow references.');
}
