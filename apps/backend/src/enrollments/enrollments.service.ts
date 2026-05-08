import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnrollmentDto } from './create-enrollment.dto';
import { JoinCourseDto } from './join-course.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  findAll() {
    return this.prisma.enrollment.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
        course: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByUser(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            instructor: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: CreateEnrollmentDto) {
    return this.prisma.enrollment.create({
      data: {
        user: { connect: { id: data.userId } },
        course: { connect: { id: data.courseId } },
      },
    });
  }

  async joinWithKey(data: JoinCourseDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if ((user.role as string).toUpperCase() !== 'STUDENT') {
      throw new BadRequestException('Only students can join courses');
    }

    const normalizedJoinKey = data.joinKey.trim().toUpperCase();

    const course = await this.prisma.course.findFirst({
      where: { joinKey: normalizedJoinKey },
    });

    if (!course) {
      throw new NotFoundException('Course not found with this join key');
    }

    try {
      const enrollment = await this.prisma.enrollment.create({
        data: {
          user: { connect: { id: data.userId } },
          course: { connect: { id: course.id } },
        },
        include: {
          course: true,
        },
      });

      // Notify the student
      await this.notificationsService.create(
        data.userId,
        'Enrollment Successful',
        `You have been enrolled in "${course.title}" (${course.code})`,
        'ENROLLMENT',
      );

      return enrollment;
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Student is already enrolled in this course');
      }
      throw error;
    }
  }
}
