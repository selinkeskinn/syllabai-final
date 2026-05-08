import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSyllabusWeekDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weekNo!: number;

  @ApiProperty({ example: 'Introduction to Programming' })
  @IsString()
  @IsNotEmpty()
  topic!: string;

  @ApiPropertyOptional({ example: 'Overview of basic concepts, data types, variables' })
  @IsString()
  @IsOptional()
  details?: string;

  @ApiPropertyOptional({ example: 'Read Chapter 1, complete Quiz 1' })
  @IsString()
  @IsOptional()
  todo?: string;
}
