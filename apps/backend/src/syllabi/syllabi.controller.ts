import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  BadRequestException,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SyllabiService } from './syllabi.service';
import { CreateSyllabusDto } from './create-syllabus.dto';
import { UpdateSyllabusDto } from './update-syllabus.dto';
import { CreateSyllabusWeekDto } from './create-syllabus-week.dto';
import { UpdateSyllabusWeekDto } from './update-syllabus-week.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

const syllabusUploadDir = join(process.cwd(), 'uploads', 'syllabi');

if (!existsSync(syllabusUploadDir)) {
  mkdirSync(syllabusUploadDir, { recursive: true });
}

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const syllabusUploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, syllabusUploadDir);
    },
    filename: (_req, file, cb) => {
      const safeBaseName = file.originalname
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 60);
      const extension = extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${safeBaseName || 'syllabus'}${extension}`);
    },
  }),
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(
        new BadRequestException('Only PDF, DOC, and DOCX files are allowed.'),
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

@ApiTags('Syllabi')
@Controller('syllabi')
export class SyllabiController {
  constructor(private readonly syllabiService: SyllabiService) {}

  @Get()
  @ApiOperation({ summary: 'List all syllabi' })
  findAll() {
    return this.syllabiService.findAll();
  }

  @Get('course/:courseId')
  @ApiOperation({ summary: 'Get syllabus by course ID' })
  findByCourse(@Param('courseId') courseId: string) {
    return this.syllabiService.findByCourseId(courseId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get syllabus by ID with weeks' })
  findOne(@Param('id') id: string) {
    return this.syllabiService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a syllabus for own course (instructor only)' })
  create(@Body() body: CreateSyllabusDto, @Request() req: any) {
    return this.syllabiService.create(body, req.user.userId);
  }

  @Post('course/:courseId/upload')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload a syllabus document for own course (instructor only)',
  })
  @UseInterceptors(FileInterceptor('file', syllabusUploadOptions))
  uploadDocument(
    @Param('courseId') courseId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('A syllabus document is required.');
    }

    return this.syllabiService.uploadDocument(courseId, file, req.user.userId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update own syllabus (creates version snapshot + notifies students)',
  })
  update(
    @Param('id') id: string,
    @Body() body: UpdateSyllabusDto,
    @Request() req: any,
  ) {
    return this.syllabiService.update(id, body, req.user.userId);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get syllabus version history' })
  getVersions(@Param('id') id: string) {
    return this.syllabiService.getVersions(id);
  }

  @Get(':syllabusId/weeks')
  @ApiOperation({ summary: 'Get all weeks of a syllabus' })
  findWeeks(@Param('syllabusId') syllabusId: string) {
    return this.syllabiService.findWeeks(syllabusId);
  }

  @Post(':syllabusId/weeks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a week to own syllabus (instructor only)' })
  createWeek(
    @Param('syllabusId') syllabusId: string,
    @Body() body: CreateSyllabusWeekDto,
    @Request() req: any,
  ) {
    return this.syllabiService.createWeek(syllabusId, body, req.user.userId);
  }

  @Put(':syllabusId/weeks/:weekId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own syllabus week (instructor only)' })
  updateWeek(
    @Param('syllabusId') syllabusId: string,
    @Param('weekId') weekId: string,
    @Body() body: UpdateSyllabusWeekDto,
    @Request() req: any,
  ) {
    return this.syllabiService.updateWeek(
      syllabusId,
      weekId,
      body,
      req.user.userId,
    );
  }

  @Delete(':syllabusId/weeks/:weekId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete own syllabus week (instructor only)' })
  deleteWeek(
    @Param('syllabusId') syllabusId: string,
    @Param('weekId') weekId: string,
    @Request() req: any,
  ) {
    return this.syllabiService.deleteWeek(
      syllabusId,
      weekId,
      req.user.userId,
    );
  }
}