import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

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

    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId: data.courseId },
      select: { userId: true },
    });

    await Promise.all(
      enrollments.map((enrollment) =>
        this.notificationsService.create(
          enrollment.userId,
          'New Announcement',
          `New announcement in "${course.title}": ${announcement.title}`,
          'ANNOUNCEMENT',
        ),
      ),
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
        include: this.announcementInclude(),
      });
    }

    if (role === 'STUDENT') {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { userId },
        select: { courseId: true },
      });

      const enrolledCourseIds = enrollments.map((item) => item.courseId);

      if (courseId) {
        if (!enrolledCourseIds.includes(courseId)) {
          throw new ForbiddenException(
            'You can only view announcements for enrolled courses',
          );
        }

        return this.prisma.announcement.findMany({
          where: { courseId },
          orderBy: {
            createdAt: 'desc',
          },
          include: this.announcementInclude(),
        });
      }

      return this.prisma.announcement.findMany({
        where: {
          courseId: {
            in: enrolledCourseIds,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: this.announcementInclude(),
      });
    }

    throw new ForbiddenException('Unsupported user role');
  }

  async update(
    id: string,
    data: UpdateAnnouncementDto,
    instructorId: string,
  ) {
    await this.ensureAnnouncementOwner(id, instructorId);

    return this.prisma.announcement.update({
      where: { id },
      data: {
        title: data.title,
        content: data.content,
        type: data.type,
      },
      include: this.announcementInclude(),
    });
  }

  async delete(id: string, instructorId: string) {
    await this.ensureAnnouncementOwner(id, instructorId);

    return this.prisma.announcement.delete({
      where: { id },
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

  private async ensureAnnouncementOwner(
    announcementId: string,
    instructorId: string,
  ) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
      include: {
        course: {
          select: {
            id: true,
            instructorId: true,
          },
        },
      },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    if (announcement.course.instructorId !== instructorId) {
      throw new ForbiddenException(
        'You can only manage announcements for your own courses',
      );
    }

    return announcement;
  }

  private announcementInclude() {
    return {
      course: {
        select: {
          id: true,
          code: true,
          title: true,
        },
      },
    };
  }
}