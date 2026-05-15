import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';
import { AskResponseDto } from './dto/ask-response.dto';
import { ChatDto } from './dto/chat.dto';

type CourseSyllabusSummary = {
  courseSummary: string;
  gradingItems: Array<{
    label: string;
    value: string;
    description: string;
  }>;
  policies: string[];
  resources: string[];
  weeklyTopics: Array<{
    weekNo: number | null;
    topic: string;
    details: string;
    todo: string;
  }>;
  importantDates: string[];
  officeHours: string;
  sourceCount: number;
};

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: AiProviderService,
  ) {}

  async askCourseQuestion(
    userId: string,
    role: string,
    courseId: string,
    rawQuestion: string,
  ): Promise<AskResponseDto> {
    const question = rawQuestion.trim();

    if (!question) {
      throw new BadRequestException('Question is required');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        code: true,
        title: true,
        instructorId: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    await this.ensureCourseAccess(userId, role, course.id, course.instructorId);

    const readyResourceCount = await this.prisma.courseResource.count({
      where: {
        courseId,
        status: 'READY',
      },
    });

    if (readyResourceCount === 0) {
      throw new BadRequestException(
        'No indexed AI resources are ready for this course.',
      );
    }

    const questionEmbedding = await this.aiProvider.createEmbedding(question);
    const candidates = await this.prisma.resourceChunk.findMany({
      where: {
        courseId,
        resource: {
          status: 'READY',
        },
      },
      include: {
        resource: {
          select: {
            id: true,
            originalName: true,
          },
        },
      },
    });

    const topK = Number(process.env.AI_TOP_K ?? 5);
    const matches = candidates
      .map((chunk) => ({
        ...chunk,
        score:
          this.cosineSimilarity(questionEmbedding, chunk.embedding) +
          this.keywordBoost(question, chunk.content),
      }))
      .filter((chunk) => Number.isFinite(chunk.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    if (!matches.length) {
      throw new BadRequestException(
        'No searchable chunks were found for this course.',
      );
    }

    const context = matches
      .map((match, index) => {
        const page = match.pageNumber ? `page ${match.pageNumber}` : 'page unknown';
        return `[Source ${index + 1}: ${match.resource.originalName}, ${page}]\n${match.content}`;
      })
      .join('\n\n');

    const answer = await this.generateRagAnswer(question, context);
    const sources = matches.map((match) => ({
      resourceId: match.resource.id,
      resourceName: match.resource.originalName,
      pageNumber: match.pageNumber,
      contentPreview: this.preview(match.content),
      score: Number(match.score.toFixed(4)),
    }));

    return {
      answer,
      courseId: course.id,
      mode: 'rag',
      sourceCount: sources.length,
      sources,
    };
  }

  async generateCourseSyllabusSummary(
    userId: string,
    role: string,
    courseId: string,
  ): Promise<CourseSyllabusSummary> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        code: true,
        title: true,
        instructorId: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    await this.ensureCourseAccess(userId, role, course.id, course.instructorId);

    const chunks = await this.prisma.resourceChunk.findMany({
      where: {
        courseId,
        resource: {
          status: 'READY',
        },
      },
      orderBy: [{ resourceId: 'asc' }, { chunkIndex: 'asc' }],
      include: {
        resource: {
          select: {
            originalName: true,
          },
        },
      },
    });

    if (!chunks.length) {
      throw new BadRequestException(
        'No indexed AI resources are ready for this course.',
      );
    }

    const context = this.buildSummaryContext(chunks);
    const systemPrompt =
      'You extract structured syllabus information from course PDF text. ' +
      'Return only valid JSON. Do not wrap it in markdown. If a field is missing, use an empty string or empty array.';

    const userPrompt = `
Course: ${course.code} - ${course.title}

Return this exact JSON shape:
{
  "courseSummary": "short course overview from the PDF",
  "gradingItems": [
    {"label": "Midterm", "value": "30%", "description": "short description"}
  ],
  "policies": ["policy item"],
  "resources": ["resource item"],
  "weeklyTopics": [
    {"weekNo": 1, "topic": "topic", "details": "details", "todo": "reading/homework if present"}
  ],
  "importantDates": ["date or deadline item"],
  "officeHours": "office hour information if present"
}

PDF text:
${context}`;

    try {
      const rawAnswer = await this.aiProvider.createAnswer([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);
      const normalized = this.normalizeSummary(rawAnswer);
      const fallback = this.fallbackSummaryFromChunks(chunks);

      return {
        courseSummary: normalized.courseSummary || fallback.courseSummary,
        gradingItems: normalized.gradingItems.length
          ? normalized.gradingItems
          : fallback.gradingItems,
        policies: normalized.policies.length
          ? normalized.policies
          : fallback.policies,
        resources: normalized.resources.length
          ? normalized.resources
          : fallback.resources,
        weeklyTopics: normalized.weeklyTopics.length
          ? normalized.weeklyTopics
          : fallback.weeklyTopics,
        importantDates: normalized.importantDates.length
          ? normalized.importantDates
          : fallback.importantDates,
        officeHours: normalized.officeHours || fallback.officeHours,
        sourceCount: chunks.length,
      };
    } catch {
      return {
        ...this.fallbackSummaryFromChunks(chunks),
        sourceCount: chunks.length,
      };
    }
  }

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

  private async generateRagAnswer(question: string, context: string) {
    const systemPrompt =
      'You are a course assistant. Answer only from the provided course document context. ' +
      'If the context does not contain the answer, say that the uploaded course documents do not include enough information. ' +
      'If the user asks about grading, prioritize grading components, percentages, exams, assignments, projects, quizzes, relative grading rules, and evaluation rules. If no percentages or components exist, state only the available grading rule. ' +
      'Keep the answer concise and mention that it is based on the uploaded sources.';

    try {
      return await this.aiProvider.createAnswer([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Question:\n${question}\n\nCourse document context:\n${context}`,
        },
      ]);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return (
          'I found relevant source material, but the AI answer provider is not reachable. ' +
          `Closest source context:\n${this.preview(context, 1200)}`
        );
      }

      throw error;
    }
  }

  private buildSummaryContext(
    chunks: Array<{
      content: string;
      pageNumber: number | null;
      resource: { originalName: string };
    }>,
  ) {
    const maxChars = 18000;
    let context = '';

    for (const chunk of chunks) {
      const page = chunk.pageNumber ? `page ${chunk.pageNumber}` : 'page unknown';
      const next = `[${chunk.resource.originalName}, ${page}]\n${chunk.content}\n\n`;

      if (context.length + next.length > maxChars) {
        break;
      }

      context += next;
    }

    return context.trim();
  }

  private normalizeSummary(rawAnswer: string) {
    const jsonText = this.extractJsonObject(rawAnswer);
    const parsed = JSON.parse(jsonText) as Partial<CourseSyllabusSummary>;

    return {
      courseSummary: this.asString(parsed.courseSummary),
      gradingItems: Array.isArray(parsed.gradingItems)
        ? parsed.gradingItems.map((item) => ({
            label: this.asString(item?.label),
            value: this.asString(item?.value),
            description: this.asString(item?.description),
          }))
        : [],
      policies: this.asStringArray(parsed.policies),
      resources: this.asStringArray(parsed.resources),
      weeklyTopics: Array.isArray(parsed.weeklyTopics)
        ? parsed.weeklyTopics.map((item) => ({
            weekNo:
              typeof item?.weekNo === 'number' && Number.isFinite(item.weekNo)
                ? item.weekNo
                : null,
            topic: this.asString(item?.topic),
            details: this.asString(item?.details),
            todo: this.asString(item?.todo),
          }))
        : [],
      importantDates: this.asStringArray(parsed.importantDates),
      officeHours: this.asString(parsed.officeHours),
    };
  }

  private fallbackSummaryFromChunks(
    chunks: Array<{
      content: string;
      pageNumber: number | null;
      resource: { originalName: string };
    }>,
  ) {
    const text = chunks
      .map((chunk) => chunk.content)
      .join('\n')
      .replace(/\s+/g, ' ')
      .trim();

    const gradingMatches = Array.from(
      text.matchAll(
        /([A-Za-z][A-Za-z\s/&-]{2,40})[:\s-]+(\d+(?:\.\d+)?\s*%)/g,
      ),
    )
      .slice(0, 8)
      .map((match) => ({
        label: match[1].trim(),
        value: match[2].trim(),
        description: 'Extracted from uploaded PDF text',
      }));
    const gradingSentences = this.extractSentences(text, [
      'grading',
      'grade',
      'assessment',
      'evaluation',
    ]);
    const gradingItems = gradingMatches.length
      ? gradingMatches
      : gradingSentences.slice(0, 4).map((sentence, index) => ({
          label: index === 0 ? 'Grading policy' : `Grading note ${index + 1}`,
          value: 'See policy',
          description: sentence,
        }));
    const resourceNames = Array.from(
      new Set(
        chunks.map((chunk) => `Uploaded PDF: ${chunk.resource.originalName}`),
      ),
    );
    const extractedResources = this.extractSentences(text, [
      'textbook',
      'resource',
      'reading',
      'slides',
      'book',
    ]);

    return {
      courseSummary: this.preview(text, 700),
      gradingItems,
      policies: this.extractSentences(text, [
        'attendance',
        'policy',
        'late',
        'academic',
        'integrity',
        'plagiarism',
      ]),
      resources: extractedResources.length ? extractedResources : resourceNames,
      weeklyTopics: this.extractWeeklyTopics(text),
      importantDates: this.extractSentences(text, [
        'due',
        'deadline',
        'exam',
        'final',
        'midterm',
        'project',
      ]),
      officeHours:
        this.extractSentences(text, ['office hour', 'office hours'])[0] ?? '',
    };
  }

  private extractJsonObject(value: string) {
    const first = value.indexOf('{');
    const last = value.lastIndexOf('}');

    if (first === -1 || last === -1 || last <= first) {
      throw new BadRequestException('AI summary response was not valid JSON.');
    }

    return value.slice(first, last + 1);
  }

  private asString(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private asStringArray(value: unknown) {
    return Array.isArray(value)
      ? value
          .map((item) => this.asString(item))
          .filter((item) => item.length > 0)
      : [];
  }

  private extractSentences(text: string, keywords: string[]) {
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    return sentences
      .filter((sentence) =>
        keywords.some((keyword) =>
          sentence.toLowerCase().includes(keyword.toLowerCase()),
        ),
      )
      .slice(0, 8);
  }

  private extractWeeklyTopics(text: string) {
    const matches = Array.from(
      text.matchAll(/week\s*(\d{1,2})\s*[:.-]?\s*([^.;\n]{5,120})/gi),
    );

    return matches.slice(0, 16).map((match) => ({
      weekNo: Number(match[1]),
      topic: match[2].trim(),
      details: '',
      todo: '',
    }));
  }

  private keywordBoost(question: string, content: string) {
    const normalizedQuestion = question.toLowerCase();
    const normalizedContent = content.toLowerCase();
    const groups = [
      {
        triggers: ['grading', 'grade', 'policy', 'assessment', 'percentage'],
        keywords: [
          'grading',
          'grade',
          'assessment',
          'evaluation',
          'midterm',
          'final',
          'quiz',
          'project',
          'assignment',
          '%',
          'percent',
          'relative grading',
        ],
      },
      {
        triggers: ['week', 'topic', 'schedule'],
        keywords: ['week', 'topic', 'schedule', 'lecture', 'module'],
      },
      {
        triggers: ['resource', 'textbook', 'book', 'reading'],
        keywords: ['resource', 'textbook', 'book', 'reading', 'slides'],
      },
      {
        triggers: ['office', 'hour', 'contact'],
        keywords: ['office hour', 'office hours', 'contact', 'email'],
      },
    ];

    return groups.reduce((score, group) => {
      const isRelevant = group.triggers.some((trigger) =>
        normalizedQuestion.includes(trigger),
      );

      if (!isRelevant) {
        return score;
      }

      const hits = group.keywords.filter((keyword) =>
        normalizedContent.includes(keyword),
      ).length;

      return score + Math.min(hits * 0.08, 0.4);
    }, 0);
  }

  private cosineSimilarity(first: number[], second: number[]) {
    if (!first.length || first.length !== second.length) {
      return Number.NEGATIVE_INFINITY;
    }

    let dot = 0;
    let firstMagnitude = 0;
    let secondMagnitude = 0;

    for (let index = 0; index < first.length; index += 1) {
      dot += first[index] * second[index];
      firstMagnitude += first[index] * first[index];
      secondMagnitude += second[index] * second[index];
    }

    if (!firstMagnitude || !secondMagnitude) {
      return Number.NEGATIVE_INFINITY;
    }

    return dot / (Math.sqrt(firstMagnitude) * Math.sqrt(secondMagnitude));
  }

  private preview(content: string, maxLength = 220) {
    const normalized = content.replace(/\s+/g, ' ').trim();
    return normalized.length > maxLength
      ? `${normalized.slice(0, maxLength).trim()}...`
      : normalized;
  }
}
