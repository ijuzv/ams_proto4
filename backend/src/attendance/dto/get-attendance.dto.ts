import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class GetAttendanceDto {
  @ApiProperty({
    description: 'Month (1-12)',
    example: 11,
    minimum: 1,
    maximum: 12,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({
    description: 'Year (e.g., 2023)',
    example: 2023,
  })
  @IsInt()
  @Min(2000)
  year: number;
}
