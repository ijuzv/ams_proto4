import { Controller, Get, Param, Post, Put, UseGuards, Body, ParseIntPipe, NotFoundException, Req, Delete, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PasswordUpdateDto, UpdateUserRoleDto, UserEditDto } from './dto/update-user-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserRequestDto } from './dto/usre-request.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new user (Admin only)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Put("password-change")
  @ApiOperation({ summary: 'Update user password)' })
  @ApiResponse({ status: 201, description: 'User password updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(@Req() req, @Body() passwordUpdateDto: PasswordUpdateDto) {
    const userId = req.user.id;
    return this.usersService.updatePassword(userId, passwordUpdateDto)
  }

  @Get("managers")
  @ApiOperation({ summary: 'Get Manager dropdownlist' })
  @ApiResponse({ status: 200, description: 'Return Managers' })
  async findManagers() {
    return this.usersService.findAllManagers();
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({ status: 200, description: 'Return all users' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @Query() query: UserRequestDto
  ) {
    return this.usersService.findAll(query);
  }

  @Get('export')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Export users to Excel (Admin only)' })
  @ApiResponse({ status: 200, description: 'Users exported successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async exportUsersToExcel(@Res() res: Response) {
    const users = await this.usersService.findAllUsersForExport();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Users');
    sheet.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Role', key: 'role', width: 15 },
      { header: 'Designation', key: 'designation', width: 20 },
      { header: 'Shift', key: 'shift', width: 15 },
      { header: 'Team', key: 'team', width: 20 },
      { header: 'Manager', key: 'manager', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    users.forEach(user => {
      sheet.addRow({
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation || '-',
        shift: user.shift || '-',
        team: user.team || '-',
        manager: user.manager || '-',
        status: user.active ? 'Active' : 'Inactive',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=users.xlsx');
    await workbook.xlsx.write(res);
  }

  @Delete(':id/delete')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user role (Admin only)' })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usersService.deleteUserbyId(id)
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Return user by ID' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  @Put(':id/update')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user role (Admin only)' })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateUserRole(id, updateUserRoleDto);
  }

  @Put('/editProfile')
  @ApiOperation({ summary: 'Edit user profile' })
  @ApiResponse({ status: 200, description: 'User profile updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async editProfile(
    @Req() req,
    @Body() userEditDto: UserEditDto,
  ) {
    const userId = req.user.id;
    return this.usersService.updateUser(userId, userEditDto);
  }

  @Put('/avatar')
  @ApiOperation({ summary: 'Update user avatar' })
  @ApiResponse({ status: 200, description: 'Avatar updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateAvatar(
    @Req() req,
    @Body() updateAvatarDto: UpdateAvatarDto,
  ) {
    const userId = req.user.id;
    return this.usersService.updateAvatar(userId, updateAvatarDto.avatar || '');
  }

}