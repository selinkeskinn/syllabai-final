import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateFeedbackDto, studentId: string) {
    await this.ensureStudentEnrollment(data.courseId, studentId);

    return this.prisma.feedback.create({
      data: {
        courseId: data.courseId,
        userId: data.isAnonymous ? null : studentId,
        rating: data.rating,
        tags: data.tags,
        comment: data.comment,
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

  async findAll(userId: string, role: string, courseId?: string) {
    if (role === 'INSTRUCTOR') {
      if (courseId) {
        await this.ensureCourseOwner(courseId, userId);
      }

      return this.prisma.feedback.findMany({
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

    return this.prisma.feedback.findMany({
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

  private async ensureStudentEnrollment(courseId: string, studentId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        courseId,
        userId: studentId,
      },
    });

    if (!enrollment) {
      throw new ForbiddenException(
        'You can only submit feedback for courses you are enrolled in',
      );
    }

    return enrollment;
  }

  private async ensureCourseOwner(courseId: string, instructorId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        instructorId: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.instructorId !== instructorId) {
      throw new ForbiddenException(
        'You can only view feedback for your own courses',
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
}