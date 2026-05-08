import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsIn(["INFO", "URGENT", "EVENT"])
  type: string;
}