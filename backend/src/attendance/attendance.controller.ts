import { Controller, Post, Body, Get, Query, UseGuards, Req, ParseIntPipe, Res } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { AdminMarkAttendanceDto } from './dto/admin-mark-attendance.dto';
import { GetAttendanceDto } from './dto/get-attendance.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AttendanceStatus, UserRole } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('attendance')
@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) { }

  @Get('list')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all attendance records with filters' })
  async findAll(@Query() query: AttendanceQueryDto) {
    return this.attendanceService.findAll(query);
  }

  @Get('export')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Export attendance records (matrix format if startDate and endDate provided)' })
  async export(@Query() query: AttendanceQueryDto, @Res() res: Response) {
    // If startDate and endDate are provided, export in matrix format
    if (query.startDate && query.endDate) {
      const matrix = await this.attendanceService.getAttendanceMatrixForExport(
        new Date(query.startDate),
        new Date(query.endDate),
        query.search
      );

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Attendance Matrix');

      // Create header row: User Name, Email, then all dates
      const headerRow = ['User Name', 'Email', ...matrix.dates];
      sheet.addRow(headerRow);

      // Style header row
      const headerRowObj = sheet.getRow(1);
      headerRowObj.font = { bold: true };
      headerRowObj.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Add data rows
      matrix.users.forEach(user => {
        const row = [
          user.userName,
          user.userEmail,
          ...matrix.dates.map(date => user.attendance[date] || ''),
        ];
        sheet.addRow(row);
      });

      // Auto-fit columns
      sheet.columns.forEach((column, index) => {
        if (index === 0 || index === 1) {
          column.width = 20; // User Name and Email columns
        } else {
          column.width = 12; // Date columns
        }
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=attendance_matrix.xlsx');
      await workbook.xlsx.write(res);
      return;
    }

    // Default export format (list format)
    const { data } = await this.attendanceService.findAll({ ...query, limit: 10000 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Attendance');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'User Name', key: 'userName', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Check In', key: 'checkin', width: 20 }
    ];

    data.forEach((record: any) => {
      sheet.addRow({
        date: record.date.toISOString().split('T')[0],
        userName: record.user?.name || 'Unknown',
        email: record.user?.email || 'Unknown',
        status: record.status,
        checkin: (record.date && (record.status === AttendanceStatus.WFH || record.status === AttendanceStatus.WFO))
          ? record.date.toISOString().split('T')[1].substring(0, 8)
          : '-',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance.xlsx');
    await workbook.xlsx.write(res);
  }

  @Post('mark')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark attendance for the current day' })
  @ApiResponse({ status: 201, description: 'Attendance marked successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async markAttendance(@Req() req: any, @Body() dto: MarkAttendanceDto) {
    return this.attendanceService.markAttendance(req.user.id, dto);
  }

  @Post('admin/mark')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark attendance on behalf of a user (Admin only, bypasses time restrictions)' })
  @ApiResponse({ status: 201, description: 'Attendance marked successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async adminMarkAttendance(
    @Req() req: any,
    @Body() dto: AdminMarkAttendanceDto,
  ) {
    return this.attendanceService.adminMarkAttendance(req.user.id, dto);
  }

  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my attendance for a specific month' })
  @ApiQuery({ name: 'month', required: true, type: Number, example: 11 })
  @ApiQuery({ name: 'year', required: true, type: Number, example: 2023 })
  @ApiResponse({ status: 200, description: 'Return attendance records' })
  async getMyAttendance(
    @Req() req: any,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    return this.attendanceService.getMyAttendance(req.user.id, { month, year });
  }

  @Get('date')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get attendance for all users on a specific date (Admin only)' })
  @ApiQuery({ name: 'date', required: true, type: Date, example: '2023-11-01' })
  @ApiResponse({ status: 200, description: 'Return attendance records for the date' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAttendanceByDate(@Query('date') date: string) {
    return this.attendanceService.getAttendanceByDate(new Date(date));
  }

  @Get('summary')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current month attendance summary' })
  @ApiResponse({ status: 200, description: 'Return attendance summary' })
  async getAttendanceSummary(@Req() req: any) {
    return this.attendanceService.getUserAttendanceSummary(req.user.id);
  }

  @Get('all-summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current month attendance summary' })
  @ApiResponse({ status: 200, description: 'Return attendance summary' })
  async getAdminSummary(@Req() req: any) {
    return this.attendanceService.getUserAdminSummary(req.user.id);
  }

  @Post('trigger-absent-marking-job') 
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Manually trigger absent marking job (Admin only)' })
  async triggerAbsentMarkingJob() {
    return this.attendanceService.autoMarkAbsentAttendance();
  }

  @Post('trigger-attendance-reminders')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Manually trigger attendance reminders (Admin only)' })
  async triggerAttendanceReminders() {
    return this.attendanceService.sendAttendanceReminders();
  }
}
