import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Feedback } from './entities/feedback.entity';
import { FeedbackAiResultDto, SubmitFeedbackDto } from './dto/feedback.dto';
import { Viewing } from '../viewings/entities/viewing.entity';
import { Property } from '../properties/entities/property.entity';
import { LeadsService } from '../leads/leads.service';
import { N8nService } from '../n8n/n8n.service';

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
  ) {}

  private urlFor(token: string): string {
    const base = (process.env.PUBLIC_WEB_URL || 'http://localhost:3000').replace(/\/$/, '');
    return `${base}/cam-nhan/${token}`;
  }

  // n8n (luồng 2) xin link gửi trong email hỏi cảm nhận. Mỗi khách chỉ có một link.
  async createLink(leadId: number): Promise<{ token: string; url: string }> {
    await this.leadsService.findOne(leadId); // 404 nếu khách không tồn tại
    const existing = await this.feedbackRepository.findOne({ where: { leadId }, order: { id: 'DESC' } });
    if (existing) return { token: existing.token, url: this.urlFor(existing.token) };

    const token = crypto.randomBytes(16).toString('hex');
    await this.feedbackRepository.save(
      this.feedbackRepository.create({ leadId, token, rating: null, interest: null, comment: null, submittedAt: null }),
    );
    return { token, url: this.urlFor(token) };
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
    const viewing = await this.viewingRepository.findOne({ where: { leadId: lead.id }, order: { id: 'DESC' } });
    const property = viewing ? await this.propertyRepository.findOne({ where: { id: viewing.propertyId } }) : null;
    return {
      leadName: lead.name,
      propertyName: property?.name ?? null,
      viewingTime: viewing?.viewingTime ?? null,
      submitted: feedback.submittedAt !== null,
    };
  }

  async submit(token: string, dto: SubmitFeedbackDto): Promise<{ ok: true }> {
    const feedback = await this.findByToken(token);
    if (feedback.submittedAt) throw new ConflictException('Anh/chị đã gửi cảm nhận rồi, cảm ơn anh/chị');

    feedback.rating = dto.rating;
    feedback.interest = dto.interest;
    feedback.comment = dto.comment || null;
    feedback.submittedAt = new Date();
    await this.feedbackRepository.save(feedback);

    await this.leadsService.addEvent(feedback.leadId, {
      type: 'FEEDBACK_RECEIVED',
      note: `${dto.rating}/5 sao, ${dto.interest}${dto.comment ? ': ' + dto.comment.slice(0, 120) : ''}`,
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
