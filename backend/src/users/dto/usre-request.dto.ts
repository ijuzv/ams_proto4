import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UserRequestDto {
  @ApiProperty({
    description: "User's name",
    example: "Vignesh",
  })
  @IsString()
  @IsOptional()
  search?: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @ApiProperty({
    description: "Page number (1-based)",
    example: 1,
    type: Number
  })
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @ApiProperty({
    description: "Number of items per page",
    example: 10,
    type: Number
  })
  @IsOptional()
  limit?: number = 10;

  @ApiProperty({
    description: "Sort by createdAt field",
    example: "asc or desc"})
  @IsString()
  @IsOptional()
  sortBy?: string;
}