import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus } from '@prisma/client';

export class AdminMarkAttendanceDto {
  @ApiProperty({
    example: 1,
    description: 'The user ID for whom attendance is being marked',
  })
  @Type(() => Number)
  @IsInt()
  userId: number;

  @ApiProperty({
    example: "2023-10-10",
    description: 'The date for which attendance is being marked (YYYY-MM-DD)',
  })
  @IsString()
  date: string;

  @ApiProperty({
    enum: AttendanceStatus,
    example: AttendanceStatus.WFO,
    description: 'The attendance status (WFO, WFH, CL, SL, EL, COMP_OFF, AB)',
  })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;
}

