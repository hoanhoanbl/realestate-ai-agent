import { BadGatewayException, BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { FollowupTask, type FollowupResult, type LadderSuggestion } from './followup-task.entity';
import { ActionDoneDto, ClaimFollowupDto, FailFollowupDto, ResolveFollowupDto } from './followup.dto';
import { ConfirmLadderDto, SaveLadderSuggestionDto } from './ladder.dto';
import { isLadderDue, type LadderDue, type LadderSnapshot } from './ladder-policy';
import { LADDER_DUE_SQL, LADDER_SNAPSHOT_SQL } from './ladder-sql';
import { Lead } from '../leads/entities/lead.entity';
import { LeadEvent } from '../leads/entities/lead-event.entity';
import { N8nService } from '../n8n/n8n.service';
import { LeadsService } from '../leads/leads.service';

const lease = 30 * 60_000;
export const isLadderType = (type: string) => ['LADDER_REACH','LADDER_QUIET','LADDER_STALE','LADDER_EMAIL'].includes(type);
interface Approval { decision: 'SEND'|'SKIP'; text?: string; dispatched?: boolean; dispatchUntil?: number }
interface Result extends FollowupResult { approval?: Approval; parentTaskId?: number; assigneeId?: number | null; assignedAt?: string | null; cancelled?: boolean }
interface Snapshot extends LadderSnapshot {
  name: string; email: string | null; phone: string; needs: string | null;
  consent_marketing: boolean; assigned_user_id: number | null; assignee_name: string | null; property_name: string | null;
}
const resultOf = (task: FollowupTask) => task.result as Result;
const plainFallback: LadderSuggestion = { action:'CALL', reason:'Liên hệ trực tiếp để xác nhận nhu cầu của khách.', emailDraft:null };

@Injectable()
export class LadderService {
  constructor(private readonly db: DataSource, private readonly n8n: N8nService, private readonly leads: LeadsService) {}

  async due() { return this.db.query(LADDER_DUE_SQL); }
  async emailDue() {
    return this.db.query(`SELECT t.id AS "taskId",t.lead_id AS "leadId",p.id AS "ladderTaskId",t.viewing_time AS "viewingTime"
      FROM followup_tasks t JOIN followup_tasks p ON p.id=(t.result->>'parentTaskId')::int JOIN leads l ON l.id=t.lead_id
      WHERE t.type='LADDER_EMAIL' AND t.state IN ('FAILED','CLAIMED','ACTION_STARTED','ACTION_DONE')
      AND t.available_at<=now() AND t.lease_until<=now() AND (t.state IN ('ACTION_STARTED','ACTION_DONE') OR (
       l.status NOT IN ('LOST','SIGNED','DEPOSIT') AND l.consent_marketing AND nullif(trim(l.email),'') IS NOT NULL
       AND p.result->'approval'->>'decision'='SEND' AND p.result->'suggestion'->>'action' IS DISTINCT FROM 'WAIT'
       AND p.result->>'assigneeId' IS NOT DISTINCT FROM l.assigned_user_id::text
       AND date_trunc('milliseconds',(p.result->>'assignedAt')::timestamptz) IS NOT DISTINCT FROM date_trunc('milliseconds',l.assigned_at)
       AND NOT EXISTS(SELECT 1 FROM followup_tasks n WHERE n.lead_id=l.id AND n.type IN ('LADDER_REACH','LADDER_QUIET','LADDER_STALE') AND n.id>p.id)))
      ORDER BY t.id LIMIT 50`);
  }
  private async snapshot(m: EntityManager, leadId: number): Promise<Snapshot> {
    const [s] = await m.query(`${LADDER_SNAPSHOT_SQL} WHERE l.id=$1`, [leadId]);
    if (!s) throw new NotFoundException('Khách không tồn tại');
    return s;
  }
  private async lockLead(m: EntityManager, leadId: number) {
    const rows = await m.query('SELECT id FROM leads WHERE id=$1 FOR UPDATE', [leadId]);
    if (!rows.length) throw new NotFoundException('Khách không tồn tại');
  }
  private candidate(task: FollowupTask): LadderDue {
    return { kind:task.type.substring(7) as LadderDue['kind'], step:task.type==='LADDER_REACH'?Number(task.taskKey.split(':')[2]):null,
      anchor:task.viewingTime.toISOString() };
  }
  private async staleRecovery(m: EntityManager, task: FollowupTask, s: Snapshot) {
    if (task.type!=='LADDER_STALE' || s.status!=='LOST' || s.lost_reason!=='STALE') return false;
    return m.getRepository(LeadEvent).existsBy({leadId:task.leadId,type:'LEAD_STALE_CLOSED',note:`L9 ${task.taskKey}`});
  }
  private async isCurrent(m: EntityManager, task: FollowupTask, s: Snapshot): Promise<boolean> {
    if (['LOST','SIGNED','DEPOSIT'].includes(s.status)) return false;
    const r=resultOf(task);
    if (r.assigneeId!==s.assigned_user_id || (r.assignedAt??null)!==(s.assigned_at?new Date(s.assigned_at).toISOString():null)) return false;
    return !(await m.query(`SELECT id FROM followup_tasks WHERE lead_id=$1 AND type IN ('LADDER_REACH','LADDER_QUIET','LADDER_STALE') AND id>$2 LIMIT 1`,[task.leadId,task.id])).length;
  }
  private refusal(s: Snapshot) { return !s.consent_marketing?'NO_CONSENT':!s.email?.trim()?'NO_EMAIL':null; }
  private publicSuggestion(s:Snapshot,suggestion:LadderSuggestion):LadderSuggestion {
    const email=s.email?.trim();
    const digits=String(s.phone??'').replace(/\D/g,'');
    const phones=new Set([digits]);
    if(digits.startsWith('0'))phones.add('84'+digits.slice(1));
    if(digits.startsWith('84'))phones.add('0'+digits.slice(2));
    const redact=(text:string)=>{
      // Also cover contacts from an older context after the lead's details changed.
      text=text.replace(/[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/g,'[đã ẩn email]');
      if(email)text=text.replace(new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'[đã ẩn email]');
      for(const phone of phones)if(phone.length>=8)
        text=text.replace(new RegExp('(?<!\\d)\\+?'+phone.split('').join('[\\s().-]*')+'(?!\\d)','g'),'[đã ẩn số điện thoại]');
      text=text.replace(/(?<!\d)(?:\+?84|0)(?:[\s().-]*\d){8,10}(?!\d)/g,'[đã ẩn số điện thoại]');
      return text;
    };
    // An AI may quote a contact from its private context. Redact nested text too,
    // without changing the stored suggestion or the secret worker's recipient.
    return {...suggestion,reason:redact(suggestion.reason),emailDraft:suggestion.emailDraft===null?null:redact(suggestion.emailDraft)};
  }

  async claim(dto: ClaimFollowupDto) {
    if (dto.viewingId!==0) throw new BadRequestException('Ladder dùng viewingId=0');
    const kind=dto.type.substring(7) as LadderDue['kind'];
    if (dto.type==='LADDER_REACH' && ![1,3,7].includes(dto.step??0)) throw new BadRequestException('Bậc nhắc phải là 1, 3 hoặc 7');
    if (dto.type!=='LADDER_REACH' && dto.step!==undefined) throw new BadRequestException('Loại này không có bậc nhắc');
    const anchor=new Date(dto.viewingTime).toISOString();
    const key=dto.type==='LADDER_EMAIL'?`LADDER_EMAIL:${dto.ladderTaskId}`:`${dto.type}:${dto.leadId}:${kind==='REACH'?`${dto.step}:`:''}${anchor}`;
    const response=await this.db.transaction(async m=>{
      await this.lockLead(m,dto.leadId);
      const repo=m.getRepository(FollowupTask);
      let task=await repo.findOne({where:{taskKey:key},lock:{mode:'pessimistic_write'}});
      const now=new Date(); const s=await this.snapshot(m,dto.leadId);
      if (task && (task.leadId!==dto.leadId || task.viewingTime.getTime()!==new Date(anchor).getTime())) throw new ConflictException('Sai tác vụ hoặc mốc thời gian');
      if (task?.state==='COMPLETED' || task?.state==='REVIEW') return {claimed:false,reason:task.state};
      if (task && task.leaseUntil>now) return {claimed:false,reason:'Tác vụ đang được xử lý'};
      if (task && task.availableAt>now) return {claimed:false,reason:'Đang chờ thử lại'};
      if (task?.state==='ACTION_STARTED') {
        task.state='REVIEW';task.error='Không xác định dịch vụ ngoài đã nhận hay chưa; cần kiểm tra trước khi gửi lại';
        await repo.save(task);await m.getRepository(LeadEvent).save({leadId:dto.leadId,type:'FOLLOWUP_FAILED',note:`${dto.type}: REVIEW: ${task.error}`});
        return {claimed:false,reason:'REVIEW'};
      }
      if (dto.type==='LADDER_EMAIL') {
        if (!task || !dto.ladderTaskId) return {claimed:false,reason:'Chưa có thư được duyệt'};
        const parent=await repo.findOneBy({id:dto.ladderTaskId,leadId:dto.leadId});
        if (!parent || resultOf(parent).approval?.decision!=='SEND') return {claimed:false,reason:'Chưa có thư được duyệt'};
        if (task.state!=='ACTION_DONE' && (!(await this.isCurrent(m,parent,s)) || this.refusal(s) || parent.result.suggestion?.action==='WAIT'))
          return {claimed:false,reason:'Link không còn được phép gửi'};
      } else if (task?.state!=='ACTION_DONE' && !(task && await this.staleRecovery(m,task,s)) &&
        !isLadderDue(s,{kind,step:dto.step??null,anchor},now)) return {claimed:false,reason:'Không còn đủ điều kiện'};
      const statusChanged=dto.type==='LADDER_STALE' && s.status!=='LOST' && task?.state!=='ACTION_DONE';
      if (statusChanged) {
        await m.getRepository(Lead).update(dto.leadId,{status:'LOST',lostReason:'STALE',approvalUrl:null});
        await m.getRepository(LeadEvent).save({leadId:dto.leadId,type:'LEAD_STALE_CLOSED',note:`L9 ${key}`});
        await m.getRepository(LeadEvent).save({leadId:dto.leadId,type:'STATUS_CHANGED',note:`${s.status} -> LOST: STALE - Im lặng 14 ngày`});
      }
      task??=repo.create({taskKey:key,leadId:dto.leadId,viewingId:0,viewingTime:new Date(anchor),type:dto.type,
        result:{assigneeId:s.assigned_user_id,assignedAt:s.assigned_at?new Date(s.assigned_at).toISOString():null} as Result});
      task.token=randomUUID();task.owner=dto.owner;task.availableAt=now;task.leaseUntil=new Date(now.getTime()+lease);task.error=null;
      if (task.state!=='ACTION_DONE') task.state='CLAIMED';
      await repo.save(task);
      return {claimed:true,taskId:task.id,token:task.token,resume:task.state==='ACTION_DONE',statusChanged};
    });
    if(response.statusChanged) await this.leads.notifyFollowupStatusChanged(dto.leadId).catch(()=>undefined);
    return response;
  }
  private async locked(m:EntityManager,id:number,token?:string) {
    const repo=m.getRepository(FollowupTask);const initial=await repo.findOneBy({id});
    if(!initial || !isLadderType(initial.type)) throw new NotFoundException('Tác vụ ladder không tồn tại');
    await this.lockLead(m,initial.leadId);
    const task=await repo.findOneOrFail({where:{id},lock:{mode:'pessimistic_write'}});
    if(token!==undefined && task.token!==token) throw new ConflictException('Execution không còn sở hữu tác vụ');
    return task;
  }
  async owns(id:number) { const task=await this.db.getRepository(FollowupTask).findOneBy({id});return task && isLadderType(task.type); }
  async start(id:number,token:string) {
    return this.db.transaction(async m=>{
      const task=await this.locked(m,id,token);const s=await this.snapshot(m,task.leadId);
      if(task.state!=='CLAIMED' || task.leaseUntil<=new Date()) return {allowed:false,reason:task.state};
      let valid:boolean;
      let delivery:{email:string;text:string}|undefined;
      if(task.type==='LADDER_EMAIL') {
        const parent=await m.getRepository(FollowupTask).findOneBy({id:resultOf(task).parentTaskId});
        const approval=parent?resultOf(parent).approval:undefined;
        valid=!!parent && await this.isCurrent(m,parent,s) && !this.refusal(s) && parent.result.suggestion?.action!=='WAIT' &&
          approval?.decision==='SEND' && typeof approval.text==='string' && approval.text.trim().length>0 && approval.text.length<=1500;
        if(valid&&s.email&&typeof approval?.text==='string')delivery={email:s.email.trim(),text:approval.text};
      } else valid=await this.staleRecovery(m,task,s) || isLadderDue(s,this.candidate(task),new Date());
      if(!valid) return {allowed:false,reason:'Khách hoặc bậc nhắc đã thay đổi'};
      task.state='ACTION_STARTED';task.leaseUntil=new Date(Date.now()+lease);await m.getRepository(FollowupTask).save(task);
      // Return the same recipient/content that was checked under this lock.
      // A worker must not send using context read earlier in the execution.
      return {allowed:true,...(delivery?{delivery}:{})};
    });
  }
  async actionDone(id:number,dto:ActionDoneDto) {
    return this.db.transaction(async m=>{
      const task=await this.locked(m,id,dto.token);
      if(['ACTION_DONE','COMPLETED'].includes(task.state)) return {ok:true};
      if(task.state!=='ACTION_STARTED') throw new ConflictException('Tác vụ chưa bắt đầu gửi');
      task.result={...task.result};task.state='ACTION_DONE';await m.getRepository(FollowupTask).save(task);return {ok:true};
    });
  }
  async complete(id:number,token:string) {
    return this.db.transaction(async m=>{
      const task=await this.locked(m,id,token);
      if(task.state==='COMPLETED')return {ok:true};
      if(task.state!=='ACTION_DONE')throw new ConflictException('Chưa xác nhận gửi thành công');
      await m.getRepository(LeadEvent).save({leadId:task.leadId,type:'LADDER_STEP_SENT',note:`L9 ${task.taskKey}`});
      task.state='COMPLETED';task.error=null;await m.getRepository(FollowupTask).save(task);return {ok:true};
    });
  }
  async fail(id:number,dto:FailFollowupDto) {
    return this.db.transaction(async m=>{
      const task=await this.locked(m,id,dto.token);
      if(task.state==='COMPLETED')return {state:task.state};
      task.state=['ACTION_STARTED','REVIEW'].includes(task.state)?'REVIEW':task.state==='ACTION_DONE'?'ACTION_DONE':'FAILED';
      task.error=dto.error;task.leaseUntil=new Date(0);task.availableAt=new Date(Date.now()+6*3_600_000);
      await m.getRepository(FollowupTask).save(task);await m.getRepository(LeadEvent).save({leadId:task.leadId,type:'FOLLOWUP_FAILED',note:`${task.type}: ${task.state}: ${dto.error}`});
      return {state:task.state};
    });
  }
  async resolve(id:number,dto:ResolveFollowupDto) {
    await this.db.transaction(async m=>{
      const task=await this.locked(m,id,dto.token);
      if(task.state!=='REVIEW')throw new ConflictException('Chỉ xử lý thủ công tác vụ REVIEW');
      task.state=dto.resolution==='delivered'?'ACTION_DONE':'FAILED';task.availableAt=new Date(0);task.leaseUntil=new Date(0);
      await m.getRepository(FollowupTask).save(task);
    });
    return dto.resolution==='delivered'?this.complete(id,dto.token):{ok:true};
  }
  async context(id:number,token:string) {
    return this.db.transaction(async m=>{
      const task=await this.locked(m,id,token);const s=await this.snapshot(m,task.leadId);
      const events=await m.getRepository(LeadEvent).find({where:{leadId:task.leadId},order:{createdAt:'DESC',id:'DESC'},take:12});
      return {taskId:id,leadId:task.leadId,type:task.type,...this.candidate(task),name:s.name,email:s.email,needs:s.needs,
        assigneeId:s.assigned_user_id,assigneeName:s.assignee_name,propertyName:s.property_name,events:events.map(e=>({type:e.type,note:e.note})),
        text:resultOf(task).parentTaskId?resultOf((await m.getRepository(FollowupTask).findOneByOrFail({id:resultOf(task).parentTaskId}))).approval?.text:undefined};
    });
  }
  async suggestion(id:number,dto:SaveLadderSuggestionDto) {
    return this.db.transaction(async m=>{
      const task=await this.locked(m,id,dto.token);
      if(!['LADDER_REACH','LADDER_QUIET'].includes(task.type) || !['CLAIMED','ACTION_STARTED'].includes(task.state) || task.leaseUntil<=new Date())
        throw new ConflictException('Không thể sửa gợi ý của tác vụ này');
      const suggestion:LadderSuggestion={...dto.suggestion,emailDraft:dto.suggestion.action==='WAIT'?null:dto.suggestion.emailDraft??null};
      task.result={...task.result,suggestion};await m.getRepository(FollowupTask).save(task);return {ok:true};
    });
  }
  private secret() { const secret=process.env.WEBHOOK_SECRET;if(!secret)throw new Error('Thiếu WEBHOOK_SECRET');return secret; }
  private decode(token:string) {
    try {
      const [body,signature,...rest]=token.split('.');if(rest.length || !/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]{43}$/.test(signature))throw new Error();
      const expected=createHmac('sha256',this.secret()).update(body).digest();const actual=Buffer.from(signature,'base64url');
      if(actual.length!==expected.length || !timingSafeEqual(actual,expected))throw new Error();
      const payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
      if(!Number.isSafeInteger(payload.t)||payload.t<1)throw new Error();return payload.t as number;
    } catch { throw new NotFoundException('Liên kết không hợp lệ'); }
  }
  async link(id:number) {
    const task=await this.db.getRepository(FollowupTask).findOneBy({id});
    if(!task || !['LADDER_REACH','LADDER_QUIET'].includes(task.type))throw new NotFoundException('Tác vụ không tồn tại');
    const body=Buffer.from(JSON.stringify({t:id})).toString('base64url');
    const token=body+'.'+createHmac('sha256',this.secret()).update(body).digest('base64url');
    return {approveUrl:`${(process.env.PUBLIC_WEB_URL||'http://localhost:3000').replace(/\/$/,'')}/duyet-thu/${token}`};
  }
  async preview(token:string) {
    const id=this.decode(token);
    return this.db.transaction(async m=>{
      const task=await this.locked(m,id);if(!['LADDER_REACH','LADDER_QUIET'].includes(task.type))throw new NotFoundException('Liên kết không hợp lệ');
      const s=await this.snapshot(m,task.leadId);const approval=resultOf(task).approval;
      const email=approval?.decision==='SEND'?await m.getRepository(FollowupTask).findOneBy({taskKey:`LADDER_EMAIL:${id}`}):null;
      const deliveryStarted=!!email&&email.state!=='FAILED';
      const retryPending=approval?.decision==='SEND'&&!approval.dispatched&&!deliveryStarted&&(approval.dispatchUntil??0)<=Date.now();
      const state=approval&&!retryPending?'HANDLED':await this.isCurrent(m,task,s)?'OPEN':'EXPIRED';const refusal=this.refusal(s);
      const suggestion=this.publicSuggestion(s,task.result.suggestion??plainFallback);
      return {state,refusal,leadName:s.name,leadStatus:s.status,assigneeName:s.assignee_name,
        kind:task.type==='LADDER_REACH'?'REACH':'QUIET',step:this.candidate(task).step,propertyName:s.property_name,suggestion,
        canSend:state==='OPEN'&&!refusal&&suggestion.action!=='WAIT'};
    });
  }
  async confirm(token:string,dto:ConfirmLadderDto) {
    const id=this.decode(token);
    if(dto.decision==='SEND' && (!dto.text?.trim() || dto.text.trim().length>1500))throw new BadRequestException('Nội dung thư phải từ 1 đến 1500 ký tự');
    const outcome=await this.db.transaction(async m=>{
      const task=await this.locked(m,id);
      if(!['LADDER_REACH','LADDER_QUIET'].includes(task.type))throw new NotFoundException('Liên kết không hợp lệ');
      const result=resultOf(task),previous=result.approval;const s=await this.snapshot(m,task.leadId);
      const repo=m.getRepository(FollowupTask);
      // All workers lock this lead first too: cancellation and claim cannot both win.
      let email=previous?.decision==='SEND'?await repo.findOne({where:{taskKey:`LADDER_EMAIL:${id}`},lock:{mode:'pessimistic_write'}}):null;
      const deliveryStarted=!!email&&email.state!=='FAILED';
      if(previous && (previous.decision==='SKIP'||previous.dispatched||deliveryStarted||(previous.dispatchUntil??0)>Date.now()))
        return {decision:previous.decision,already:true};
      if(!(await this.isCurrent(m,task,s)))throw new BadRequestException('EXPIRED');
      const cancelPending=previous?.decision==='SEND'&&dto.decision==='SKIP';
      const decision=cancelPending?'SKIP':previous?.decision??dto.decision;
      if(decision==='SEND' && (this.refusal(s)||task.result.suggestion?.action==='WAIT'))throw new BadRequestException(this.refusal(s)??'WAIT');
      const approval:Approval=cancelPending?{decision:'SKIP'}:previous??{decision,...(decision==='SEND'?{text:dto.text!.trim()}:{})};
      approval.dispatchUntil=decision==='SEND'?Date.now()+30_000:undefined;
      result.approval=approval;task.result=result;await m.getRepository(FollowupTask).save(task);
      if(!previous||cancelPending)await m.getRepository(LeadEvent).save({leadId:task.leadId,type:'LADDER_APPROVED',actorUserId:s.assigned_user_id,
        note:`L9 ${task.taskKey}: ${decision}${cancelPending?' - Huỷ thư chưa bắt đầu gửi':''}, link gửi cho ${s.assignee_name??'quản lý'}${approval.text?': '+approval.text:''}`});
      if(decision==='SKIP'){
        if(email){email.state='COMPLETED';email.result={...email.result,cancelled:true} as Result;email.error=null;await repo.save(email);}
        return {decision,already:false};
      }
      email??=repo.create({taskKey:`LADDER_EMAIL:${id}`,leadId:task.leadId,viewingId:0,viewingTime:task.viewingTime,type:'LADDER_EMAIL',
        owner:'approval',token:randomUUID(),state:'FAILED',leaseUntil:new Date(0),availableAt:new Date(0),result:{parentTaskId:id} as Result,error:null});
      await repo.save(email);return {decision,already:false,leadId:task.leadId,emailTaskId:email.id,anchor:task.viewingTime.toISOString()};
    });
    if(outcome.emailTaskId) {
      try {await this.n8n.callWebhook('ladder-email-approved',{taskId:outcome.emailTaskId,ladderTaskId:id,leadId:outcome.leadId,viewingTime:outcome.anchor});}
      catch {
        await this.updateDispatch(id,false);
        throw new BadGatewayException('Chưa gửi được, thử lại sau');
      }
      await this.updateDispatch(id,true);
    }
    return {ok:true,decision:outcome.decision,...(outcome.already?{already:true}:{})};
  }
  private async updateDispatch(id:number,dispatched:boolean) {
    await this.db.transaction(async m=>{const task=await this.locked(m,id);const r=resultOf(task);
      if(r.approval?.decision==='SEND'){
        // A late failure must not undo another request's successful acknowledgement.
        r.approval.dispatched=r.approval.dispatched===true||dispatched;r.approval.dispatchUntil=0;task.result=r;
        await m.getRepository(FollowupTask).save(task);
      }});
  }
}
