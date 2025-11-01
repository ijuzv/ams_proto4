import { IsDateString, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { LeaveType } from '@prisma/client';

export class ApplyLeaveDto {
  @IsEnum(LeaveType)
  @IsNotEmpty()
  type: LeaveType;

  @IsDateString()
  @IsNotEmpty()
  fromDate: Date;

  @IsDateString()
  @IsNotEmpty()
  toDate: Date;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
