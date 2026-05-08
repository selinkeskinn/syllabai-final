import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@ApiTags('Announcements')
@Controller('announcements')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Create an announcement for own course (instructor only)' })
  create(@Body() body: CreateAnnouncementDto, @Request() req: any) {
    return this.announcementsService.create(body, req.user.userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get announcements based on authenticated user course access',
  })
  @ApiQuery({ name: 'courseId', required: false })
  findAll(@Request() req: any, @Query('courseId') courseId?: string) {
    return this.announcementsService.findAll(
      req.user.userId,
      req.user.role,
      courseId,
    );
  }
}