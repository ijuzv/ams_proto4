import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { TeamService } from './team.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Assuming standard path

@Controller('team')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) { }

  @Get('tree')
  async getFullTree() {
    return this.teamService.getOrganizationTree();
  }

  @Get('my-team')
  async getMyTeam(@Req() req) {
    const userId = req.user.id;
    return this.teamService.getOrganizationTree(userId);
  }

  @Get('status/today')
  async getStatus() {
    const map = await this.teamService.getTodayStatusMap();
    // Convert Map to Object for JSON response
    return Object.fromEntries(map);
  }
}
