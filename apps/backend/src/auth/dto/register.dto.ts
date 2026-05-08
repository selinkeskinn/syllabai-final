import { IsEmail, IsNotEmpty, IsString, MinLength, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securepassword123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: ['STUDENT', 'INSTRUCTOR'], example: 'STUDENT' })
  @IsIn(['STUDENT', 'INSTRUCTOR'])
  role: 'STUDENT' | 'INSTRUCTOR';
}
