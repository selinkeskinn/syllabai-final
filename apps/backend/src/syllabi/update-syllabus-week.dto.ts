import { IsString, IsOptional, IsInt } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSyllabusWeekDto {
  @ApiPropertyOptional({ example: 'Updated Topic Title' })
  @IsString()
  @IsOptional()
  topic?: string;

  @ApiPropertyOptional({ example: 'Detailed description' })
  @IsString()
  @IsOptional()
  details?: string;

  @ApiPropertyOptional({ example: 'Read chapter 5' })
  @IsString()
  @IsOptional()
  todo?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsInt()
  @IsOptional()
  weekNo?: number;
}
