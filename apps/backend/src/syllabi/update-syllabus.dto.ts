import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSyllabusDto {
  @ApiPropertyOptional({ example: 'Updated Syllabus Title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
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
}
