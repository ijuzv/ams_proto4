import { IsEnum, IsOptional, IsString, IsArray, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export enum ExportType {
  XLSX = 'xlsx',
  CSV = 'csv',
}

export enum DataType {
  USERS = 'users',
  ATTENDANCE = 'attendance',
  APPROVED_LEAVES = 'approved_leaves',
  LEAVE_SUMMARY = 'leave_summary',
}

export enum TimeFilter {
  LAST_7_DAYS = '7_days',
  LAST_30_DAYS = '30_days',
  LAST_3_MONTHS = '3_months',
  LAST_6_MONTHS = '6_months',
  LAST_1_YEAR = '1_year',
  DATE_SPECIFIC = 'date_specific',
  CUSTOM_RANGE = 'custom_range',
}

export class ExportGlobalDto {
  @IsString()
  fileName: string;

  @IsEnum(ExportType)
  fileType: ExportType;

  @IsArray()
  @IsEnum(DataType, { each: true })
  dataTypes: DataType[];

  @IsEnum(TimeFilter)
  timeFilter: TimeFilter;

  @IsOptional()
  @IsDateString()
  specificDate?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
