import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatDto } from './dto/chat.dto';

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  async chat(userId: string, role: string, dto: ChatDto) {
    const question = dto.question.trim();

    if (!question) {
      throw new BadRequestException('Question is required');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      include: {
        syllabus: {
          include: {
            weeks: {
              orderBy: { weekNo: 'asc' },
            },
          },
        },
        deadlines: {
          orderBy: { dueDate: 'asc' },
        },
        announcements: {
          orderBy: { createdAt: 'desc' },
        },
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    await this.ensureCourseAccess(userId, role, course.id, course.instructorId);

    const answer = this.generateContextBasedAnswer(question, course);

    return {
      answer,
      courseId: course.id,
      courseCode: course.code,
      courseTitle: course.title,
      mode: 'context_based_mock',
      note:
        'This endpoint prepares course, syllabus, deadline, and announcement context for AI. Real model/RAG integration can be connected inside AiService.',
      sources: {
        course: true,
        syllabus: Boolean(course.syllabus),
        weeks: course.syllabus?.weeks.length ?? 0,
        deadlines: course.deadlines.length,
        announcements: course.announcements.length,
      },
    };
  }

  private async ensureCourseAccess(
    userId: string,
    role: string,
    courseId: string,
    instructorId: string,
  ) {
    if (role === 'INSTRUCTOR') {
      if (instructorId !== userId) {
        throw new ForbiddenException(
          'You can only ask AI about your own courses',
        );
      }

      return;
    }

    if (role === 'STUDENT') {
      const enrollment = await this.prisma.enrollment.findFirst({
        where: {
          userId,
          courseId,
        },
      });

      if (!enrollment) {
        throw new ForbiddenException(
          'You can only ask AI about courses you are enrolled in',
        );
      }

      return;
    }

    throw new ForbiddenException('Unsupported user role');
  }

  private generateContextBasedAnswer(question: string, course: any) {
    const normalizedQuestion = question.toLowerCase();

    if (
      normalizedQuestion.includes('deadline') ||
      normalizedQuestion.includes('due') ||
      normalizedQuestion.includes('assignment') ||
      normalizedQuestion.includes('exam') ||
      normalizedQuestion.includes('quiz') ||
      normalizedQuestion.includes('project')
    ) {
      return this.answerDeadlines(course);
    }

    if (
      normalizedQuestion.includes('week') ||
      normalizedQuestion.includes('topic') ||
      normalizedQuestion.includes('schedule') ||
      normalizedQuestion.includes('covered')
    ) {
      return this.answerWeeks(course);
    }

    if (
      normalizedQuestion.includes('announcement') ||
      normalizedQuestion.includes('notice') ||
      normalizedQuestion.includes('update')
    ) {
      return this.answerAnnouncements(course);
    }

    if (
      normalizedQuestion.includes('grading') ||
      normalizedQuestion.includes('policy') ||
      normalizedQuestion.includes('policies') ||
      normalizedQuestion.includes('resource') ||
      normalizedQuestion.includes('syllabus')
    ) {
      return this.answerSyllabus(course);
    }

    return this.answerGeneral(course);
  }

  private answerDeadlines(course: any) {
    if (!course.deadlines.length) {
      return `I could not find any deadlines recorded for ${course.code} - ${course.title}.`;
    }

    const deadlineText = course.deadlines
      .map((deadline) => {
        const dueDate = new Date(deadline.dueDate).toISOString().slice(0, 10);
        return `- ${deadline.title} (${deadline.type}) is due on ${dueDate}`;
      })
      .join('\n');

    return `Here are the deadlines I found for ${course.code} - ${course.title}:\n${deadlineText}`;
  }

  private answerWeeks(course: any) {
    const weeks = course.syllabus?.weeks ?? [];

    if (!weeks.length) {
      return `I could not find weekly syllabus topics for ${course.code} - ${course.title}.`;
    }

    const weekText = weeks
      .map((week) => {
        const details = week.details ? ` - ${week.details}` : '';
        return `- Week ${week.weekNo}: ${week.topic}${details}`;
      })
      .join('\n');

    return `Here is the weekly syllabus plan for ${course.code} - ${course.title}:\n${weekText}`;
  }

  private answerAnnouncements(course: any) {
    if (!course.announcements.length) {
      return `I could not find any announcements for ${course.code} - ${course.title}.`;
    }

    const announcementText = course.announcements
      .slice(0, 5)
      .map((announcement) => {
        const createdAt = new Date(announcement.createdAt)
          .toISOString()
          .slice(0, 10);
        return `- ${announcement.title} (${createdAt}): ${announcement.content}`;
      })
      .join('\n');

    return `Here are the latest announcements for ${course.code} - ${course.title}:\n${announcementText}`;
  }

  private answerSyllabus(course: any) {
    if (!course.syllabus) {
      return `I could not find a syllabus record for ${course.code} - ${course.title}.`;
    }

    const syllabusParts = [
      course.syllabus.description
        ? `Description: ${course.syllabus.description}`
        : null,
      course.syllabus.grading ? `Grading: ${course.syllabus.grading}` : null,
      course.syllabus.policies ? `Policies: ${course.syllabus.policies}` : null,
      course.syllabus.resources
        ? `Resources: ${course.syllabus.resources}`
        : null,
    ].filter(Boolean);

    if (!syllabusParts.length) {
      return `A syllabus exists for ${course.code} - ${course.title}, but detailed syllabus text has not been added yet.`;
    }

    return `Here is the syllabus information I found for ${course.code} - ${course.title}:\n${syllabusParts.join('\n')}`;
  }

  private answerGeneral(course: any) {
    return (
      `I can help with questions about ${course.code} - ${course.title} using the available syllabus, weekly topics, deadlines, and announcements. ` +
      `Please ask about course deadlines, weekly topics, announcements, grading, policies, or resources.`
    );
  }
}
