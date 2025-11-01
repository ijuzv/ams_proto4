import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApplyLeaveDto } from './dto/apply-leave.dto';

@Controller('leaves')
@UseGuards(JwtAuthGuard)
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Post('apply')
  @Roles(UserRole.USER)
  async applyForLeave(@Body() applyLeaveDto: ApplyLeaveDto, @Req() req) {
    return this.leavesService.applyLeave(req.user.userId, applyLeaveDto);
  }

  @Get('my-leaves')
  @Roles(UserRole.USER)
  async getMyLeaves(@Req() req) {
    return this.leavesService.getMyLeaves(req.user.userId);
  }

  @Get('all')
  @Roles(UserRole.ADMIN)
  async getAllLeaves() {
    return this.leavesService.getPendingLeaves();
  }
}
