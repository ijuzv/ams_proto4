import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class MarkAttendanceDto {
  @ApiProperty({
    enum: AttendanceStatus,
    example: AttendanceStatus.WFO,
    description: 'The attendance status (WFO, WFH, CL, SL, COMP_OFF, AB)',
  })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;
}
