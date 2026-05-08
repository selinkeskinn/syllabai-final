import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSyllabusDto } from './create-syllabus.dto';
import { UpdateSyllabusDto } from './update-syllabus.dto';
import { CreateSyllabusWeekDto } from './create-syllabus-week.dto';
import { UpdateSyllabusWeekDto } from './update-syllabus-week.dto';
import { NotificationsService } from '../notifications/notifications.service';

type UploadedSyllabusFile = Pick<
  Express.Multer.File,
  'originalname' | 'mimetype' | 'size' | 'filename' | 'path'
>;

@Injectable()
export class SyllabiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  findAll() {
    return this.prisma.syllabus.findMany({
      include: {
        course: true,
        weeks: { orderBy: { weekNo: 'asc' } },
      },
    });
  }

  async findById(id: string) {
    const syllabus = await this.prisma.syllabus.findUnique({
      where: { id },
      include: {
        course: {
          include: {
            instructor: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        weeks: { orderBy: { weekNo: 'asc' } },
      },
    });
    if (!syllabus) throw new NotFoundException('Syllabus not found');
    return syllabus;
  }

  async findByCourseId(courseId: string) {
    const syllabus = await this.prisma.syllabus.findUnique({
      where: { courseId },
      include: {
        weeks: { orderBy: { weekNo: 'asc' } },
      },
    });
    if (!syllabus) {
      throw new NotFoundException('Syllabus not found for this course');
    }
    return syllabus;
  }

  create(data: CreateSyllabusDto) {
    return this.prisma.syllabus.create({
      data: {
        courseId: data.courseId,
        title: data.title,
        description: data.description,
        grading: data.grading,
        policies: data.policies,
        resources: data.resources,
      },
      include: {
        course: true,
      },
    });
  }

  async uploadDocument(courseId: string, file: UploadedSyllabusFile) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        syllabus: {
          include: {
            course: true,
            weeks: { orderBy: { weekNo: 'asc' } },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const uploadedAt = new Date();
    const existingSyllabus = course.syllabus;
    const documentData = {
      documentFileName: file.originalname,
      documentStoredFileName: file.filename,
      documentMimeType: file.mimetype,
      documentSizeKb: Math.max(1, Math.round(file.size / 1024)),
      documentUploadedAt: uploadedAt,
    };

    const savedSyllabus = existingSyllabus
      ? await this.prisma.syllabus.update({
          where: { id: existingSyllabus.id },
          data: documentData,
          include: {
            course: true,
            weeks: { orderBy: { weekNo: 'asc' } },
          },
        })
      : await this.prisma.syllabus.create({
          data: {
            courseId,
            title: `${course.code} Syllabus`,
            ...documentData,
          },
          include: {
            course: true,
            weeks: { orderBy: { weekNo: 'asc' } },
          },
        });

    await this.notifyEnrolledStudents(
      courseId,
      `A syllabus document for "${course.title}" has been uploaded`,
      'SYLLABUS_UPDATED',
    );

    return savedSyllabus;
  }

  async update(id: string, dto: UpdateSyllabusDto) {
    const existing = await this.findById(id);
    const existingWithStructuredFields = existing as typeof existing & {
      grading?: string | null;
      policies?: string | null;
      resources?: string | null;
      documentFileName?: string | null;
      documentStoredFileName?: string | null;
      documentMimeType?: string | null;
      documentSizeKb?: number | null;
      documentUploadedAt?: Date | null;
    };

    // Create a version snapshot before updating
    await this.prisma.syllabusVersion.create({
      data: {
        syllabusId: id,
        snapshot: {
          title: existing.title,
          description: existing.description,
          grading: existingWithStructuredFields.grading,
          policies: existingWithStructuredFields.policies,
          resources: existingWithStructuredFields.resources,
          documentFileName: existingWithStructuredFields.documentFileName,
          documentStoredFileName:
            existingWithStructuredFields.documentStoredFileName,
          documentMimeType: existingWithStructuredFields.documentMimeType,
          documentSizeKb: existingWithStructuredFields.documentSizeKb,
          documentUploadedAt: existingWithStructuredFields.documentUploadedAt,
          weeks: existing.weeks,
        },
      },
    });

    const updated = await this.prisma.syllabus.update({
      where: { id },
      data: dto,
      include: {
        course: true,
        weeks: { orderBy: { weekNo: 'asc' } },
      },
    });

    // Notify enrolled students
    await this.notifyEnrolledStudents(
      existing.courseId,
      `Syllabus for "${existing.course.title}" has been updated`,
      'SYLLABUS_UPDATED',
    );

    return updated;
  }

  async getVersions(syllabusId: string) {
    return this.prisma.syllabusVersion.findMany({
      where: { syllabusId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- Weeks ---

  findWeeks(syllabusId: string) {
    return this.prisma.syllabusWeek.findMany({
      where: { syllabusId },
      orderBy: { weekNo: 'asc' },
    });
  }

  createWeek(syllabusId: string, data: CreateSyllabusWeekDto) {
    return this.prisma.syllabusWeek.create({
      data: {
        syllabusId,
        weekNo: data.weekNo,
        topic: data.topic,
        details: data.details,
        todo: data.todo,
      },
    });
  }

  async updateWeek(weekId: string, dto: UpdateSyllabusWeekDto) {
    const week = await this.prisma.syllabusWeek.findUnique({
      where: { id: weekId },
    });
    if (!week) throw new NotFoundException('Week not found');

    const updated = await this.prisma.syllabusWeek.update({
      where: { id: weekId },
      data: dto,
    });

    // Get syllabus to find course for notification
    const syllabus = await this.prisma.syllabus.findUnique({
      where: { id: week.syllabusId },
      include: { course: true },
    });

    if (syllabus) {
      await this.notifyEnrolledStudents(
        syllabus.courseId,
        `Week ${updated.weekNo} of "${syllabus.course.title}" syllabus has been updated`,
        'SYLLABUS_UPDATED',
      );
    }

    return updated;
  }

  async deleteWeek(weekId: string) {
    const week = await this.prisma.syllabusWeek.findUnique({
      where: { id: weekId },
    });
    if (!week) throw new NotFoundException('Week not found');
    return this.prisma.syllabusWeek.delete({ where: { id: weekId } });
  }

  // --- Helpers ---

  private async notifyEnrolledStudents(
    courseId: string,
    message: string,
    type: 'SYLLABUS_UPDATED' | 'ANNOUNCEMENT',
  ) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId },
      select: { userId: true },
    });

    for (const enrollment of enrollments) {
      await this.notificationsService.create(
        enrollment.userId,
        'Syllabus Update',
        message,
        type,
      );
    }
  }
}
