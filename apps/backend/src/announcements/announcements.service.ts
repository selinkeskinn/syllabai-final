import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAnnouncementDto } from "./dto/create-announcement.dto";

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAnnouncementDto) {
    return this.prisma.announcement.create({
      data: {
        courseId: data.courseId,
        title: data.title,
        content: data.content,
        type: data.type ?? "INFO",
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
    return this.prisma.announcement.findMany({
      where: courseId ? { courseId } : undefined,
      orderBy: {
        createdAt: "desc",
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
