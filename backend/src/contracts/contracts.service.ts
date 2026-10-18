import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { Contract } from './entities/contract.entity';
import {
  CreateContractDto,
  DraftContractDto,
  SignContractDto,
} from './dto/contract.dto';
import { Lead } from '../leads/entities/lead.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { Property } from '../properties/entities/property.entity';
import { LeadsService } from '../leads/leads.service';

const SIGN_VALID_DAYS = 7;

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(Viewing)
    private readonly viewingRepository: Repository<Viewing>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    private readonly leadsService: LeadsService,
    private readonly httpService: HttpService,
  ) {}

  // ---- Gọi n8n (tạm viết ngay tại đây; sau này chuyển sang N8nService dùng chung) ----

  // Địa chỉ n8n mà BACKEND nhìn thấy (trong Docker là http://n8n:5678), lấy gốc từ N8N_WEBHOOK_URL
  private n8nOrigin(): string {
    return new URL(process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/viewing-requested').origin;
  }

  private async callWebhook(path: string, payload: Record<string, unknown>): Promise<void> {
    await firstValueFrom(
      this.httpService.post(`${this.n8nOrigin()}/webhook/${path}`, payload, {
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': process.env.WEBHOOK_SECRET || '' },
        timeout: 15000,
      }),
    );
  }

  // Bấm "link tiếp tục" (resumeUrl) của lần chạy n8n đang chờ. resumeUrl có thể mang địa chỉ công khai, đổi sang địa chỉ nội bộ.
  private async resume(resumeUrl: string, action: string, extra: Record<string, string> = {}): Promise<void> {
    const u = new URL(resumeUrl);
    const base = new URL(this.n8nOrigin());
    u.protocol = base.protocol;
    u.host = base.host;
    u.searchParams.set('action', action);
    for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
    await firstValueFrom(this.httpService.get(u.toString(), { timeout: 60000 }));
  }

  // ---- Lấy hợp đồng, kèm các cột bị ẩn mặc định ----

  private async findOneOrFail(id: number): Promise<Contract> {
    const contract = await this.contractRepository.findOne({ where: { id } });
    if (!contract) throw new NotFoundException(`Contract with id ${id} not found`);
    return contract;
  }

  private findWithSecrets(where: { id?: number; signToken?: string }): Promise<Contract | null> {
    const qb = this.contractRepository
      .createQueryBuilder('c')
      .addSelect(['c.resumeUrl', 'c.signature']);
    if (where.id !== undefined) qb.where('c.id = :id', { id: where.id });
    if (where.signToken !== undefined) qb.where('c.signToken = :t', { t: where.signToken });
    return qb.getOne();
  }

  // ---- Nhân viên tạo hợp đồng ----

  async create(dto: CreateContractDto, actor: string): Promise<Contract> {
    const lead = await this.leadsService.findOne(dto.leadId);
    if (lead.status !== 'VIEWED') {
      throw new BadRequestException('Chỉ tạo hợp đồng cho khách đã xem nhà (trạng thái VIEWED)');
    }
    const active = await this.contractRepository
      .createQueryBuilder('c')
      .where('c.lead_id = :id AND c.status NOT IN (:...done)', { id: lead.id, done: ['REJECTED', 'EXPIRED'] })
      .getCount();
    if (active > 0) throw new ConflictException('Khách này đã có hợp đồng đang xử lý');

    const viewing = await this.viewingRepository.findOne({ where: { leadId: lead.id }, order: { id: 'DESC' } });
    const property = viewing ? await this.propertyRepository.findOne({ where: { id: viewing.propertyId } }) : null;
    if (!property) throw new BadRequestException('Khách chưa có căn nhà để lập hợp đồng');
    if (dto.depositAmount > Number(property.price)) {
      throw new BadRequestException('Tiền đặt cọc không được lớn hơn giá căn nhà');
    }

    const contract = await this.contractRepository.save(
      this.contractRepository.create({
        leadId: lead.id,
        propertyId: property.id,
        depositAmount: dto.depositAmount,
        propertyPrice: Number(property.price),
        status: 'DRAFTING',
        createdBy: actor,
      }),
    );

    await this.leadsService.updateStatus(lead.id, { status: 'DEPOSIT', note: `Tạo hợp đồng #${contract.id} (bởi ${actor})` });
    await this.leadsService.addEvent(lead.id, { type: 'CONTRACT_CREATED', note: `Hợp đồng #${contract.id}, cọc ${dto.depositAmount.toLocaleString('vi-VN')} đ (bởi ${actor})` });

    this
      .callWebhook('contract-requested', { contractId: contract.id })
      .catch((err) => this.logger.error(`Không gọi được luồng 3 cho hợp đồng ${contract.id}: ${err.message}`));

    return contract;
  }

  // ---- Danh sách và chi tiết (admin) ----

  findAll() {
    return this.contractRepository
      .createQueryBuilder('c')
      .innerJoin(Lead, 'l', 'l.id = c.lead_id')
      .innerJoin(Property, 'p', 'p.id = c.property_id')
      .select([
        'c.id AS "id"',
        'c.status AS "status"',
        'c.deposit_amount AS "depositAmount"',
        'c.created_at AS "createdAt"',
        'c.signed_at AS "signedAt"',
        'c.lead_id AS "leadId"',
        'l.name AS "leadName"',
        'p.name AS "propertyName"',
      ])
      .orderBy('c.id', 'DESC')
      .getRawMany();
  }

  async findDetail(id: number) {
    const contract = await this.findWithSecrets({ id });
    if (!contract) throw new NotFoundException(`Contract with id ${id} not found`);
    const lead = await this.leadRepository.findOne({ where: { id: contract.leadId } });
    const property = await this.propertyRepository.findOne({ where: { id: contract.propertyId } });
    const { resumeUrl: _hidden, signToken, ...rest } = contract;
    const base = (process.env.PUBLIC_WEB_URL || 'http://localhost:3000').replace(/\/$/, '');
    return {
      ...rest,
      // Chỉ nhân viên đăng nhập mới thấy link ký (để hỗ trợ khách khi cần)
      signUrl: signToken && contract.status === 'SENT' ? `${base}/ky/${signToken}` : null,
      lead: lead ? { id: lead.id, name: lead.name, email: lead.email, phone: lead.phone } : null,
      property,
    };
  }

  // ---- Quản lý duyệt hoặc từ chối: bấm link của lần chạy n8n đang chờ ----

  private async resumeApproval(id: number, action: string, extra: Record<string, string> = {}): Promise<void> {
    const contract = await this.findWithSecrets({ id });
    if (!contract) throw new NotFoundException(`Contract with id ${id} not found`);
    if (contract.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Hợp đồng không ở trạng thái chờ duyệt');
    }
    if (!contract.resumeUrl) throw new BadRequestException('Hợp đồng chưa có bản nháp từ n8n');
    try {
      await this.resume(contract.resumeUrl, action, extra);
    } catch (err: any) {
      const status = err?.response?.status;
      if ([401, 403, 404, 409, 410].includes(status)) {
        throw new ConflictException('Hợp đồng đã quá hạn duyệt, hãy tạo lại hợp đồng mới');
      }
      throw new BadGatewayException(`n8n báo lỗi: ${err?.message ?? status}`);
    }
  }

  async approve(id: number, actor: string): Promise<{ ok: true }> {
    await this.contractRepository.update(id, { approvedBy: actor });
    await this.resumeApproval(id, 'approve');
    return { ok: true };
  }

  async reject(id: number, reason: string, actor: string): Promise<{ ok: true }> {
    await this.resumeApproval(id, 'reject', { reason: `${reason} (bởi ${actor})` });
    return { ok: true };
  }

  // ---- n8n gọi vào ----

  // Bản nháp xong: lưu nội dung và link để chờ duyệt
  async saveDraft(id: number, dto: DraftContractDto): Promise<Contract> {
    const contract = await this.findOneOrFail(id);
    if (contract.status !== 'DRAFTING') throw new BadRequestException('Hợp đồng đã có bản nháp');
    contract.title = dto.title;
    contract.content = dto.content;
    contract.aiReview = dto.aiReview;
    contract.resumeUrl = dto.resumeUrl;
    contract.status = 'PENDING_APPROVAL';
    const saved = await this.contractRepository.save(contract);
    await this.leadsService.addEvent(contract.leadId, { type: 'CONTRACT_DRAFTED', note: `Hợp đồng #${id} đã soạn xong, chờ quản lý duyệt` });
    return saved;
  }

  // Quản lý đã duyệt: cấp link ký cho khách (hạn 7 ngày)
  async issueToken(id: number): Promise<{ token: string; signUrl: string; expiresAt: Date }> {
    const contract = await this.findOneOrFail(id);
    if (contract.status !== 'PENDING_APPROVAL') throw new BadRequestException('Hợp đồng không ở trạng thái chờ duyệt');
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + SIGN_VALID_DAYS * 86400000);
    contract.signToken = token;
    contract.expiresAt = expiresAt;
    contract.status = 'SENT';
    contract.approvedBy = contract.approvedBy ?? 'Quản lý (qua email)';
    await this.contractRepository.save(contract);
    await this.leadsService.addEvent(contract.leadId, { type: 'CONTRACT_SENT', note: `Hợp đồng #${id} đã được duyệt (${contract.approvedBy}) và gửi khách ký` });
    const base = (process.env.PUBLIC_WEB_URL || 'http://localhost:3000').replace(/\/$/, '');
    return { token, signUrl: `${base}/ky/${token}`, expiresAt };
  }

  private async rollbackLead(leadId: number, note: string): Promise<void> {
    const lead = await this.leadsService.findOne(leadId);
    if (lead.status === 'DEPOSIT') await this.leadsService.updateStatus(leadId, { status: 'VIEWED', note });
  }

  async markRejected(id: number, reason: string): Promise<Contract> {
    const contract = await this.findOneOrFail(id);
    if (contract.status !== 'PENDING_APPROVAL') throw new BadRequestException('Hợp đồng không ở trạng thái chờ duyệt');
    contract.status = 'REJECTED';
    contract.rejectReason = reason;
    const saved = await this.contractRepository.save(contract);
    await this.leadsService.addEvent(contract.leadId, { type: 'CONTRACT_REJECTED', note: `Hợp đồng #${id} bị từ chối: ${reason}` });
    await this.rollbackLead(contract.leadId, `Hợp đồng #${id} bị từ chối`);
    return saved;
  }

  async markExpired(id: number, reason?: string): Promise<Contract> {
    const contract = await this.findOneOrFail(id);
    if (contract.status !== 'PENDING_APPROVAL' && contract.status !== 'SENT') {
      throw new BadRequestException('Hợp đồng không còn ở trạng thái có thể hết hạn');
    }
    const wasSent = contract.status === 'SENT';
    contract.status = 'EXPIRED';
    contract.rejectReason = reason ?? (wasSent ? 'Khách không ký trong thời hạn' : 'Quá hạn chờ duyệt');
    const saved = await this.contractRepository.save(contract);
    await this.leadsService.addEvent(contract.leadId, { type: 'CONTRACT_EXPIRED', note: `Hợp đồng #${id} hết hạn: ${contract.rejectReason}` });
    await this.rollbackLead(contract.leadId, `Hợp đồng #${id} hết hạn`);
    return saved;
  }

  // ---- Khách ký (công khai, qua token) ----

  private async findByTokenOrFail(token: string): Promise<Contract> {
    const contract = await this.findWithSecrets({ signToken: token });
    if (!contract) throw new NotFoundException('Liên kết ký không hợp lệ');
    return contract;
  }

  async getPublic(token: string) {
    const contract = await this.findByTokenOrFail(token);
    const lead = await this.leadsService.findOne(contract.leadId);
    const property = await this.propertyRepository.findOne({ where: { id: contract.propertyId } });
    const expired = contract.status === 'SENT' && contract.expiresAt !== null && contract.expiresAt.getTime() < Date.now();
    return {
      title: contract.title,
      content: contract.content,
      customerName: lead.name,
      propertyName: property?.name ?? null,
      depositAmount: contract.depositAmount,
      status: expired ? 'EXPIRED' : contract.status,
      expiresAt: contract.expiresAt,
      signedAt: contract.signedAt,
      signerName: contract.signerName,
    };
  }

  async sign(token: string, dto: SignContractDto, ip: string): Promise<{ ok: true }> {
    const contract = await this.findByTokenOrFail(token);
    if (contract.status === 'SIGNED') throw new ConflictException('Hợp đồng này đã được ký rồi');
    if (contract.status !== 'SENT') throw new BadRequestException('Hợp đồng này không còn có thể ký');
    if (contract.expiresAt && contract.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Liên kết ký đã hết hạn');
    }

    contract.signerName = dto.signerName;
    contract.signature = dto.signature;
    contract.signedAt = new Date();
    contract.signedIp = ip.slice(0, 64);
    contract.status = 'SIGNED';
    await this.contractRepository.save(contract);

    await this.leadsService.updateStatus(contract.leadId, { status: 'SIGNED', note: `Khách ký hợp đồng #${contract.id}` });
    await this.leadsService.addEvent(contract.leadId, { type: 'CONTRACT_SIGNED', note: `Hợp đồng #${contract.id} do ${dto.signerName} ký online` });

    // Báo cho n8n (luồng 3 đang chờ khách ký) gửi email xác nhận. n8n lỗi không làm mất chữ ký đã lưu.
    if (contract.resumeUrl) {
      this
        .resume(contract.resumeUrl, 'signed')
        .catch((err) => this.logger.error(`Không báo được n8n hợp đồng ${contract.id} đã ký: ${err.message}`));
    }
    return { ok: true };
  }
}
