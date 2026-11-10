import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Lead } from './entities/lead.entity';
import { LeadEvent } from './entities/lead-event.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { formatVn } from '../viewings/viewing-time';
import type { AuthUser } from '../auth/auth.types';
import { AssignLeadDto, CreateLeadDto } from './dto/create-lead.dto';
import {
  ASSIGNMENT_LOCK_SQL,
  NORMALIZED_PHONE_SQL,
  normalizePhone,
  responseDeadline,
} from './intake-rules';

export interface IntakeResult {
  lead: Lead;
  created: boolean;
  reopened: boolean;
}
export interface IntakeOptions {
  actor?: AuthUser;
  status?: 'NEW' | 'CONSULTING';
  // Đặt buổi xem (POST /viewings): gắn buổi xem vào lead cũ nếu khách chưa có buổi nào đang mở.
  booking?: boolean;
}

@Injectable()
export class LeadIntakeService {
  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
  ) {}

  private phoneQuery(em: EntityManager, phone: string) {
    return em
      .getRepository(Lead)
      .createQueryBuilder('l')
      .where(`${NORMALIZED_PHONE_SQL} = :phone`, { phone })
      .orderBy('l.id', 'ASC');
  }

  async lookup(phone: string) {
    const lead = await this.phoneQuery(
      this.leads.manager,
      normalizePhone(phone),
    ).getOne();
    if (!lead) return null;
    const owner = lead.assignedUserId
      ? await this.leads.manager.findOneBy(User, { id: lead.assignedUserId })
      : null;
    return {
      id: lead.id,
      name: lead.name,
      status: lead.status,
      assignedUserId: lead.assignedUserId,
      assignedUserName: owner?.name ?? null,
    };
  }

  create(dto: CreateLeadDto, actor?: AuthUser): Promise<IntakeResult> {
    return this.leads.manager.transaction((em) =>
      this.receive(em, dto, { actor }),
    );
  }

  // Dùng cùng transaction với nơi tạo buổi xem: không lưu lead mồ côi nếu đặt lịch thất bại.
  async receive(
    em: EntityManager,
    dto: CreateLeadDto,
    options: IntakeOptions = {},
  ): Promise<IntakeResult> {
    const phone = normalizePhone(dto.phone);
    await em.query(ASSIGNMENT_LOCK_SQL);
    const repo = em.getRepository(Lead);
    const existing = await this.phoneQuery(em, phone)
      .setLock('pessimistic_write')
      .getOne();
    // Mỗi khách chỉ có tối đa một buổi xem đang mở (FE-34): luồng 1, 1b, 2 và nút Duyệt đều tính theo lead
    // và lấy buổi xem mới nhất, nên chưa xử lý được nhiều buổi mở cùng lúc.
    if (existing && options.booking) {
      if (existing.status === 'DEPOSIT' || existing.status === 'SIGNED') {
        throw new ConflictException(
          'Bạn đang làm hợp đồng đặt cọc với chúng tôi. Vui lòng liên hệ nhân viên để đặt thêm lịch xem.',
        );
      }
      const open = await em.getRepository(Viewing).findOne({
        where: { leadId: existing.id, status: 'NEW' },
        order: { id: 'DESC' },
      });
      if (open) {
        throw new ConflictException(
          `Bạn đang có lịch xem lúc ${formatVn(open.viewingTime)}. Nếu cần đổi giờ, hãy dùng link trong email xác nhận hoặc liên hệ nhân viên.`,
        );
      }
    }
    if (existing && options.actor) {
      // Nhập tay không sửa/mở lại khách cũ; giao diện mời người dùng mở lead hiện có.
      const owner = existing.assignedUserId
        ? await em.findOneBy(User, { id: existing.assignedUserId })
        : null;
      throw new ConflictException({
        message: `Số này đã có: lead #${existing.id} ${existing.name}, đang do ${owner?.name ?? 'chưa có nhân viên'} phụ trách`,
        leadId: existing.id,
        assignedUserId: existing.assignedUserId,
      });
    }
    if (existing) {
      const reopened = existing.status === 'LOST';
      existing.phoneNormalized = phone;
      // Không lấy dữ liệu mới đè tên, email, nguồn, consent hay điểm của khách cũ.
      if (reopened || !existing.assignedUserId) {
        const previous = existing.assignedUserId;
        const owner = previous
          ? await em.findOneBy(User, { id: previous })
          : null;
        if (!owner || !owner.acceptingLeads) {
          const assigned = await this.chooseOwner(em);
          this.setOwner(existing, assigned.id);
          await this.event(
            em,
            existing.id,
            previous ? 'LEAD_REASSIGNED' : 'LEAD_ASSIGNED',
            `${previous ?? 'chưa có'} -> ${assigned.id} (${assigned.name})`,
          );
        } else if (reopened) {
          this.setOwner(existing, owner.id);
        }
      }
      if (reopened) {
        existing.status = 'CONSULTING';
        existing.lostReason = null;
        existing.approvalUrl = null;
        await this.event(
          em,
          existing.id,
          'LEAD_REOPENED',
          'Khách cũ liên hệ lại, mở về Đang tư vấn',
        );
      }
      if (options.booking) {
        const before = existing.status;
        existing.status = 'NEW';
        existing.email ??= dto.email?.trim().toLowerCase() || null;
        existing.budget ??= dto.budget ?? null;
        existing.needs ??= dto.needs?.trim() || null;
        existing.interestedPropertyIds = [
          ...new Set([
            ...(existing.interestedPropertyIds ?? []),
            ...(dto.interestedPropertyIds ?? []),
          ]),
        ];
        existing.eventId = randomUUID();
        existing.approvalUrl = null;
        existing.automationStatus = 'PENDING';
        existing.automationError = null;
        await this.event(
          em,
          existing.id,
          'STATUS_CHANGED',
          `${before} -> NEW: Đặt buổi xem mới`,
        );
      }
      if (dto.note?.trim())
        await this.noteInTransaction(em, existing, dto.note);
      return { lead: await repo.save(existing), created: false, reopened };
    }

    const propertyIds = dto.interestedPropertyIds ?? [];
    if (
      propertyIds.length &&
      (await em.getRepository(Property).countBy({ id: In(propertyIds) })) !==
        propertyIds.length
    ) {
      throw new BadRequestException('Có căn quan tâm không tồn tại');
    }
    const owner = await this.chooseOwner(
      em,
      options.actor ? (dto.assignedUserId ?? options.actor.id) : undefined,
    );
    const lead = repo.create({
      name: dto.name.trim(),
      phone,
      phoneNormalized: phone,
      email: dto.email?.trim().toLowerCase() || null,
      budget: dto.budget ?? null,
      needs: dto.needs?.trim() || null,
      source: dto.source.trim().toLowerCase(),
      consentMarketing: dto.consentMarketing ?? false,
      interestedPropertyIds: propertyIds,
      status: options.status ?? 'CONSULTING',
      automationStatus: 'PENDING',
      eventId: randomUUID(),
    });
    this.setOwner(lead, owner.id);
    const saved = await repo.save(lead);
    await this.event(
      em,
      saved.id,
      'LEAD_CREATED',
      `Nguồn: ${saved.source}`,
      options.actor?.id,
    );
    await this.event(
      em,
      saved.id,
      'LEAD_ASSIGNED',
      `${owner.id} (${owner.name})`,
      options.actor?.id,
    );
    if (dto.note?.trim())
      await this.noteInTransaction(em, saved, dto.note, options.actor);
    return { lead: saved, created: true, reopened: false };
  }

  // Người được chia lâu nhất nhận lượt tiếp; nhập tay cũng cập nhật lượt. Khoá chung bảo vệ nhiều request đồng thời.
  private async chooseOwner(
    em: EntityManager,
    requestedId?: number,
  ): Promise<User> {
    const users = em.getRepository(User);
    let owner: User | null;
    if (requestedId !== undefined) {
      owner = await users.findOneBy({ id: requestedId });
      if (!owner || (owner.role !== 'MANAGER' && !owner.acceptingLeads)) {
        throw new BadRequestException(
          'Người phụ trách không tồn tại hoặc đang ngừng nhận khách',
        );
      }
    } else {
      owner = await users
        .createQueryBuilder('u')
        .where('u.role = :role AND u.acceptingLeads = true', { role: 'SALE' })
        .orderBy('u.lastAssignedAt', 'ASC', 'NULLS FIRST')
        .addOrderBy('u.id', 'ASC')
        .getOne();
      owner ??= await users.findOne({
        where: { role: 'MANAGER' },
        order: { id: 'ASC' },
      });
      if (!owner)
        throw new ServiceUnavailableException(
          'Chưa có sale nhận khách hoặc tài khoản quản lý; hãy cấu hình nhân sự trước',
        );
    }
    // Dùng thời gian sau khi lấy khoá, không dùng transaction_timestamp() có thể cũ hơn lượt trước.
    await users.update(owner.id, { lastAssignedAt: () => 'clock_timestamp()' });
    return owner;
  }

  private setOwner(lead: Lead, id: number) {
    const now = new Date();
    lead.assignedUserId = id;
    lead.assignedAt = now;
    lead.responseDueAt = responseDeadline(now);
    lead.firstResponseAt = null;
  }

  async reassign(
    id: number,
    dto: AssignLeadDto,
    actor: AuthUser,
  ): Promise<Lead> {
    if (actor.role !== 'MANAGER')
      throw new ForbiddenException('Chỉ quản lý được chuyển người phụ trách');
    return this.leads.manager.transaction(async (em) => {
      await em.query(ASSIGNMENT_LOCK_SQL);
      const lead = await this.lockLead(em, id);
      if (lead.assignedUserId === dto.assignedUserId) return lead; // Không gia hạn bằng cách chọn lại cùng người.
      const previous = lead.assignedUserId;
      const owner = await this.chooseOwner(em, dto.assignedUserId);
      this.setOwner(lead, owner.id);
      await em.save(Lead, lead);
      await this.event(
        em,
        id,
        'LEAD_REASSIGNED',
        `${previous ?? 'chưa có'} -> ${owner.id} (${owner.name})${dto.note ? ': ' + dto.note : ''}`,
        actor.id,
      );
      return lead;
    });
  }

  async addNote(id: number, note: string, actor: AuthUser): Promise<LeadEvent> {
    return this.leads.manager.transaction(async (em) => {
      const lead = await this.lockLead(em, id);
      if (actor.role !== 'MANAGER' && lead.assignedUserId !== actor.id) {
        throw new ForbiddenException(
          'Chỉ người phụ trách hoặc quản lý được ghi chú khách này',
        );
      }
      return this.noteInTransaction(em, lead, note, actor);
    });
  }

  private async noteInTransaction(
    em: EntityManager,
    lead: Lead,
    note: string,
    actor?: AuthUser,
  ) {
    if (!note.trim())
      throw new BadRequestException('Ghi chú không được để trống');
    const event = await this.event(
      em,
      lead.id,
      'NOTE_ADDED',
      note.trim(),
      actor?.id,
    );
    if (
      actor &&
      (actor.role === 'MANAGER' || actor.id === lead.assignedUserId) &&
      !lead.firstResponseAt
    ) {
      lead.firstResponseAt = new Date();
      await em
        .getRepository(Lead)
        .update(lead.id, { firstResponseAt: lead.firstResponseAt });
    }
    return event;
  }

  private async lockLead(em: EntityManager, id: number) {
    const lead = await em
      .getRepository(Lead)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!lead) throw new NotFoundException(`Lead with id ${id} not found`);
    return lead;
  }

  private event(
    em: EntityManager,
    leadId: number,
    type: string,
    note: string,
    actorUserId?: number,
  ) {
    return em
      .getRepository(LeadEvent)
      .save({ leadId, type, note, actorUserId: actorUserId ?? null });
  }
}
