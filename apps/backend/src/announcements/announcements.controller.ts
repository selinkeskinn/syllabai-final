import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { AnnouncementsService } from "./announcements.service";
import { CreateAnnouncementDto } from "./dto/create-announcement.dto";

@Controller("announcements")
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  create(@Body() body: CreateAnnouncementDto) {
    return this.announcementsService.create(body);
  }

  @Get()
  findAll(@Query("courseId") courseId?: string) {
    return this.announcementsService.findAll(courseId);
  }
}
