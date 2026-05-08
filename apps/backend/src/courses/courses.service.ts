import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './create-course.dto';
import { UpdateCourseDto } from './update-course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.course.findMany({
      include: {
        instructor: {
          select: { id: true, name: true, email: true, role: true },
        },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        instructor: {
          select: { id: true, name: true, email: true, role: true },
        },
        syllabus: {
          include: {
            weeks: { orderBy: { weekNo: 'asc' } },
          },
        },
        deadlines: { orderBy: { dueDate: 'asc' } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  findByInstructor(instructorId: string) {
    return this.prisma.course.findMany({
      where: { instructorId },
      include: {
        syllabus: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findEnrolled(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            instructor: {
              select: { id: true, name: true, email: true, role: true },
            },
            syllabus: true,
            _count: { select: { enrollments: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return enrollments.map((e) => ({
      enrollmentId: e.id,
      enrolledAt: e.createdAt,
      ...e.course,
    }));
  }

  async enrollByJoinKey(userId: string, joinKey: string) {
    const normalizedJoinKey = joinKey?.trim().toUpperCase();

    if (!normalizedJoinKey) {
      throw new BadRequestException('Course key is required');
    }

    const course = await this.prisma.course.findFirst({
      where: { joinKey: normalizedJoinKey },
      include: {
        instructor: {
          select: { id: true, name: true, email: true, role: true },
        },
        syllabus: true,
        _count: { select: { enrollments: true } },
      },
    });

    if (!course) {
      throw new NotFoundException('Invalid course key');
    }

    const existingEnrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId,
        courseId: course.id,
      },
    });

    if (existingEnrollment) {
      throw new ConflictException('You are already enrolled in this course');
    }

    await this.prisma.enrollment.create({
      data: {
        userId,
        courseId: course.id,
      },
    });

    return {
      message: 'Enrolled successfully',
      course,
    };
  }

  private async generateUniqueJoinKey(): Promise<string> {
    while (true) {
      const joinKey = randomBytes(3).toString('hex').toUpperCase();
      const existing = await this.prisma.course.findFirst({
        where: { joinKey },
      });
      if (!existing) return joinKey;
    }
  }

   async create(data: CreateCourseDto & { instructorId: string }) {
     const joinKey = await this.generateUniqueJoinKey();

     return this.prisma.course.create({
       data: {
         code: data.code,
         title: data.title,
         description: data.description,
         semester: data.semester,
         instructorId: data.instructorId,
         joinKey,
       },
       include: {
         instructor: {
           select: { id: true, name: true, email: true, role: true },
         },
       },
     });
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
       throw new ForbiddenException('You can only modify your own courses');
     }

     return course;
   }

   async update(id: string, dto: UpdateCourseDto, instructorId: string) {
     await this.ensureCourseOwner(id, instructorId);

     return this.prisma.course.update({
       where: { id },
       data: dto,
     });
   }

   async delete(id: string, instructorId: string) {
     await this.ensureCourseOwner(id, instructorId);

     return this.prisma.course.delete({
       where: { id },
     });
   }
 }