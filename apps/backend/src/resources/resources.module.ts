import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
