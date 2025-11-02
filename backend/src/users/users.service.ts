import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PasswordUpdateDto } from './dto/update-user-role.dto';

type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  managerId?: number | null;
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role || UserRole.USER,
        managerId: data.managerId,
      },
    });
  }

  async updatePassword(userId: number, data: PasswordUpdateDto): Promise<{ message: string}> {
    const { currentPassword, newPassword } = data;
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw new BadRequestException('Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, 10);
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed }
    });
    
    return {
      message: 'Password updated successfully',
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async updateUserRole(userId: number, role: UserRole): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      },
    });
  }
}
