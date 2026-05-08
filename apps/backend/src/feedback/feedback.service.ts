import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateFeedbackDto) {
    return this.prisma.feedback.create({
      data: {
        courseId: data.courseId,
        rating: data.rating,
        tags: data.tags,
        comment: data.comment,
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
      },
    });
  }

  async findAll(courseId?: string) {
    return this.prisma.feedback.findMany({
      where: courseId ? { courseId } : undefined,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
      },
    });
  }
}
