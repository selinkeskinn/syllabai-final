import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ResourceStatus } from '@prisma/client';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import pdfParse from 'pdf-parse';
import { AiProviderService } from '../ai/ai-provider.service';
import { PrismaService } from '../prisma/prisma.service';
import { ResourceResponseDto } from './dto/resource-response.dto';

type UploadedResourceFile = Pick<
  Express.Multer.File,
  'originalname' | 'mimetype' | 'size' | 'filename' | 'path'
>;

const MAX_CHUNK_CHARS = 1200;
const CHUNK_OVERLAP_CHARS = 200;

@Injectable()
export class ResourcesService {
  private readonly logger = new Logger(ResourcesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: AiProviderService,
  ) {}

  async findByCourse(
    courseId: string,
    userId: string,
    role: string,
  ): Promise<ResourceResponseDto[]> {
    await this.ensureCourseAccess(courseId, userId, role);

    const resources = await this.prisma.courseResource.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    return resources.map((resource) => this.toResourceResponse(resource));
  }

  async uploadAndIndex(
    courseId: string,
    instructorId: string,
    file: UploadedResourceFile,
  ): Promise<ResourceResponseDto> {
    await this.ensureCourseOwner(courseId, instructorId);

    const resource = await this.prisma.courseResource.create({
      data: {
        courseId,
        uploadedById: instructorId,
        originalName: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        status: ResourceStatus.PROCESSING,
      },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    void this.indexResourceInBackground(resource.id, courseId, file.path);

    return this.toResourceResponse(resource);
  }

  async delete(courseId: string, resourceId: string, instructorId: string) {
    await this.ensureCourseOwner(courseId, instructorId);

    const resource = await this.prisma.courseResource.findFirst({
      where: { id: resourceId, courseId },
      select: {
        id: true,
        storedName: true,
        status: true,
      },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    if (resource.status === ResourceStatus.PROCESSING) {
      throw new BadRequestException(
        'Resource is still being indexed. Please wait until indexing finishes before deleting it.',
      );
    }

    await this.prisma.courseResource.delete({
      where: { id: resource.id },
    });

    try {
      await unlink(join(process.cwd(), 'uploads', 'resources', resource.storedName));
    } catch (error) {
      this.logger.warn(
        `Resource file could not be removed from disk: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    return {
      message: 'Resource deleted successfully',
      resourceId: resource.id,
    };
  }

  private async indexResourceInBackground(
    resourceId: string,
    courseId: string,
    filePath: string,
  ) {
    try {
      const pages = await this.extractPdfPages(filePath);
      const chunks = pages.flatMap((page) =>
        this.chunkText(page.content, page.pageNumber),
      );

      if (!chunks.length) {
        throw new BadRequestException(
          'PDF could not be processed. Please upload a text-based PDF, not a scanned/image-only PDF.',
        );
      }

      for (const [index, chunk] of chunks.entries()) {
        const embedding = await this.aiProvider.createEmbedding(chunk.content);

        await this.prisma.resourceChunk.create({
          data: {
            resourceId,
            courseId,
            chunkIndex: index,
            pageNumber: chunk.pageNumber,
            content: chunk.content,
            embedding,
          },
        });
      }

      await this.prisma.courseResource.update({
        where: { id: resourceId },
        data: { status: ResourceStatus.READY, errorMessage: null },
      });
    } catch (error) {
      const message = this.resolveIndexingErrorMessage(error);

      await this.prisma.courseResource.update({
        where: { id: resourceId },
        data: {
          status: ResourceStatus.FAILED,
          errorMessage: message.slice(0, 500),
        },
      });

      this.logger.warn(`Resource indexing failed: ${message}`);
    }
  }

  private async extractPdfPages(path: string) {
    const buffer = await readFile(path);
    const pages: Array<{ pageNumber: number; content: string }> = [];
    let pageNumber = 0;

    try {
      await pdfParse(buffer, {
        pagerender: async (pageData: any) => {
          pageNumber += 1;
          const textContent = await pageData.getTextContent();
          const content = textContent.items
            .map((item: { str?: string }) => item.str ?? '')
            .join(' ')
            .replace(/\s+\n/g, '\n')
            .trim();

          pages.push({ pageNumber, content });
          return content;
        },
      });
    } catch {
      throw new BadRequestException(
        'PDF could not be processed. Please upload a valid text-based PDF.',
      );
    }

    return pages.filter((page) => page.content.length > 0);
  }

  private chunkText(text: string, pageNumber: number) {
    const normalized = text
      .replace(/\r/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const paragraphs = normalized
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    const chunks: Array<{ content: string; pageNumber: number | null }> = [];
    let current = '';

    for (const paragraph of paragraphs) {
      const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

      if (candidate.length <= MAX_CHUNK_CHARS) {
        current = candidate;
        continue;
      }

      if (current) {
        chunks.push({ content: current, pageNumber });
      }

      if (paragraph.length <= MAX_CHUNK_CHARS) {
        current = paragraph;
        continue;
      }

      chunks.push(...this.chunkLongText(paragraph, pageNumber));
      current = '';
    }

    if (current) {
      chunks.push({ content: current, pageNumber });
    }

    return chunks.filter((chunk) => chunk.content.length > 20);
  }

  private chunkLongText(text: string, pageNumber: number) {
    const chunks: Array<{ content: string; pageNumber: number | null }> = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(text.length, start + MAX_CHUNK_CHARS);
      chunks.push({ content: text.slice(start, end).trim(), pageNumber });

      if (end === text.length) {
        break;
      }

      start = Math.max(end - CHUNK_OVERLAP_CHARS, start + 1);
    }

    return chunks;
  }

  private async ensureCourseOwner(courseId: string, instructorId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, instructorId: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.instructorId !== instructorId) {
      throw new ForbiddenException(
        'You can only manage resources for your own courses',
      );
    }
  }

  private async ensureCourseAccess(
    courseId: string,
    userId: string,
    role: string,
  ) {
    if (role === 'INSTRUCTOR') {
      await this.ensureCourseOwner(courseId, userId);
      return;
    }

    if (role === 'STUDENT') {
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { courseId, userId },
      });

      if (!enrollment) {
        throw new ForbiddenException('You are not enrolled in this course.');
      }

      return;
    }

    throw new ForbiddenException('Unsupported user role');
  }

  private toResourceResponse(resource: {
    id: string;
    courseId: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    status: ResourceStatus;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { chunks: number };
  }): ResourceResponseDto {
    return {
      resourceId: resource.id,
      courseId: resource.courseId,
      resourceName: resource.originalName,
      mimeType: resource.mimeType,
      sizeBytes: resource.sizeBytes,
      status: resource.status,
      errorMessage: resource.errorMessage,
      chunkCount: resource._count.chunks,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    };
  }

  private resolveIndexingErrorMessage(error: unknown) {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();

      if (typeof response === 'string') {
        return response;
      }

      if (
        response &&
        typeof response === 'object' &&
        'message' in response
      ) {
        const message = (response as { message?: unknown }).message;
        return Array.isArray(message) ? message.join(', ') : String(message);
      }
    }

    if (error instanceof Error) {
      return error.message.includes('Command token too long')
        ? 'PDF could not be processed. Please upload a valid text-based PDF.'
        : error.message;
    }

    return 'Resource indexing failed.';
  }
}
