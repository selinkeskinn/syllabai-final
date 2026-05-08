import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDeadlineDto } from './create-deadline.dto';
import { UpdateDeadlineDto } from './update-deadline.dto';

@Injectable()
export class DeadlinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findForStudent(userId: string, courseId?: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId },
      select: { courseId: true },
    });

    const enrolledCourseIds = enrollments.map((e) => e.courseId);

    const whereClause: any = {
      courseId: { in: enrolledCourseIds },
    };

    if (courseId) {
      if (!enrolledCourseIds.includes(courseId)) {
        throw new ForbiddenException('You are not enrolled in this course');
      }

      whereClause.courseId = courseId;
    }

    return this.prisma.deadline.findMany({
      where: whereClause,
      include: {
        course: {
          select: { id: true, code: true, title: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async findForInstructor(userId: string, courseId?: string) {
    if (courseId) {
      await this.ensureCourseOwner(courseId, userId);
    }

    return this.prisma.deadline.findMany({
      where: {
        courseId,
        course: { instructorId: userId },
      },
      include: {
        course: {
          select: { id: true, code: true, title: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async findById(id: string) {
    const deadline = await this.prisma.deadline.findUnique({
      where: { id },
      include: {
        course: {
          select: { id: true, code: true, title: true, instructorId: true },
        },
      },
    });

    if (!deadline) {
      throw new NotFoundException('Deadline not found');
    }

    return deadline;
  }

  async create(dto: CreateDeadlineDto, instructorId: string) {
    const course = await this.ensureCourseOwner(dto.courseId, instructorId);

    const deadline = await this.prisma.deadline.create({
      data: {
        courseId: dto.courseId,
        title: dto.title,
        description: dto.description,
        dueDate: new Date(dto.dueDate),
        type: (dto.type as any) ?? 'ASSIGNMENT',
      },
      include: {
        course: {
          select: { id: true, code: true, title: true },
        },
      },
    });

    await this.notifyEnrolledStudents(
      dto.courseId,
      'New Deadline',
      `New deadline in "${course.title}": ${deadline.title}`,
      'DEADLINE_REMINDER',
    );

    return deadline;
  }

  async update(id: string, dto: UpdateDeadlineDto, instructorId: string) {
    await this.ensureDeadlineOwner(id, instructorId);

    const data: any = { ...dto };

    if (dto.dueDate) {
      data.dueDate = new Date(dto.dueDate);
    }

    return this.prisma.deadline.update({
      where: { id },
      data,
      include: {
        course: {
          select: { id: true, code: true, title: true },
        },
      },
    });
  }

  async delete(id: string, instructorId: string) {
    await this.ensureDeadlineOwner(id, instructorId);

    return this.prisma.deadline.delete({
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
        'You can only manage deadlines for your own courses',
      );
    }

    return course;
  }

  private async ensureDeadlineOwner(deadlineId: string, instructorId: string) {
    const deadline = await this.prisma.deadline.findUnique({
      where: { id: deadlineId },
      include: {
        course: {
          select: {
            id: true,
            instructorId: true,
          },
        },
      },
    });

    if (!deadline) {
      throw new NotFoundException('Deadline not found');
    }

    if (deadline.course.instructorId !== instructorId) {
      throw new ForbiddenException(
        'You can only manage deadlines for your own courses',
      );
    }

    return deadline;
  }

  private async notifyEnrolledStudents(
    courseId: string,
    title: string,
    message: string,
    type: 'DEADLINE_REMINDER',
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