import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole, example: UserRole.ADMIN })
  @IsEnum(UserRole)
  role: UserRole;
}

export class PasswordUpdateDto {
  
  @IsString()
  @IsNotEmpty()
  currentPassword: string

  @IsString()
  @IsNotEmpty()
  newPassword: string

}
