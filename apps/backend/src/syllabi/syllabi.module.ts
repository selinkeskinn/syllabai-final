import { Module } from '@nestjs/common';
import { SyllabiService } from './syllabi.service';
import { SyllabiController } from './syllabi.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SyllabiController],
  providers: [SyllabiService],
  exports: [SyllabiService],
})
export class SyllabiModule {}