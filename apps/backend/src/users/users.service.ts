import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './update-user.dto';
import { UpdatePasswordDto } from './update-password.dto';
import { UpdateNotificationPreferencesDto } from './update-notification-preferences.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: this.userSelect(),
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.userSelect(),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const data: any = {};

    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.trim().toLowerCase();

      this.validateEmailDomain(normalizedEmail, existingUser.role as string);

      const emailOwner = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (emailOwner && emailOwner.id !== id) {
        throw new ConflictException('Email already in use');
      }

      data.email = normalizedEmail;
    }

    if (dto.studentId !== undefined) {
      const normalizedStudentId = dto.studentId.trim();

      if (existingUser.role !== 'STUDENT' && normalizedStudentId) {
        throw new BadRequestException(
          'Student ID can only be set for student accounts',
        );
      }

      if (normalizedStudentId) {
        const studentIdOwner = await this.prisma.user.findUnique({
          where: { studentId: normalizedStudentId },
        });

        if (studentIdOwner && studentIdOwner.id !== id) {
          throw new ConflictException('Student ID already in use');
        }

        data.studentId = normalizedStudentId;
      } else {
        data.studentId = null;
      }
    }

    if (dto.firstName !== undefined) {
      data.firstName = dto.firstName.trim() || null;
    }

    if (dto.lastName !== undefined) {
      data.lastName = dto.lastName.trim() || null;
    }

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    } else if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const firstName =
        dto.firstName !== undefined
          ? dto.firstName.trim()
          : existingUser.firstName ?? '';

      const lastName =
        dto.lastName !== undefined
          ? dto.lastName.trim()
          : existingUser.lastName ?? '';

      const combinedName = `${firstName} ${lastName}`.trim();

      if (combinedName) {
        data.name = combinedName;
      }
    }

    if (data.name !== undefined && !data.name) {
      throw new BadRequestException('Name cannot be empty');
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: this.userSelect(),
    });
  }

  async updatePassword(id: string, dto: UpdatePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordMatch = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );

    if (!passwordMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Password confirmation does not match');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
      },
    });

    return {
      message: 'Password updated successfully',
    };
  }

  async getNotificationPreferences(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.notificationPreferencesSelect(),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateNotificationPreferences(
    id: string,
    dto: UpdateNotificationPreferencesDto,
  ) {
    await this.findById(id);

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: this.notificationPreferencesSelect(),
    });
  }
    async updateAvatar(id: string, avatarUrl: string) {
      await this.findById(id);

      return this.prisma.user.update({
        where: { id },
        data: { avatarUrl },
        select: this.userSelect(),
      });
    }

    async removeAvatar(id: string) {
      await this.findById(id);

      return this.prisma.user.update({
        where: { id },
        data: { avatarUrl: null },
        select: this.userSelect(),
      });
    }

    async deactivate(id: string) {
      await this.findById(id);

      await this.prisma.user.update({
        where: { id },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
        },
      });

      return {
        message: 'Account deactivated successfully',
      };
    }
  async create(email: string, name: string, password: string, role: string) {
    const normalizedEmail = email.trim().toLowerCase();

    this.validateEmailDomain(normalizedEmail, role);

    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name,
        password: hashedPassword,
        role: role as any,
      },
      select: this.userSelect(),
    });
  }

  private validateEmailDomain(email: string, role: string) {
    if (role === 'STUDENT' && !email.endsWith('@bahcesehir.edu.tr')) {
      throw new BadRequestException(
        'Student accounts must use @bahcesehir.edu.tr email addresses',
      );
    }

    if (role === 'INSTRUCTOR' && !email.endsWith('@bau.edu.tr')) {
      throw new BadRequestException(
        'Instructor accounts must use @bau.edu.tr email addresses',
      );
    }
  }

  private userSelect() {
    return {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      studentId: true,
      role: true,
      avatarUrl: true,
      isActive: true,
      deactivatedAt: true,
      emailNotificationsEnabled: true,
      pushNotificationsEnabled: true,
      assignmentRemindersEnabled: true,
      gradeUpdatesEnabled: true,
      courseAnnouncementsEnabled: true,
      deadlineAlertsEnabled: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  private notificationPreferencesSelect() {
    return {
      emailNotificationsEnabled: true,
      pushNotificationsEnabled: true,
      assignmentRemindersEnabled: true,
      gradeUpdatesEnabled: true,
      courseAnnouncementsEnabled: true,
      deadlineAlertsEnabled: true,
    };
  }
}