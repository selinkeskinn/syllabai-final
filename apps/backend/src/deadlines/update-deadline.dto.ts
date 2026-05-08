import { IsString, IsOptional, IsDateString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDeadlineDto {
  @ApiPropertyOptional({ example: 'Updated Midterm' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '2025-05-01T09:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ enum: ['ASSIGNMENT', 'PROJECT', 'EXAM', 'QUIZ', 'OTHER'] })
  @IsIn(['ASSIGNMENT', 'PROJECT', 'EXAM', 'QUIZ', 'OTHER'])
  @IsOptional()
  type?: string;
}
