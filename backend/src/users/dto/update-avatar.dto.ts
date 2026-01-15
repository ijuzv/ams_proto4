import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateAvatarDto {
  @ApiProperty({
    example: 'https://api.dicebear.com/7.x/avataaars/svg?seed=abc123',
    description: 'Full DiceBear avatar URL (empty string to clear)',
    required: false
  })
  @IsString()
  @IsOptional()
  avatar?: string;
}

