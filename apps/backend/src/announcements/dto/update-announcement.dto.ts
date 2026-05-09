import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateAnnouncementDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsIn(['INFO', 'URGENT', 'EVENT'])
  @IsOptional()
  type?: string;
}