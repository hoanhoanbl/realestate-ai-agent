import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { N8nService } from './n8n.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [N8nService],
  exports: [N8nService],
})
export class N8nModule {}
