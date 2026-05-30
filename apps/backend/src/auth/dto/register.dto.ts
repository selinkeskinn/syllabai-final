import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: '2026000001' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{7}$/, {
    message: 'Student ID must be exactly 7 digits',
  })
  studentId?: string;

  @ApiProperty({ example: 'jane@bahcesehir.edu.tr' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securepassword123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: 'securepassword123' })
  @IsOptional()
  @IsString()
  confirmPassword?: string;

  @ApiProperty({ enum: ['STUDENT', 'INSTRUCTOR'], example: 'STUDENT' })
  @IsIn(['STUDENT', 'INSTRUCTOR'])
  role: 'STUDENT' | 'INSTRUCTOR';
}