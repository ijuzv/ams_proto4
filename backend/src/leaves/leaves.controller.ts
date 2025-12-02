import { Controller, Get, Post, Body, UseGuards, Req, Query } from "@nestjs/common";
import { LeavesService } from "./leaves.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { ApplyLeaveDto } from "./dto/apply-leave.dto";
import { Param, Put, Delete, Res, ParseIntPipe } from "@nestjs/common";
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { LeavesQueryDto } from "./dto/leaves-query.dto";
import { ApiOperation } from "@nestjs/swagger";

@Controller("leaves")
@UseGuards(JwtAuthGuard)
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) { }

  @Get('balance')
  async getBalance(@Req() req) {
    return this.leavesService.getLeaveBalance(req.user.id);
  }

  @Post('accrue')
  @Roles(UserRole.ADMIN)
  async triggerAccrual() {
    return this.leavesService.accrueMonthlyLeaves();
  }

  @Get('list')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all leaves with filters' })
  async findAll(@Query() query: LeavesQueryDto) {
    return this.leavesService.findAll(query);
  }

  @Get('export')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Export leaves' })
  async export(@Query() query: LeavesQueryDto, @Res() res: Response) {
    const { data } = await this.leavesService.findAll({ ...query, limit: 10000 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Leaves');
    sheet.columns = [
      { header: 'User Name', key: 'userName', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'From', key: 'fromDate', width: 15 },
      { header: 'To', key: 'toDate', width: 15 },
      { header: 'Reason', key: 'reason', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    data.forEach(leave => {
      sheet.addRow({
        userName: leave.user.name,
        email: leave.user.email,
        type: leave.type,
        fromDate: leave.fromDate.toISOString().split('T')[0],
        toDate: leave.toDate.toISOString().split('T')[0],
        reason: leave.reason,
        status: leave.status,
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=leaves.xlsx');
    await workbook.xlsx.write(res);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update leave request (User only, pending only)' })
  async updateLeave(@Req() req, @Param('id', ParseIntPipe) id: number, @Body() dto: ApplyLeaveDto) {
    return this.leavesService.updateLeave(id, req.user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete leave request (User only, pending only)' })
  async deleteLeave(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.leavesService.deleteLeave(id, req.user.id);
  }

  @Post("apply")
  // @Roles(UserRole.USER)
  async applyForLeave(@Body() applyLeaveDto: ApplyLeaveDto, @Req() req) {
    return this.leavesService.applyLeave(req.user.id, req.user.role, applyLeaveDto);
  }

  @Get("my-leaves")
  // @Roles(UserRole.USER)
  async getMyLeaves(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('date') date?: string,
    @Query('status') status?: string
  ) {
    try {
      console.log('User from request:', req.user); // Debug log
      if (!req.user?.id) {
        throw new Error('User not authenticated or missing user ID');
      }
      return await this.leavesService.getMyLeaves(
        req.user.id,
        page ? Number(page) : 1,
        limit ? Number(limit) : 10,
        date,
        status
      );
    } catch (error) {
      console.error('Error in getMyLeaves controller:', error);
      throw error;
    }
  }

  @Get("all")
  @Roles(UserRole.ADMIN)
  async getAllLeaves(@Req() req, @Query('type') type?: string) {
    if (type) {
      return this.leavesService.getApprovedLeaves();
    }
    return this.leavesService.getManagerApprovedLeaves();
  }

  @Get("requests")
  @Roles(UserRole.MANAGER)
  async getReporteeLeaves(@Req() req, @Param('managerId') managerId?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('date') date?: string,
    @Query('status') status?: string) {
    const targetManagerId = managerId || req.user.id;
    return this.leavesService.getReporteePendingLeaves(targetManagerId, page ? Number(page) : 1, limit ? Number(limit) : 10, date, status);
  }

  @Post("approve/:leaveId")
  @Roles(UserRole.ADMIN)
  async approveLeave(@Req() req, @Param("leaveId") leaveId: number) {
    return this.leavesService.approveLeave(leaveId, req.user.id);
  }

  @Post("reject/:leaveId")
  @Roles(UserRole.ADMIN)
  async rejectLeave(@Req() req, @Param("leaveId") leaveId: number) {
    return this.leavesService.rejectLeave(leaveId, req.user.id);
  }

  @Post("manager-approve/:leaveId")
  @Roles(UserRole.MANAGER)
  async approveManagerLeave(@Req() req, @Param("leaveId") leaveId: number) {
    return this.leavesService.approveManagerLeave(leaveId, req.user.id);
  }

  @Post("manager-reject/:leaveId")
  @Roles(UserRole.MANAGER)
  async rejectManagerLeave(@Req() req, @Param("leaveId") leaveId: number) {
    return this.leavesService.rejectManagerLeave(leaveId, req.user.id);
  }

  @Post("revoke/:leaveId")
  @ApiOperation({ summary: 'Revoke leave request (User only, if not HR accepted)' })
  async revokeLeave(@Req() req, @Param("leaveId", ParseIntPipe) leaveId: number) {
    return this.leavesService.revokeLeave(leaveId, req.user.id);
  }

  @Get("recent-activity")
  @ApiOperation({ summary: 'Get recent activity for user dashboard' })
  async getRecentActivity(@Req() req) {
    return this.leavesService.getUserRecentActivity(req.user.id);
  }

  @Get("admin-requests")
  @Roles(UserRole.CEO)
  @ApiOperation({ summary: 'Get admin leave requests (CEO only)' })
  async getAdminLeaveRequests(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('date') date?: string,
    @Query('status') status?: string
  ) {
    return this.leavesService.getAdminLeaveRequests(
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
      date,
      status
    );
  }

  @Post("ceo-approve/:leaveId")
  @Roles(UserRole.CEO)
  @ApiOperation({ summary: 'Approve admin leave request (CEO only)' })
  async approveAdminLeave(@Req() req, @Param("leaveId") leaveId: number) {
    return this.leavesService.approveAdminLeave(leaveId, req.user.id);
  }

  @Post("ceo-reject/:leaveId")
  @Roles(UserRole.CEO)
  @ApiOperation({ summary: 'Reject admin leave request (CEO only)' })
  async rejectAdminLeave(@Req() req, @Param("leaveId") leaveId: number, @Body() body?: { comments?: string }) {
    return this.leavesService.rejectAdminLeave(leaveId, req.user.id, body?.comments);
  }

  @Post('accrue-ol')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Manually trigger optional leave allocation (Admin only)' })
  async triggerOLAccrual() {
    return this.leavesService.accrueYearlyOL();
  }
}
