// Real isolated n8n -> Nest -> disposable PostgreSQL. All delivery channels mocked.
// n8n 2.42 CLI publish writes the legacy activeVersion pointer; disable only the new
// publication-service read path inside this disposable CLI fixture to match that pointer.
// Run after backend build. Requires localhost:55433/fe33_test, never the application DB.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
require('../backend/node_modules/reflect-metadata');
const { DataSource } = require('../backend/node_modules/typeorm');
const { Module, Controller, Post, Get, Req, ValidationPipe } = require('../backend/node_modules/@nestjs/common');
const { JwtModule, JwtService } = require('../backend/node_modules/@nestjs/jwt');
const { NestFactory } = require('../backend/node_modules/@nestjs/core');
const load = (p,k) => require('../backend/dist/'+p)[k];
const classes = [
  ['feedback/feedback-work.entity','FeedbackWork'], ['feedback/feedback-work.entity','FeedbackWorkHistory'], ['feedback/feedback-work.entity','FeedbackWorkAlert'],
  ['feedback/entities/feedback.entity','Feedback'], ['leads/entities/lead.entity','Lead'], ['leads/entities/lead-event.entity','LeadEvent'],
  ['users/entities/user.entity','User'], ['properties/entities/property.entity','Property'], ['viewings/entities/viewing.entity','Viewing'], ['contracts/entities/contract.entity','Contract'],
];
const entities = Object.fromEntries(classes.map(([p,k]) => [k,load(p,k)]));
const { FeedbackWork, FeedbackWorkHistory, FeedbackWorkAlert, Feedback, Lead, User, Property, Viewing } = entities;
const FeedbackWorkService = load('feedback/feedback-work.service','FeedbackWorkService');
const FeedbackWorkController = load('feedback/feedback-work.controller','FeedbackWorkController');
const root = path.resolve(__dirname,'..'), schema = 'l5_runtime_test';
const databaseUrl = process.env.FE33_TEST_DATABASE_URL;
const target = new URL(databaseUrl || 'postgres://invalid');
assert(['127.0.0.1','localhost'].includes(target.hostname) && target.port === '55433' && target.pathname === '/fe33_test', 'Set FE33_TEST_DATABASE_URL to disposable localhost:55433/fe33_test');
const db = new DataSource({type:'postgres',url:databaseUrl,schema,entities:Object.values(entities),extra:{options:'-c search_path='+schema}});
const key = 'l5-runtime-test-only', calls = [], engine = 'realestate-l5-test-engine';
let app, folder, finishPreview, created = false, engineRunning = false;
const docker = args => new Promise((resolve,reject) => {
  const child=spawn('docker',args,{stdio:['ignore','pipe','pipe']});let output='';
  child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);child.on('error',reject);
  child.on('exit',code=>code===0?resolve(output):reject(Error(output.slice(-4000))));
});
async function cleanup() {
  if (engineRunning) await docker(['rm','-f',engine]).catch(()=>undefined);
  await app?.close();
  if(db.isInitialized) { if(created) await db.query('DROP SCHEMA '+schema+' CASCADE');await db.destroy(); }
  if(folder) { fs.rmSync(path.join(folder,'workflows.json'),{force:true});fs.rmdirSync(folder); }
}
(async()=>{
  try {
    await db.initialize();await db.query('CREATE SCHEMA '+schema);created=true;
    // Migration is additive and repeatable; TypeORM must find no further schema changes.
    const sql=fs.readFileSync(path.join(root,'backend/sql/l5-feedback-work.sql'),'utf8');
    await db.query(sql);await db.query(sql);await db.synchronize();
    const drift=await db.driver.createSchemaBuilder().log();assert.equal(drift.upQueries.length,0,'Migration / entity schema drift');
    const user=await db.getRepository(User).save({name:'Sale demo',email:'sale@example.invalid',role:'SALE',passwordHash:'unused'});
    const manager=await db.getRepository(User).save({name:'Quản lý demo',email:'manager@example.invalid',role:'MANAGER',passwordHash:'unused'});
    const property=await db.getRepository(Property).save({name:'Nhà demo Sơn Trà',address:'Đà Nẵng',price:2000000000,area:80,type:'HOUSE',status:'AVAILABLE'});
    for(const [index,name] of ['Mới nhận','Cần nhắc','Báo quản lý','Đã hoàn tất','Kênh không xác nhận','Kênh lỗi'].entries()) {
      const lead=await db.getRepository(Lead).save({name,phone:'090000000'+index,status:'VIEWED',assignedUserId:user.id});
      const viewing=await db.getRepository(Viewing).save({leadId:lead.id,propertyId:property.id,viewingTime:new Date(Date.now()-86400000),status:'ATTENDED'});
      const feedback=await db.getRepository(Feedback).save({leadId:lead.id,token:`v${viewing.id}_${'a'.repeat(32)}`,rating:4,interest:'OTHER',comment:'Muốn trao đổi thêm',submittedAt:new Date()});
      await db.getRepository(FeedbackWork).save({feedbackId:feedback.id,leadId:lead.id,viewingId:viewing.id,
        status:index===3?'COMPLETED':'PENDING',dueAt:new Date(Date.now()+(index===0?3600000:-3600000)),
        escalateAt:new Date(Date.now()+(index===2?-1000:3600000)),completedAt:index===3?new Date():null});
    }
    process.env.WEBHOOK_SECRET=key;
    const service=new FeedbackWorkService(db,{callWebhook:async()=>undefined},{notifyFollowupStatusChanged:async()=>undefined});
    const jwt=new JwtService({secret:'l5-preview-only'});
    class TestController {
      login() { return {accessToken:jwt.sign({...manager,sub:manager.id}),user:{id:manager.id,email:manager.email,name:manager.name,role:manager.role}}; }
      properties() { return db.getRepository(Property).find(); }
      stopPreview() { finishPreview?.(); return {ok:true}; }
      notification(req) { const payload=req.body;calls.push(payload);if(payload.leadId===6)throw Error('Simulated provider timeout');return payload.leadId===5?{}:{emailSent:true,telegramSent:false,pushSent:false}; }
    }
    Controller()(TestController);
    for(const [method,decorator] of [['login',Post('auth/login')],['properties',Get('properties')],['stopPreview',Post('test-stop-preview')],['notification',Post('test-notifications')]])decorator(TestController.prototype,method,Object.getOwnPropertyDescriptor(TestController.prototype,method));
    Req()(TestController.prototype,'notification',0);
    class TestModule {}
    Module({imports:[JwtModule.register({secret:'l5-preview-only'})],controllers:[FeedbackWorkController,TestController],providers:[{provide:FeedbackWorkService,useValue:service}]})(TestModule);
    app=await NestFactory.create(TestModule,{logger:false});app.setGlobalPrefix('api');app.enableCors();app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));await app.listen(18095,'0.0.0.0');
    if(process.argv.includes('--preview-only')) {
      console.log('Preview API http://localhost:18095/api; demo manager@example.invalid / demo. POST /api/test-stop-preview to clean up.');
      await new Promise(resolve=>{finishPreview=resolve;process.once('SIGINT',resolve);});
      return;
    }
    fs.mkdirSync(path.join(root,'tmp'),{recursive:true});folder=fs.mkdtempSync(path.join(root,'tmp','l5-engine-'));
    const workflow=JSON.parse(fs.readFileSync(path.join(root,'n8n-workflows/luong-5-theo-doi-phan-hoi.json'),'utf8'));
    for(const a of workflow.nodes.find(n=>n.name==='Cấu hình').parameters.assignments.assignments) {
      if(a.name==='backendUrl')a.value='http://host.docker.internal:18095';
      if(a.name==='webhookSecret')a.value=key;
      if(a.name==='managerEmail')a.value='manager@example.invalid';
    }
    workflow.nodes.find(n=>n.name==='Thông báo nhân viên').parameters.workflowId.value='l5TestMockDelivery';
    const mock={id:'l5TestMockDelivery',name:'L5 test mock delivery',active:false,nodes:[
      {id:'entry',name:'Entry',type:'n8n-nodes-base.executeWorkflowTrigger',typeVersion:1.1,position:[0,0],parameters:{inputSource:'passthrough'}},
      {id:'mock',name:'Mock delivery',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[220,0],parameters:{method:'POST',url:'http://host.docker.internal:18095/api/test-notifications',sendBody:true,specifyBody:'json',jsonBody:'={{ $json }}',options:{timeout:15000}}},
    ],connections:{Entry:{main:[[{node:'Mock delivery',type:'main',index:0}]]}},settings:{executionOrder:'v1'}};
    fs.writeFileSync(path.join(folder,'workflows.json'),JSON.stringify([mock,workflow]));
    console.log('Starting disposable n8n engine; delivery is mocked.');engineRunning=true;
    await docker(['run','--rm','-d','--name',engine,'--add-host','host.docker.internal:host-gateway','-e','N8N_DIAGNOSTICS_ENABLED=false','-e','N8N_VERSION_NOTIFICATIONS_ENABLED=false','-e','N8N_USE_WORKFLOW_PUBLICATION_SERVICE=false','-e','N8N_RUNNERS_ENABLED=false','-e','N8N_BLOCK_ENV_ACCESS_IN_NODE=false','-v',folder.replace(/\\/g,'/')+':/files','--entrypoint','/bin/sh','docker.n8n.io/n8nio/n8n','-c','sleep 1800']);
    await docker(['exec',engine,'n8n','import:workflow','--input=/files/workflows.json']);
    const published = await docker(['exec',engine,'n8n','publish:workflow','--id=l5TestMockDelivery']);
    assert(published.includes('Publishing workflow'), 'Mock workflow did not publish');
    const execution = await docker(['exec',engine,'n8n','execute','--id=feedbackWorkNotifications']);
    let alerts=await db.getRepository(FeedbackWorkAlert).find();
    if(alerts.filter(a=>a.state==='SENT').length!==3) {
      console.error('Alert states:',alerts.map(a=>({workId:a.workId,state:a.state,error:a.error})), 'mock calls:',calls.length);
      console.error(execution.split('\n').filter(line=>/"error"|"description"|"message"|Error:/.test(line)).slice(0,35).join('\n'));
    }
    assert.equal(alerts.filter(a=>a.state==='SENT').length,3);
    assert.equal(alerts.filter(a=>a.state==='REVIEW').length,2);
    assert.equal(calls.length,5);
    assert(calls.find(c=>c.kind==='ESCALATE').emailTo==='manager@example.invalid');
    assert(calls.filter(c=>c.kind!=='ESCALATE').every(c=>c.assigneeId===user.id));
    assert(!calls.some(c=>c.leadId===4));
    await docker(['exec',engine,'n8n','execute','--id=feedbackWorkNotifications']);
    assert.equal(calls.length,5,'Repeated execution sent duplicate notification');
    console.log('PASS: real n8n batches NEW/REMIND/ESCALATE, routes current owner/manager, holds failed/uncertain sends for review, skips completed work and does not resend. Migration is idempotent.');
    await docker(['rm','-f',engine]);engineRunning=false;
    if(process.argv.includes('--preview')) {console.log('Preview API http://localhost:18095/api; demo login manager@example.invalid / demo. Ctrl+C cleans disposable schema.');await new Promise(resolve=>process.once('SIGINT',resolve));}
  } finally {await cleanup();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
