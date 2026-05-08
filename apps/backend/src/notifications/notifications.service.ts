import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type NotificationType =
  | 'SYLLABUS_UPDATED'
  | 'ANNOUNCEMENT'
  | 'DEADLINE_REMINDER'
  | 'ENROLLMENT';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(
    userId: string,
    title: string,
    message: string,
    type: NotificationType = 'ANNOUNCEMENT',
  ) {
    const shouldCreate = await this.shouldCreateNotification(userId, type);

    if (!shouldCreate) {
      return null;
    }

    return this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type: type as any,
      },
    });
  }

  findByUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async delete(id: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id, userId },
    });
  }

  private async shouldCreateNotification(
    userId: string,
    type: NotificationType,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        courseAnnouncementsEnabled: true,
        deadlineAlertsEnabled: true,
        assignmentRemindersEnabled: true,
        gradeUpdatesEnabled: true,
      },
    });

    if (!user) {
      return false;
    }

    if (type === 'ANNOUNCEMENT') {
      return user.courseAnnouncementsEnabled;
    }

    if (type === 'DEADLINE_REMINDER') {
      return user.deadlineAlertsEnabled;
    }

    return true;
  }
}