import { Module } from '@nestjs/common';
import { SyllabiService } from './syllabi.service';
import { SyllabiController } from './syllabi.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ResourcesModule } from '../resources/resources.module';

@Module({
  imports: [PrismaModule, ResourcesModule],
  controllers: [SyllabiController],
  providers: [SyllabiService],
  exports: [SyllabiService],
})
export class SyllabiModule {}
