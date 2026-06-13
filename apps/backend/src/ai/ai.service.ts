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
import { InstructorAdviceType } from './dto/ask-question.dto';
import { ChatDto } from './dto/chat.dto';

type CourseSyllabusSummary = {
  courseSummary: string;
  instructorInfo: {
    office: string;
    officeHours: string;
    cvLink: string;
  };
  courseInfo: {
    credits: string;
    classSchedule: string;
    classroom: string;
    courseType: string;
    prerequisites: string;
    courseObjectives: string;
  };
  policySections: {
    communication: string;
    aiDigitalTools: string;
    deadlines: string;
    attendance: string;
    disabledStudentSupport: string;
    communicationEthics: string;
    privacyCopyright: string;
    academicIntegrity: string;
  };
  moreInfo: {
    learningOutcomes: string[];
    contributionToProgram: string;
    courseStructure: string;
    teachingMethods: string[];
  };
  gradingItems: Array<{
    label: string;
    value: string;
    description: string;
  }>;
  policies: string[];
  resources: string[];
  weeklyTopics: Array<{
    weekNo: number | null;
    place?: string;
    topic: string;
    details: string;
    todo: string;
  }>;
  importantDates: string[];
  officeHours: string;
  sourceCount: number;
};

const CURRENT_ACADEMIC_WEEK = 8;

@Injectable()
export class AiService {
  private readonly syllabusSummaryCache = new Map<
    string,
    { fingerprint: string; summary: CourseSyllabusSummary }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: AiProviderService,
  ) {}

  async askCourseQuestion(
    userId: string,
    role: string,
    courseId: string,
    rawQuestion: string,
    adviceType?: InstructorAdviceType,
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

    if (adviceType && role !== 'INSTRUCTOR') {
      throw new ForbiddenException('Instructor advice is only available to instructors');
    }

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

    const questionEmbedding = await this.withTimeout(
      this.aiProvider.createEmbedding(question),
      10000,
      'AI embedding timed out',
    );
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

    const fullCourseText = [...candidates]
      .sort((a, b) => {
        const resourceCompare = a.resourceId.localeCompare(b.resourceId);

        if (resourceCompare !== 0) return resourceCompare;

        return a.chunkIndex - b.chunkIndex;
      })
      .map((chunk) => chunk.content)
      .join('\n');
    const deterministicAnswer = adviceType
      ? null
      : this.generateDeterministicRagAnswer(question, fullCourseText);
    const answer =
      deterministicAnswer ??
      (adviceType
        ? await this.generateInstructorAdvice(
            adviceType,
            question,
            fullCourseText,
            context,
          )
        : await this.generateRagAnswer(question, context, role));
    const sourceMatches = deterministicAnswer
      ? [...matches].sort(
          (a, b) =>
            this.answerSourceBoost(question, b.content) -
            this.answerSourceBoost(question, a.content),
        )
      : matches;
    const sources = sourceMatches.map((match) => ({
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

    const fingerprint = this.buildSummaryFingerprint(chunks);
    const cached = this.syllabusSummaryCache.get(course.id);

    if (cached?.fingerprint === fingerprint) {
      return cached.summary;
    }

    const context = this.buildSummaryContext(chunks);
    const systemPrompt =
      'You extract structured information from a university syllabus PDF. ' +
      'Return only valid JSON. Do not wrap it in markdown. If a field is missing, use an empty string or empty array. ' +
      'Do not invent values. Do not extract semester/period, course code, course name, instructor name, instructor email, or delivery method; those are managed by the application.';

    const userPrompt = `
Course: ${course.code} - ${course.title}

Return this exact JSON shape:
{
  "courseSummary": "short course overview from the PDF",
  "instructorInfo": {
    "office": "D545",
    "officeHours": "Tuesday 12:30-13:30",
    "cvLink": "https://..."
  },
  "courseInfo": {
    "credits": "3/7",
    "classSchedule": "Wednesday 08:30",
    "classroom": "Check UMIS",
    "courseType": "Must",
    "prerequisites": "exact Prerequisite section text from the PDF",
    "courseObjectives": "course objectives paragraph"
  },
  "policySections": {
    "communication": "Communication Channels and Methods section text",
    "aiDigitalTools": "Usage of AI & Digital Tools / Usage of Digital Tools section text",
    "deadlines": "Deadlines / Assignments and Project Deadline section text",
    "attendance": "Attendance section text",
    "disabledStudentSupport": "Disabled Student Support section text",
    "communicationEthics": "Oral and Written Communication Ethics section text",
    "privacyCopyright": "Privacy and Copyright section text",
    "academicIntegrity": "Academic Integrity, Cheating and Plagiarism section text"
  },
  "moreInfo": {
    "learningOutcomes": ["one learning outcome"],
    "contributionToProgram": "exact Contribution of the Course to the Program section text only when that heading exists in the PDF; otherwise return an empty string",
    "courseStructure": "Course Structure section text",
    "teachingMethods": ["Lecture", "Project"]
  },
  "gradingItems": [
    {"label": "Midterm", "value": "30%", "description": "short description"}
  ],
  "policies": ["policy item"],
  "resources": ["resource item"],
  "weeklyTopics": [
    {"weekNo": 1, "place": "F2F / ONLINE / Hybrid if present", "topic": "topic", "details": "assignment/deadline if present", "todo": "reading/homework if present"}
  ],
  "importantDates": ["date or deadline item"],
  "officeHours": "office hour information if present"
}

Important: Course Calendar is usually a 15-week table in this syllabus format. Return weeklyTopics entries for W1 through W15 when a Course Calendar table exists. Do not invent W16; the application adds the final exam week when W1-W15 are present.

PDF text:
${context}`;

    try {
      const rawAnswer = await this.withTimeout(
        this.aiProvider.createAnswer([
          {
            role: 'system',
            content: this.buildRagSystemPrompt(role, systemPrompt),
          },
          { role: 'user', content: userPrompt },
        ]),
        12000,
        'AI syllabus summary timed out',
      );
      const normalized = this.normalizeSummary(rawAnswer);
      const fallback = this.fallbackSummaryFromChunks(chunks);

      const summary = {
        courseSummary: normalized.courseSummary || fallback.courseSummary,
        instructorInfo: this.mergeInstructorInfo(
          normalized.instructorInfo,
          fallback.instructorInfo,
        ),
        courseInfo: this.mergeCourseInfo(
          normalized.courseInfo,
          fallback.courseInfo,
        ),
        policySections: this.mergePolicySections(
          normalized.policySections,
          fallback.policySections,
        ),
        moreInfo: this.mergeMoreInfo(normalized.moreInfo, fallback.moreInfo),
        gradingItems: this.mergeGradingItems(
          normalized.gradingItems,
          fallback.gradingItems,
        ),
        policies: normalized.policies.length
          ? normalized.policies
          : fallback.policies,
        resources: this.mergeResources(normalized.resources, fallback.resources),
        weeklyTopics: this.mergeWeeklyTopics(
          normalized.weeklyTopics,
          fallback.weeklyTopics,
        ),
        importantDates: normalized.importantDates.length
          ? normalized.importantDates
          : fallback.importantDates,
        officeHours: normalized.officeHours || fallback.officeHours,
        sourceCount: chunks.length,
      };

      this.syllabusSummaryCache.set(course.id, { fingerprint, summary });
      return summary;
    } catch {
      const summary = {
        ...this.fallbackSummaryFromChunks(chunks),
        sourceCount: chunks.length,
      };

      this.syllabusSummaryCache.set(course.id, { fingerprint, summary });
      return summary;
    }
  }

  invalidateCourseSyllabusSummary(courseId: string) {
    this.syllabusSummaryCache.delete(courseId);
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

  private generateDeterministicRagAnswer(question: string, courseText: string) {
    const normalizedQuestion = question.toLowerCase();

    if (
      /\b(final|finals|final exam|final examination)\b/i.test(
        normalizedQuestion,
      ) &&
      /\b(week|hafta|kaçıncı|kacinci|which week|what week)\b/i.test(
        normalizedQuestion,
      )
    ) {
      return 'Final Exam Week is Week 16.';
    }

    if (/\boffice\s+hours?\b|\bofis\s+saat/i.test(normalizedQuestion)) {
      return this.generateOfficeHoursAnswer(courseText);
    }

    const weekTopicAnswer = this.generateWeekTopicAnswer(
      normalizedQuestion,
      courseText,
    );

    if (weekTopicAnswer) {
      return weekTopicAnswer;
    }

    if (
      /\b(project|presentation|upload|submission)\b/i.test(normalizedQuestion) &&
      /\b(due|deadline|when|date|week|submit|teslim)\b/i.test(
        normalizedQuestion,
      )
    ) {
      return this.generateProjectScheduleAnswer(courseText);
    }

    if (
      !/\b(grading|grade|grades|evaluation|assessment|weight|percentage)\b/i.test(
        normalizedQuestion,
      )
    ) {
      return null;
    }

    const gradingItems = this.extractGradingItems(courseText);

    if (!gradingItems.length) {
      return null;
    }

    const wantsDetails = /\b(detail|details|description|describe|explain)\b/i.test(
      normalizedQuestion,
    );
    const lines = gradingItems.slice(0, 6).map((item) => {
      const parts = item.description.split('|').map((part) => part.trim());
      const description = parts[0] || 'Assessment component';
      const scoring = parts[1] || '';
      const weight = parts[2] || item.value;
      const scoringText = scoring ? ` (${scoring} points)` : '';

      return wantsDetails
        ? `- ${item.label}: ${weight}${scoringText} — ${description}`
        : `- ${item.label}: ${weight}${scoringText}`;
    });
    const relativeGrading =
      /\brelative grading system\b/i.test(courseText) ||
      /\bproper letter grade\b/i.test(courseText);

    return [
      'Based on the uploaded syllabus:',
      ...lines,
      relativeGrading
        ? '- Grading rule: the course uses a relative grading system.'
        : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private generateOfficeHoursAnswer(courseText: string) {
    const officeHours = this.extractInstructorOfficeHours(courseText);

    if (!officeHours) {
      return 'The uploaded syllabus does not list specific office hours.';
    }

    return `Office hours: ${officeHours}`;
  }

  private generateProjectScheduleAnswer(courseText: string) {
    const projectWeeks = this.extractWeeklyTopics(courseText)
      .filter((week) => Number.isInteger(Number(week.weekNo)))
      .map((week) => ({
        weekNo: Number(week.weekNo),
        topic: this.cleanPdfText(week.topic || ''),
        details: this.cleanPdfText(week.details || ''),
        todo: this.cleanPdfText(week.todo || ''),
      }))
      .filter((week) =>
        /\b(project|presentation|upload|submission|final version)\b/i.test(
          [week.topic, week.details, week.todo].join(' '),
        ),
      )
      .sort((first, second) => first.weekNo - second.weekNo);

    if (!projectWeeks.length) {
      return (
        'The uploaded syllabus does not list an exact final project due date. ' +
        'Please check the instructor announcements or manually published deadline details.'
      );
    }

    const lines = projectWeeks.slice(0, 6).map((week) => {
      const text = [week.topic, week.details, week.todo]
        .filter(Boolean)
        .join(' - ');

      return `- Week ${week.weekNo}: ${text}`;
    });

    return [
      'Based on the course calendar in the uploaded syllabus:',
      ...lines,
      'If the instructor has a separate exact submission date, follow the manually published deadline.',
    ].join('\n');
  }

  private generateWeekTopicAnswer(
    normalizedQuestion: string,
    courseText: string,
  ) {
    const weekMatch = normalizedQuestion.match(
      /\b(?:week|w)\s*(\d{1,2})\b|\b(\d{1,2})(?:st|nd|rd|th)?\s+week\b/i,
    );

    if (
      !weekMatch ||
      !/\b(topic|subject|covered|konu|week|hafta)\b/i.test(normalizedQuestion)
    ) {
      return null;
    }

    const weekNo = Number(weekMatch[1] || weekMatch[2]);

    if (!Number.isInteger(weekNo) || weekNo < 1 || weekNo > 16) {
      return null;
    }

    if (weekNo === 16) {
      return 'Week 16 is Final Exam Week.';
    }

    const week = this.extractWeeklyTopics(courseText).find(
      (item) => Number(item.weekNo) === weekNo,
    );

    if (!week || !this.isUsefulCalendarValue(week.topic)) {
      return `I could not find a published topic for Week ${weekNo} in the uploaded syllabus.`;
    }

    const parts = [`Week ${weekNo} topic: ${this.cleanPdfText(week.topic)}`];
    const todo = this.cleanPdfText(week.todo || '');
    const details = this.cleanPdfText(week.details || '');

    if (todo) parts.push(`To do: ${todo}`);
    if (details) parts.push(`Assignment/deadline: ${details}`);

    return parts.join('\n');
  }

  private answerSourceBoost(question: string, content: string) {
    if (/\boffice\s+hours?\b|\bofis\s+saat/i.test(question)) {
      if (/\bOf\s*fice\s+Hours?\b|\bOffice\s+Hours?\b/i.test(content)) return 35;
      if (/\boffice\b|\bappointment\b|\bMS Teams\b/i.test(content)) return 12;
    }

    if (/\b(?:week|w)\s*\d{1,2}\b/i.test(question)) {
      if (/\b(course calendar|week\/place|course topic)\b/i.test(content)) return 35;
      if (/\bW\d{1,2}\b|\bWeek\s+\d{1,2}\b/i.test(content)) return 15;
    }

    if (
      /\b(project|presentation|upload|submission)\b/i.test(question) &&
      /\b(due|deadline|when|date|week|submit)\b/i.test(question)
    ) {
      if (/\b(course calendar|week\/place|project presentation|project upload|final version)\b/i.test(content)) return 35;
      if (/\b(project|presentation|upload|submission|deadline|due)\b/i.test(content)) return 15;
    }

    if (
      !/\b(grading|grade|grades|evaluation|assessment|weight|percentage)\b/i.test(
        question,
      )
    ) {
      return 0;
    }

    if (/Grading and Evaluation/i.test(content)) return 30;
    if (/\b(Project|Midterm|Final)\b/i.test(content)) return 15;
    if (/\brelative grading system\b/i.test(content)) return 8;

    return 0;
  }

  private async generateInstructorAdvice(
    adviceType: InstructorAdviceType,
    question: string,
    fullCourseText: string,
    retrievedContext: string,
  ) {
    const adviceInstructions: Record<InstructorAdviceType, string> = {
      SYLLABUS_GAP_ANALYSIS:
        'Find missing, weak, unclear, or incomplete syllabus areas. Focus on office hours, grading explanations, resources, deadlines, policies, and weekly schedule clarity. Do not flag office hours as missing or weak if the syllabus provides an instructor-defined method such as "posted on the office door", "by appointment", "contact the instructor", an email-based method, or a clear location/time. Only flag office hours if they are absent, blank, "Not published yet", "TBA", or "to be announced".',
      GRADING_CONSISTENCY_CHECK:
        'Check whether grading components, scores, descriptions, and weights are internally consistent. Verify whether percentages appear to total 100 and flag ambiguous or conflicting grading text.',
      RESOURCE_RECOMMENDATION:
        'Suggest optional textbooks, readings, videos, tools, or practice resources based on the course topics. Do not give generic categories such as "a beginner-friendly textbook" or "tool-specific tutorials". Recommend concrete resource names, authors/platforms when available, and explain which syllabus topic each item supports. Prioritize weekly course topics over prerequisites. Only recommend prerequisite resources if the syllabus explicitly shows that students need support for that background area. Limit the answer to 4 or 5 recommendations unless the instructor asks for more. If a resource is already listed in the syllabus, mention it as existing and do not duplicate it as a new recommendation. Every recommendation must be marked instructor-review-required.',
      ANNOUNCEMENT_DRAFT_GENERATOR:
        `Draft short announcement options for important syllabus events such as project uploads, quizzes, midterm weeks, final exam weeks, resource reminders, or policy reminders. Current academic week is Week ${CURRENT_ACADEMIC_WEEK}; prioritize events in Week ${CURRENT_ACADEMIC_WEEK} or later and mention each detected event week when available. Use specific events detected in the syllabus instead of generic "upcoming course activities" whenever possible. Keep each draft ready to copy, short, and instructor-review-required. If the final exam is discussed but no week is listed, use Week 16.`,
    };

    const systemPrompt =
      'You are an instructor-facing syllabus advisor. Use only the provided course document context as the basis for analysis. ' +
      'You may suggest improvements, optional resources, or announcement drafts, but you must not change official course rules or claim that suggestions are already approved. ' +
      'Treat instructor-provided methods as valid even when they are not exact times, unless they are blank or explicitly unpublished. ' +
      'Keep the answer concise and practical. Use clear headings and bullet points. ' +
      'If the syllabus does not contain enough information for a requested item, say what is missing and what the instructor may add manually. ' +
      'Every recommendation must be framed as instructor-review-required.';

    const courseContext = this.preview(fullCourseText, 14000);
    const retrieved = this.preview(retrievedContext, 4000);

    try {
      const answerTimeoutMs =
        adviceType === 'RESOURCE_RECOMMENDATION' ? 25000 : 15000;
      const answer = await this.withTimeout(
        this.aiProvider.createAnswer([
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content:
              `Instructor advice type:\n${adviceType}\n\n` +
              `Advice instruction:\n${adviceInstructions[adviceType]}\n\n` +
              `Current academic week:\nWeek ${CURRENT_ACADEMIC_WEEK}\n\n` +
              `Instructor request:\n${question}\n\n` +
              `Full course document context:\n${courseContext}\n\n` +
              `Most relevant retrieved context:\n${retrieved}`,
          },
        ]),
        answerTimeoutMs,
        'AI instructor advice timed out',
      );

      return adviceType === 'SYLLABUS_GAP_ANALYSIS'
        ? this.sanitizeGapAnalysisAnswer(answer, fullCourseText)
        : answer;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return this.generateInstructorAdviceFallback(adviceType, fullCourseText);
      }

      throw error;
    }
  }

  private async generateRagAnswer(
    question: string,
    context: string,
    role: string,
  ) {
    const systemPrompt =
      'You are a course assistant. Answer only from the provided course document context. ' +
      'If the context does not contain the answer, say that the uploaded course documents do not include enough information. ' +
      'Keep answers short: use at most 4 bullet points or 4 short sentences. ' +
      'Do not add assumptions, inferred notes, caveats, or repeated explanations. ' +
      'If the user asks about grading, list only the grading components, scoring, weights, and one grading rule if explicitly present. ' +
      'Do not say “it can be inferred” or “the syllabus does not mention” unless that is the entire answer.';

    try {
      return await this.withTimeout(
        this.aiProvider.createAnswer([
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Question:\n${question}\n\nCourse document context:\n${context}`,
          },
        ]),
        15000,
        'AI answer timed out',
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return this.generateExtractiveRagFallbackAnswer(question, context);
      }

      throw error;
    }
  }

  private generateExtractiveRagFallbackAnswer(question: string, context: string) {
    const normalizedQuestion = question.toLowerCase();
    const keywordGroups = [
      normalizedQuestion.includes('project')
        ? ['project', 'presentation', 'upload', 'deadline', 'due', 'final']
        : [],
      normalizedQuestion.includes('final')
        ? ['final', 'exam', 'week 16', 'all chapters']
        : [],
      normalizedQuestion.includes('due') || normalizedQuestion.includes('deadline')
        ? ['due', 'deadline', 'submission', 'upload']
        : [],
      normalizedQuestion.includes('when')
        ? ['week', 'date', 'schedule']
        : [],
    ].flat();
    const keywords = keywordGroups.length
      ? Array.from(new Set(keywordGroups))
      : normalizedQuestion
          .split(/\W+/)
          .filter((word) => word.length > 3)
          .slice(0, 8);
    const sentences = context
      .replace(/\[Source[^\]]+\]/g, ' ')
      .split(/(?<=[.!?])\s+|\n+/)
      .map((sentence) => this.cleanPdfText(sentence))
      .filter((sentence) => sentence.length > 20)
      .filter((sentence) =>
        keywords.some((keyword) =>
          sentence.toLowerCase().includes(keyword.toLowerCase()),
        ),
      )
      .slice(0, 3);

    if (sentences.length) {
      return [
        'I found relevant syllabus text, but the AI answer provider timed out. Based on the indexed document:',
        ...sentences.map((sentence) => `- ${sentence}`),
      ].join('\n');
    }

    return (
      'I found relevant source material, but the AI answer provider timed out. ' +
      `Closest source context:\n${this.preview(context, 900)}`
    );
  }

  private buildRagSystemPrompt(role: string, basePrompt: string) {
    if (role === 'INSTRUCTOR') {
      return (
        'You are an instructor course assistant for a syllabus management system. ' +
        'Help the instructor inspect, verify, and explain their uploaded course documents. ' +
        'You may point out where an item appears in the syllabus and suggest that the instructor manually edit unclear fields, but do not change official course rules yourself. ' +
        basePrompt
      );
    }

    return (
      'You are a student course assistant. ' +
      'Help an enrolled student understand their course syllabus, weekly topics, grading, office hours, deadlines, resources, and policies. ' +
      'Use clear student-friendly wording and do not provide instructor-only recommendations or syllabus-editing advice. ' +
      basePrompt
    );
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

  private buildSummaryFingerprint(
    chunks: Array<{
      resourceId: string;
      chunkIndex: number;
      createdAt: Date;
    }>,
  ) {
    const resourceIds = Array.from(
      new Set(chunks.map((chunk) => chunk.resourceId)),
    ).join('|');
    const latestChunkTime = chunks.reduce(
      (latest, chunk) => Math.max(latest, chunk.createdAt.getTime()),
      0,
    );

    return `${resourceIds}:${chunks.length}:${latestChunkTime}`;
  }

  private normalizeSummary(rawAnswer: string) {
    const jsonText = this.extractJsonObject(rawAnswer);
    const parsed = JSON.parse(jsonText) as Partial<CourseSyllabusSummary>;

    return {
      courseSummary: this.asString(parsed.courseSummary),
      instructorInfo: this.normalizeInstructorInfo(parsed.instructorInfo),
      courseInfo: this.normalizeCourseInfo(parsed.courseInfo),
      policySections: this.normalizePolicySections(parsed.policySections),
      moreInfo: this.normalizeMoreInfo(parsed.moreInfo),
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
            place: this.asString(item?.place),
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
    const rawText = chunks
      .map((chunk) => chunk.content)
      .join('\n')
      .replace(/\r/g, '');
    const text = rawText
      .replace(/\s+/g, ' ')
      .trim();

    const gradingMatches = this.extractGradingItems(text);
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
    const extractedResources = this.extractCourseResources(text, resourceNames);
    const fallbackCourseInfo = {
      credits: this.extractCourseCredits(text),
      classSchedule: this.extractValueBetween(text, 'Time', [
        'Course Credit',
        'Classroom',
      ]),
      classroom: this.extractValueBetween(text, 'Classroom', [
        'Mode of Delivery',
        'Course type',
      ]),
      courseType: this.extractCourseType(text),
      prerequisites: this.extractPrerequisites(text),
      courseObjectives: this.extractCourseObjectives(text),
    };
    const fallbackPolicySections = this.normalizePolicySections({
      communication: this.extractPolicySection(
        text,
        'Communication Channels and Methods',
        ['Usage of Digital Tools', 'Mobile Technologies'],
      ),
      aiDigitalTools: this.extractPolicySection(text, 'Usage of Digital Tools', [
        'Assignments and Project Deadline',
        'Deadlines',
        'Attendance',
      ]),
      deadlines:
        this.extractPolicySection(text, 'Assignments and Project Deadline', [
          'Attendance',
        ]) || this.extractPolicySection(text, 'Deadlines', ['Attendance']),
      attendance: this.extractPolicySection(text, 'Attendance', [
        'Disabled Student Support',
      ]),
      disabledStudentSupport: this.extractPolicySection(
        text,
        'Disabled Student Support',
        ['Oral and Written Communication Ethics'],
      ),
      communicationEthics: this.extractPolicySection(
        text,
        'Oral and Written Communication Ethics',
        ['Privacy and Copyright'],
      ),
      privacyCopyright: this.extractPolicySection(text, 'Privacy and Copyright', [
        'Course Resources',
        'Academic Integrity',
      ]),
      academicIntegrity: this.extractPolicySection(
        text,
        'Academic Integrity, Cheating and Plagiarism',
        ['Prepared by', 'Prepared by Name'],
      ),
    });
    const fallbackMoreInfo = {
      learningOutcomes: this.extractLearningOutcomes(text),
      contributionToProgram: this.cleanPdfText(
        this.extractBetween(text, 'Contribution of the Course to the Program', [
          'Course Structure',
        ]),
      ),
      courseStructure: this.extractCourseStructure(text),
      teachingMethods: this.extractTeachingMethods(text),
    };

    return {
      courseSummary: this.preview(text, 700),
      instructorInfo: {
        office: this.extractInstructorOffice(text),
        officeHours: this.extractInstructorOfficeHours(text),
        cvLink: this.extractCvLink(text),
      },
      courseInfo: fallbackCourseInfo,
      policySections: fallbackPolicySections,
      moreInfo: fallbackMoreInfo,
      gradingItems,
      policies: this.extractSentences(text, [
        'attendance',
        'policy',
        'late',
        'academic',
        'integrity',
        'plagiarism',
      ]),
      resources: extractedResources,
      weeklyTopics: this.extractWeeklyTopics(rawText),
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
    if (typeof value !== 'string') return '';

    const text = value.trim();
    return this.isPlaceholderValue(text) ? '' : text;
  }

  private isPlaceholderValue(value: string) {
    const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();
    const placeholders = new Set([
      'short course overview from the pdf',
      'course objectives paragraph',
      'communication channels and methods section text',
      'usage of ai & digital tools / usage of digital tools section text',
      'deadlines / assignments and project deadline section text',
      'attendance section text',
      'disabled student support section text',
      'oral and written communication ethics section text',
      'privacy and copyright section text',
      'academic integrity, cheating and plagiarism section text',
      'contribution of the course to the program section text',
      'course structure section text',
      'short description',
      'policy item',
      'resource item',
      'topic',
      'details',
      'reading/homework if present',
      'assignment/deadline if present',
      'f2f / online / hybrid if present',
      'date or deadline item',
      'office hour information if present',
      'one learning outcome',
    ]);

    return placeholders.has(normalized);
  }

  private asStringArray(value: unknown) {
    return Array.isArray(value)
      ? value
          .map((item) => this.asString(item))
          .filter((item) => item.length > 0)
      : [];
  }

  private asRecord(value: unknown) {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private normalizeInstructorInfo(value: unknown) {
    const record = this.asRecord(value);

    return {
      office: this.asString(record.office),
      officeHours: this.asString(record.officeHours),
      cvLink: this.asUrlString(record.cvLink),
    };
  }

  private normalizeCourseInfo(value: unknown) {
    const record = this.asRecord(value);

    return {
      credits: this.asString(record.credits),
      classSchedule: this.asString(record.classSchedule),
      classroom: this.asString(record.classroom),
      courseType: this.asString(record.courseType),
      prerequisites: this.asString(record.prerequisites),
      courseObjectives: this.asString(record.courseObjectives),
    };
  }

  private normalizePolicySections(value: unknown) {
    const record = this.asRecord(value);

    return {
      communication: this.asString(record.communication),
      aiDigitalTools: this.asString(record.aiDigitalTools),
      deadlines: this.asString(record.deadlines),
      attendance: this.asString(record.attendance),
      disabledStudentSupport: this.asString(record.disabledStudentSupport),
      communicationEthics: this.asString(record.communicationEthics),
      privacyCopyright: this.asString(record.privacyCopyright),
      academicIntegrity: this.asString(record.academicIntegrity),
    };
  }

  private normalizeMoreInfo(value: unknown) {
    const record = this.asRecord(value);

    return {
      learningOutcomes: this.asStringArray(record.learningOutcomes),
      contributionToProgram: this.asString(record.contributionToProgram),
      courseStructure: this.asString(record.courseStructure),
      teachingMethods: this.asStringArray(record.teachingMethods),
    };
  }

  private mergeInstructorInfo(
    primary: CourseSyllabusSummary['instructorInfo'],
    fallback: CourseSyllabusSummary['instructorInfo'],
  ) {
    return {
      office: primary.office || fallback.office,
      officeHours: primary.officeHours || fallback.officeHours,
      cvLink: fallback.cvLink || primary.cvLink,
    };
  }

  private asUrlString(value: unknown) {
    const rawText = this.asString(value).replace(/\s*-\s*/g, '-');
    const urlMatch = rawText.match(/https?:\/\/[^\s]+/i);
    const text = urlMatch?.[0] || rawText;

    if (!/^https?:\/\/\S+$/i.test(text) || text.includes('...')) {
      return '';
    }

    try {
      const url = new URL(text);

      if (url.hostname === '...' || url.hostname.includes('..')) {
        return '';
      }

      return url.toString();
    } catch {
      return '';
    }
  }

  private extractCourseType(text: string) {
    const rawValue = this.extractValueBetween(text, 'Course type', [
      'Course ECTS',
      'Prerequisite',
      'Course Objectives',
      'Course Learning Outcomes',
    ]);
    const match = rawValue.match(
      /\b(Must|Elective|Required|Compulsory|Mandatory|Optional)\b/i,
    );

    if (!match) {
      return '';
    }

    const value = match[1].toLowerCase();

    if (value === 'elective') return 'Elective';
    if (value === 'optional') return 'Optional';
    if (['must', 'required', 'compulsory', 'mandatory'].includes(value)) {
      return value === 'must' ? 'Must' : 'Required';
    }

    return match[1];
  }

  private extractCourseCredits(text: string) {
    const match = text.match(
      /Course\s+Credit\s*\/\s*ECTS\s*:?\s*:?\s*(.+?)(?=\s+(?:Classroom|Mode\s+of\s+Delivery|Course\s+type|Prerequisite|Course\s+Objectives)\b)/i,
    );
    const value = this.cleanPdfText(match?.[1] || '');
    const credits = value.match(/\b\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?\b/);

    return credits?.[0]?.replace(/\s+/g, '') || '';
  }

  private extractCvLink(text: string) {
    return this.asUrlString(
      this.extractValueBetween(text, 'CV (link)', [
        'Course Information',
        'Course Info',
      ]),
    );
  }

  private mergeCourseInfo(
    primary: CourseSyllabusSummary['courseInfo'],
    fallback: CourseSyllabusSummary['courseInfo'],
  ) {
    return {
      credits: fallback.credits || primary.credits,
      classSchedule: fallback.classSchedule || primary.classSchedule,
      classroom: fallback.classroom || primary.classroom,
      courseType: fallback.courseType || primary.courseType,
      prerequisites: fallback.prerequisites || primary.prerequisites,
      courseObjectives: primary.courseObjectives || fallback.courseObjectives,
    };
  }

  private mergePolicySections(
    primary: CourseSyllabusSummary['policySections'],
    fallback: CourseSyllabusSummary['policySections'],
  ) {
    return {
      communication: fallback.communication || primary.communication,
      aiDigitalTools: fallback.aiDigitalTools || primary.aiDigitalTools,
      deadlines: fallback.deadlines || primary.deadlines,
      attendance: fallback.attendance || primary.attendance,
      disabledStudentSupport:
        fallback.disabledStudentSupport || primary.disabledStudentSupport,
      communicationEthics:
        fallback.communicationEthics || primary.communicationEthics,
      privacyCopyright: fallback.privacyCopyright || primary.privacyCopyright,
      academicIntegrity: fallback.academicIntegrity || primary.academicIntegrity,
    };
  }

  private mergeMoreInfo(
    primary: CourseSyllabusSummary['moreInfo'],
    fallback: CourseSyllabusSummary['moreInfo'],
  ) {
    return {
      learningOutcomes: fallback.learningOutcomes.length
        ? fallback.learningOutcomes
        : primary.learningOutcomes,
      contributionToProgram: fallback.contributionToProgram,
      courseStructure: primary.courseStructure || fallback.courseStructure,
      teachingMethods: fallback.teachingMethods.length
        ? fallback.teachingMethods
        : primary.teachingMethods,
    };
  }

  private mergeResources(primary: string[], fallback: string[]) {
    const hasExtractedCourseResources = fallback.some(
      (item) => !item.startsWith('Uploaded PDF:'),
    );

    if (hasExtractedCourseResources) {
      return fallback;
    }

    return primary.length ? primary : fallback;
  }

  private mergeGradingItems(
    primary: CourseSyllabusSummary['gradingItems'],
    fallback: CourseSyllabusSummary['gradingItems'],
  ) {
    const totalWeight = (items: CourseSyllabusSummary['gradingItems']) =>
      items.reduce((sum, item) => sum + this.extractWeightNumber(item.value), 0);
    const fallbackLooksStructured = fallback.some((item) =>
      /\|\s*\d+(?:\.\d+)?\s*\|\s*\d+(?:\.\d+)?\s*%/i.test(item.description),
    );
    const fallbackTotal = totalWeight(fallback);
    const primaryTotal = totalWeight(primary);

    if (
      fallbackLooksStructured &&
      fallbackTotal >= 95 &&
      fallbackTotal <= 105
    ) {
      return fallback;
    }

    if (primaryTotal >= 95 && primaryTotal <= 105) {
      return primary;
    }

    if (fallbackLooksStructured) {
      return fallback;
    }

    return primary.length ? primary : fallback;
  }

  private extractWeightNumber(value: string) {
    const match = value.match(/(\d+(?:\.\d+)?)\s*%?/);
    return match ? Number(match[1]) : 0;
  }

  private mergeWeeklyTopics(
    primary: CourseSyllabusSummary['weeklyTopics'],
    fallback: CourseSyllabusSummary['weeklyTopics'],
  ) {
    const toWeekMap = (items: CourseSyllabusSummary['weeklyTopics']) => {
      const map = new Map<
        number,
        CourseSyllabusSummary['weeklyTopics'][number]
      >();

      for (const item of items) {
        const weekNo = Number(item.weekNo);

        if (!Number.isInteger(weekNo) || weekNo < 1 || weekNo > 16) {
          continue;
        }

        map.set(weekNo, { ...item, weekNo });
      }

      return map;
    };

    const primaryByWeek = toWeekMap(primary);
    const fallbackByWeek = toWeekMap(fallback);

    const hasCompleteCourseWeeks = Array.from(
      { length: 15 },
      (_, index) => index + 1,
    ).every((weekNo) => fallbackByWeek.has(weekNo) || primaryByWeek.has(weekNo));
    const weekCount = hasCompleteCourseWeeks ? 16 : 15;

    return Array.from({ length: weekCount }, (_, index) => {
      const weekNo = index + 1;
      const fallbackItem = fallbackByWeek.get(weekNo);
      const primaryItem = primaryByWeek.get(weekNo);
      const fallbackTopic = fallbackItem?.topic || '';
      const primaryTopic = primaryItem?.topic || '';

      if (weekNo === 16 && !fallbackItem && !primaryItem) {
        return this.createFinalExamWeek();
      }

      return {
        weekNo,
        place: fallbackItem?.place || primaryItem?.place || '',
        topic: this.isUsefulCalendarValue(fallbackTopic)
          ? fallbackTopic
          : this.isUsefulCalendarValue(primaryTopic)
            ? primaryTopic
            : 'Not published yet',
        details: fallbackItem?.details || primaryItem?.details || '',
        todo: fallbackItem?.todo || primaryItem?.todo || '',
      };
    });
  }

  private createFinalExamWeek() {
    return {
      weekNo: 16,
      place: '',
      topic: 'Final Exam Week',
      details: 'Final exam schedule will be announced by the university.',
      todo: 'Review all chapters and prepare for the final exam.',
    };
  }

  private isUsefulCalendarValue(value: string) {
    const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();

    return Boolean(normalized) && normalized !== 'not published yet';
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

  private extractBetween(text: string, startLabel: string, endLabels: string[]) {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const lowerText = normalizedText.toLowerCase();
    const start = lowerText.indexOf(startLabel.toLowerCase());

    if (start === -1) {
      return '';
    }

    const contentStart = start + startLabel.length;
    const end = endLabels
      .map((label) => lowerText.indexOf(label.toLowerCase(), contentStart))
      .filter((index) => index > contentStart)
      .sort((a, b) => a - b)[0];
    const value = normalizedText
      .slice(contentStart, end ?? normalizedText.length)
      .replace(/^[:\s-]+/, '')
      .trim();

    return this.preview(value, 1800);
  }

  private extractValueBetween(
    text: string,
    label: string,
    endLabels: string[],
  ) {
    return this.preview(this.extractBetween(text, label, endLabels), 220);
  }

  private extractInstructorOffice(text: string) {
    const match = text.match(
      /\bOf\s*fice\s*:\s*(.+?)(?=\s+(?:E\s*-\s*Mail|Email|Office\s+Hours)\s*:)/i,
    );

    return this.preview(this.cleanPdfText(match?.[1] || ''), 120);
  }

  private extractInstructorOfficeHours(text: string) {
    const match = text.match(
      /\bOf\s*fice\s+Hours?\s*:\s*:?\s*(.+?)(?=\s+(?:CV\s*\(link\)|Course Information|Period|Time|Course Credit|Classroom)(?:\s*:|\b))/i,
    );

    return this.preview(
      this.cleanPdfText(match?.[1] || '').replace(
        /\b(\d{1,2})\s+:\s*(\d{2})\b/g,
        '$1:$2',
      ),
      180,
    );
  }

  private extractPolicySection(
    text: string,
    startLabel: string,
    endLabels: string[],
  ) {
    const section =
      this.extractPolicySectionByHeadings(text, startLabel) ||
      this.extractBetween(text, startLabel, endLabels);
    const repeatedHeading = new RegExp(`${this.escapeRegExp(startLabel)}:\\s*`, 'i');
    const headingMatch = section.match(repeatedHeading);
    const cleanSection =
      headingMatch?.index !== undefined
        ? section.slice(headingMatch.index + headingMatch[0].length)
        : section;

    return this.cleanPolicyText(cleanSection);
  }

  private extractPolicySectionByHeadings(text: string, startLabel: string) {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const headingPatterns: Array<{ key: string; pattern: RegExp }> = [
      {
        key: 'communication',
        pattern: /\bCommunication\s+Channels\s+and\s+Methods\s*:/gi,
      },
      {
        key: 'aiDigitalTools',
        pattern: /\b(?:Usage\s+of\s+)?AI\s*&\s*Digital\s+Tools\s*:/gi,
      },
      {
        key: 'deadlines',
        pattern: /\b(?:Assignments?\s+and\s+Project\s+Deadline|D\s*eadline\s*s|Deadlines?)\s*:/gi,
      },
      {
        key: 'attendance',
        pattern: /\bAttendance\s*:/gi,
      },
      {
        key: 'disabledStudentSupport',
        pattern: /\bDisabled\s+Student\s+Support\s*:/gi,
      },
      {
        key: 'communicationEthics',
        pattern: /\bOral\s+and\s+Written\s+Communication\s+Ethics\s*:/gi,
      },
      {
        key: 'privacyCopyright',
        pattern: /\bPrivacy\s+and\s+Copyright\s*:/gi,
      },
      {
        key: 'academicIntegrity',
        pattern: /\bAcademic\s+Integrity(?:,\s*Cheating\s+and\s+Plagiarism)?\s*:?/gi,
      },
      {
        key: 'courseResources',
        pattern: /\bCourse\s+Resources\b/gi,
      },
      {
        key: 'preparedBy',
        pattern: /\bPrepared\s+by\b/gi,
      },
    ];
    const requestedKey = this.policyKeyFromLabel(startLabel);

    if (!requestedKey) {
      return '';
    }

    const headings = headingPatterns.flatMap(({ key, pattern }) =>
      Array.from(normalizedText.matchAll(pattern)).map((match) => ({
        key,
        index: match.index ?? 0,
        length: match[0].length,
      })),
    );
    const sortedHeadings = headings
      .filter((heading) => heading.index >= 0)
      .sort((a, b) => a.index - b.index);
    const start = sortedHeadings.find((heading) => heading.key === requestedKey);

    if (!start) {
      return '';
    }

    const next = sortedHeadings.find(
      (heading) =>
        heading.index > start.index &&
        heading.key !== requestedKey,
    );
    let section = normalizedText
      .slice(start.index + start.length, next?.index ?? normalizedText.length)
      .trim();

    const sameHeading = headingPatterns.find(
      (heading) => heading.key === requestedKey,
    );

    if (sameHeading) {
      const repeated = Array.from(section.matchAll(sameHeading.pattern));
      const lastRepeat = repeated.at(-1);

      if (lastRepeat?.index !== undefined) {
        section = section.slice(lastRepeat.index + lastRepeat[0].length).trim();
      }
    }

    return section;
  }

  private policyKeyFromLabel(label: string) {
    const normalized = label.toLowerCase().replace(/\s+/g, ' ').trim();

    if (normalized.includes('communication channels')) return 'communication';
    if (normalized.includes('ai') || normalized.includes('digital tools')) {
      return 'aiDigitalTools';
    }
    if (normalized.includes('deadline')) return 'deadlines';
    if (normalized.includes('attendance')) return 'attendance';
    if (normalized.includes('disabled student')) return 'disabledStudentSupport';
    if (normalized.includes('oral and written')) return 'communicationEthics';
    if (normalized.includes('privacy') || normalized.includes('copyright')) {
      return 'privacyCopyright';
    }
    if (normalized.includes('academic integrity')) return 'academicIntegrity';

    return '';
  }

  private cleanPolicyText(value: string) {
    const withLineBreaks = this.cleanPdfText(value)
      .replace(/[•]\s*/g, '\n- ')
      .replace(/[▪■□]/g, ' ')
      .replace(/\be-mail\b/gi, 'email')
      .replace(/\be\s*-\s*mail\b/gi, 'email')
      .replace(/\bMsTeams\b/g, 'MS Teams')
      .replace(/\bMs Teams\b/g, 'MS Teams')
      .replace(/\bMat\s*erials\b/gi, 'Materials')
      .replace(/\bpa\s*rticipate\b/gi, 'participate')
      .replace(/\bdis\s*abilities\b/gi, 'disabilities')
      .replace(/\bcommunicatio\s+n\b/gi, 'communication')
      .replace(/\bdi\s+sciplinary\b/gi, 'disciplinary')
      .replace(/\bde\s+ceive\b/gi, 'deceive')
      .replace(/\bNot\s+eve\s+rything\b/g, 'Not everything')
      .replace(/\bwi\s+ll\b/gi, 'will')
      .replace(/\bconduc\s+ted\b/gi, 'conducted')
      .replace(/\bpen\s+alties\b/gi, 'penalties')
      .replace(/\bAL\s+A\b/g, 'ALA')
      .replace(/\bi\s+t\b/g, 'it')
      .replace(/\bad\s+dition\b/gi, 'addition')
      .replace(/\bplagiaris\s+m\b/gi, 'plagiarism')
      .replace(/\bproceedi\s+ngs\b/gi, 'proceedings')
      .replace(/\bactivit\s+y\b/gi, 'activity')
      .replace(/\bIn\s+stitution\b/g, 'Institution')
      .replace(/\bemai\s+l\b/gi, 'email')
      .replace(/\bth\s+e\b/gi, 'the')
      .replace(/\bex\s+cuses\b/gi, 'excuses')
      .replace(/\b3\s*-\s*(?=Emails\b)/i, '- ')
      .replace(/(?<=ignored)-(?=Emails\b)/g, '\n- ')
      .replace(/(?<=app\.)-(?=Please\b)/g, '\n- ')
      .replace(/(?<=accepted\.)-(?=Sufficient\b)/g, '\n- ')
      .replace(/If you are unable to c ial via email\.\s*/gi, '')
      .replace(/Such activit m or similar violations[^.]+\.\s*/gi, '')
      .replace(/\s+-\s+(?=[A-Z])/g, '\n- ');
    const normalized = withLineBreaks
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .map((line) => line.replace(/\s+\d+\s*$/, '').trim())
      .filter(Boolean)
      .join('\n');

    return this.removeDuplicateSentences(normalized);
  }

  private removeDuplicateSentences(value: string) {
    const lines = value.split('\n').filter((line, index, allLines) => {
      const nextLine = allLines[index + 1];

      if (!line.startsWith('- ') || !nextLine?.startsWith('- ')) {
        return true;
      }

      const linePrefix = line.slice(0, 80).toLowerCase();
      const nextPrefix = nextLine.slice(0, 80).toLowerCase();

      return !(linePrefix === nextPrefix && nextLine.length > line.length);
    });

    return lines
      .map((line) => {
        if (line.startsWith('- ')) return line;

        const sentences = line
          .split(/(?<=[.!?])\s+/)
          .map((sentence) => sentence.trim())
          .filter(Boolean);

        return Array.from(new Set(sentences)).join(' ');
      })
      .join('\n')
      .trim();
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private extractLearningOutcomes(text: string) {
    const section = this.extractBetween(text, 'Course Learning Outcomes', [
      'Contribution of the Course to the Program',
      'Course Structure',
    ]);

    if (!section) {
      return [];
    }

    const outcomeVerbs = [
      'Understand',
      'Apply',
      'Import',
      'Prepare',
      'Query',
      'Analyze',
      'Visualize',
    ];
    const verbPattern = outcomeVerbs.join('|');
    const byVerb = new Map<string, string>();
    const normalizedSection = section
      .replace(/^The students who have succeeded in this course;\s*/i, '')
      .trim();
    const verbMatches = Array.from(
      normalizedSection.matchAll(
        new RegExp(
          `\\b(${verbPattern})\\b([\\s\\S]*?)(?=\\b(?:${verbPattern})\\b|$)`,
          'gi',
        ),
      ),
    );

    for (const match of verbMatches) {
      const verb = this.capitalizeWord(match[1]);
      const outcome = this.cleanPdfText(`${verb}${match[2] || ''}`)
        .replace(/\s+/g, ' ')
        .trim();
      const existing = byVerb.get(verb) || '';

      if (outcome.length >= 20 && outcome.length > existing.length) {
        byVerb.set(verb, outcome);
      }
    }

    const orderedOutcomes = outcomeVerbs
      .map((verb) => byVerb.get(verb))
      .filter((item): item is string => Boolean(item));

    if (orderedOutcomes.length) {
      return [
        `The students who have succeeded in this course; ${orderedOutcomes.join(' ')}`,
      ];
    }

    const numbered = Array.from(section.matchAll(/\b\d+\.\s*([^.;]+[.;]?)/g))
      .map((match) => match[1].trim())
      .filter(Boolean);

    if (numbered.length) {
      return numbered.slice(0, 10);
    }

    return this.extractSentences(section, ['student', 'students', 'course']).slice(
      0,
      8,
    );
  }

  private extractTeachingMethods(text: string) {
    const section = this.extractBetween(
      text,
      'Teaching Methods and Techniques Used in the Course',
      ['Course Policies', 'Communication Channels and Methods'],
    );
    const knownMethods = [
      'Case Study',
      'Collaborative Learning',
      'Discussion',
      'Implementation',
      'Individual Study',
      'Lecture',
      'Problem Solving',
      'Project',
      'Reading',
      'Technology-Enhanced Learning',
    ];

    if (section) {
      const markerPattern = '[☐□☑☒✓✔]';
      const selectedMethods = Array.from(
        section.matchAll(
          new RegExp(
            `(${markerPattern})\\s*([^☐□☑☒✓✔]+?)(?=${markerPattern}|$)`,
            'g',
          ),
        ),
      )
        .filter((match) => /[☑☒✓✔]/.test(match[1]))
        .map((match) => this.cleanPdfText(match[2]))
        .map((value) =>
          knownMethods.find(
            (method) => method.toLowerCase() === value.toLowerCase(),
          ),
        )
        .filter((method): method is string => Boolean(method));

      if (selectedMethods.length) {
        return Array.from(new Set(selectedMethods));
      }
    }

    const normalized = text.toLowerCase();

    return knownMethods.filter((method) =>
      normalized.includes(method.toLowerCase()),
    );
  }

  private extractCourseStructure(text: string) {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const startMatch = normalizedText.match(/\bCourse Structure\b/i);

    if (!startMatch || startMatch.index === undefined) {
      return '';
    }

    const afterStart = normalizedText.slice(
      startMatch.index + startMatch[0].length,
    );
    const endMatch = afterStart.match(
      /\bTeaching\s+Methods\s+and\s+Techniques\s+Used\s+in\s+the\s+Course\b|\bCourse Policies\b|\bCommunication Channels and Methods\b/i,
    );

    return this.cleanCourseStructureText(
      this.cleanPdfText(afterStart.slice(0, endMatch?.index ?? undefined)),
    );
  }

  private cleanPdfText(value: string) {
    return value
      .replace(/\bsu\s+ch\b/gi, 'such')
      .replace(/\ban\s+d\b/gi, 'and')
      .replace(/\bar\s+e\b/gi, 'are')
      .replace(/\bS\s+AP\b/g, 'SAP')
      .replace(/\bwit\s+h\b/gi, 'with')
      .replace(/\s+\)/g, ')')
      .replace(/\bh\s+ealthcare\b/gi, 'healthcare')
      .replace(/\s+-\s+/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanCourseStructureText(value: string) {
    const beforeBrokenHeading = value.replace(/\s+Teaching\s+M\b[\s\S]*$/i, '');
    const sentences = beforeBrokenHeading
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    const uniqueSentences = Array.from(new Set(sentences));

    return this.preview(uniqueSentences.join(' '), 1800);
  }

  private capitalizeWord(value: string) {
    const normalized = value.toLowerCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  private extractCourseResources(text: string, fallbackResourceNames: string[]) {
    const section = this.extractBetween(text, 'Course Resources', [
      'Grading and Evaluation',
      'Grading',
      'Course Calendar',
      'Course Policies',
      'Matters Needing Attention',
      'Academic Integrity',
      'Prepared by',
    ]);
    const cleanedSection = section
      .replace(/\s*□\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanedSection) {
      return fallbackResourceNames;
    }

    const labeledItems = this.splitResourceSection(cleanedSection);

    return labeledItems.length ? labeledItems : [this.preview(cleanedSection, 900)];
  }

  private extractGradingItems(text: string) {
    const section = this.extractGradingSection(text);

    if (!section) {
      return [];
    }

    const knownAssignments =
      'Active\\s+Learning\\s+Activities\\s*(?:\\(\\s*ALA\\s*\\))?|Industry\\s+Seminars?|Coursera\\s+Application|Cousera\\s+Application|Final\\s+Exam|Mid\\s*-?\\s*term\\s+exam|Midterm\\s+Exam|Project|Mid\\s*-?\\s*term|Midterm|Final|Quiz|Homework|Assignment|Presentation|Participation|Lab|Exam';
    const normalized = section
      .replace(/\bAssignment\s+Description\s+Scoring\s+Weight\s*\(%\)/i, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const assignmentBoundary = `(?:${knownAssignments})(?=\\s|:|\\(|-|$)`;
    const starredRows = Array.from(
      normalized.matchAll(
        new RegExp(
          `\\*\\s*(${assignmentBoundary})\\s*([\\s\\S]*?)(?=\\s+\\*\\s*${assignmentBoundary}|\\s*$)`,
          'gi',
        ),
      ),
    );
    const rows = starredRows.length
      ? starredRows
      : Array.from(
          normalized.matchAll(
            new RegExp(
              `(?:^|\\s)(${assignmentBoundary})\\s*([\\s\\S]*?)(?=\\s+${assignmentBoundary}|\\s*$)`,
              'g',
            ),
          ),
        );

    const parsedRows = rows
      .map((match) => {
        const label = this.normalizeGradingLabel(match[1]);
        const body = match[2].replace(/\s+/g, ' ').trim();
        const valueMatch = this.extractTrailingScoreAndWeight(body);

        if (!valueMatch) {
          return null;
        }

        const { description, scoring, weight } = valueMatch;

        return {
          label,
          value: weight,
          description: `${description} | ${scoring} | ${weight}`,
        };
      })
      .filter(
        (item): item is { label: string; value: string; description: string } =>
          Boolean(item),
      );

    return this.dedupeGradingItems(parsedRows);
  }

  private extractGradingSection(text: string) {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const starts = Array.from(
      normalizedText.matchAll(/\bGrading\s+and\s+Evaluation\b/gi),
    )
      .map((match) => match.index ?? -1)
      .filter((index) => index >= 0);

    if (!starts.length) {
      return this.extractBetween(text, 'Grading', [
        'TOTAL',
        'Course Calendar',
        'Course Policies',
        'Course Resources',
        'Matters Needing Attention',
        'Academic Integrity',
        'Prepared by',
      ]);
    }

    const start =
      starts.find((index) =>
        /Assignment\s+Description\s+Scoring\s+Weight/i.test(
          normalizedText.slice(index, index + 1800),
        ),
      ) ?? starts[starts.length - 1];
    const afterStart = normalizedText.slice(start);
    const totalMatch = afterStart.match(/\bTOTAL\b\s*-?\s*\d/);
    const nextSectionMatch = afterStart.match(
      /\b(?:Course\s+Calendar|Make\s*-\s*up\s+Rules|Matters\s+Needing\s+Attention|Academic\s+Integrity|Prepared\s+by)\b/i,
    );
    const endIndex =
      typeof totalMatch?.index === 'number'
        ? totalMatch.index
        : nextSectionMatch?.index;

    return afterStart.slice(0, endIndex).trim();
  }

  private extractTrailingScoreAndWeight(value: string) {
    const numericTail = value.match(
      /(\d+(?:\.\d+)?\s*%?(?:\s+\d+(?:\.\d+)?\s*%?){1,5})\s*$/,
    );

    if (!numericTail || numericTail.index === undefined) {
      return null;
    }

    const description = value.slice(0, numericTail.index).trim();
    let numbers = Array.from(
      numericTail[1].matchAll(/\d+(?:\.\d+)?/g),
    ).map((match) => match[0]);

    if (numbers.length < 2) {
      return null;
    }

    const explicitTotalWeight = description.match(
      /\bin\s+total\s+(\d+(?:\.\d+)?)\s*%/i,
    );

    if (explicitTotalWeight) {
      return {
        description,
        scoring: numbers[0],
        weight: `${explicitTotalWeight[1]}%`,
      };
    }

    if (
      numbers.length >= 4 &&
      /^\d$/.test(numbers[numbers.length - 1]) &&
      /^\d$/.test(numbers[numbers.length - 2]) &&
      /^\d$/.test(numbers[numbers.length - 3]) &&
      Number(numbers[numbers.length - 4]) >= 10
    ) {
      numbers = numbers.slice(0, -1);
    }

    if (
      numbers.length >= 3 &&
      /^\d$/.test(numbers[numbers.length - 1]) &&
      Number(numbers[numbers.length - 2]) >= 10
    ) {
      numbers = numbers.slice(0, -1);
    }

    const { scoring, weight } = this.pickScoringAndWeight(numbers);

    return {
      description,
      scoring,
      weight: `${weight}%`,
    };
  }

  private pickScoringAndWeight(numbers: string[]) {
    const last = numbers[numbers.length - 1];
    const previous = numbers[numbers.length - 2];

    if (
      numbers.length >= 3 &&
      /^\d$/.test(previous) &&
      /^\d$/.test(last)
    ) {
      return {
        scoring: numbers[numbers.length - 3],
        weight: `${previous}${last}`,
      };
    }

    return {
      scoring: previous,
      weight: last,
    };
  }

  private normalizeGradingLabel(value: string) {
    return value
      .replace(/^\*+\s*/, '')
      .replace(/\bMid\s*-\s*Term\b/gi, 'Midterm')
      .replace(/\bMid\s*-\s*term\b/gi, 'Midterm')
      .replace(/\s*\(\s*ALA\s*\)\s*/gi, ' (ALA)')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .replace(/^Cousera\b/, 'Coursera');
  }

  private dedupeGradingItems(
    items: Array<{ label: string; value: string; description: string }>,
  ) {
    const byLabel = new Map<
      string,
      { label: string; value: string; description: string }
    >();

    for (const item of items) {
      const key = item.label.toLowerCase();
      const existing = byLabel.get(key);

      if (!existing || item.description.length > existing.description.length) {
        byLabel.set(key, item);
      }
    }

    return Array.from(byLabel.values());
  }

  private splitResourceSection(section: string) {
    const normalized = section.replace(/\s+/g, ' ').trim();
    const labelMatches = Array.from(
      normalized.matchAll(
        /\b(Textbook|Book|References?|Slides?|Lecture Notes?|Required Readings?|Readings?|Course Materials?|Materials?)\s*:/gi,
      ),
    );

    if (!labelMatches.length) {
      return [];
    }

    return labelMatches
      .map((match, index) => {
        const start = match.index ?? 0;
        const next = labelMatches[index + 1];
        const end = next?.index ?? normalized.length;

        return this.preview(normalized.slice(start, end).trim(), 900);
      })
      .filter(Boolean);
  }

  private extractCourseObjectives(text: string) {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const startMatch = normalizedText.match(/Course\s+Objective\s*s\b/i);

    if (!startMatch || startMatch.index === undefined) {
      return this.extractBetween(normalizedText, 'Course Objectives', [
        'Course Learning Outcomes',
      ]);
    }

    const start = startMatch.index + startMatch[0].length;
    const afterStart = normalizedText.slice(start);
    const endMatch = afterStart.match(
      /\b(1\s+1\s+It\s+is\s+essential|Course\s+Learning\s+Outcomes|Contribution\s+of\s+the\s+Course|Course\s+Structure)\b/i,
    );
    const extracted = afterStart.slice(0, endMatch?.index ?? undefined).trim();

    return this.cleanCourseObjectivesText(extracted);
  }

  private cleanCourseObjectivesText(value: string) {
    const normalized = value
      .replace(/^[:\s-]+/, '')
      .replace(/[▪■□]/g, ' ')
      .replace(/[•]\s*/g, '\n')
      .replace(/\bth\s+fectively\.\s*/gi, '')
      .replace(/\s+([.,;:])/g, '$1')
      .trim();
    const lines = normalized
      .split(/\n+/)
      .map((line) => this.cleanPdfText(line))
      .map((line) =>
        line.replace(
          /\bThis course aims to provide students with\s+$/i,
          '',
        ),
      )
      .map((line) => line.trim())
      .filter((line) => line.length > 20)
      .filter(
        (line) =>
          !/^This course aims to provide students with User Experience\b/i.test(
            line,
          ),
      );
    const unique: string[] = [];

    for (const line of lines) {
      const isDuplicate = unique.some(
        (existing) =>
          existing.includes(line) ||
          line.includes(existing) ||
          this.normalizeForComparison(existing) ===
            this.normalizeForComparison(line),
      );

      if (!isDuplicate) {
        unique.push(line);
      }
    }

    return unique.join('\n');
  }

  private normalizeForComparison(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  private extractPrerequisites(text: string) {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const startMatch = normalizedText.match(/\bPrerequisite\b/i);

    if (!startMatch || startMatch.index === undefined) {
      return '';
    }

    const start = startMatch.index + startMatch[0].length;
    const afterStart = normalizedText.slice(start);
    const endMatch = afterStart.match(
      /\b(Course\s+Objective\s*s|Course\s+Learning\s+Outcomes|Contribution\s+of\s+the\s+Course|Course\s+Structure)\b/i,
    );

    return afterStart
      .slice(0, endMatch?.index ?? undefined)
      .replace(/^\s*(?:\([^)]*\))?\s*[:\s-]*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractWeeklyTopics(text: string) {
    const calendarText = this.normalizeCalendarOcrWeekMarkers(
      this.extractCalendarSection(text),
    );
    const lines = calendarText
      .split(/\n/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .filter(
        (line) =>
          !/^(course calendar|week\/place|course topic|to do|assignments?\s*&?\s*deadline\*?)$/i.test(
            line,
          ),
      );
    const rows: Array<{
      weekNo: number;
      lines: string[];
    }> = [];
    let current:
      | {
          weekNo: number;
          lines: string[];
        }
      | null = null;

    for (const line of lines) {
      const weekMatch = line.match(/^(?:W|Week)\s*(\d{1,2})\b(.*)$/i);

      if (weekMatch) {
        if (current) rows.push(current);

        current = {
          weekNo: Number(weekMatch[1]),
          lines: weekMatch[2]?.trim() ? [weekMatch[2].trim()] : [],
        };
        continue;
      }

      if (current) {
        current.lines.push(line);
      }
    }

    if (current) rows.push(current);

    const parsedRows = rows
      .filter((row) => row.weekNo >= 1 && row.weekNo <= 16)
      .map((row) => this.parseCalendarRow(row.weekNo, row.lines));

    const collapsedRows = this.extractCollapsedWeeklyTopics(calendarText);

    if (collapsedRows.length) {
      const parsedUniqueCount = new Set(parsedRows.map((row) => row.weekNo)).size;
      const collapsedUniqueCount = new Set(
        collapsedRows.map((row) => row.weekNo),
      ).size;

      if (collapsedUniqueCount >= parsedUniqueCount || parsedRows.length < 10) {
        return this.ensureFinalExamWeek(this.dedupeWeeklyTopics(collapsedRows));
      }
    }

    if (parsedRows.length >= 10) {
      return this.ensureFinalExamWeek(this.dedupeWeeklyTopics(parsedRows));
    }

    const fallbackRows = Array.from(
      text.matchAll(/(?:week|w)\s*(\d{1,2})\s*[:.-]?\s*([^.;\n]{5,160})/gi),
    )
      .filter((match) => {
        const weekNo = Number(match[1]);
        return weekNo >= 1 && weekNo <= 16;
      })
      .slice(0, 16)
      .map((match) => ({
        weekNo: Number(match[1]),
        place: '',
        topic: match[2].trim(),
        details: '',
        todo: '',
      }));

    return this.ensureFinalExamWeek(this.dedupeWeeklyTopics(fallbackRows));
  }

  private dedupeWeeklyTopics(
    weeks: CourseSyllabusSummary['weeklyTopics'],
  ): CourseSyllabusSummary['weeklyTopics'] {
    const byWeek = new Map<number, CourseSyllabusSummary['weeklyTopics'][number]>();

    for (const week of weeks) {
      const weekNo = Number(week.weekNo);

      if (!Number.isInteger(weekNo)) {
        continue;
      }

      byWeek.set(weekNo, { ...week, weekNo });
    }

    return Array.from(byWeek.values()).sort(
      (a, b) => Number(a.weekNo) - Number(b.weekNo),
    );
  }

  private ensureFinalExamWeek(
    weeks: CourseSyllabusSummary['weeklyTopics'],
  ): CourseSyllabusSummary['weeklyTopics'] {
    const weekNos = new Set(
      weeks
        .map((week) => Number(week.weekNo))
        .filter((weekNo) => Number.isInteger(weekNo)),
    );
    const hasCompleteCourseWeeks = Array.from(
      { length: 15 },
      (_, index) => index + 1,
    ).every((weekNo) => weekNos.has(weekNo));

    if (!hasCompleteCourseWeeks || weekNos.has(16)) {
      return weeks;
    }

    return [...weeks, this.createFinalExamWeek()];
  }

  private extractCollapsedWeeklyTopics(text: string) {
    const normalized = this.normalizeCalendarOcrWeekMarkers(text)
      .replace(/\s+/g, ' ')
      .trim();
    const markers = Array.from(
      normalized.matchAll(/(?:^|\s)(?:W|Week)\s*(\d{1,2})\b/gi),
    )
      .map((match) => ({
        weekNo: Number(match[1]),
        index: match.index ?? 0,
        markerLength: match[0].length,
      }))
      .filter((marker) => marker.weekNo >= 1 && marker.weekNo <= 16);

    return markers.map((marker, index) => {
      const nextMarker = markers[index + 1];
      const segment = normalized
        .slice(
          marker.index + marker.markerLength,
          nextMarker?.index ?? normalized.length,
        )
        .trim();

      return this.parseCollapsedCalendarRow(marker.weekNo, segment);
    });
  }

  private normalizeCalendarOcrWeekMarkers(text: string) {
    return text.replace(/\b(W|Week)\s*1\s+([1-6])\b/gi, (_match, label, digit) => {
      const normalizedLabel = /^week$/i.test(label) ? 'Week' : 'W';
      return `${normalizedLabel}1${digit}`;
    });
  }

  private parseCollapsedCalendarRow(weekNo: number, segment: string) {
    const placeMatch = segment.match(/^(?:\d+\s+)?(f2f|online|hybrid)\b/i);
    const place = placeMatch ? this.normalizeCalendarPlace(placeMatch[1]) : '';
    let withoutPlace = segment
      .replace(/^(f2f|online|hybrid)\b/i, '')
      .replace(/\b(matters\s+needing\s+attention|academic\s+integrity|course\s+policies|prepared\s+by)\b[\s\S]*$/i, '')
      .trim();
    const datePrefix = this.extractCalendarDatePrefix(withoutPlace);
    withoutPlace = datePrefix.text;
    const trailingDetailMatch = withoutPlace.match(
      /\s((?:ALA|Seminar)\s*-\s*\d+(?:\s*\([^)]*\))?|FINAL\s+EXAM)(?:\s+\d+)?\s*$/i,
    );
    const trailingDetails = trailingDetailMatch?.[1] || '';
    const withoutTrailingDetails = trailingDetailMatch?.index
      ? withoutPlace.slice(0, trailingDetailMatch.index).trim()
      : withoutPlace;
    const assignmentMatch = withoutTrailingDetails.match(
      /\b(project\s+upload\s+#?\d*|assignments?\b|deadline\b|due\b)/i,
    );
    const beforeAssignment = assignmentMatch
      ? withoutTrailingDetails.slice(0, assignmentMatch.index).trim()
      : withoutTrailingDetails;
    const assignmentDetails = assignmentMatch
      ? withoutTrailingDetails.slice(assignmentMatch.index).trim()
      : '';
    const details = [assignmentDetails, trailingDetails]
      .filter(Boolean)
      .join(' ')
      .trim();
    const todoMatch = beforeAssignment.match(
      /\s(\*+\s*Review\b[\s\S]*|Read the course notes[\s\S]*|Review course materials[\s\S]*|Prepare\b[\s\S]*)/i,
    );
    const rawTopic = todoMatch
      ? beforeAssignment.slice(0, todoMatch.index).trim()
      : beforeAssignment;
    const rawTodo = todoMatch
      ? beforeAssignment.slice(todoMatch.index).trim()
      : '';
    const topic = rawTopic.replace(/\s+/g, ' ').trim();
    const cleanedTopic = topic.replace(/\s+\d+\s*$/, '').trim();
    const todo = rawTodo
      .replace(/\*+\s*/g, '; ')
      .replace(/^;\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    const cleaned = this.cleanCalendarTopicAndTodo(cleanedTopic, todo);
    const normalizedTopic = /^mid\s*-\s*term\s+week$/i.test(cleaned.topic)
      ? 'Midterm Exam Week'
      : cleaned.topic;

    return {
      weekNo,
      place: place || datePrefix.place,
      topic: normalizedTopic || 'Not published yet',
      details,
      todo: cleaned.todo,
    };
  }

  private extractCalendarDatePrefix(value: string) {
    const monthPattern =
      'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';
    const match = value.match(
      new RegExp(
        `^(\\d{1,2}\\s+(?:${monthPattern}))\\s+(\\d{1,2}\\s+(?:${monthPattern}))\\s+([\\s\\S]+)$`,
        'i',
      ),
    );

    if (!match) {
      return { place: '', text: value };
    }

    return {
      place: `${this.cleanPdfText(match[1])} / ${this.cleanPdfText(match[2])}`,
      text: match[3].trim(),
    };
  }

  private extractCalendarSection(text: string) {
    const normalized = text.replace(/\r/g, '');
    const startMatch = normalized.match(/course\s+calendar/i);

    if (startMatch?.index === undefined) {
      return normalized;
    }

    const start = startMatch.index;
    const afterStart = normalized.slice(start);
    const endMatch = afterStart.match(
      /\b(matters\s+needing\s+attention|academic\s+integrity|course\s+policies|prepared\s+by)\b/i,
    );

    return endMatch?.index ? afterStart.slice(0, endMatch.index) : afterStart;
  }

  private parseCalendarRow(weekNo: number, rowLines: string[]) {
    const place =
      rowLines.find((line) => /^(f2f|online|hybrid)$/i.test(line.trim())) ||
      '';
    const content = rowLines
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^(f2f|online|hybrid)$/i.test(line))
      .filter((line) => !/^\d+$/.test(line));

    const assignmentStart = content.findIndex(
      (line, index) =>
        index > 0 &&
        /(project\s+upload|assignment|deadline|due|upload\s+#|final\s+version)/i.test(
          line,
        ),
    );
    const topicAndTodo =
      assignmentStart >= 0 ? content.slice(0, assignmentStart) : content;
    const assignmentLines =
      assignmentStart >= 0 ? content.slice(assignmentStart) : [];
    const firstTodoIndex = topicAndTodo.findIndex((line, index) => {
      if (index === 0) return false;

      return (
        /^-/.test(line) ||
        /^(lecture|lab|practice)$/i.test(line) ||
        /read|review|prepare|course schedule|expectation/i.test(line)
      );
    });
    const topicLines =
      firstTodoIndex >= 0 ? topicAndTodo.slice(0, firstTodoIndex) : topicAndTodo;
    const todoLines =
      firstTodoIndex >= 0 ? topicAndTodo.slice(firstTodoIndex) : [];
    const topic = topicLines.join(' ').replace(/\s+/g, ' ').trim();
    const todo = todoLines
      .join(' ')
      .replace(/\s*-\s*/g, '; ')
      .replace(/^;\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    const details = assignmentLines.join(' ').replace(/\s+/g, ' ').trim();
    const cleaned = this.cleanCalendarTopicAndTodo(topic, todo);

    return {
      weekNo,
      place: this.normalizeCalendarPlace(place),
      topic: cleaned.topic || 'Not published yet',
      details,
      todo: cleaned.todo,
    };
  }

  private cleanCalendarTopicAndTodo(topic: string, todo: string) {
    if (/^no\s+lecture\b/i.test(topic) || /^term\s+review\b/i.test(topic)) {
      return {
        topic: this.cleanPdfText(topic),
        todo: this.cleanPdfText(todo),
      };
    }

    const inlineTodoMatch = topic.match(
      /^(.+?)(?:\s+-\s+|\s+)(Course\s+Schedule|Expectations|Review|Read\b|Prepare\b|Lecture\b|Lab\b|Practice\b)(.+)?$/i,
    );

    if (!inlineTodoMatch) {
      return {
        topic: this.cleanPdfText(topic),
        todo: this.cleanPdfText(todo),
      };
    }

    const extractedTodo = [inlineTodoMatch[2], inlineTodoMatch[3] || '']
      .join('')
      .replace(/\s*-\s*/g, '; ')
      .replace(/^;\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      topic: this.cleanPdfText(inlineTodoMatch[1].trim()),
      todo: this.cleanPdfText([todo, extractedTodo].filter(Boolean).join('; ')),
    };
  }

  private normalizeCalendarPlace(value: string) {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'f2f') return 'F2F';
    if (normalized === 'online') return 'Online';
    if (normalized === 'hybrid') return 'Hybrid';

    return '';
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
        triggers: ['project', 'deadline', 'due', 'submit', 'submission'],
        keywords: [
          'course calendar',
          'project',
          'presentation',
          'upload',
          'submission',
          'deadline',
          'due',
          'final version',
          'week',
        ],
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

  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        setTimeout(
          () => reject(new ServiceUnavailableException(message)),
          timeoutMs,
        );
      }),
    ]);
  }

  private generateInstructorAdviceFallback(
    adviceType: InstructorAdviceType,
    courseText: string,
  ) {
    if (adviceType === 'GRADING_CONSISTENCY_CHECK') {
      return this.generateGradingFallback(courseText);
    }

    if (adviceType === 'RESOURCE_RECOMMENDATION') {
      return this.generateResourceFallback(courseText);
    }

    if (adviceType === 'ANNOUNCEMENT_DRAFT_GENERATOR') {
      return this.generateAnnouncementFallback(courseText);
    }

    return this.generateGapAnalysisFallback(courseText);
  }

  private generateGapAnalysisFallback(courseText: string) {
    const issues: string[] = [];

    if (!this.hasUsableOfficeHours(courseText)) {
      issues.push(
        'Office hours are weak or not specific. Add a clear day/time or explain where students can find the official schedule.',
      );
    }

    const gradingItems = this.extractGradingItems(courseText);
    const gradingTotal = this.getGradingWeightTotal(gradingItems);

    if (!gradingItems.length) {
      issues.push('Grading components were not clearly detected. Add a grading table with assignment, scoring, and weight columns.');
    } else if (Math.abs(gradingTotal - 100) > 1) {
      issues.push(`Detected grading weights total ${gradingTotal}%. Review the grading table so it clearly totals 100%.`);
    }

    const resources = this.extractCourseResources(courseText, []);
    if (!resources.length) {
      issues.push('Course resources are missing or unclear. Add required and optional materials separately.');
    }

    if (!/\b(W\d+|Week\s+\d+)\b/i.test(courseText)) {
      issues.push('Weekly course calendar was not clearly detected. Add week-by-week topics and deadlines.');
    }

    if (!/\b(deadline|project upload|quiz|midterm|final exam)\b/i.test(courseText)) {
      issues.push('Important assessment dates are not clear. Add quiz, project upload, midterm, or final exam week information if applicable.');
    }

    const finalIssues = issues.length
      ? issues
      : ['No major syllabus gaps were detected from the indexed PDF text. Instructor review is still recommended before publishing.'];

    return [
      'Syllabus Gap Analysis',
      'Instructor review required before publishing changes.',
      '',
      ...finalIssues.map((issue) => `- ${issue}`),
    ].join('\n');
  }

  private sanitizeGapAnalysisAnswer(answer: string, courseText: string) {
    if (!this.hasUsableOfficeHours(courseText)) {
      return answer;
    }

    const lines = answer.split('\n');
    const filteredLines = lines.filter(
      (line) =>
        !(
          /office\s+hours?/i.test(line) &&
          /\b(weak|missing|unclear|not specific|not published|tba|to be announced)\b/i.test(
            line,
          )
        ),
    );
    const hasIssueLine = filteredLines.some((line) => /^\s*-\s+/.test(line));

    if (hasIssueLine) {
      return filteredLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    return [
      'Syllabus Gap Analysis',
      'Instructor review required before publishing changes.',
      '',
      '- No major syllabus gaps were detected from the indexed PDF text. Instructor review is still recommended before publishing.',
    ].join('\n');
  }

  private hasUsableOfficeHours(courseText: string) {
    const officeHours = this.extractInstructorOfficeHours(courseText);

    return Boolean(
      officeHours &&
        !/not published|tba|to be announced/i.test(officeHours) &&
        /\b(posted|door|appointment|contact|email|online|office|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\s*[:.]\s*\d{2})\b/i.test(
          officeHours,
        ),
    );
  }

  private generateGradingFallback(courseText: string) {
    const gradingItems = this.extractGradingItems(courseText);

    if (!gradingItems.length) {
      return [
        'Grading Consistency Check',
        'Instructor review required.',
        '',
        '- I could not detect a clear grading table from the indexed syllabus text.',
        '- Add grading components with assignment name, description, scoring, and weight (%).',
      ].join('\n');
    }

    const total = this.getGradingWeightTotal(gradingItems);
    const rows = gradingItems.map((item) => {
      const parts = item.description.split('|').map((part) => part.trim());
      const scoring = parts[1] || 'scoring not clear';
      return `- ${item.label}: ${item.value} (${scoring} points)`;
    });

    return [
      'Grading Consistency Check',
      'Instructor review required.',
      '',
      ...rows,
      `- Detected total weight: ${total}%.`,
      Math.abs(total - 100) <= 1
        ? '- The detected grading weights appear to total 100%.'
        : '- The detected grading weights do not clearly total 100%; review the PDF table and extracted values.',
    ].join('\n');
  }

  private generateResourceFallback(courseText: string) {
    const existingResources = this.extractCourseResources(courseText, []);
    const topics = this.extractFallbackTopics(courseText);
    const topicText = topics.length ? topics.slice(0, 4).join(', ') : 'the weekly course topics';
    const recommendations = this.generateConcreteResourceRecommendations(
      courseText,
      topics,
      existingResources,
    );

    return [
      'Optional Resource Recommendations',
      'Instructor review required before adding any item to the syllabus.',
      'AI-generated concrete resource selection was not available, so no course-specific external resource names were auto-invented.',
      '',
      existingResources.length
        ? `Detected existing resources: ${existingResources.slice(0, 3).join('; ')}`
        : 'No clearly separated course resources were detected.',
      '',
      `Based on ${topicText}, optional additions could include:`,
      ...recommendations,
    ].join('\n');
  }

  private generateConcreteResourceRecommendations(
    courseText: string,
    topics: string[],
    existingResources: string[],
  ) {
    return this.generateTopicBasedResourceSlots(topics);

    const haystack = `${topics.join(' ')} ${courseText}`.toLowerCase();
    const existing = existingResources.join(' ').toLowerCase();
    const recommendations: string[] = [];

    const addRecommendation = (
      name: string,
      supports: string,
      reason: string,
      duplicateHints: string[] = [name],
    ) => {
      if (
        duplicateHints.some((hint) =>
          existing.includes(hint.toLowerCase().slice(0, 40)),
        )
      ) {
        return;
      }

      recommendations.push(
        `- instructor-review-required: ${name} — supports ${supports}. ${reason}`,
      );
    };

    const isGraphicsCourse =
      /\b(computer graphics|graphics programming|animation|processing|coordinate systems?|2d|3d|geometric transformation|visual programming|java technologies)\b/i.test(
        haystack,
      );
    const isDataScienceCourse =
      !isGraphicsCourse &&
      /\b(rstudio|r programming|programming in r|data science|ggplot|eda|sql|regression|data frames?|tidyverse|dplyr|tidyr|hypothesis testing|data visualization)\b/i.test(
        haystack,
      );

    if (isGraphicsCourse) {
      addRecommendation(
        'Computer Graphics: Principles and Practice by John F. Hughes, Andries van Dam, Morgan McGuire, David Sklar, James D. Foley, Steven Feiner, and Kurt Akeley',
        'computer graphics fundamentals, coordinate systems, transformations, and rendering concepts',
        'Useful as an optional deeper reference for students who want a broader theory background.',
        ['Computer Graphics: Principles and Practice'],
      );
      addRecommendation(
        'LearnOpenGL by Joey de Vries',
        'coordinate systems, transformations, rendering pipeline concepts, and graphics programming practice',
        'Can support optional visual examples even if the official course implementation uses another graphics environment.',
        ['LearnOpenGL'],
      );
      addRecommendation(
        'The Nature of Code by Daniel Shiffman',
        'animation, interaction, motion, and creative coding concepts',
        'Fits optional enrichment for students building graphics or animation projects.',
        ['The Nature of Code'],
      );
      addRecommendation(
        'Processing Reference documentation',
        'Processing syntax, drawing functions, interaction, images, and animation APIs',
        'A practical quick reference aligned with the existing Processing textbooks.',
        ['Processing Reference'],
      );
      addRecommendation(
        'Khan Academy Linear Algebra',
        'vectors, matrices, transformations, and geometry prerequisites used in graphics topics',
        'Helpful only as optional background support for students who need math review.',
        ['Khan Academy Linear Algebra'],
      );
    }

    if (isDataScienceCourse) {
      addRecommendation(
        'Hands-On Programming with R by Garrett Grolemund',
        'R syntax, functions, control structures, and basic programming practice',
        'Useful for students who need extra R background before weekly data tasks.',
      );
      addRecommendation(
        'ggplot2: Elegant Graphics for Data Analysis by Hadley Wickham',
        'data visualization and ggplot2 weeks',
        'A focused optional reference for visualization assignments and examples.',
        ['ggplot2', 'Elegant Graphics'],
      );
      addRecommendation(
        'SQLBolt interactive SQL lessons',
        'SQL querying and database-related weekly topics',
        'Provides short browser-based exercises that can support optional practice.',
      );
      addRecommendation(
        'OpenIntro Statistics',
        'descriptive statistics, hypothesis testing, and regression topics',
        'Can help students review statistics concepts used in data analysis weeks.',
      );
      addRecommendation(
        'Posit Cheatsheets for RStudio, dplyr, tidyr, and ggplot2',
        'RStudio workflow, data cleaning, and tidyverse usage',
        'Good as quick optional references during labs or project work.',
        ['Posit Cheatsheets', 'RStudio Cheatsheets'],
      );
    }

    if (/\b(erp|sap|business process|process reengineering|operations management|bpmn)\b/i.test(haystack)) {
      addRecommendation(
        'SAP Learning Journey: Business Process Integration',
        'ERP and SAP business process integration topics',
        'Official SAP learning material can reinforce platform-specific course concepts.',
        ['SAP Learning Journey'],
      );
      addRecommendation(
        'APQC Process Classification Framework',
        'business process analysis and redesign topics',
        'Provides a structured reference for comparing and improving business processes.',
        ['APQC'],
      );
      addRecommendation(
        'Camunda BPMN 2.0 Tutorial',
        'business process modeling and workflow representation',
        'Useful if the instructor wants optional process modeling practice.',
        ['Camunda', 'BPMN'],
      );
    }

    if (
      !isGraphicsCourse &&
      /\b(data structures|algorithm|programming|object oriented|java|python)\b/i.test(
        haystack,
      )
    ) {
      addRecommendation(
        'OpenDSA Data Structures and Algorithms',
        'data structures, algorithms, and programming practice',
        'Offers interactive exercises that can support optional weekly review.',
        ['OpenDSA'],
      );
      addRecommendation(
        'Visualgo',
        'algorithm visualization and data structure behavior',
        'Can help students inspect sorting, graph, tree, and heap operations visually.',
        ['Visualgo'],
      );
    }

    if (recommendations.length) {
      return recommendations.slice(0, 5);
    }

    return [
      '- instructor-review-required: MIT OpenCourseWare topic-related lecture notes — supports the main course concepts detected in the weekly schedule. Use only the specific pages that match the instructor-approved syllabus topics.',
      '- instructor-review-required: OpenStax topic-related chapters — supports prerequisite or background review. Select chapters manually after checking alignment with the official syllabus.',
      '- instructor-review-required: Official documentation for the course software tools — supports tool usage mentioned in the syllabus. Add only the relevant documentation pages after instructor review.',
    ];
  }

  private generateTopicBasedResourceSlots(topics: string[]) {
    const topicRecommendations = topics
      .slice(0, 5)
      .map(
        (topic) =>
          `- instructor-review-required: Select one instructor-approved optional book, article, official documentation page, or practice resource for "${topic}". Add the exact title/link only after instructor review.`,
      );

    if (topicRecommendations.length) {
      return topicRecommendations;
    }

    return [
      '- instructor-review-required: Select one instructor-approved optional textbook or article aligned with the main weekly topics. Add the exact title/link only after instructor review.',
      '- instructor-review-required: Select official documentation for any software, platform, or tool explicitly used in the syllabus. Add only the relevant pages after instructor review.',
      '- instructor-review-required: Select optional practice material for students who need background support. Confirm alignment with the syllabus before publishing.',
    ];
  }

  private generateAnnouncementFallback(courseText: string) {
    const eventHints = this.sortAnnouncementEventHints(
      this.extractFallbackEventHints(courseText),
    );
    const eventText = eventHints.length
      ? eventHints.slice(0, 4).join(', ')
      : `upcoming course activities from Week ${CURRENT_ACADEMIC_WEEK} onward`;
    const drafts = this.generateAnnouncementDraftLines(eventHints, courseText);

    return [
      'Announcement Drafts',
      'Instructor review required before publishing.',
      '',
      `Detected event focus: ${eventText}.`,
      '',
      ...drafts,
    ].join('\n');
  }

  private getGradingWeightTotal(
    gradingItems: Array<{ value: string; description: string; label: string }>,
  ) {
    return gradingItems.reduce((total, item) => {
      const value = Number(item.value.match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
      return total + (Number.isFinite(value) ? value : 0);
    }, 0);
  }

  private extractFallbackTopics(courseText: string) {
    const matches = Array.from(
      courseText.matchAll(/\bW\d+\s+(?:F2F|ONLINE|Hybrid)?\s*([^W]{8,90})/gi),
    )
      .map((match) => this.cleanPdfText(match[1]))
      .filter((topic) => topic.length >= 8);

    return Array.from(new Set(matches)).slice(0, 8);
  }

  private extractFallbackEventHints(courseText: string) {
    const normalized = this.cleanPdfText(courseText);
    const hints: string[] = this.extractCalendarEventHints(courseText);

    const add = (hint: string) => {
      if (!hints.includes(hint)) hints.push(hint);
    };

    if (/\bquiz(?:zes)?\b/i.test(normalized) && !hints.some((hint) => /quiz/i.test(hint))) {
      add('Quiz');
    }
    if (/\bmidterm(?:\s+exam)?\b/i.test(normalized) && !hints.some((hint) => /midterm/i.test(hint))) {
      add(`Midterm Exam${this.extractEventWeek(normalized, /midterm/i)}`);
    }
    if (/\bfinal(?:\s+exam)?\b/i.test(normalized) && !hints.some((hint) => /final/i.test(hint))) {
      add('Week 16: Final Exam');
    }
    if (
      /\bproject\s+upload\b|\buploads?\s+throughout\b|\bmake\s+\d+\s+uploads?\b/i.test(normalized) &&
      !hints.some((hint) => /project upload/i.test(hint))
    ) {
      add('Project Upload');
    }
    if (
      /\bproject\s+presentation(?:s)?\b/i.test(normalized) &&
      !hints.some((hint) => /project presentation/i.test(hint))
    ) {
      add('Project Presentation');
    }
    if (/\bcoursera|cousera\b/i.test(normalized)) {
      add('Coursera Application');
    }
    if (/\bread\s+the\s+course\s+notes\b|\bcourse\s+resources\b|\btextbook\b/i.test(normalized)) {
      add('Course Resources Reminder');
    }

    return hints;
  }

  private extractCalendarEventHints(courseText: string) {
    const weeks = this.extractWeeklyTopics(courseText)
      .filter((week) => Number.isInteger(Number(week.weekNo)))
      .map((week) => ({
        weekNo: Number(week.weekNo),
        text: this.cleanPdfText(
          [week.topic, week.details, week.todo].filter(Boolean).join(' '),
        ),
      }))
      .filter((week) => week.weekNo >= CURRENT_ACADEMIC_WEEK);
    const hints: string[] = [];
    const add = (hint: string) => {
      if (!hints.includes(hint)) hints.push(hint);
    };

    for (const week of weeks) {
      if (/\bquiz(?:zes)?\b/i.test(week.text)) {
        add(`Week ${week.weekNo}: Quiz`);
      }
      if (/\bmidterm(?:\s+exam)?\b/i.test(week.text)) {
        add(`Week ${week.weekNo}: Midterm Exam`);
      }
      if (/\bfinal(?:\s+exam)?\b/i.test(week.text)) {
        add(`Week ${week.weekNo}: Final Exam`);
      }
      if (/\bproject\s+upload\b|\bupload\s*#?\d+\b|\bsubmission\b/i.test(week.text)) {
        add(`Week ${week.weekNo}: Project Upload`);
      }
      if (/\bproject\s+presentation(?:s)?\b|\bpresentations?\b/i.test(week.text)) {
        add(`Week ${week.weekNo}: Project Presentation`);
      }
      if (/\bcoursera|cousera\b/i.test(week.text)) {
        add(`Week ${week.weekNo}: Coursera Application`);
      }
    }

    if (
      !hints.some((hint) => /final/i.test(hint)) &&
      /\bfinal(?:\s+exam)?\b/i.test(this.cleanPdfText(courseText))
    ) {
      add('Week 16: Final Exam');
    }

    return hints;
  }

  private extractEventWeek(text: string, eventPattern: RegExp) {
    const weekRows = Array.from(
      text.matchAll(/\bW(?:eek)?\s*(\d{1,2})\b[\s\S]{0,180}?/gi),
    );

    for (const row of weekRows) {
      const rowText = row[0];
      if (eventPattern.test(rowText)) {
        return ` Week ${row[1]}`;
      }
    }

    return '';
  }

  private generateAnnouncementDraftLines(
    eventHints: string[],
    courseText: string,
  ) {
    const sortedHints = this.sortAnnouncementEventHints(eventHints);
    const projectPresentationHints = sortedHints.filter((hint) =>
      /project presentation/i.test(hint),
    );
    const groupedProjectPresentation = this.groupAnnouncementWeeks(
      projectPresentationHints,
      'Project Presentation',
    );
    const draftItems: Array<{ week: number; line: string }> = [];
    const addDraft = (hint: string, line: string) => {
      draftItems.push({
        week: this.getAnnouncementHintWeek(hint),
        line: `- instructor-review-required: ${line}`,
      });
    };

    if (groupedProjectPresentation) {
      addDraft(
        groupedProjectPresentation,
        `${groupedProjectPresentation} reminder: Please prepare your presentation materials and check the syllabus expectations before presentation week.`,
      );
    }

    for (const hint of sortedHints) {
      if (/project presentation/i.test(hint)) {
        continue;
      }

      if (/project upload/i.test(hint)) {
        addDraft(
          hint,
          `${hint} reminder: Please review the project upload requirements in the syllabus and submit the required file before the instructor-defined deadline.`,
        );
      } else if (/quiz/i.test(hint)) {
        addDraft(
          hint,
          `${hint} reminder: Please review the related weekly topics and course notes before the upcoming quiz.`,
        );
      } else if (/midterm/i.test(hint)) {
        addDraft(
          hint,
          `${hint} reminder: Please review the covered course topics and any instructor-provided exam guidance before the midterm.`,
        );
      } else if (/final/i.test(hint)) {
        addDraft(
          hint,
          `${hint} reminder: Please review all relevant chapters, course notes, and instructor-approved materials before the final exam.`,
        );
      } else if (/coursera|cousera/i.test(hint)) {
        addDraft(
          hint,
          `${hint} reminder: Please follow the syllabus instructions for the Coursera-related activity and complete the required work before the deadline.`,
        );
      } else if (/resources/i.test(hint)) {
        addDraft(
          hint,
          'Resource reminder: Please use the official course materials and any instructor-approved optional resources while preparing for weekly topics.',
        );
      }
    }

    if (draftItems.length) {
      return draftItems
        .sort((first, second) => first.week - second.week)
        .map((item) => item.line)
        .slice(0, 5);
    }

    const topics = this.extractFallbackTopics(courseText).slice(0, 2);
    return [
      topics.length
        ? `- instructor-review-required: Weekly preparation reminder: Please review ${topics.join(' and ')} before the next class.`
        : '- instructor-review-required: Weekly preparation reminder: Please review the upcoming course schedule and prepare the required materials before class.',
      '- instructor-review-required: Syllabus reminder: Please check the official syllabus for assessment rules, weekly expectations, and approved course resources.',
    ];
  }

  private sortAnnouncementEventHints(eventHints: string[]) {
    return [...eventHints].sort(
      (first, second) =>
        this.getAnnouncementHintWeek(first) - this.getAnnouncementHintWeek(second),
    );
  }

  private getAnnouncementHintWeek(hint: string) {
    const match = hint.match(/Week\s+(\d{1,2})/i);
    if (!match) {
      return Number.MAX_SAFE_INTEGER;
    }

    return Number(match[1]);
  }

  private groupAnnouncementWeeks(hints: string[], label: string) {
    const weeks = hints
      .map((hint) => this.getAnnouncementHintWeek(hint))
      .filter((week) => Number.isInteger(week) && week !== Number.MAX_SAFE_INTEGER)
      .sort((first, second) => first - second);

    if (!weeks.length) {
      return hints.length ? label : '';
    }

    const uniqueWeeks = Array.from(new Set(weeks));
    const isConsecutive = uniqueWeeks.every(
      (week, index) => index === 0 || week === uniqueWeeks[index - 1] + 1,
    );

    if (uniqueWeeks.length === 1) {
      return `Week ${uniqueWeeks[0]}: ${label}`;
    }

    if (isConsecutive) {
      return `Weeks ${uniqueWeeks[0]}-${uniqueWeeks[uniqueWeeks.length - 1]}: ${label}`;
    }

    return `Weeks ${uniqueWeeks.join(', ')}: ${label}`;
  }
}
