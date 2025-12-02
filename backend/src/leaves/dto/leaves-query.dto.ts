import { IsOptional, IsString, IsDateString, IsInt, Min, IsIn } from 'class-validator';
import { LeaveStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class LeavesQueryDto {
  @IsOptional()
  @IsIn([...Object.values(LeaveStatus), 'REJECTED'])
  status?: LeaveStatus | 'REJECTED';

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}
