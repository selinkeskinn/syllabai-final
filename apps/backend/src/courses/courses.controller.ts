import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './create-course.dto';
import { EnrollCourseDto } from './enroll-course.dto';
import { UpdateCourseDto } from './update-course.dto';

@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: 'List all courses' })
  findAll() {
    return this.coursesService.findAll();
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get instructor\'s own courses' })
  findMyCourses(@Request() req: any) {
    return this.coursesService.findByInstructor(req.user.userId);
  }

  @Get('enrolled')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get student\'s enrolled courses' })
  findEnrolled(@Request() req: any) {
    return this.coursesService.findEnrolled(req.user.userId);
  }

  @Post('enroll')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enroll student in a course using join key' })
  enrollWithJoinKey(@Body() body: EnrollCourseDto, @Request() req: any) {
    return this.coursesService.enrollByJoinKey(req.user.userId, body.joinKey);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get course by ID with syllabus and deadlines' })
  findOne(@Param('id') id: string) {
    return this.coursesService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new course (instructor only)' })
  create(@Body() body: CreateCourseDto, @Request() req: any) {
    return this.coursesService.create({
      ...body,
      instructorId: req.user.userId,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a course (instructor only)' })
  update(@Param('id') id: string, @Body() body: UpdateCourseDto) {
    return this.coursesService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a course (instructor only)' })
  delete(@Param('id') id: string) {
    return this.coursesService.delete(id);
  }
}