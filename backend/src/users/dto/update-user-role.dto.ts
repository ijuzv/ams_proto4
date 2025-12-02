import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsInt, IsString, IsEmail, IsOptional } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserRoleDto {
  @ApiProperty( {description: "Email of the user", example: "user@example.com"})
  @IsEmail()
  @IsOptional()
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.ADMIN })
  @IsEnum(UserRole)
  role: UserRole;

  @IsNotEmpty()
  @IsInt()
  managerId: number;

  @ApiProperty({
    example: 'https://api.dicebear.com/7.x/avataaars/svg?seed=abc123',
    required: false,
    description: 'Full DiceBear avatar URL'
  })
  @IsString()
  @IsOptional()
  avatar?: string;
}

export class UserEditDto {
  @IsString()
  name: string;
}

export class PasswordUpdateDto {
  
  @IsString()
  @IsNotEmpty()
  currentPassword: string

  @IsString()
  @IsNotEmpty()
  newPassword: string
}
