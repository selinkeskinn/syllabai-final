import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'securepassword123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: ['STUDENT', 'INSTRUCTOR'] })
  @IsIn(['STUDENT', 'INSTRUCTOR'])
  role: string;
}
