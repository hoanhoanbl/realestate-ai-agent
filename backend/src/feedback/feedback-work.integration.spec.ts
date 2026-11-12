import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { FeedbackWorkService } from './feedback-work.service';
import { FeedbackWorkController } from './feedback-work.controller';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.controller';
import { FeedbackWork, FeedbackWorkAlert, FeedbackWorkHistory } from './feedback-work.entity';
import { Feedback } from './entities/feedback.entity';
import { Lead } from '../leads/entities/lead.entity';
import { LeadEvent } from '../leads/entities/lead-event.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { LeadsService } from '../leads/leads.service';
import { addWorkingHours } from '../leads/intake-rules';
import { bookableSlots } from '../viewings/viewing-time';
import { ContractsService } from '../contracts/contracts.service';
import type { AuthUser } from '../auth/auth.types';

const url = process.env.FE33_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;
integration('L5: feedback work with real PostgreSQL transactions and HTTP guards', () => {
  let db: DataSource, work: FeedbackWorkService, feedback: FeedbackService, leads: LeadsService;
  let owner: AuthUser, other: AuthUser, manager: AuthUser, lead: Lead, property: Property, viewing: Viewing;
  const n8n = { callWebhook: jest.fn(async () => undefined) };
  const future = () => new Date(Date.now()+86400000).toISOString();
  const saveFeedback = async (submitted = true, v = viewing) => db.getRepository(Feedback).save({ leadId: lead.id,
    token: `v${v.id}_${String(v.id).padStart(32,'a')}`, rating: submitted ? 4 : null, interest: submitted ? 'OTHER' : null,
    comment: 'Cần suy nghĩ', submittedAt: submitted ? new Date() : null });
  const createWork = async () => { const f=await saveFeedback(); return db.transaction(m=>work.create(m,f)); };
  beforeAll(async () => {
    const target=new URL(url!);
    if(!['localhost','127.0.0.1'].includes(target.hostname)||target.port!=='55433'||target.pathname!=='/fe33_test') throw new Error('Chỉ dùng localhost:55433/fe33_test');
    db=new DataSource({type:'postgres',url,synchronize:true,entities:[FeedbackWork,FeedbackWorkHistory,FeedbackWorkAlert,Feedback,Lead,LeadEvent,User,Property,Viewing,Contract]});
    await db.initialize();
    leads=new LeadsService(db.getRepository(Lead),db.getRepository(LeadEvent),db.getRepository(Viewing),db.getRepository(Property),n8n as any);
    work=new FeedbackWorkService(db,n8n as any,leads);
    feedback=new FeedbackService(db.getRepository(Feedback),db.getRepository(Viewing),db.getRepository(Property),leads,n8n as any,work);
  });
  afterAll(async () => { if(db?.isInitialized) await db.destroy(); });
  beforeEach(async () => {
    await db.query('TRUNCATE feedback_work_alerts,feedback_work_history,feedback_work,feedbacks,contracts,viewings,leads,lead_events,properties,users RESTART IDENTITY');
    n8n.callWebhook.mockReset(); n8n.callWebhook.mockResolvedValue(undefined);
    const users=await db.getRepository(User).save(['SALE','SALE','MANAGER'].map((role,i)=>({role:role as 'SALE'|'MANAGER',name:`User ${i}`,email:`user${i}@example.invalid`,passwordHash:'test'})));
    [owner,other,manager]=users;
    lead=await db.getRepository(Lead).save({name:'Khách test',phone:'0901234567',assignedUserId:owner.id,status:'VIEWED'});
    property=await db.getRepository(Property).save({name:'Căn A',address:'Đà Nẵng',price:2000000000,area:100,type:'HOUSE',status:'AVAILABLE'});
    viewing=await db.getRepository(Viewing).save({leadId:lead.id,propertyId:property.id,status:'ATTENDED',viewingTime:new Date(Date.now()-86400000)});
  });
  it('double submit commits one feedback, one task and event; failed task rolls back feedback',async()=>{
    const f=await saveFeedback(false);
    const results=await Promise.allSettled([feedback.submit(f.token,{rating:4,interest:'OTHER'}),feedback.submit(f.token,{rating:5,interest:'DEPOSIT'})]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(await db.getRepository(FeedbackWork).count()).toBe(1);
    expect(await db.getRepository(LeadEvent).countBy({type:'FEEDBACK_RECEIVED'})).toBe(1);
    const w=await db.getRepository(FeedbackWork).findOneByOrFail({feedbackId:f.id});
    const saved=await db.getRepository(Feedback).findOneByOrFail({id:f.id});
    expect(w.viewingId).toBe(viewing.id); expect(w.dueAt).toEqual(addWorkingHours(saved.submittedAt!,2));
    const v2=await db.getRepository(Viewing).save({leadId:lead.id,propertyId:property.id,status:'ATTENDED',viewingTime:new Date()});
    const f2=await saveFeedback(false,v2);
    const spy=jest.spyOn(work,'create').mockRejectedValueOnce(new Error('test rollback'));
    await expect(feedback.submit(f2.token,{rating:3,interest:'OTHER'})).rejects.toThrow('rollback');spy.mockRestore();
    expect((await db.getRepository(Feedback).findOneByOrFail({id:f2.id})).submittedAt).toBeNull();
  });
  it('maps the reviewed property exactly, legacy to first; never discloses the feedback token',async()=>{
    const f=await saveFeedback();
    const p2=await db.getRepository(Property).save({...property,id:undefined,name:'Căn B'});
    await db.getRepository(Viewing).save({leadId:lead.id,propertyId:p2.id,status:'NEW',viewingTime:new Date()});
    expect((await work.context(f.id)).property_name).toBe('Căn A');
    await db.getRepository(Feedback).update(f.id,{token:'b'.repeat(32)});
    expect((await work.context(f.id)).property_name).toBe('Căn A');
    await db.transaction(m=>work.create(m,{...f,token:'b'.repeat(32)}));
    expect(JSON.stringify(await work.list(owner,'ALL'))).not.toContain('bbbbbbbb');
  });
  it('rejects a different sale; assignment transfer moves visibility and blocks stale notification recipients',async()=>{
    const w=await createWork();
    await expect(work.record(w.id,{version:1,outcome:'CONTACTED',note:'x',complete:true},other)).rejects.toThrow('sale');
    expect(await work.list(other,'ALL')).toHaveLength(0);
    await db.getRepository(Lead).update(lead.id,{assignedUserId:other.id});
    expect((await work.start({workId:w.id,version:1,assigneeId:owner.id,kind:'NEW'})).allowed).toBe(false);
    expect(await work.list(owner,'ALL')).toHaveLength(0);expect(await work.list(other,'ALL')).toHaveLength(1);
  });
  it('two simultaneous staff edits cannot overwrite history; completion stops alerts',async()=>{
    const w=await createWork();const dto={version:1,outcome:'CONTACTED' as const,note:'Đã gọi',complete:true};
    const r=await Promise.allSettled([work.record(w.id,dto,owner),work.record(w.id,dto,manager)]);
    expect(r.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect(await db.getRepository(FeedbackWorkHistory).count()).toBe(1);
    expect(await work.due()).toEqual([]);
  });
  it('needs time keeps work open with new deadline; reminders use the new revision',async()=>{
    const w=await createWork();const next=future();
    await work.record(w.id,{version:1,outcome:'NEEDS_TIME',note:'Khách bàn gia đình',nextDueAt:next},owner);
    const saved=await db.getRepository(FeedbackWork).findOneByOrFail({id:w.id});
    expect(saved.status).toBe('IN_PROGRESS');expect(saved.version).toBe(2);expect(saved.dueAt.toISOString()).toBe(next);
    expect(await work.due()).toEqual([]);
    await db.getRepository(FeedbackWork).update(w.id,{dueAt:new Date(Date.now()-60000),escalateAt:new Date(Date.now()+3600000)});
    expect((await work.due())[0]).toMatchObject({workId:w.id,version:2,kind:'REMIND'});
  });
  it('each notification milestone sends once; repeated or concurrent starts cannot resend',async()=>{
    const w=await createWork();await db.getRepository(FeedbackWork).update(w.id,{dueAt:new Date(Date.now()+3600000)});
    const dto={workId:w.id,version:1,kind:'NEW',assigneeId:owner.id};
    const r=await Promise.all([work.start(dto),work.start(dto)]);const allowed=r.find(x=>x.allowed)!;
    expect(r.filter(x=>x.allowed)).toHaveLength(1);
    await expect(work.finish(allowed.alertId!,{token:'z'.repeat(64),delivered:true})).rejects.toThrow();
    await work.finish(allowed.alertId!,{token:allowed.token!,delivered:true});
    await work.finish(allowed.alertId!,{token:allowed.token!,delivered:true});
    expect(await work.due()).toEqual([]);
    await db.getRepository(FeedbackWork).update(w.id,{dueAt:new Date(Date.now()-1000),escalateAt:new Date(Date.now()+3600000)});
    const remind=(await work.due())[0];expect(remind.kind).toBe('REMIND');const a=await work.start(remind);await work.finish(a.alertId!,{token:a.token!,delivered:true});
    expect(await work.due()).toEqual([]);
    await db.getRepository(FeedbackWork).update(w.id,{escalateAt:new Date(Date.now()-1000)});
    const escalation=await work.start((await work.due())[0]);expect(escalation.kind).toBe('ESCALATE');expect(escalation).not.toHaveProperty('assigneeId');
  });
  it('uncertain delivery requires manager review; resolution is audited before retry',async()=>{
    const w=await createWork();await db.getRepository(FeedbackWork).update(w.id,{dueAt:new Date(Date.now()+3600000)});
    const dto={workId:w.id,version:1,kind:'NEW',assigneeId:owner.id};const a=await work.start(dto);
    await work.finish(a.alertId!,{token:a.token!,delivered:false,error:'SMTP timeout'});
    expect(await work.due()).toEqual([]);expect((await work.review(manager))[0].state).toBe('REVIEW');
    expect(JSON.stringify(await work.review(manager))).not.toContain(a.token!);
    await expect(work.resolve(a.alertId!,{delivered:false,note:'chưa gửi'},owner)).rejects.toThrow();
    await work.resolve(a.alertId!,{delivered:false,note:'Đã kiểm tra SMTP: chưa gửi'},manager);
    expect((await work.start(dto)).allowed).toBe(true);
    expect(await db.getRepository(LeadEvent).countBy({type:'FEEDBACK_ALERT_RESOLVED'})).toBe(1);
  });
  it('crash after start is held for review, not retried by another worker',async()=>{
    const w=await createWork();await db.getRepository(FeedbackWork).update(w.id,{dueAt:new Date(Date.now()+3600000)});
    const dto={workId:w.id,version:1,kind:'NEW',assigneeId:owner.id};const a=await work.start(dto);
    await db.getRepository(FeedbackWorkAlert).update(a.alertId!,{leaseUntil:new Date(Date.now()-1000)});
    expect((await work.start(dto)).allowed).toBe(false);expect((await work.review(manager))[0].state).toBe('REVIEW');
    await work.resolve(a.alertId!,{delivered:true,note:'Đã tìm thấy thư trong provider'},manager);
    expect(await work.due()).toEqual([]);
  });
  it('creates a real next viewing atomically, updates lead and completes the work',async()=>{
    const w=await createWork();const time=bookableSlots(new Date())[0].toISOString();
    await work.record(w.id,{version:1,outcome:'NEXT_VIEWING',note:'Khách đồng ý',propertyId:property.id,viewingTime:time},owner);
    const v=await db.getRepository(Viewing).findOneByOrFail({leadId:lead.id,status:'NEW'});
    expect(v.id).not.toBe(viewing.id);expect(v.viewingTime.toISOString()).toBe(time);
    expect((await db.getRepository(Lead).findOneByOrFail({id:lead.id})).status).toBe('NEW');
    expect((await db.getRepository(FeedbackWorkHistory).findOneByOrFail({workId:w.id})).nextViewingId).toBe(v.id);
    expect(n8n.callWebhook).toHaveBeenCalledWith('viewing-requested',expect.objectContaining({viewingId:v.id,assignedUserId:owner.id}));
  });
  it('rejects unavailable property, existing open viewing and another client occupying the time',async()=>{
    const w=await createWork();const time=bookableSlots(new Date())[0].toISOString();const dto={version:1,outcome:'NEXT_VIEWING' as const,note:'Hẹn tiếp',propertyId:property.id,viewingTime:time};
    await db.getRepository(Property).update(property.id,{status:'RESERVED'});await expect(work.record(w.id,dto,owner)).rejects.toThrow();
    await db.getRepository(Property).update(property.id,{status:'AVAILABLE'});
    const v=await db.getRepository(Viewing).save({leadId:lead.id,propertyId:property.id,status:'NEW',viewingTime:new Date(time)});
    await expect(work.record(w.id,dto,owner)).rejects.toThrow('lịch đang chờ');
    const l2=await db.getRepository(Lead).save({name:'Other',phone:'0909999999',status:'CONFIRMED'});
    await db.getRepository(Viewing).update(v.id,{leadId:l2.id});await expect(work.record(w.id,dto,owner)).rejects.toThrow('Khung giờ');
    expect(await db.getRepository(FeedbackWorkHistory).count()).toBe(0);
    expect((await db.getRepository(FeedbackWork).findOneByOrFail({id:w.id})).version).toBe(1);
  });
  it('a failed booking webhook preserves the booking and exposes manual approval fallback',async()=>{
    const w=await createWork();n8n.callWebhook.mockRejectedValueOnce(new Error('offline'));
    await work.record(w.id,{version:1,outcome:'NEXT_VIEWING',note:'Hẹn tiếp',propertyId:property.id,viewingTime:bookableSlots(new Date())[0].toISOString()},owner);
    expect((await db.getRepository(Lead).findOneByOrFail({id:lead.id})).automationStatus).toBe('FAILED');
    expect(await db.getRepository(Viewing).countBy({leadId:lead.id,status:'NEW'})).toBe(1);
  });
  it.each(['DRAFTING','PENDING_APPROVAL','SENT','SIGNED'])('NOT_BUYING cannot bypass an active %s contract',async status=>{
    const w=await createWork();await db.getRepository(Contract).save({leadId:lead.id,propertyId:property.id,status,depositAmount:100,propertyPrice:1000});
    await expect(work.record(w.id,{version:1,outcome:'NOT_BUYING',note:'Dừng'},owner)).rejects.toThrow('hợp đồng');
    expect((await db.getRepository(Lead).findOneByOrFail({id:lead.id})).status).toBe('VIEWED');
  });
  it('NOT_BUYING closes lead, cancels open viewings and other open feedback work',async()=>{
    const w=await createWork();const v2=await db.getRepository(Viewing).save({leadId:lead.id,propertyId:property.id,status:'NEW',viewingTime:new Date(future())});
    const f2=await saveFeedback(true,v2);await db.transaction(m=>work.create(m,f2));
    await work.record(w.id,{version:1,outcome:'NOT_BUYING',note:'Không còn nhu cầu'},owner);
    expect((await db.getRepository(Lead).findOneByOrFail({id:lead.id})).lostReason).toBe('NOT_INTERESTED');
    expect((await db.getRepository(Viewing).findOneByOrFail({id:v2.id})).status).toBe('CANCELLED');
    expect(await db.getRepository(FeedbackWork).countBy({status:'COMPLETED'})).toBe(2);expect(await work.due()).toEqual([]);
  });
  it.each(['NOT_BUYING','NEXT_VIEWING'] as const)('contract creation racing %s cannot leave an active contract on a closed/new-booking lead',async outcome=>{
    const w=await createWork();
    const contracts=new ContractsService(db.getRepository(Contract),db.getRepository(Lead),db.getRepository(Viewing),db.getRepository(Property),leads,n8n as any);
    const second=await db.getRepository(Property).save({...property,id:undefined,name:'Căn B'});
    const results=await Promise.allSettled([
      contracts.create({leadId:lead.id,depositAmount:1000000},owner),
      work.record(w.id,{version:1,outcome,note:'Khách đổi quyết định',...(outcome==='NEXT_VIEWING'?{propertyId:second.id,viewingTime:bookableSlots(new Date())[0].toISOString()}:{})},owner),
    ]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const current=await db.getRepository(Lead).findOneByOrFail({id:lead.id});
    const active=await db.getRepository(Contract).countBy({leadId:lead.id,status:'DRAFTING'});
    if(active) expect(current.status).toBe('DEPOSIT');
    else expect(current.status).toBe(outcome==='NOT_BUYING'?'LOST':'NEW');
  });
  it('external terminal lead changes close work, without reviving it if status changes later',async()=>{
    const w=await createWork();await leads.updateStatus(lead.id,{status:'LOST',lostReason:'OTHER'});
    expect((await db.getRepository(FeedbackWork).findOneByOrFail({id:w.id})).status).toBe('COMPLETED');
    await db.getRepository(Lead).update(lead.id,{status:'CONSULTING'});expect(await work.due()).toEqual([]);
  });
  it('HTTP validates input and enforces JWT ownership / webhook secret; review never returns tokens',async()=>{
    const oldSecret=process.env.WEBHOOK_SECRET;process.env.WEBHOOK_SECRET='l5-integration-secret';
    const jwt=new JwtService({secret:'l5-test-only'});
    @Module({controllers:[FeedbackWorkController,FeedbackController],providers:[{provide:FeedbackWorkService,useValue:work},{provide:FeedbackService,useValue:feedback},{provide:JwtService,useValue:jwt}]}) class TestModule {}
    const app=await NestFactory.create(TestModule,{logger:false});app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));await app.init();
    try {
      const w=await createWork();const http=request(app.getHttpServer());const token=(u:AuthUser)=>jwt.sign({...u,sub:u.id});
      await http.get('/feedback-work').expect(401);
      await http.get('/feedback-work/context/1').expect(401);
      await http.get('/feedback-work/context/1').set('X-Webhook-Secret','l5-integration-secret').expect(200);
      await http.get(`/feedback-work/lead/${lead.id}`).set('Authorization',`Bearer ${token(other)}`).expect(403);
      await http.post(`/feedback-work/${w.id}/result`).set('Authorization',`Bearer ${token(owner)}`).send({version:1,outcome:'CONTACTED',note:'x',complete:true,assignedUserId:other.id}).expect(400);
      await http.post(`/feedback-work/${w.id}/result`).set('Authorization',`Bearer ${token(owner)}`).send({version:1,outcome:'CONTACTED',note:'x',complete:true}).expect(201);
      await http.get('/feedback-work/alerts/review').set('Authorization',`Bearer ${token(owner)}`).expect(403);
    } finally {await app.close();if(oldSecret===undefined) delete process.env.WEBHOOK_SECRET;else process.env.WEBHOOK_SECRET=oldSecret;}
  });
});
