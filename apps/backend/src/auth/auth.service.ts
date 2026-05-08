import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedStudentId = dto.studentId?.trim() || undefined;

    this.validateEmailDomain(normalizedEmail, dto.role);
    this.validatePasswordConfirmation(dto.password, dto.confirmPassword);

    if (dto.role === 'STUDENT' && !normalizedStudentId) {
      throw new BadRequestException('Student ID is required for student accounts');
    }

    const profile = this.resolveProfile(dto);

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingEmail) {
      throw new ConflictException('Email already in use');
    }

    if (normalizedStudentId) {
      const existingStudentId = await this.prisma.user.findUnique({
        where: { studentId: normalizedStudentId },
      });

      if (existingStudentId) {
        throw new ConflictException('Student ID already in use');
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: profile.name,
        firstName: profile.firstName,
        lastName: profile.lastName,
        studentId: dto.role === 'STUDENT' ? normalizedStudentId : undefined,
        email: normalizedEmail,
        password: hashedPassword,
        role: dto.role as any,
      },
    });

    const token = this.signToken(user.id, user.email, user.role as string);

    return {
      access_token: token,
      user: this.sanitizeUser(user),
    };
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isActive === false) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.signToken(user.id, user.email, user.role as string);

    return {
      access_token: token,
      user: this.sanitizeUser(user),
    };
  }

  private validateEmailDomain(
    email: string,
    role: 'STUDENT' | 'INSTRUCTOR',
  ) {
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

  private validatePasswordConfirmation(
    password: string,
    confirmPassword?: string,
  ) {
    if (confirmPassword && password !== confirmPassword) {
      throw new BadRequestException('Password confirmation does not match');
    }
  }

  private resolveProfile(dto: RegisterDto) {
    const firstName = dto.firstName?.trim() || undefined;
    const lastName = dto.lastName?.trim() || undefined;
    const fullName = dto.name?.trim();

    if (fullName) {
      return {
        name: fullName,
        firstName,
        lastName,
      };
    }

    const combinedName = `${firstName ?? ''} ${lastName ?? ''}`.trim();

    if (!combinedName) {
      throw new BadRequestException(
        'Name or firstName and lastName are required',
      );
    }

    return {
      name: combinedName,
      firstName,
      lastName,
    };
  }

  private signToken(userId: string, email: string, role: string): string {
    return this.jwtService.sign({ sub: userId, email, role });
  }

  private sanitizeUser(user: any) {
    const { password, ...rest } = user;
    return rest;
  }
}