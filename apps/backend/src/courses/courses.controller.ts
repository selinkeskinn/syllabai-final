import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ResourcesService } from '../resources/resources.service';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './create-course.dto';
import { EnrollCourseDto } from './enroll-course.dto';
import { UpdateCourseDto } from './update-course.dto';

const courseResourceUploadDir = join(process.cwd(), 'uploads', 'resources');

if (!existsSync(courseResourceUploadDir)) {
  mkdirSync(courseResourceUploadDir, { recursive: true });
}

const courseResourceUploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, courseResourceUploadDir),
    filename: (_req, file, cb) => {
      const safeBaseName = file.originalname
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 60);
      cb(
        null,
        `${Date.now()}-${safeBaseName || 'resource'}${extname(
          file.originalname,
        ).toLowerCase()}`,
      );
    },
  }),
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (file.mimetype !== 'application/pdf') {
      cb(
        new BadRequestException('Only PDF files are supported for AI resources.'),
        false,
      );
      return;
    }

    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
};

@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly resourcesService: ResourcesService,
  ) {}

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
  @UseInterceptors(FileInterceptor('file', courseResourceUploadOptions))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Create a new course (instructor only)' })
  async create(
    @Body() body: CreateCourseDto,
    @Request() req: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const course = await this.coursesService.create({
      ...body,
      instructorId: req.user.userId,
    });

    if (!file) {
      return course;
    }

    const initialResource = await this.resourcesService.uploadAndIndex(
      course.id,
      req.user.userId,
      file,
    );

    return {
      ...course,
      initialResource,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a course (instructor only)' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateCourseDto,
    @Request() req: any,
  ) {
    return this.coursesService.update(id, body, req.user.userId);
  }

  @Delete(':id/enrollment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Leave an enrolled course (student only)' })
  leaveCourse(@Param('id') id: string, @Request() req: any) {
    return this.coursesService.leaveCourse(req.user.userId, id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a course (instructor only)' })
  delete(@Param('id') id: string, @Request() req: any) {
    return this.coursesService.delete(id, req.user.userId);
  }
}
