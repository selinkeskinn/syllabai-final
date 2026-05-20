import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiProviderService } from './ai-provider.service';
import { AiService } from './ai.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [AiController],
  providers: [AiService, AiProviderService],
  exports: [AiProviderService, AiService],
})
export class AiModule {}
