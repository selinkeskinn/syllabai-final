import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  create(@Body() body: CreateFeedbackDto) {
    return this.feedbackService.create(body);
  }

  @Get()
  findAll(@Query('courseId') courseId?: string) {
    return this.feedbackService.findAll(courseId);
  }
}
