import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { Viewing } from './entities/viewing.entity';
import { Lead } from '../leads/entities/lead.entity';
import { Property } from '../properties/entities/property.entity';
import { CreateViewingDto } from './dto/create-viewing.dto';

@Injectable()
export class ViewingsService {
  private readonly logger = new Logger(ViewingsService.name);

  constructor(
    @InjectRepository(Viewing)
    private readonly viewingRepository: Repository<Viewing>,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    private readonly httpService: HttpService,
  ) {}

  async create(createViewingDto: CreateViewingDto): Promise<{ viewing: Viewing; lead: Lead }> {
    const { name, email, phone, budget, needs, propertyId, viewingTime } = createViewingDto;

    const property = await this.propertyRepository.findOne({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with id ${propertyId} not found`);
    }

    const viewingDate = new Date(viewingTime);
    if (Number.isNaN(viewingDate.getTime())) {
      throw new BadRequestException('Invalid viewingTime format');
    }

    const lead = this.leadRepository.create({
      name,
      email,
      phone,
      budget,
      needs: needs || null,
      status: 'NEW',
      automationStatus: 'PENDING',
    });
    const savedLead = await this.leadRepository.save(lead);

    const viewing = this.viewingRepository.create({
      property_id: propertyId,
      lead_id: savedLead.id,
      viewing_time: viewingDate,
      status: 'NEW',
    });
    const savedViewing = await this.viewingRepository.save(viewing);

    // Call n8n webhook asynchronously so lead/viewing saving isn't blocked by n8n failure
    this.triggerN8nWebhook(savedLead, propertyId, viewingTime).catch((err) => {
      this.logger.error(`Error triggering n8n webhook: ${err.message}`);
    });

    return { viewing: savedViewing, lead: savedLead };
  }

  private async triggerN8nWebhook(
    lead: Lead,
    propertyId: number,
    viewingTime: string,
  ): Promise<void> {
    const webhookUrl =
      process.env.N8N_WEBHOOK_URL ||
      'http://localhost:5678/webhook-test/viewing-requested';
    const webhookSecret = process.env.WEBHOOK_SECRET || '';

    const payload = {
      event: 'viewing_requested',
      eventId: crypto.randomUUID(),
      leadId: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      budget: Number(lead.budget),
      needs: lead.needs || '',
      propertyId,
      viewingTime,
    };

    const maxRetries = 3;
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
      attempt++;
      try {
        await firstValueFrom(
          this.httpService.post(webhookUrl, payload, {
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Secret': webhookSecret,
            },
            timeout: 5000,
          }),
        );
        success = true;
        this.logger.log(`Successfully triggered n8n webhook for lead ${lead.id} on attempt ${attempt}`);
      } catch (error: any) {
        this.logger.warn(
          `Attempt ${attempt} to trigger n8n webhook failed: ${error.message}`,
        );
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    if (!success) {
      this.logger.error(
        `Failed to trigger n8n webhook for lead ${lead.id} after ${maxRetries} attempts. Setting automationStatus to FAILED.`,
      );
      lead.automationStatus = 'FAILED';
      await this.leadRepository.save(lead);
    }
  }

  findAll(): Promise<Viewing[]> {
    return this.viewingRepository.find();
  }
}