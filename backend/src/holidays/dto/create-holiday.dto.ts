import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateHolidayDto {
  @IsDateString()
  date: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isMandatory?: boolean;
}
