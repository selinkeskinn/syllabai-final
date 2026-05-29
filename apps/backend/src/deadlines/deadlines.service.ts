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

    const deadlines = await this.prisma.deadline.findMany({
      where: whereClause,
      include: {
        course: {
          select: { id: true, code: true, title: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
    const calendarDeadlines = await this.findCalendarDeadlines({
      courseId: whereClause.courseId,
    });

    return this.sortDeadlines([...deadlines, ...calendarDeadlines]);
  }

  /** Get all deadlines for an instructor's courses */
  async findForInstructor(userId: string, courseId?: string) {
    const whereClause: any = {
      course: { instructorId: userId },
    };

    if (courseId) {
      whereClause.courseId = courseId;
    }

    const deadlines = await this.prisma.deadline.findMany({
      where: whereClause,
      include: {
        course: {
          select: { id: true, code: true, title: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
    const calendarDeadlines = await this.findCalendarDeadlines({
      instructorId: userId,
      ...(courseId ? { courseId } : {}),
    });

    return this.sortDeadlines([...deadlines, ...calendarDeadlines]);
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

  private async findCalendarDeadlines(where: any) {
    const courses = await this.prisma.course.findMany({
      where: {
        archivedAt: null,
        ...where,
      },
      include: {
        syllabus: {
          include: {
            weeks: { orderBy: { weekNo: 'asc' } },
          },
        },
      },
    });

    return courses.flatMap((course) =>
      this.buildCalendarDeadlines(
        course.id,
        { id: course.id, code: course.code, title: course.title },
        course.syllabus?.weeks ?? [],
      ),
    );
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

    return {
      id: `calendar-${courseId}-week-${week.weekNo}-${event.type.toLowerCase()}`,
      courseId,
      title: event.title,
      description: `Automatically generated from Course Calendar week ${week.weekNo}.`,
      dueDate: this.getAcademicWeekDate(week.weekNo, event.type).toISOString(),
      type: event.type,
      createdAt: this.getAcademicWeekDate(week.weekNo, event.type),
      updatedAt: this.getAcademicWeekDate(week.weekNo, event.type),
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
