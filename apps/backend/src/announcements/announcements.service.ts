import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(data: CreateAnnouncementDto, instructorId: string) {
    const course = await this.ensureCourseOwner(data.courseId, instructorId);

    const announcement = await this.prisma.announcement.create({
      data: {
        courseId: data.courseId,
        title: data.title,
        content: data.content,
        type: data.type ?? 'INFO',
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
      },
    });

    await this.notifyEnrolledStudents(
      data.courseId,
      'New Announcement',
      `New announcement in "${course.title}": ${announcement.title}`,
      'ANNOUNCEMENT',
    );

    return announcement;
  }

  async findAll(userId: string, role: string, courseId?: string) {
    if (role === 'INSTRUCTOR') {
      if (courseId) {
        await this.ensureCourseOwner(courseId, userId);
      }

      return this.prisma.announcement.findMany({
        where: {
          courseId,
          course: {
            instructorId: userId,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          course: {
            select: {
              id: true,
              code: true,
              title: true,
            },
          },
        },
      });
    }

    const enrolledCourseIds = await this.getEnrolledCourseIds(userId);

    if (courseId && !enrolledCourseIds.includes(courseId)) {
      throw new ForbiddenException('You are not enrolled in this course');
    }

    return this.prisma.announcement.findMany({
      where: {
        courseId: courseId ?? { in: enrolledCourseIds },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
      },
    });
  }

  private async ensureCourseOwner(courseId: string, instructorId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        instructorId: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.instructorId !== instructorId) {
      throw new ForbiddenException(
        'You can only manage announcements for your own courses',
      );
    }

    return course;
  }

  private async getEnrolledCourseIds(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId },
      select: { courseId: true },
    });

    return enrollments.map((enrollment) => enrollment.courseId);
  }

  private async notifyEnrolledStudents(
    courseId: string,
    title: string,
    message: string,
    type: 'ANNOUNCEMENT',
  ) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId },
      select: { userId: true },
    });

    for (const enrollment of enrollments) {
      await this.notificationsService.create(
        enrollment.userId,
        title,
        message,
        type,
      );
    }
  }
}