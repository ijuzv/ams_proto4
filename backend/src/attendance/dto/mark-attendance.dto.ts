import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class MarkAttendanceDto {

  @ApiProperty({
    example: "2023-10-10",
    description: 'The date for which attendance is being marked (YYYY-MM-DD)',
  })
  @IsString()
  @IsOptional()
  date: string;

  @ApiProperty({
    enum: AttendanceStatus,
    example: AttendanceStatus.WFO,
    description: 'The attendance status (WFO, WFH, CL, SL, COMP_OFF, AB)',
  })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;
}
