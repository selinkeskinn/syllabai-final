import { Module } from '@nestjs/common';
import { ResourcesModule } from '../resources/resources.module';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  imports: [ResourcesModule],
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}
