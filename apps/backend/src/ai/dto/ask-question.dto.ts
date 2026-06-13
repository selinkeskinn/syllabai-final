import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const INSTRUCTOR_ADVICE_TYPES = [
  'SYLLABUS_GAP_ANALYSIS',
  'GRADING_CONSISTENCY_CHECK',
  'RESOURCE_RECOMMENDATION',
  'ANNOUNCEMENT_DRAFT_GENERATOR',
] as const;

export type InstructorAdviceType = (typeof INSTRUCTOR_ADVICE_TYPES)[number];

export class AskQuestionDto {
  @ApiProperty({
    example: 'What is the grading policy of this course?',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  question: string;

  @ApiProperty({
    required: false,
    enum: INSTRUCTOR_ADVICE_TYPES,
    example: 'SYLLABUS_GAP_ANALYSIS',
  })
  @IsOptional()
  @IsString()
  @IsIn(INSTRUCTOR_ADVICE_TYPES)
  adviceType?: InstructorAdviceType;
}
