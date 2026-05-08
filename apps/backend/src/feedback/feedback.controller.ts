import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@ApiTags('Feedback')
@Controller('feedback')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Submit feedback for an enrolled course (student only)' })
  create(@Body() body: CreateFeedbackDto, @Request() req: any) {
    return this.feedbackService.create(body, req.user.userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get feedback based on authenticated user course access',
  })
  @ApiQuery({ name: 'courseId', required: false })
  findAll(@Request() req: any, @Query('courseId') courseId?: string) {
    return this.feedbackService.findAll(req.user.userId, req.user.role, courseId);
  }
}