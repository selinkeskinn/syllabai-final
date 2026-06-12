import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './create-course.dto';
import { UpdateCourseDto } from './update-course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.course.findMany({
      where: { archivedAt: null },
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
    const course = await this.prisma.course.findFirst({
      where: { id, archivedAt: null },
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

    return {
      ...course,
      deadlines: this.sortDeadlines([
        ...course.deadlines,
        ...this.buildCalendarDeadlines(
          course.id,
          { id: course.id, code: course.code, title: course.title },
          course.syllabus?.weeks ?? [],
        ),
      ]),
    };
  }

  findByInstructor(instructorId: string) {
    return this.prisma.course.findMany({
      where: { instructorId, archivedAt: null },
      include: {
        syllabus: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
findArchivedByInstructor(instructorId: string) {
  return this.prisma.course.findMany({
    where: {
      instructorId,
      archivedAt: { not: null },
    },
    include: {
      syllabus: true,
      _count: { select: { enrollments: true } },
    },
    orderBy: { archivedAt: 'desc' },
  });
}


  async findEnrolled(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        course: { archivedAt: null },
      },
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
      where: { joinKey: normalizedJoinKey, archivedAt: null },
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
        description: data.description?.trim() || null,
        semester: data.semester,
        deliveryMethod: data.deliveryMethod || 'In-Person',
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

  async update(id: string, dto: UpdateCourseDto, instructorId: string) {
    const course = await this.findById(id);
    this.assertCourseOwner(course.instructorId, instructorId);

    return this.prisma.course.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, instructorId: string) {
    const course = await this.findById(id);
    this.assertCourseOwner(course.instructorId, instructorId);

    return this.prisma.course.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: {
        instructor: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  async leaveCourse(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId,
        courseId,
        course: { archivedAt: null },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    await this.prisma.enrollment.delete({
      where: { id: enrollment.id },
    });

    return {
      message: 'Left course successfully',
      courseId,
    };
  }

  private assertCourseOwner(ownerId: string, instructorId: string) {
    if (ownerId !== instructorId) {
      throw new ForbiddenException(
        'You can only manage your own courses',
      );
    }
  }

  private buildCalendarDeadlines(
    courseId: string,
    course: { id: string; code: string; title: string },
    weeks: Array<{
      weekNo: number;
      topic?: string | null;
      details?: string | null;
      todo?: string | null;
    }>,
  ) {
    return weeks
      .map((week) => this.buildCalendarDeadline(courseId, course, week))
      .filter((deadline): deadline is NonNullable<typeof deadline> =>
        Boolean(deadline),
      );
  }

  private buildCalendarDeadline(
    courseId: string,
    course: { id: string; code: string; title: string },
    week: {
      weekNo: number;
      topic?: string | null;
      details?: string | null;
      todo?: string | null;
    },
  ) {
    const text = [week.topic, week.details, week.todo]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const event = this.detectCalendarEvent(text);

    if (!event) {
      return null;
    }

    const dueDate = this.getAcademicWeekDate(week.weekNo, event.type);

    return {
      id: `calendar-${courseId}-week-${week.weekNo}-${event.type.toLowerCase()}`,
      courseId,
      title: event.title,
      description: `Automatically generated from Course Calendar week ${week.weekNo}.`,
      dueDate,
      type: event.type,
      createdAt: dueDate,
      updatedAt: dueDate,
      course,
      isCalendarGenerated: true,
      weekNo: week.weekNo,
    };
  }

  private detectCalendarEvent(text: string) {
    const normalized = text.toLowerCase();

    if (/\bfinal\b/.test(normalized)) {
      return { title: 'Final Exam Week', type: 'EXAM' as const };
    }

    if (/\bmidterm\b/.test(normalized)) {
      return { title: 'Midterm Exam Week', type: 'EXAM' as const };
    }

    if (/\bquiz\b/.test(normalized)) {
      return { title: 'Quiz', type: 'QUIZ' as const };
    }

    if (/\bproject\s+upload\b/.test(normalized) || /\bupload\s*#?\s*\d*/.test(normalized)) {
      return { title: 'Project Upload', type: 'PROJECT' as const };
    }

    return null;
  }

  private getAcademicWeekDate(weekNo: number, type: string) {
    const currentAcademicWeek = 8;
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    const day = base.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    base.setDate(base.getDate() + mondayOffset);
    base.setDate(base.getDate() + (weekNo - currentAcademicWeek) * 7 + 4);

    if (type === 'EXAM') {
      base.setHours(9, 0, 0, 0);
    } else {
      base.setHours(23, 59, 0, 0);
    }

    return base;
  }

  private sortDeadlines<T extends { dueDate?: Date | string | null }>(
    deadlines: T[],
  ) {
    return deadlines.sort((first, second) => {
      const firstTime = first.dueDate ? new Date(first.dueDate).getTime() : 0;
      const secondTime = second.dueDate ? new Date(second.dueDate).getTime() : 0;

      return firstTime - secondTime;
    });
  }
}
