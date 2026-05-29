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

    const fullCourseText = [...candidates]
      .sort((a, b) => {
        const resourceCompare = a.resourceId.localeCompare(b.resourceId);

        if (resourceCompare !== 0) return resourceCompare;

        return a.chunkIndex - b.chunkIndex;
      })
      .map((chunk) => chunk.content)
      .join('\n');
    const deterministicAnswer = this.generateDeterministicRagAnswer(
      question,
      fullCourseText,
    );
    const answer =
      deterministicAnswer ?? (await this.generateRagAnswer(question, context));
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
      const rawAnswer = await this.aiProvider.createAnswer([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);
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

  private answerSourceBoost(question: string, content: string) {
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

  private async generateRagAnswer(question: string, context: string) {
    const systemPrompt =
      'You are a course assistant. Answer only from the provided course document context. ' +
      'If the context does not contain the answer, say that the uploaded course documents do not include enough information. ' +
      'Keep answers short: use at most 4 bullet points or 4 short sentences. ' +
      'Do not add assumptions, inferred notes, caveats, or repeated explanations. ' +
      'If the user asks about grading, list only the grading components, scoring, weights, and one grading rule if explicitly present. ' +
      'Do not say “it can be inferred” or “the syllabus does not mention” unless that is the entire answer.';

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
      /\bOffice\s+Hours\s*:\s*:?\s*(.+?)(?=\s+CV\s*\(link\)|\s+Course Information\b)/i,
    );

    return this.preview(this.cleanPdfText(match?.[1] || ''), 180);
  }

  private extractPolicySection(
    text: string,
    startLabel: string,
    endLabels: string[],
  ) {
    const section = this.extractBetween(text, startLabel, endLabels);
    const repeatedHeading = new RegExp(`${this.escapeRegExp(startLabel)}:\\s*`, 'i');
    const headingMatch = section.match(repeatedHeading);
    const cleanSection =
      headingMatch?.index !== undefined
        ? section.slice(headingMatch.index + headingMatch[0].length)
        : section;

    return this.cleanPolicyText(cleanSection);
  }

  private cleanPolicyText(value: string) {
    const withLineBreaks = this.cleanPdfText(value)
      .replace(/\be-mail\b/gi, 'email')
      .replace(/\be\s*-\s*mail\b/gi, 'email')
      .replace(/\bMsTeams\b/g, 'MS Teams')
      .replace(/\bMat\s*erials\b/gi, 'Materials')
      .replace(/\bpa\s*rticipate\b/gi, 'participate')
      .replace(/\bdis\s*abilities\b/gi, 'disabilities')
      .replace(/\bcommunicatio\s+n\b/gi, 'communication')
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
    const section = this.extractBetween(text, 'Grading and Evaluation', [
      'TOTAL',
      'Course Calendar',
      'Course Policies',
      'Course Resources',
      'Matters Needing Attention',
      'Academic Integrity',
      'Prepared by',
    ]);

    if (!section) {
      return [];
    }

    const knownAssignments =
      'Coursera\\s+Application|Cousera\\s+Application|Final\\s+Exam|Midterm\\s+Exam|Project|Midterm|Final|Quiz|Homework|Assignment|Presentation|Participation|Lab|Exam';
    const normalized = section
      .replace(/\bAssignment\s+Description\s+Scoring\s+Weight\s*\(%\)/i, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const starredRows = Array.from(
      normalized.matchAll(
        new RegExp(
          `\\*\\s*(${knownAssignments})\\b\\s*([\\s\\S]*?)(?=\\s+\\*\\s*(?:${knownAssignments})\\b|\\s*$)`,
          'gi',
        ),
      ),
    );
    const rows = starredRows.length
      ? starredRows
      : Array.from(
          normalized.matchAll(
            new RegExp(
              `(?:^|\\s)(${knownAssignments})\\b\\s*([\\s\\S]*?)(?=\\s+(?:${knownAssignments})\\b|\\s*$)`,
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

    return extracted
      .replace(/^[:\s-]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
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
    const calendarText = this.extractCalendarSection(text);
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

    if (parsedRows.length >= 10) {
      return this.ensureFinalExamWeek(parsedRows);
    }

    const collapsedRows = this.extractCollapsedWeeklyTopics(calendarText);

    if (collapsedRows.length) {
      return this.ensureFinalExamWeek(collapsedRows);
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

    return this.ensureFinalExamWeek(fallbackRows);
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
    const normalized = text.replace(/\s+/g, ' ').trim();
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

  private parseCollapsedCalendarRow(weekNo: number, segment: string) {
    const placeMatch = segment.match(/^(?:\d+\s+)?(f2f|online|hybrid)\b/i);
    const place = placeMatch ? this.normalizeCalendarPlace(placeMatch[1]) : '';
    const withoutPlace = segment
      .replace(/^\d+\s+/, '')
      .replace(/^(f2f|online|hybrid)\b/i, '')
      .replace(/\b(matters\s+needing\s+attention|academic\s+integrity|course\s+policies|prepared\s+by)\b[\s\S]*$/i, '')
      .trim();
    const assignmentMatch = withoutPlace.match(
      /\b(project\s+upload\s+#?\d*|assignments?\b|deadline\b|due\b)/i,
    );
    const beforeAssignment = assignmentMatch
      ? withoutPlace.slice(0, assignmentMatch.index).trim()
      : withoutPlace;
    const details = assignmentMatch
      ? withoutPlace.slice(assignmentMatch.index).trim()
      : '';
    const todoMatch = beforeAssignment.match(
      /\s(-\s*[A-Za-z]|Read the course notes|Review\b|Prepare\b)/i,
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
      .replace(/\s*-\s*/g, '; ')
      .replace(/^;\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    const cleaned = this.cleanCalendarTopicAndTodo(cleanedTopic, todo);

    return {
      weekNo,
      place,
      topic: cleaned.topic || 'Not published yet',
      details,
      todo: cleaned.todo,
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
    const inlineTodoMatch = topic.match(
      /^(.+?)(?:\s+-\s+|\s+)(Course\s+Schedule|Expectations|Review|Read\b|Prepare\b|Lecture\b|Lab\b|Practice\b)(.+)?$/i,
    );

    if (!inlineTodoMatch) {
      return { topic, todo };
    }

    const extractedTodo = [inlineTodoMatch[2], inlineTodoMatch[3] || '']
      .join('')
      .replace(/\s*-\s*/g, '; ')
      .replace(/^;\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      topic: inlineTodoMatch[1].trim(),
      todo: [todo, extractedTodo].filter(Boolean).join('; '),
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
