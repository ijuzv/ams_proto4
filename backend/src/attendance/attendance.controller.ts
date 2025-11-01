import { Controller, Post, Body, Get, Query, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { GetAttendanceDto } from './dto/get-attendance.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('attendance')
@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('mark')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark attendance for the current day' })
  @ApiResponse({ status: 201, description: 'Attendance marked successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async markAttendance(@Req() req: any, @Body() dto: MarkAttendanceDto) {
    return this.attendanceService.markAttendance(req.user.id, dto);
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
}
