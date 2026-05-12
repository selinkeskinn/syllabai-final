import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatDto {
  @ApiProperty({ example: 'course-id' })
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @ApiProperty({
    example: 'What are the deadlines for this course?',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  question: string;
}
