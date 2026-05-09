import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Announcements')
@Controller('announcements')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Create announcement for own course' })
  create(@Body() body: CreateAnnouncementDto, @Request() req: any) {
    return this.announcementsService.create(body, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List announcements accessible by current user' })
  findAll(@Request() req: any, @Query('courseId') courseId?: string) {
    return this.announcementsService.findAll(
      req.user.userId,
      req.user.role,
      courseId,
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Update own course announcement' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateAnnouncementDto,
    @Request() req: any,
  ) {
    return this.announcementsService.update(id, body, req.user.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Delete own course announcement' })
  delete(@Param('id') id: string, @Request() req: any) {
    return this.announcementsService.delete(id, req.user.userId);
  }
}