import { Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { Lead } from '../leads/entities/lead.entity';
import { LeadEvent } from '../leads/entities/lead-event.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { ChatLog } from '../chat-logs/chat-log.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { Feedback } from '../feedback/entities/feedback.entity';
import { FeedbackWork } from '../feedback/feedback-work.entity';
import { FollowupTask } from './followup-task.entity';
import { FollowupsService } from './followups.service';
import { FollowupsController } from './followups.controller';
import { LadderService } from './ladder.service';
import { LadderController, LadderLinksController } from './ladder.controller';
import { FOLLOWUP_SELECTOR_SQL } from './followup-sql';
import { ladderDecision } from './ladder-policy';
import { LADDER_SNAPSHOT_SQL } from './ladder-sql';
import { createHmac } from 'crypto';

const url=process.env.FE33_TEST_DATABASE_URL;
(url?describe:describe.skip)('FE-45 ladder HTTP and PostgreSQL',()=>{
  let db:DataSource,app:INestApplication,base:string,ladder:LadderService,worker:FollowupsService;
  let lead:Lead,property:Property,owner:User;
  const secret='fe45-disposable-only',previous=process.env.WEBHOOK_SECRET;
  const linkSecret='fe45-link-only-'+ 'x'.repeat(48),previousLink=process.env.LADDER_LINK_SECRET;
  const n8n={callWebhook:jest.fn().mockResolvedValue(undefined)};
  const notify={notifyFollowupStatusChanged:jest.fn().mockResolvedValue(undefined)};
  const ago=(days:number)=>new Date(Date.now()-days*86_400_000);
  beforeAll(async()=>{
    const target=new URL(url!);
    if(!['localhost','127.0.0.1'].includes(target.hostname)||target.port!=='55433'||target.pathname!=='/fe33_test')throw new Error('Chỉ dùng PostgreSQL disposable localhost:55433/fe33_test');
    db=new DataSource({type:'postgres',url,synchronize:true,entities:[Lead,LeadEvent,User,Property,Viewing,ChatLog,Contract,Feedback,FeedbackWork,FollowupTask]});await db.initialize();
    ladder=new LadderService(db,n8n as any,notify as any);worker=new FollowupsService(db,notify as any,ladder);
    process.env.WEBHOOK_SECRET=secret;
    process.env.LADDER_LINK_SECRET=linkSecret;
    @Module({controllers:[FollowupsController,LadderController,LadderLinksController],providers:[{provide:FollowupsService,useValue:worker},{provide:LadderService,useValue:ladder}]})class TestModule{}
    app=await NestFactory.create(TestModule,{logger:false});app.setGlobalPrefix('api');app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true}));await app.listen(0,'127.0.0.1');base=await app.getUrl();
  });
  afterAll(async()=>{await app?.close();if(db?.isInitialized)await db.destroy();if(previous===undefined)delete process.env.WEBHOOK_SECRET;else process.env.WEBHOOK_SECRET=previous;
    if(previousLink===undefined)delete process.env.LADDER_LINK_SECRET;else process.env.LADDER_LINK_SECRET=previousLink;});
  beforeEach(async()=>{
    n8n.callWebhook.mockReset().mockResolvedValue(undefined);notify.notifyFollowupStatusChanged.mockClear();
    await db.query('TRUNCATE followup_tasks,feedback_work,contracts,feedbacks,viewings,lead_events,leads,users,properties,chat_logs RESTART IDENTITY CASCADE');
    owner=await db.getRepository(User).save({name:'An',email:'an@example.test',role:'SALE',passwordHash:'test'});
    lead=await db.getRepository(Lead).save({name:'Khách',phone:'0900000001',email:'customer@example.test',status:'CONSULTING',consentMarketing:true,
      assignedUserId:owner.id,assignedAt:ago(1.1),createdAt:ago(1.1)});
    property=await db.getRepository(Property).save({name:'Nhà A',address:'Đà Nẵng',price:3_000_000_000,area:80,type:'HOUSE',status:'AVAILABLE'});
  });
  const http=(route:string,body?:unknown,withSecret=true)=>fetch(`${base}/api/followups${route}`,{method:body===undefined?'GET':'POST',
    headers:{'Content-Type':'application/json',...(withSecret?{'X-Webhook-Secret':secret}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const stored=()=>db.getRepository(Lead).findOneByOrFail({id:lead.id});
  const events=(type:string)=>db.getRepository(LeadEvent).findBy({leadId:lead.id,type});
  async function candidate(){return (await ladder.due()).find((d:any)=>d.leadId===lead.id);}
  async function claim(owner='execution-1'){
    const due=await candidate();expect(due).toBeDefined();
    return worker.claim({leadId:lead.id,type:`LADDER_${due.kind}` as any,viewingId:0,viewingTime:new Date(due.anchor).toISOString(),owner,...(due.step?{step:due.step}:{})});
  }
  async function reminder(action:'CALL'|'WAIT'='CALL'){
    const c=await claim();expect(c.claimed).toBe(true);const id=c.taskId!,token=c.token!;
    await ladder.suggestion(id,{token,suggestion:{action,reason:'Test',emailDraft:'Hello'}});
    await worker.start(id,token);await worker.actionDone(id,{token});await worker.complete(id,token);
    const link=await ladder.link(id);return {id,token,linkToken:link.approveUrl.split('/').pop()!};
  }
  it('machine endpoints require secret; public links require HMAC',async()=>{
    expect((await http('/ladder-due',undefined,false)).status).toBe(401);
    expect((await http('/ladder-due')).status).toBe(200);
    expect((await http('/ladder-links/forged',undefined,false)).status).toBe(404);
  });
  it('selects reach and prevents concurrent claims by different executions',async()=>{
    const due=await candidate();expect(due).toMatchObject({kind:'REACH',step:1,assigneeId:owner.id});
    // Both executions already read the same due item before either acquires the lead lock.
    const dto={leadId:lead.id,type:'LADDER_REACH' as const,step:due.step,viewingId:0,viewingTime:new Date(due.anchor).toISOString()};
    const results=await Promise.all([worker.claim({...dto,owner:'one'}),worker.claim({...dto,owner:'two'})]);expect(results.filter(x=>x.claimed)).toHaveLength(1);
    expect(await db.getRepository(FollowupTask).count()).toBe(1);
  });
  it('completed step is not selected again; next step is selected',async()=>{
    await reminder();expect(await candidate()).toBeUndefined();
    await db.getRepository(Lead).update(lead.id,{assignedAt:ago(3.1),createdAt:ago(3.1)});expect(await candidate()).toMatchObject({kind:'REACH',step:3});
  });
  it('SQL matches policy at the reach/quiet/stale boundaries and statuses',async()=>{
    for(const status of ['CONSULTING','NEW','VIEWED','CONFIRMED','DEPOSIT','SIGNED','LOST'])for(const age of [0.5,1.1,3.1,7.1,14.1]){
      await db.getRepository(Lead).update(lead.id,{status,createdAt:ago(age),assignedAt:ago(age),contactedAt:status==='VIEWED'?ago(age):null});
      const [s]=await db.query(`${LADDER_SNAPSHOT_SQL} WHERE l.id=$1`,[lead.id]);const expected=ladderDecision(s,new Date());const actual=await candidate();
      expect(actual?.kind??null).toBe(expected?.kind??null);expect(actual?.step??null).toBe(expected?.step??null);
    }
  });
  it('cancel day 2 skips day 1; day 3 remains eligible',async()=>{
    await db.getRepository(Lead).update(lead.id,{createdAt:ago(2.1),assignedAt:ago(2.1)});
    await db.getRepository(LeadEvent).save({leadId:lead.id,type:'STATUS_CHANGED',note:'CONFIRMED -> CONSULTING: cancelled',createdAt:ago(0.1)});
    expect(await candidate()).toBeUndefined();
    await db.getRepository(Lead).update(lead.id,{createdAt:ago(3.1),assignedAt:ago(3.1)});expect(await candidate()).toMatchObject({kind:'REACH',step:3});
  });
  it('LEAD_REOPENED alone restarts reach instead of sending an old step',async()=>{
    await db.getRepository(Lead).update(lead.id,{createdAt:ago(30),assignedAt:ago(30)});
    await db.getRepository(LeadEvent).save({leadId:lead.id,type:'LEAD_REOPENED',createdAt:ago(0.5)});
    expect(await candidate()).toBeUndefined();
    await db.query("UPDATE lead_events SET created_at=now()-interval '1.1 days' WHERE type='LEAD_REOPENED'");
    expect(await candidate()).toMatchObject({kind:'REACH',step:1});
  });
  it('cancel day 10: quiet after 7 days since cancellation, stale after 14',async()=>{
    await db.getRepository(Lead).update(lead.id,{createdAt:ago(17.1),assignedAt:ago(17.1)});
    await db.getRepository(LeadEvent).save({leadId:lead.id,type:'STATUS_CHANGED',note:'CONFIRMED -> CONSULTING',createdAt:ago(7.1)});
    expect(await candidate()).toMatchObject({kind:'QUIET'});
    await db.query("UPDATE lead_events SET created_at=now()-interval '14.1 days'");expect(await candidate()).toMatchObject({kind:'STALE'});
  });
  it('notes reset silence; automated events do not',async()=>{
    await db.getRepository(Lead).update(lead.id,{status:'VIEWED',createdAt:ago(8),assignedAt:ago(8),contactedAt:ago(8)});
    await db.getRepository(LeadEvent).save({leadId:lead.id,type:'AI_SCORED'});expect(await candidate()).toMatchObject({kind:'QUIET'});
    await db.getRepository(LeadEvent).save({leadId:lead.id,type:'NOTE_ADDED'});expect(await candidate()).toBeUndefined();
  });
  it('guards a 21-day feedback call from quiet and stale',async()=>{
    await db.getRepository(Lead).update(lead.id,{status:'VIEWED',createdAt:ago(20),assignedAt:ago(20),contactedAt:ago(20)});
    await db.getRepository(FeedbackWork).save({leadId:lead.id,feedbackId:1,status:'IN_PROGRESS',dueAt:ago(-21),escalateAt:ago(-21),version:1});
    expect(await candidate()).toBeUndefined();
    expect(await worker.claim({type:'LADDER_STALE',leadId:lead.id,viewingId:0,viewingTime:lead.assignedAt!.toISOString(),owner:'blocked'})).toMatchObject({claimed:false});
  });
  it.each(['viewing','contract'])('does not close stale while there is a live %s',async guard=>{
    await db.getRepository(Lead).update(lead.id,{createdAt:ago(15),assignedAt:ago(15),contactedAt:ago(15)});
    if(guard==='viewing')await db.getRepository(Viewing).save({leadId:lead.id,propertyId:property.id,status:'NEW',viewingTime:ago(-1)});
    else await db.getRepository(Contract).save({leadId:lead.id,propertyId:property.id,status:'DRAFTING',propertyPrice:3_000_000_000,depositAmount:100_000_000});
    expect(await candidate()).toBeUndefined();
  });
  it('stale close is atomic and recovers after crash before notification',async()=>{
    await db.getRepository(Lead).update(lead.id,{createdAt:ago(15),assignedAt:ago(15),contactedAt:ago(15)});
    const c=await claim();expect((await stored()).status).toBe('LOST');expect((await stored()).lostReason).toBe('STALE');
    expect(await events('LEAD_STALE_CLOSED')).toHaveLength(1);
    await db.getRepository(FollowupTask).update(c.taskId!,{leaseUntil:new Date(0)});
    expect(await candidate()).toMatchObject({kind:'STALE',taskId:c.taskId});
    const again=await claim('recovery');expect(again.claimed).toBe(true);
    await worker.start(again.taskId!,again.token!);await worker.actionDone(again.taskId!,{token:again.token!});await worker.complete(again.taskId!,again.token!);
    expect(await candidate()).toBeUndefined();expect(await events('LEAD_STALE_CLOSED')).toHaveLength(1);
  });
  it('DB failure rolls back stale close and claim together',async()=>{
    await db.getRepository(Lead).update(lead.id,{createdAt:ago(15),assignedAt:ago(15),contactedAt:ago(15)});
    await db.query("ALTER TABLE lead_events ADD CONSTRAINT fe45_reject CHECK(type<>'LEAD_STALE_CLOSED')");
    try{await expect(claim()).rejects.toBeDefined();}finally{await db.query('ALTER TABLE lead_events DROP CONSTRAINT fe45_reject');}
    expect((await stored()).status).toBe('CONSULTING');expect(await db.getRepository(FollowupTask).count()).toBe(0);
  });
  it('start rechecks a note written after claim',async()=>{
    await db.getRepository(Lead).update(lead.id,{status:'VIEWED',createdAt:ago(8),assignedAt:ago(8),contactedAt:ago(8)});
    const c=await claim();await db.getRepository(LeadEvent).save({leadId:lead.id,type:'NOTE_ADDED'});
    expect(await worker.start(c.taskId!,c.token!)).toMatchObject({allowed:false});
  });
  it('preview exposes no email, phone or worker token, and changes nothing',async()=>{
    const r=await reminder();const before=await db.getRepository(LeadEvent).count();
    const res=await http(`/ladder-links/${r.linkToken}`,undefined,false);expect(res.status).toBe(200);expect(res.headers.get('cache-control')).toBe('no-store');
    const data=await res.json();expect(data).toMatchObject({state:'OPEN',canSend:true,suggestion:{action:'CALL',emailDraft:'Hello'}});
    expect(JSON.stringify(data)).not.toContain('customer@example.test');expect(JSON.stringify(data)).not.toContain(r.token);expect(JSON.stringify(data)).not.toContain('0900000001');
    expect(await db.getRepository(LeadEvent).count()).toBe(before);
    expect((await http(`/ladder-links/${r.linkToken}x`,undefined,false)).status).toBe(404);
  });
  it('two concurrent confirms create one email task, event and dispatch',async()=>{
    const r=await reminder();const responses=await Promise.all([1,2].map(()=>http(`/ladder-links/${r.linkToken}/confirm`,{decision:'SEND',text:'  Edited  '},false)));
    expect(responses.map(x=>x.status)).toEqual([201,201]);const data=await Promise.all(responses.map(x=>x.json()));expect(data.filter(x=>x.already)).toHaveLength(1);
    expect(n8n.callWebhook).toHaveBeenCalledTimes(1);expect(await events('LADDER_APPROVED')).toHaveLength(1);
    const emails=await db.getRepository(FollowupTask).findBy({type:'LADDER_EMAIL'});expect(emails).toHaveLength(1);
    const p=await db.getRepository(FollowupTask).findOneByOrFail({id:r.id});expect(p.result.suggestion?.emailDraft).toBe('Hello');
    const c=await worker.claim({type:'LADDER_EMAIL',ladderTaskId:r.id,leadId:lead.id,viewingId:0,viewingTime:p.viewingTime.toISOString(),owner:'mail-execution'});
    expect(c.claimed).toBe(true);expect((await ladder.context(c.taskId!,c.token!)).text).toBe('Edited');
    await worker.start(c.taskId!,c.token!);await worker.actionDone(c.taskId!,{token:c.token!});await worker.complete(c.taskId!,c.token!);
    expect((await ladder.preview(r.linkToken)).state).toBe('HANDLED');
  });
  it('upstream error returns 502 and a retry dispatches the same saved email once',async()=>{
    const r=await reminder();n8n.callWebhook.mockRejectedValueOnce(new Error('offline'));
    expect((await http(`/ladder-links/${r.linkToken}/confirm`,{decision:'SEND',text:'Original approved'},false)).status).toBe(502);
    expect((await ladder.preview(r.linkToken)).state).toBe('OPEN');
    expect((await http(`/ladder-links/${r.linkToken}/confirm`,{decision:'SEND',text:'Replacement on retry'},false)).status).toBe(201);
    expect(await db.getRepository(FollowupTask).countBy({type:'LADDER_EMAIL'})).toBe(1);expect(await events('LADDER_APPROVED')).toHaveLength(1);
    expect((await db.getRepository(FollowupTask).findOneByOrFail({id:r.id})).result).toMatchObject({approval:{text:'Original approved'}});
  });
  it('SKIP handles the link without an email task, including without consent',async()=>{
    const r=await reminder();await db.getRepository(Lead).update(lead.id,{consentMarketing:false});
    expect(await ladder.preview(r.linkToken)).toMatchObject({canSend:false,refusal:'NO_CONSENT'});
    await ladder.confirm(r.linkToken,{decision:'SKIP'});expect(await ladder.confirm(r.linkToken,{decision:'SKIP'})).toMatchObject({already:true});expect(n8n.callWebhook).not.toHaveBeenCalled();
  });
  it.each(['consent','email','closed','owner','WAIT','newer'])('rejects SEND when %s changes',async change=>{
    const r=await reminder(change==='WAIT'?'WAIT':'CALL');
    if(change==='consent')await db.getRepository(Lead).update(lead.id,{consentMarketing:false});
    if(change==='email')await db.getRepository(Lead).update(lead.id,{email:null});
    if(change==='closed')await db.getRepository(Lead).update(lead.id,{status:'LOST'});
    if(change==='owner')await db.getRepository(Lead).update(lead.id,{assignedUserId:null});
    if(change==='newer')await db.query("INSERT INTO followup_tasks(task_key,lead_id,viewing_id,viewing_time,type,state,owner,token,lease_until,available_at) VALUES('newer',$1,0,now(),'LADDER_QUIET','COMPLETED','other','t',now(),now())",[lead.id]);
    expect((await http(`/ladder-links/${r.linkToken}/confirm`,{decision:'SEND',text:'Hello'},false)).status).toBe(400);expect(n8n.callWebhook).not.toHaveBeenCalled();
  });
  it.each(['','   ','x'.repeat(1501)])('rejects invalid email body length %i',async text=>{
    const r=await reminder();expect((await http(`/ladder-links/${r.linkToken}/confirm`,{decision:'SEND',text},false)).status).toBe(400);
  });
  it('email start checks consent again after human approval',async()=>{
    const r=await reminder();await ladder.confirm(r.linkToken,{decision:'SEND',text:'Hello'});
    const p=await db.getRepository(FollowupTask).findOneByOrFail({id:r.id});
    const c=await worker.claim({type:'LADDER_EMAIL',ladderTaskId:r.id,leadId:lead.id,viewingId:0,viewingTime:p.viewingTime.toISOString(),owner:'email'});
    await db.getRepository(Lead).update(lead.id,{consentMarketing:false});expect(await worker.start(c.taskId!,c.token!)).toMatchObject({allowed:false});
  });
  it('approval and email task roll back together if event insert fails',async()=>{
    const r=await reminder();await db.query("ALTER TABLE lead_events ADD CONSTRAINT fe45_approval_reject CHECK(type<>'LADDER_APPROVED')");
    try{await expect(ladder.confirm(r.linkToken,{decision:'SEND',text:'Hello'})).rejects.toBeDefined();}
    finally{await db.query('ALTER TABLE lead_events DROP CONSTRAINT fe45_approval_reject');}
    expect(await db.getRepository(FollowupTask).countBy({type:'LADDER_EMAIL'})).toBe(0);
    expect((await ladder.preview(r.linkToken)).state).toBe('OPEN');expect(n8n.callWebhook).not.toHaveBeenCalled();
  });
  it('email recovery selector excludes revoked consent but still finalizes ACTION_DONE',async()=>{
    const r=await reminder();await ladder.confirm(r.linkToken,{decision:'SEND',text:'Hello'});
    expect(await ladder.emailDue()).toHaveLength(1);
    await db.getRepository(Lead).update(lead.id,{consentMarketing:false});expect(await ladder.emailDue()).toHaveLength(0);
    await db.getRepository(FollowupTask).update({type:'LADDER_EMAIL'},{state:'ACTION_DONE',leaseUntil:new Date(0)});
    expect(await ladder.emailDue()).toHaveLength(1);
  });
  it('ACTION_DONE recovers database finalization after lead has closed, and stays out of L2',async()=>{
    const c=await claim();await worker.start(c.taskId!,c.token!);await worker.actionDone(c.taskId!,{token:c.token!});
    await db.getRepository(Lead).update(lead.id,{status:'LOST',lostReason:'OTHER'});
    await db.getRepository(FollowupTask).update(c.taskId!,{leaseUntil:new Date(0)});
    expect(await candidate()).toMatchObject({kind:'REACH',taskId:c.taskId});
    expect((await db.query(FOLLOWUP_SELECTOR_SQL)).some((x:any)=>x.type==='LADDER_REACH')).toBe(false);
    const r=await claim('recovery');expect(r).toMatchObject({claimed:true,resume:true});await worker.complete(r.taskId!,r.token!);
    expect(await events('LADDER_STEP_SENT')).toHaveLength(1);
  });
  it('an ambiguous external send is REVIEW, never automatically repeated',async()=>{
    const c=await claim();await worker.start(c.taskId!,c.token!);await db.getRepository(FollowupTask).update(c.taskId!,{leaseUntil:new Date(0)});
    expect(await claim('another')).toMatchObject({claimed:false,reason:'REVIEW'});
    expect((await db.getRepository(FollowupTask).findOneByOrFail({id:c.taskId})).state).toBe('REVIEW');
  });
  it('invalid worker token and suggestion body are refused',async()=>{
    const c=await claim();expect((await http(`/${c.taskId}/ladder-context`,{token:'x'.repeat(36)})).status).toBe(409);
    expect((await http(`/${c.taskId}/ladder-suggestion`,{token:c.token})).status).toBe(400);
  });
  it('legacy L2 selector does not select silent marketing or ladder checkpoints',async()=>{
    await db.getRepository(Lead).update(lead.id,{status:'VIEWED',level:'WARM',consentMarketing:false});
    const rows=await db.query(FOLLOWUP_SELECTOR_SQL);expect(rows.some((x:any)=>['HOT_NUDGE','WARM_NUDGE','COLD_NURTURE'].includes(x.type))).toBe(false);
  });
  it('FE45 regression: SKIP after dispatch failure must cancel the pending email',async()=>{
    const r=await reminder();n8n.callWebhook.mockRejectedValueOnce(new Error('offline'));
    await expect(ladder.confirm(r.linkToken,{decision:'SEND',text:'Approved earlier'})).rejects.toMatchObject({status:502});
    expect(await ladder.confirm(r.linkToken,{decision:'SKIP'})).toMatchObject({decision:'SKIP'});
    expect(n8n.callWebhook).toHaveBeenCalledTimes(1);
    const p=await db.getRepository(FollowupTask).findOneByOrFail({id:r.id});
    expect(await worker.claim({leadId:lead.id,type:'LADDER_EMAIL',ladderTaskId:r.id,viewingId:0,viewingTime:p.viewingTime.toISOString(),owner:'late-webhook'})).toMatchObject({claimed:false});
    expect(await ladder.emailDue()).toHaveLength(0);
  });
  it('FE45 regression: lost webhook acknowledgement after delivery stays HANDLED',async()=>{
    const r=await reminder();
    n8n.callWebhook.mockImplementationOnce(async(_path,payload)=>{
      const c=await worker.claim({leadId:lead.id,type:'LADDER_EMAIL',ladderTaskId:r.id,viewingId:0,viewingTime:payload.viewingTime,owner:'email-worker'});
      await worker.start(c.taskId!,c.token!);await worker.actionDone(c.taskId!,{token:c.token!});await worker.complete(c.taskId!,c.token!);
      throw new Error('acknowledgement lost');
    });
    await expect(ladder.confirm(r.linkToken,{decision:'SEND',text:'Hello'})).rejects.toMatchObject({status:502});
    expect(await ladder.preview(r.linkToken)).toMatchObject({state:'HANDLED',canSend:false});
    expect(await ladder.confirm(r.linkToken,{decision:'SEND',text:'Hello'})).toMatchObject({already:true});
    expect(n8n.callWebhook).toHaveBeenCalledTimes(1);
  });
  it.each(['REACH','QUIET'])('FE45 regression: expired %s send is recovered even after a new activity',async kind=>{
    if(kind==='QUIET')await db.getRepository(Lead).update(lead.id,{status:'VIEWED',createdAt:ago(8),assignedAt:ago(8),contactedAt:ago(8)});
    const c=await claim();await worker.start(c.taskId!,c.token!);
    await db.getRepository(FollowupTask).update(c.taskId!,{leaseUntil:new Date(0)});
    await db.getRepository(LeadEvent).save({leadId:lead.id,type:'NOTE_ADDED'});
    if(kind==='REACH')await db.getRepository(Lead).update(lead.id,{contactedAt:new Date()});
    expect(await candidate()).toMatchObject({kind,taskId:c.taskId});
    const t=await db.getRepository(FollowupTask).findOneByOrFail({id:c.taskId});
    expect(await worker.claim({leadId:lead.id,type:t.type,viewingId:0,viewingTime:t.viewingTime.toISOString(),owner:'recovery',...(kind==='REACH'?{step:1}:{})})).toMatchObject({claimed:false,reason:'REVIEW'});
  });
  it('FE45 regression: backfilled recent contacted_at protects an old lead without events',async()=>{
    await db.getRepository(Lead).update(lead.id,{status:'VIEWED',createdAt:ago(30),assignedAt:ago(30),contactedAt:ago(1)});
    expect(await candidate()).toBeUndefined();
  });
  it('FE45 regression: SKIP races worker claim without sending after successful cancellation',async()=>{
    const r=await reminder();n8n.callWebhook.mockRejectedValueOnce(new Error('offline'));
    await expect(ladder.confirm(r.linkToken,{decision:'SEND',text:'Hello'})).rejects.toBeDefined();
    const p=await db.getRepository(FollowupTask).findOneByOrFail({id:r.id});
    const [skip,c]=await Promise.all([ladder.confirm(r.linkToken,{decision:'SKIP'}),worker.claim({leadId:lead.id,type:'LADDER_EMAIL',ladderTaskId:r.id,viewingId:0,viewingTime:p.viewingTime.toISOString(),owner:'racing-worker'})]);
    if(skip.decision==='SKIP')expect(c.claimed).toBe(false);
    else expect(skip).toMatchObject({decision:'SEND',already:true});
  });
  it('FE45 regression: public suggestion cannot leak customer contacts quoted by AI',async()=>{
    const c=await claim();
    await ladder.suggestion(c.taskId!,{token:c.token!,suggestion:{action:'CALL',reason:'Gọi 090 000 0001 hoặc CUSTOMER@example.test',emailDraft:'Liên hệ +84-90-000-0001; customer@example.test'}});
    const token=(await ladder.link(c.taskId!)).approveUrl.split('/').pop()!;
    const preview=JSON.stringify(await ladder.preview(token));
    expect(preview.toLowerCase()).not.toContain('customer@example.test');
    expect(preview).not.toContain('090 000 0001');expect(preview).not.toContain('84-90-000-0001');
    // Secret worker context still has the recipient; redaction is only for the public view.
    expect((await ladder.context(c.taskId!,c.token!)).email).toBe('customer@example.test');
    await db.getRepository(Lead).update(lead.id,{email:'new@example.test',phone:'0912345678'});
    const oldContext=JSON.stringify(await ladder.preview(token));
    expect(oldContext.toLowerCase()).not.toContain('customer@example.test');
    expect(oldContext).not.toContain('090 000 0001');expect(oldContext).not.toContain('84-90-000-0001');
  });
  it('FE45 extra: start supplies current recipient rather than stale context',async()=>{
    const r=await reminder();await ladder.confirm(r.linkToken,{decision:'SEND',text:'Approved message'});
    const parent=await db.getRepository(FollowupTask).findOneByOrFail({id:r.id});
    const c=await worker.claim({leadId:lead.id,type:'LADDER_EMAIL',ladderTaskId:r.id,viewingId:0,viewingTime:parent.viewingTime.toISOString(),owner:'email-worker'});
    expect((await ladder.context(c.taskId!,c.token!)).email).toBe('customer@example.test');
    await db.getRepository(Lead).update(lead.id,{email:'current@example.test'});
    expect(await worker.start(c.taskId!,c.token!)).toMatchObject({allowed:true,delivery:{email:'current@example.test',text:'Approved message'}});
  });
  it.each([{suggestion:[]},{suggestion:[{action:'CALL',reason:'Valid-looking item',emailDraft:null}]}])('FE45 extra: array is not a suggestion object ($suggestion)',async({suggestion})=>{
    const c=await claim();
    expect((await http(`/${c.taskId}/ladder-suggestion`,{token:c.token,suggestion})).status).toBe(400);
    const task=await db.getRepository(FollowupTask).findOneByOrFail({id:c.taskId});expect(task.result.suggestion).toBeUndefined();
  });
  it('Hoang review: link signing is independent of the machine webhook secret',async()=>{
    const r=await reminder();const body=r.linkToken.split('.')[0];
    const forged=body+'.'+createHmac('sha256',secret).update(body).digest('base64url');
    await expect(ladder.preview(forged)).rejects.toMatchObject({status:404});
    process.env.WEBHOOK_SECRET='different-machine-secret';
    try{expect(await ladder.preview(r.linkToken)).toMatchObject({state:'OPEN'});}finally{process.env.WEBHOOK_SECRET=secret;}
  });
  it('Hoang review: link expires in seven days and refuses GET/confirm at expiry',async()=>{
    const r=await reminder();const payload=JSON.parse(Buffer.from(r.linkToken.split('.')[0],'base64url').toString());
    expect(payload.exp-Math.floor(Date.now()/1000)).toBeLessThanOrEqual(604800);
    expect(payload.exp-Math.floor(Date.now()/1000)).toBeGreaterThan(604790);
    const clock=jest.spyOn(Date,'now').mockReturnValue(payload.exp*1000-1000);
    try{
      expect(await ladder.preview(r.linkToken)).toMatchObject({state:'OPEN'});
      clock.mockReturnValue(payload.exp*1000);
      await expect(ladder.preview(r.linkToken)).rejects.toMatchObject({status:404});
      await expect(ladder.confirm(r.linkToken,{decision:'SEND',text:'Hello'})).rejects.toMatchObject({status:404});
      expect(n8n.callWebhook).not.toHaveBeenCalled();
    }finally{clock.mockRestore();}
  });
  it('Hoang review: absent, short or reused link key fails closed',async()=>{
    const r=await reminder();
    try{
      delete process.env.LADDER_LINK_SECRET;
      await expect(ladder.link(r.id)).rejects.toThrow('LADDER_LINK_SECRET');
      await expect(ladder.preview(r.linkToken)).rejects.toMatchObject({status:404});
      process.env.LADDER_LINK_SECRET='short';await expect(ladder.link(r.id)).rejects.toThrow('LADDER_LINK_SECRET');
      process.env.LADDER_LINK_SECRET=linkSecret;process.env.WEBHOOK_SECRET=linkSecret;
      await expect(ladder.link(r.id)).rejects.toThrow('phải khác WEBHOOK_SECRET');
    }finally{process.env.LADDER_LINK_SECRET=linkSecret;process.env.WEBHOOK_SECRET=secret;}
  });
  it('Hoang review: preview works inside a read-only PostgreSQL transaction',async()=>{
    const r=await reminder();const runner=db.createQueryRunner();await runner.connect();await runner.startTransaction();
    try{
      await runner.query('SET TRANSACTION READ ONLY');
      const readDb={manager:runner.manager,transaction:async(fn:any)=>fn(runner.manager)} as unknown as DataSource;
      const reader=new LadderService(readDb,n8n as any,notify as any);
      expect(await reader.preview(r.linkToken)).toMatchObject({state:'OPEN'});
    }finally{await runner.rollbackTransaction();await runner.release();}
  });
});
