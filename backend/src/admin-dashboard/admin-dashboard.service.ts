import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus, LeaveStatus } from '@prisma/client';

@Injectable()
export class AdminDashboardService {
  constructor(private prisma: PrismaService) { }

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalUsers, activeToday, pendingLeaves, onLeaveToday] = await Promise.all([
      this.prisma.user.count({ where: { active: true } }),
      this.prisma.attendance.count({
        where: {
          date: {
            gte: today,
            lt: tomorrow,
          },
          status: {
            in: [AttendanceStatus.WFO, AttendanceStatus.WFH],
          },
        },
      }),
      this.prisma.leaveRequest.count({
        where: {
          status: LeaveStatus.PENDING,
        },
      }),
      this.prisma.attendance.count({
        where: {
          date: {
            gte: today,
            lt: tomorrow,
          },
          status: {
            in: [AttendanceStatus.CL, AttendanceStatus.SL, AttendanceStatus.COMP_OFF, AttendanceStatus.EL, AttendanceStatus.AB, AttendanceStatus.OL],
          },
        },
      }),
    ]);

    return {
      totalUsers,
      activeToday,
      pendingLeaves,
      onLeaveToday,
    };
  }

  async getTrends(period: 'week' | 'month' | 'year' = 'week') {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();

    // Set date ranges based on period
    if (period === 'month') {
      startDate.setDate(startDate.getDate() - 29); // 30 days including today
    } else if (period === 'year') {
      startDate.setMonth(startDate.getMonth() - 11); // 12 months including current
      startDate.setDate(1); // Start from first day of that month
    } else {
      startDate.setDate(startDate.getDate() - 6); // 7 days including today
    }
    startDate.setHours(0, 0, 0, 0);

    const attendance = await this.prisma.attendance.groupBy({
      by: ['date', 'status'],
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        id: true,
      },
    });

    // Create a map for quick lookup
    const dataMap = new Map<string, Map<string, number>>();
    attendance.forEach(a => {
      const dateKey = a.date.toISOString().split('T')[0];
      if (!dataMap.has(dateKey)) {
        dataMap.set(dateKey, new Map());
      }
      dataMap.get(dateKey).set(a.status, a._count.id);
    });

    // Generate all dates/periods and fill missing data
    const result: any[] = [];

    if (period === 'year') {
      // Generate 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        date.setDate(1);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const dateKey = `${year}-${month}-01`;

        // Aggregate all data for this month
        const monthData = { WFO: 0, WFH: 0, LEAVE: 0 };
        dataMap.forEach((statusMap, key) => {
          if (key.startsWith(`${year}-${month}`)) {
            statusMap.forEach((count, status) => {
              if (status === 'WFO' || status === 'WFH') {
                monthData[status] += count;
              } else if (['CL', 'SL', 'COMP_OFF'].includes(status)) {
                monthData.LEAVE += count;
              }
            });
          }
        });

        result.push({
          date: dateKey,
          status: 'WFO',
          count: monthData.WFO,
        });
        result.push({
          date: dateKey,
          status: 'WFH',
          count: monthData.WFH,
        });
        result.push({
          date: dateKey,
          status: 'LEAVE',
          count: monthData.LEAVE,
        });
      }
    } else {
      // Generate all days in range
      const days = period === 'month' ? 30 : 7;
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];

        const dayData = dataMap.get(dateKey) || new Map();

        result.push({
          date: dateKey,
          status: 'WFO',
          count: dayData.get('WFO') || 0,
        });
        result.push({
          date: dateKey,
          status: 'WFH',
          count: dayData.get('WFH') || 0,
        });

        // Sum all leave types
        const leaveCount = (dayData.get('CL') || 0) +
          (dayData.get('SL') || 0) +
          (dayData.get('COMP_OFF') || 0);
        result.push({
          date: dateKey,
          status: 'LEAVE',
          count: leaveCount,
        });
      }
    }

    return result;
  }

  async getActivityFeed() {
    // Get latest leave requests of all users, ordered by most recent update
    const recentLeaves = await this.prisma.leaveRequest.findMany({
      take: 5,
      orderBy: { updatedAt: 'desc' },
      include: { 
        user: { 
          select: { 
            id: true,
            name: true, 
            email: true,
            avatar: true
          } 
        } ,
      },
    });

    return recentLeaves.map(leave => ({
      id: leave.id,
      type: 'LEAVE_REQUEST',
      userName: leave.user.name,
      userEmail: leave.user.email,
      userId: leave.user.id,
      userAvatar: leave.user.avatar,
      leaveType: leave.type,
      leaveStatus: leave.status,
      fromDate: leave.fromDate,
      toDate: leave.toDate,
      timestamp: leave.updatedAt,
    }));
  }
}
