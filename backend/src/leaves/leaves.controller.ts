import { Controller, Get, Post, Body, UseGuards, Req, Query } from "@nestjs/common";
import { LeavesService } from "./leaves.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { ApplyLeaveDto } from "./dto/apply-leave.dto";
import { Param } from "@nestjs/common/decorators";

@Controller("leaves")
@UseGuards(JwtAuthGuard)
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Post("apply")
  // @Roles(UserRole.USER)
  async applyForLeave(@Body() applyLeaveDto: ApplyLeaveDto, @Req() req) {
    return this.leavesService.applyLeave(req.user.id, applyLeaveDto);
  }

  @Get("my-leaves")
  // @Roles(UserRole.USER)
  async getMyLeaves(@Req() req) {
    try {
      console.log('User from request:', req.user); // Debug log
      if (!req.user?.id) {
        throw new Error('User not authenticated or missing user ID');
      }
      return await this.leavesService.getMyLeaves(req.user.id);
    } catch (error) {
      console.error('Error in getMyLeaves controller:', error);
      throw error;
    }
  }

  @Get("all")
  @Roles(UserRole.ADMIN)
  async getAllLeaves(@Req() req, @Query('type') type?: string) {
    if(type) {
      return this.leavesService.getApprovedLeaves();
    }
    return this.leavesService.getManagerApprovedLeaves();
  }
  
  @Get("requests")
  // @Roles(UserRole.MANAGER, UserRole.ADMIN)
  async getReporteeLeaves(@Req() req, @Query('managerId') managerId?: number) {
    // If managerId is not provided in query, use the authenticated user's ID
    const targetManagerId = managerId || req.user.id;
    return this.leavesService.getReporteePendingLeaves(targetManagerId);
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
  @Roles(UserRole.ADMIN)
  async rejectManagerLeave(@Req() req, @Param("leaveId") leaveId: number) {
    return this.leavesService.rejectManagerLeave(leaveId, req.user.id);
  }
}
