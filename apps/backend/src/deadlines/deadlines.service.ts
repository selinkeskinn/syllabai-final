import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeadlineDto } from './create-deadline.dto';
import { UpdateDeadlineDto } from './update-deadline.dto';

@Injectable()
export class DeadlinesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Get all deadlines for a student's enrolled courses */
  async findForStudent(userId: string, courseId?: string) {
    // Get enrolled course IDs
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId },
      select: { courseId: true },
    });
    const enrolledCourseIds = enrollments.map((e) => e.courseId);

    const whereClause: any = {
      courseId: { in: enrolledCourseIds },
    };

    if (courseId) {
      // Verify student is enrolled in requested course
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

  /** Get all deadlines for an instructor's courses */
  async findForInstructor(userId: string, courseId?: string) {
    const whereClause: any = {
      course: { instructorId: userId },
    };

    if (courseId) {
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

  async findById(id: string) {
    const deadline = await this.prisma.deadline.findUnique({
      where: { id },
      include: {
        course: {
          select: { id: true, code: true, title: true, instructorId: true },
        },
      },
    });
    if (!deadline) throw new NotFoundException('Deadline not found');
    return deadline;
  }

  async create(dto: CreateDeadlineDto, instructorId: string) {
    await this.ensureCourseOwner(dto.courseId, instructorId);

    return this.prisma.deadline.create({
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
  }

  async update(id: string, dto: UpdateDeadlineDto, instructorId: string) {
    const deadline = await this.findById(id);
    this.assertCourseOwner(deadline.course.instructorId, instructorId);

    const data: any = { ...dto };
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
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
    const deadline = await this.findById(id);
    this.assertCourseOwner(deadline.course.instructorId, instructorId);

    return this.prisma.deadline.delete({ where: { id } });
  }

  private async ensureCourseOwner(courseId: string, instructorId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { instructorId: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    this.assertCourseOwner(course.instructorId, instructorId);
  }

  private assertCourseOwner(ownerId: string, instructorId: string) {
    if (ownerId !== instructorId) {
      throw new ForbiddenException(
        'You can only manage deadlines for your own courses',
      );
    }
  }
}
