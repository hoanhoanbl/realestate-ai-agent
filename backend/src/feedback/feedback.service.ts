import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Feedback } from './entities/feedback.entity';
import { FeedbackAiResultDto, SubmitFeedbackDto } from './dto/feedback.dto';
import { Viewing } from '../viewings/entities/viewing.entity';
import { Property } from '../properties/entities/property.entity';
import { LeadsService } from '../leads/leads.service';
import { N8nService } from '../n8n/n8n.service';
import { Lead } from '../leads/entities/lead.entity';
import { LeadEvent } from '../leads/entities/lead-event.entity';
import { FeedbackWorkService } from './feedback-work.service';
import { feedbackViewing } from './feedback-scope';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepository: Repository<Feedback>,
    @InjectRepository(Viewing)
    private readonly viewingRepository: Repository<Viewing>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    private readonly leadsService: LeadsService,
    private readonly n8nService: N8nService,
    private readonly work: FeedbackWorkService,
  ) {}

  private urlFor(token: string): string {
    const base = (process.env.PUBLIC_WEB_URL || 'http://localhost:3000').replace(/\/$/, '');
    return `${base}/cam-nhan/${token}`;
  }

  // Một link cho mỗi buổi xem; prefix ánh xạ buổi xem, 128 bit ngẫu nhiên vẫn bảo vệ link.
  // Không cần thêm cột trong đợt tích hợp sau PR nền. Link hex cũ vẫn thuộc buổi đầu tiên.
  async createLink(leadId: number, viewingId?: number): Promise<{ token: string; url: string }> {
    return this.feedbackRepository.manager.transaction(async em => {
      const lead = await em.getRepository(Lead).findOne({ where: { id: leadId }, lock: { mode: 'pessimistic_write' } });
      if (!lead) throw new NotFoundException(`Lead with id ${leadId} not found`);
      const viewing = await em.getRepository(Viewing).findOne({ where: { leadId, status: 'ATTENDED', ...(viewingId ? { id: viewingId } : {}) }, order: { id: 'DESC' } });
      if (!viewing) throw new BadRequestException('Chưa có buổi xem đã điểm danh để hỏi cảm nhận');
      const repo = em.getRepository(Feedback);
      let existing = await repo.createQueryBuilder('f').where('f.leadId=:leadId', { leadId })
        .andWhere("split_part(f.token,'_',1)=:scope", { scope: `v${viewing.id}` }).getOne();
      const first = await em.getRepository(Viewing).findOne({ where: { leadId }, order: { id: 'ASC' } });
      if (!existing && first?.id === viewing.id) existing = await repo.createQueryBuilder('f').where('f.leadId=:leadId',{leadId})
        .andWhere("f.token !~ '^v[0-9]+_'").orderBy('f.id','ASC').getOne();
      if (existing) return { token: existing.token, url: this.urlFor(existing.token) };
      const token = `v${viewing.id}_${crypto.randomBytes(16).toString('hex')}`;
      await repo.save(repo.create({ leadId, token, rating: null, interest: null, comment: null, submittedAt: null }));
      return { token, url: this.urlFor(token) };
    });
  }

  private async findByToken(token: string): Promise<Feedback> {
    const feedback = await this.feedbackRepository.findOne({ where: { token } });
    if (!feedback) throw new NotFoundException('Liên kết không hợp lệ');
    return feedback;
  }

  // Trang khách: chỉ lộ tên khách, căn nhà, giờ xem. Không lộ email, số điện thoại.
  async getPublic(token: string) {
    const feedback = await this.findByToken(token);
    const lead = await this.leadsService.findOne(feedback.leadId);
    const viewing = await feedbackViewing(this.feedbackRepository.manager, feedback);
    const property = viewing ? await this.propertyRepository.findOne({ where: { id: viewing.propertyId } }) : null;
    return {
      leadName: lead.name,
      propertyName: property?.name ?? null,
      viewingTime: viewing?.viewingTime ?? null,
      submitted: feedback.submittedAt !== null,
    };
  }

  async submit(token: string, dto: SubmitFeedbackDto): Promise<{ ok: true }> {
    const initial = await this.findByToken(token);
    const feedback = await this.feedbackRepository.manager.transaction(async m => {
      await m.query('SELECT id FROM leads WHERE id=$1 FOR UPDATE', [initial.leadId]);
      const f = await m.getRepository(Feedback).findOneOrFail({ where: { id: initial.id }, lock: { mode: 'pessimistic_write' } });
      if (f.submittedAt) throw new ConflictException('Anh/chị đã gửi cảm nhận rồi, cảm ơn anh/chị');
      f.rating = dto.rating; f.interest = dto.interest; f.comment = dto.comment || null; f.submittedAt = new Date();
      await m.save(f);
      await m.getRepository(LeadEvent).save({ leadId: f.leadId, type: 'FEEDBACK_RECEIVED',
        note: `${dto.rating}/5 sao, ${dto.interest}${dto.comment ? ': ' + dto.comment.slice(0,120) : ''}` });
      await this.work.create(m, f);
      return f;
    });

    // Luồng 5 phân tích bất đồng bộ; n8n lỗi không làm hỏng việc lưu cảm nhận của khách
    this.n8nService
      .callWebhook('feedback-submitted', { feedbackId: feedback.id, leadId: feedback.leadId })
      .catch((err) => this.logger.error(`Không gọi được luồng 5 cho feedback ${feedback.id}: ${err.message}`));

    return { ok: true };
  }

  async saveAiResult(id: number, dto: FeedbackAiResultDto): Promise<Feedback> {
    const feedback = await this.feedbackRepository.findOne({ where: { id } });
    if (!feedback) throw new NotFoundException(`Feedback with id ${id} not found`);
    feedback.aiSentiment = dto.sentiment;
    feedback.aiSummary = dto.summary;
    feedback.aiNextAction = dto.nextAction;
    return this.feedbackRepository.save(feedback);
  }

  // Cho trang chi tiết khách ở admin
  findByLead(leadId: number): Promise<Feedback | null> {
    return this.feedbackRepository.findOne({ where: { leadId }, order: { id: 'DESC' } });
  }
}
