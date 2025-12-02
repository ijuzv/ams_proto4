import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin-dashboard')
@UseGuards(JwtAuthGuard)
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) { }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('trends')
  @Roles(UserRole.ADMIN)
  getTrends(@Query('period') period: 'week' | 'month' | 'year') {
    return this.dashboardService.getTrends(period);
  }

  @Get('activity')
  @Roles(UserRole.ADMIN)
  getActivity() {
    return this.dashboardService.getActivityFeed();
  }
}
