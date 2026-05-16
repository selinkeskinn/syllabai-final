import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateFeedbackDto, userId?: string) {
    return this.prisma.feedback.create({
      data: {
        courseId: data.courseId,
        userId: data.isAnonymous ? null : userId,
        rating: data.rating,
        tags: data.tags,
        comment: data.comment?.trim() || null,
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
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
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }
}
