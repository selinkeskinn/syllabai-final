import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService } from './ai.service';
import { AskQuestionDto } from './dto/ask-question.dto';
import { ChatDto } from './dto/chat.dto';

@ApiTags('AI')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ai/chat')
  @ApiOperation({
    summary: 'Ask AI about a course using syllabus-related context',
  })
  chat(@Request() req: any, @Body() dto: ChatDto) {
    return this.aiService.chat(req.user.userId, req.user.role, dto);
  }

  @Post('courses/:courseId/ai/ask')
  @ApiOperation({
    summary: 'Ask course-scoped RAG assistant using uploaded resources',
  })
  ask(
    @Param('courseId') courseId: string,
    @Request() req: any,
    @Body() dto: AskQuestionDto,
  ) {
    return this.aiService.askCourseQuestion(
      req.user.userId,
      req.user.role,
      courseId,
      dto.question,
    );
  }

  @Get('courses/:courseId/ai/syllabus-summary')
  @ApiOperation({
    summary: 'Extract structured syllabus summary from uploaded course PDFs',
  })
  syllabusSummary(@Param('courseId') courseId: string, @Request() req: any) {
    return this.aiService.generateCourseSyllabusSummary(
      req.user.userId,
      req.user.role,
      courseId,
    );
  }
}
