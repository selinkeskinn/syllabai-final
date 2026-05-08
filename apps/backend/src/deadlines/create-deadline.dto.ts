import { IsString, IsNotEmpty, IsOptional, IsDateString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDeadlineDto {
  @ApiProperty({ description: 'Course ID' })
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @ApiProperty({ example: 'Midterm Exam' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Covers chapters 1-5' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2025-04-20T09:00:00.000Z' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ enum: ['ASSIGNMENT', 'PROJECT', 'EXAM', 'QUIZ', 'OTHER'], default: 'ASSIGNMENT' })
  @IsIn(['ASSIGNMENT', 'PROJECT', 'EXAM', 'QUIZ', 'OTHER'])
  @IsOptional()
  type?: string;
}
