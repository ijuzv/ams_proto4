import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) { }

  async getOrganizationTree(rootUserId?: number) {
    // 1. Fetch all active users with necessary fields
    const users = await this.prisma.user.findMany({
      where: { 
        active: true,
        OR: [
        { managerId: { not: null } },
        { role: 'CEO' },
      ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        designation: true,
        role: true,
        shift: true,
        managerId: true,
        avatar: true,
      },
    });

    // 2. Fetch today's status map
    const statusMap = await this.getTodayStatusMap();

    // 3. Initialize nodes with status
    const userMap = new Map();
    users.forEach((u) => {
      userMap.set(u.id, {
        ...u,
        status: statusMap.get(u.id) || 'PENDING',
        children: [],
      });
    });

    // 4. Build Tree
    const roots: any[] = [];
    userMap.forEach((node) => {
      if (node.managerId && userMap.has(node.managerId)) {
        userMap.get(node.managerId).children.push(node);
      } else {
        // If no manager (or manager inactive), this is a root
        roots.push(node);
      }
    });

    // 5. If rootUserId is requested (My Team view), return that specific subtree
    if (rootUserId) {
      const root = userMap.get(rootUserId);
      return root ? [root] : [];
    }

    return roots;
  }

  async getTodayStatusMap(): Promise<Map<number, string>> {
    const today = new Date();
    const todayDateOnly = new Date(today.toISOString().split('T')[0]);

    const map = new Map<number, string>();

    // 1. Attendance (WFO/WFH) - DATE type
    const attendances = await this.prisma.attendance.findMany({
      where: {
        date: todayDateOnly
      },
      select: { userId: true, status: true }
    });

    attendances.forEach(a => map.set(a.userId, a.status));

    // 2. Leaves (High priority - overwrite attendance if needed? Or assumes if on leave, no attendance record?)
    // Usually Leave overrides 'Pending', but if someone marked WFO, they are WFO.
    // However, let's treat APPROVED leave as definitive if no attendance present.
    // If both exist, usually Attendance implies they showed up anyway.

    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        status: { in: ['MANAGER_APPROVED', 'HR_APPROVED'] },
        fromDate: { lte: todayDateOnly },
        toDate: { gte: todayDateOnly }
      },
      select: { userId: true }
    });

    leaves.forEach(l => {
      if (!map.has(l.userId)) { // Only set if not already marked present
        map.set(l.userId, 'LEAVE');
      }
    });

    return map;
  }
}
