import { Body, Controller, Get, Ip, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import {
  CreateContractDto,
  DraftContractDto,
  ExpireContractDto,
  RejectContractDto,
  SignContractDto,
} from './dto/contract.dto';
import { WebhookSecretGuard } from './webhook-secret.guard';

// Tên người thao tác, tạm cố định cho tới khi có đăng nhập (sẽ lấy từ req.user.name)
const ACTOR = 'Nhân viên';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  // --- Admin: tạm bảo vệ bằng X-Webhook-Secret, đổi sang JwtAuthGuard (và @Roles('MANAGER') cho approve/reject) khi có auth ---

  @Post()
  @UseGuards(WebhookSecretGuard)
  create(@Body() dto: CreateContractDto) {
    return this.contractsService.create(dto, ACTOR);
  }

  @Get()
  @UseGuards(WebhookSecretGuard)
  findAll() {
    return this.contractsService.findAll();
  }

  @Get(':id')
  @UseGuards(WebhookSecretGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contractsService.findDetail(id);
  }

  @Post(':id/approve')
  @UseGuards(WebhookSecretGuard)
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.contractsService.approve(id, ACTOR);
  }

  @Post(':id/reject')
  @UseGuards(WebhookSecretGuard)
  reject(@Param('id', ParseIntPipe) id: number, @Body() dto: RejectContractDto) {
    return this.contractsService.reject(id, dto.reason, ACTOR);
  }

  // --- Cho n8n (X-Webhook-Secret) ---

  @Put(':id/draft')
  @UseGuards(WebhookSecretGuard)
  saveDraft(@Param('id', ParseIntPipe) id: number, @Body() dto: DraftContractDto) {
    return this.contractsService.saveDraft(id, dto);
  }

  @Post(':id/issue-token')
  @UseGuards(WebhookSecretGuard)
  issueToken(@Param('id', ParseIntPipe) id: number) {
    return this.contractsService.issueToken(id);
  }

  @Put(':id/rejected')
  @UseGuards(WebhookSecretGuard)
  markRejected(@Param('id', ParseIntPipe) id: number, @Body() dto: RejectContractDto) {
    return this.contractsService.markRejected(id, dto.reason);
  }

  @Put(':id/expired')
  @UseGuards(WebhookSecretGuard)
  markExpired(@Param('id', ParseIntPipe) id: number, @Body() dto: ExpireContractDto) {
    return this.contractsService.markExpired(id, dto.reason);
  }
}

// Công khai: khách mở link trong email để xem và ký
@Controller('sign')
export class SignController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get(':token')
  getPublic(@Param('token') token: string) {
    return this.contractsService.getPublic(token);
  }

  @Post(':token')
  sign(@Param('token') token: string, @Body() dto: SignContractDto, @Ip() ip: string) {
    return this.contractsService.sign(token, dto, ip ?? '');
  }
}
