import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatLog } from './chat-log.entity';
import { ChatLogsController } from './chat-logs.controller';
import { ChatLogsService } from './chat-logs.service';

@Module({ imports: [TypeOrmModule.forFeature([ChatLog])], controllers: [ChatLogsController], providers: [ChatLogsService], exports: [ChatLogsService] })
export class ChatLogsModule {}
