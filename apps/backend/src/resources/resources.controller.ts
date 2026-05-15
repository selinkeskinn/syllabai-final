import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ResourcesService } from './resources.service';

const resourceUploadDir = join(process.cwd(), 'uploads', 'resources');

if (!existsSync(resourceUploadDir)) {
  mkdirSync(resourceUploadDir, { recursive: true });
}

const resourceUploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, resourceUploadDir),
    filename: (_req, file, cb) => {
      const safeBaseName = file.originalname
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 60);
      cb(null, `${Date.now()}-${safeBaseName || 'resource'}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new BadRequestException('Only PDF files are supported for AI resources.'), false);
      return;
    }

    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
};

@ApiTags('Course Resources')
@Controller('courses/:courseId/resources')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  @ApiOperation({ summary: 'List AI resources for a course' })
  findByCourse(@Param('courseId') courseId: string, @Request() req: any) {
    return this.resourcesService.findByCourse(
      courseId,
      req.user.userId,
      req.user.role,
    );
  }

  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles('INSTRUCTOR')
  @UseInterceptors(FileInterceptor('file', resourceUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload and index a course PDF for RAG' })
  upload(
    @Param('courseId') courseId: string,
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('A PDF file is required.');
    }

    return this.resourcesService.uploadAndIndex(
      courseId,
      req.user.userId,
      file,
    );
  }

  @Delete(':resourceId')
  @UseGuards(RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Delete a course PDF resource and its chunks' })
  delete(
    @Param('courseId') courseId: string,
    @Param('resourceId') resourceId: string,
    @Request() req: any,
  ) {
    return this.resourcesService.delete(courseId, resourceId, req.user.userId);
  }
}
