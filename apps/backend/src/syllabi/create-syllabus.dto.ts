import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSyllabusDto {
  @ApiProperty({ description: 'Course ID to attach syllabus to' })
  @IsString()
  @IsNotEmpty()
  courseId!: string;

  @ApiProperty({ example: 'CS101 Course Syllabus' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: 'This syllabus covers...' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'Midterm 30%, Final 40%, Project 30%' })
  @IsString()
  @IsOptional()
  grading?: string;

  @ApiPropertyOptional({ example: 'Late submissions lose 10% per day.' })
  @IsString()
  @IsOptional()
  policies?: string;

  @ApiPropertyOptional({
    example: 'Lecture slides, reading pack, external references',
  })
  @IsString()
  @IsOptional()
  resources?: string;

  @ApiPropertyOptional({
    example: {
      courseInfo: {
        deliveryMethod: 'In-Person',
      },
    },
  })
  @IsObject()
  @IsOptional()
  manualOverrides?: Record<string, unknown>;
}
