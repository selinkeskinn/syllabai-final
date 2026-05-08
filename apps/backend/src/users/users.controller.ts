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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './update-user.dto';
import { UpdatePasswordDto } from './update-password.dto';
import { UpdateNotificationPreferencesDto } from './update-notification-preferences.dto';

const avatarUploadDir = join(process.cwd(), 'uploads', 'avatars');

if (!existsSync(avatarUploadDir)) {
  mkdirSync(avatarUploadDir, { recursive: true });
}

const allowedAvatarMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const avatarUploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, avatarUploadDir);
    },
    filename: (req: any, file, cb) => {
      const userId = req.user?.userId ?? 'user';
      const safeBaseName = file.originalname
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 40);
      const extension = extname(file.originalname).toLowerCase();

      cb(null, `${Date.now()}-${userId}-${safeBaseName || 'avatar'}${extension}`);
    },
  }),
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!allowedAvatarMimeTypes.has(file.mimetype)) {
      cb(
        new BadRequestException('Only JPG, PNG, and WEBP images are allowed.'),
        false,
      );
      return;
    }

    cb(null, true);
  },
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
};

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Get all users (instructor only)' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  getMe(@Request() req: any) {
    return this.usersService.findById(req.user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(@Request() req: any, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req.user.userId, dto);
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Update current user password' })
  updatePassword(@Request() req: any, @Body() dto: UpdatePasswordDto) {
    return this.usersService.updatePassword(req.user.userId, dto);
  }

  @Get('me/notification-preferences')
  @ApiOperation({ summary: 'Get current user notification preferences' })
  getNotificationPreferences(@Request() req: any) {
    return this.usersService.getNotificationPreferences(req.user.userId);
  }

  @Patch('me/notification-preferences')
  @ApiOperation({ summary: 'Update current user notification preferences' })
  updateNotificationPreferences(
    @Request() req: any,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(req.user.userId, dto);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload current user avatar' })
  @UseInterceptors(FileInterceptor('file', avatarUploadOptions))
  uploadAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('An avatar image is required.');
    }

    return this.usersService.updateAvatar(
      req.user.userId,
      `/uploads/avatars/${file.filename}`,
    );
  }

  @Delete('me/avatar')
  @ApiOperation({ summary: 'Remove current user avatar' })
  removeAvatar(@Request() req: any) {
    return this.usersService.removeAvatar(req.user.userId);
  }

  @Patch('me/deactivate')
  @ApiOperation({ summary: 'Deactivate current user account' })
  deactivateMe(@Request() req: any) {
    return this.usersService.deactivate(req.user.userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Get user by ID (instructor only)' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}