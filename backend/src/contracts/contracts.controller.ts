import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import {
  CreateContractDto,
  DraftContractDto,
  ExpireContractDto,
  RejectContractDto,
  SignContractDto,
} from './dto/contract.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WebhookSecretGuard } from '../auth/webhook-secret.guard';
import type { AuthUser } from '../auth/auth.types';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  // --- Nhân viên, quản lý (đã đăng nhập) ---

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateContractDto, @Req() req: { user: AuthUser }) {
    return this.contractsService.create(dto, req.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.contractsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contractsService.findDetail(id);
  }

  // --- Chỉ quản lý ---

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER')
  approve(@Param('id', ParseIntPipe) id: number, @Req() req: { user: AuthUser }) {
    return this.contractsService.approve(id, req.user);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER')
  reject(@Param('id', ParseIntPipe) id: number, @Body() dto: RejectContractDto, @Req() req: { user: AuthUser }) {
    return this.contractsService.reject(id, dto.reason, req.user);
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
