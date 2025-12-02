import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Put,
} from "@nestjs/common";
import * as ExcelJS from "exceljs";
import { PrismaService } from "../prisma/prisma.service";
import { User, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import {
  PasswordUpdateDto,
  UpdateUserRoleDto,
  UserEditDto,
} from "./dto/update-user-role.dto";
import { UserRequestDto } from "./dto/usre-request.dto";

type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  managerId?: number;
  avatar?: string;
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateUserInput): Promise<User> {
    const hashed = await bcrypt.hash(data.password, 10);
    data.password = hashed;

    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashed,
        role: data.role || UserRole.USER,
        managerId: data.managerId,
        avatar: data.avatar,
      },
    });
  }

  async updatePassword(
    userId: number,
    data: PasswordUpdateDto
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword } = data;
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException("User not found");

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      throw new BadRequestException("Current password is incorrect");

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    return {
      message: "Password updated successfully",
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

  async updateUserRole(userId: number, data: UpdateUserRoleDto): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        email: data.email,
        role: data.role,
        managerId: data.managerId ?? null,
        avatar: data.avatar ?? undefined,
      },
    });
  }

  async findAllUsersForExport() {
    const users = await this.prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        designation: true,
        shift: true,
        team: true,
        managerId: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const managerIds = [
      ...new Set(users.map((u) => u.managerId).filter(Boolean)),
    ];

    const managers = await this.prisma.user.findMany({
      where: {
        id: { in: managerIds as number[] },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const managerMap = new Map(managers.map((m) => [m.id, m.name]));

    return users.map((user) => ({
      ...user,
      manager: user.managerId ? (managerMap.get(user.managerId) ?? null) : null,
    }));
  }

  async updateUser(userId: number, data: UserEditDto): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
      },
    });
  }

  async updateAvatar(userId: number, avatar: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // If avatar is empty string, set to null (clear avatar)
    const avatarValue = avatar && avatar.trim() !== '' ? avatar : null;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        avatar: avatarValue,
      },
    });
  }

  async findAll(query: UserRequestDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const search = query.search || "";
    const sort: "asc" | "desc" = query.sortBy === "desc" ? "desc" : "asc";

    const where: any = {
      active: true,
      name: {
        contains: search,
        mode: "insensitive",
      },
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: sort },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          designation: true,
          shift: true,
          managerId: true,
          active: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteUserbyId(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    await this.prisma.user.update({
      where: { id },
      data: { active: false },
    });

    return { message: "User deleted successfully" };
  }

  async findAllManagers() {
    const managers = await this.prisma.user.findMany({
      where: {
        role: "MANAGER" as UserRole,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return managers.map((manager) => ({
      id: manager.id,
      name: manager.name,
    }));
  }
}
