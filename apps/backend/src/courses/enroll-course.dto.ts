import { IsNotEmpty, IsString } from 'class-validator';

export class EnrollCourseDto {
  @IsString()
  @IsNotEmpty()
  joinKey: string;
}
