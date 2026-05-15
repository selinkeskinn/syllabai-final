import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  create(@Body() body: CreateFeedbackDto, @Request() req: any) {
    const userId = req.user?.userId ?? req.user?.sub ?? req.user?.id;
    return this.feedbackService.create(body, userId);
  }

  @Get()
  findAll(@Query('courseId') courseId?: string) {
    return this.feedbackService.findAll(courseId);
  }
}
