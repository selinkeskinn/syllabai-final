import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { SyllabiModule } from './syllabi/syllabi.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DeadlinesModule } from './deadlines/deadlines.module';
import { FeedbackModule } from './feedback/feedback.module';
import { AnnouncementsModule } from "./announcements/announcements.module";

@Module({
  imports: [
    AuthModule,
    UsersModule,
    CoursesModule,
    SyllabiModule,
    EnrollmentsModule,
    NotificationsModule,
    DeadlinesModule,
    FeedbackModule,
    AnnouncementsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
