// Disposable local-only n8n + Nest + PostgreSQL E2E. No real SMTP/Gemini or application DB.
// Requires backend build, Docker and an empty test DB on 127.0.0.1:55433/fe33_test.
// --preview keeps the fake API available on :18092 for web QA until Ctrl+C.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
require('../backend/node_modules/reflect-metadata');
const {DataSource}=require('../backend/node_modules/typeorm');
const {Module,Controller,Post,ValidationPipe}=require('../backend/node_modules/@nestjs/common');
const {NestFactory}=require('../backend/node_modules/@nestjs/core');
const {JwtModule,JwtService}=require('../backend/node_modules/@nestjs/jwt');
const load=(file,key)=>require('../backend/dist/'+file)[key];
const WeeklyReport=load('reports/entities/weekly-report.entity','WeeklyReport');
const ReportsService=load('reports/reports.service','ReportsService');
const ReportsController=load('reports/reports.controller','ReportsController');
const Breakdowns=load('reports/report-breakdowns.service','ReportBreakdownsService');
const schema='l4_runtime_test';
const db=new DataSource({type:'postgres',url:'postgresql://postgres@127.0.0.1:55433/fe33_test',schema,entities:[WeeklyReport],extra:{options:'-c search_path='+schema}});
let app,folder;let schemaCreated=false;
const key='l4-local-test-secret',jwt=new JwtService({secret:'l4-local-jwt-secret'});
const user={id:1,email:'manager@example.invalid',name:'Quản lý demo L4',role:'MANAGER'};
async function cleanup(){await app?.close();if(db.isInitialized){if(schemaCreated)await db.query('DROP SCHEMA '+schema+' CASCADE');await db.destroy();}if(folder){for(const file of ['workflow.json','credentials.json','export.json'])fs.rmSync(path.join(folder,file),{force:true});fs.rmdirSync(folder);}}
async function docker(args){return new Promise((resolve,reject)=>{const p=spawn('docker',args,{stdio:['ignore','pipe','pipe']});let output='';p.stdout.on('data',d=>output+=d);p.stderr.on('data',d=>output+=d);p.on('error',reject);p.on('exit',code=>code===0?resolve(output):reject(Error('Docker E2E failed: '+output.slice(-2500))));});}
(async()=>{
 try{
  await db.initialize();await db.query('CREATE SCHEMA '+schema);schemaCreated=true;await db.synchronize();
  await db.query(`CREATE TABLE users(id int,name text,role text);
    CREATE TABLE properties(id int,name text,status text);
    CREATE TABLE leads(id int,name text,status text,level text,created_at timestamptz,automation_status text,source text,assigned_user_id int,assigned_at timestamptz,response_due_at timestamptz,first_response_at timestamptz);
    CREATE TABLE lead_events(id int,lead_id int,type text,note text,created_at timestamptz);
    CREATE TABLE viewings(id int,lead_id int,property_id int,viewing_time timestamptz,status text);
    CREATE TABLE feedbacks(id int,lead_id int,token text,submitted_at timestamptz,rating int,interest text,comment text);
    CREATE TABLE contracts(id int,lead_id int,property_id int,status text,deposit_amount bigint,created_at timestamptz,signed_at timestamptz);
    INSERT INTO users VALUES(1,'Quản lý demo','MANAGER'),(2,'Sale Minh','SALE'),(3,'Sale An','SALE');
    INSERT INTO properties VALUES(10,'Nhà Sơn Trà','AVAILABLE'),(20,'Căn hộ Hải Châu','SOLD'),(30,'Nhà chưa có lượt xem','AVAILABLE');
    INSERT INTO leads VALUES(100,'Khách demo','SIGNED','HOT',now()-interval '6 days','COMPLETED','hotline',3,now()-interval '3 days',now()-interval '3 days'+interval '2 hours',now()-interval '3 days'+interval '1 hour');
    INSERT INTO lead_events VALUES(1,100,'LEAD_ASSIGNED','2 (Sale Minh)',now()-interval '6 days'),(2,100,'LEAD_REASSIGNED','2 -> 3 (Sale An)',now()-interval '3 days'),(3,100,'APPROVED','demo',now()-interval '5 days'),(4,100,'STATUS_CHANGED','CONFIRMED -> VIEWED',now()-interval '4 days'),(5,100,'CONTRACT_CREATED','demo',now()-interval '2 days');
    INSERT INTO viewings VALUES(1,100,10,now()-interval '4 days','ATTENDED'),(2,100,20,now()-interval '2 days','ATTENDED');
    INSERT INTO feedbacks VALUES(1,100,'v1_disposable',now()-interval '2 days',2,'OTHER','Giá cao, vị trí xa'),(2,100,'v2_disposable',now()-interval '1 day',5,'DEPOSIT','Đồng ý');
    INSERT INTO contracts VALUES(1,100,20,'SIGNED',100000000,now()-interval '2 days',now()-interval '1 day');`);
  process.env.WEBHOOK_SECRET=key;
  class LoginController { login(){return {accessToken:jwt.sign({sub:user.id,...user}),user};} }
  Controller('auth')(LoginController);Post('login')(LoginController.prototype,'login',Object.getOwnPropertyDescriptor(LoginController.prototype,'login'));
  class TestModule{}
  Module({imports:[JwtModule.register({secret:'l4-local-jwt-secret'})],controllers:[ReportsController,LoginController],providers:[{provide:ReportsService,useValue:new ReportsService(db.getRepository(WeeklyReport),{callWebhook:async()=>({})})},{provide:Breakdowns,useValue:new Breakdowns(db)}]})(TestModule);
  app=await NestFactory.create(TestModule,{logger:false});app.setGlobalPrefix('api');app.enableCors();app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true}));await app.listen(18092,'0.0.0.0');
  const root=path.resolve(__dirname,'..');fs.mkdirSync(path.join(root,'tmp'),{recursive:true});folder=fs.mkdtempSync(path.join(root,'tmp','l4-engine-'));
  const w=JSON.parse(fs.readFileSync(path.join(root,'n8n-workflows/luong-4-bao-cao.json'),'utf8'));w.id='l4DisposableTest';w.active=false;
  const remove=new Set(['Thứ Hai 8h','Quản lý bấm tạo ngay','Google Gemini Chat Model','Structured Output Parser','Tra cứu cơ sở dữ liệu']);
  w.nodes=w.nodes.filter(n=>!remove.has(n.name));for(const name of remove)delete w.connections[name];
  for(const n of w.nodes){
   if(n.name==='Cấu hình')for(const a of n.parameters.assignments.assignments){if(a.name==='backendUrl')a.value='http://host.docker.internal:18092';}
   if(n.type==='n8n-nodes-base.postgres'){
    n.credentials={postgres:{id:'l4-test-pg',name:'Disposable PostgreSQL'}};
    n.parameters.query=n.parameters.query.replace(/\b(FROM|JOIN) (leads|lead_events|contracts|feedbacks|properties|viewings)\b/g,(_,keyword,table)=>keyword+' '+schema+'.'+table);
   }
   if(n.type==='n8n-nodes-base.httpRequest'){
    delete n.credentials;delete n.parameters.authentication;delete n.parameters.genericAuthType;
    n.parameters.sendHeaders=true;n.parameters.headerParameters={parameters:[{name:'X-Webhook-Secret',value:key}]};
   }
   if(n.name==='AI Agent phân tích'){n.type='n8n-nodes-base.code';n.typeVersion=2;n.parameters={jsCode:'return [{json:{output:{}}}];'};delete n.credentials;}
   if(n.type==='n8n-nodes-base.emailSend'){n.type='n8n-nodes-base.code';n.typeVersion=2;n.parameters={jsCode:"const e=$('Soạn email báo cáo').first().json;if(!e.html.includes('Hiệu suất sale')||!e.html.includes('Hiệu quả từng căn nhà'))throw new Error('Missing email tables');return [{json:{emailMocked:true}}];"};delete n.credentials;}
  }
  fs.writeFileSync(path.join(folder,'workflow.json'),JSON.stringify(w));
  fs.writeFileSync(path.join(folder,'credentials.json'),JSON.stringify([{id:'l4-test-pg',name:'Disposable PostgreSQL',type:'postgres',data:{host:'host.docker.internal',database:'fe33_test',user:'postgres',password:'',port:55433,ssl:'disable'}}]));
  await docker(['run','--rm','--name','realestate-l4-engine','--add-host','host.docker.internal:host-gateway','-e','N8N_DIAGNOSTICS_ENABLED=false','-e','N8N_VERSION_NOTIFICATIONS_ENABLED=false','-e','N8N_RUNNERS_ENABLED=false','-e','N8N_BLOCK_ENV_ACCESS_IN_NODE=false','-v',folder.replace(/\\/g,'/')+':/files','--entrypoint','/bin/sh','docker.n8n.io/n8nio/n8n','-c','n8n import:credentials --input=/files/credentials.json >/tmp/import.log 2>&1 && n8n import:workflow --input=/files/workflow.json >>/tmp/import.log 2>&1 && n8n execute --id=l4DisposableTest >/tmp/run.log 2>&1 && n8n export:workflow --id=l4DisposableTest --output=/files/export.json >/tmp/export.log 2>&1 || { tail -c 2000 /tmp/run.log; exit 1; }']);
  const saved=await db.getRepository(WeeklyReport).find();assert.equal(saved.length,1);
  const b=saved[0].metrics.breakdowns;assert.equal(b.version,1);assert(b.sales.some(s=>s.name==='Sale Minh'&&s.viewedLeads===1));assert(b.sales.some(s=>s.name==='Sale An'&&s.signedLeads===1));assert.equal(b.properties.find(p=>p.propertyId===10).averageRating,2);assert.equal(saved[0].analysis.aiUsed,false);
  console.log('PASS: real n8n -> PostgreSQL overview -> protected Nest breakdown API -> AI fallback -> persisted report -> mocked email includes both tables. No real email/Gemini.');
  if(process.argv.includes('--preview')){console.log('Fake preview API ready: http://localhost:18092/api; login manager@example.invalid / demo. Ctrl+C cleans only disposable schema.');await new Promise(resolve=>process.once('SIGINT',resolve));}
 }finally{await cleanup();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
