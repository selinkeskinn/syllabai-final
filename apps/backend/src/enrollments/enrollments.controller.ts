import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './create-enrollment.dto';
import { JoinCourseDto } from './join-course.dto';

@ApiTags('Enrollments')
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all enrollments' })
  findAll() {
    return this.enrollmentsService.findAll();
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user enrollments' })
  findMine(@Request() req: any) {
    return this.enrollmentsService.findByUser(req.user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create enrollment directly' })
  create(@Body() body: CreateEnrollmentDto) {
    return this.enrollmentsService.create(body);
  }

  @Post('join')
  @ApiOperation({ summary: 'Join a course via join key' })
  joinWithKey(@Body() body: JoinCourseDto) {
    return this.enrollmentsService.joinWithKey(body);
  }
}
