import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus, LeaveStatus, User, UserRole } from '@prisma/client';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { GetAttendanceDto } from './dto/get-attendance.dto';

type AttendanceWithUser = {
  id: number;
  date: Date;
  status: AttendanceStatus;
  user: {
    id: number;
    name: string;
    email: string;
  };
};

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(private prisma: PrismaService) {}

  async markAttendance(userId: number, dto: MarkAttendanceDto) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if attendance already marked for today
      const existingAttendance = await this.prisma.attendance.findFirst({
        where: {
          userId,
          date: {
            gte: today,
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000), // Next day
          },
        },
      });

      if (existingAttendance) {
        // Update existing attendance
        this.logger.log(`Updating attendance for user ${userId} on ${today.toISOString()}`);
        return await this.prisma.attendance.update({
          where: { id: existingAttendance.id },
          data: { status: dto.status },
        });
      }

      // Create new attendance record with normalized date (no time component)
      const attendanceDate = new Date(today);
      
      this.logger.log(`Creating attendance for user ${userId} on ${attendanceDate.toISOString()} with status ${dto.status}`);
      
      return await this.prisma.attendance.create({
        data: {
          userId,
          date: attendanceDate,
          status: dto.status,
        },
      });
    } catch (error: any) {
      this.logger.error(`Error marking attendance for user ${userId}:`, error);
      
      // Handle unique constraint violation (race condition)
      if (error.code === 'P2002') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // If duplicate key error, try to update existing record
        const existing = await this.prisma.attendance.findFirst({
          where: {
            userId,
            date: {
              gte: today,
              lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });

        if (existing) {
          this.logger.log(`Handling race condition: updating existing attendance for user ${userId}`);
          return await this.prisma.attendance.update({
            where: { id: existing.id },
            data: { status: dto.status },
          });
        }
      }
      
      // Re-throw the error if we can't handle it
      throw error;
    }
  }

  async getMyAttendance(userId: number, dto: GetAttendanceDto) {
    const { month, year } = dto;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    return this.prisma.attendance.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  async getAttendanceByDate(date: Date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    return this.prisma.attendance.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    }) as unknown as Promise<AttendanceWithUser[]>;
  }

  async getUserAttendanceSummary(userId: number) {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const cl = 1
    const sl = 1
    
    const attendances = await this.prisma.attendance.findMany({
      where: {
        userId,
        date: {
          gte: firstDay,
          lte: lastDay,
        },
      },
    });

    return {
      totalDays: lastDay.getDate(),
      present: attendances.filter(a => a.status === 'WFO' || a.status === 'WFH').length,
      wfo: attendances.filter(a => a.status === 'WFO').length,
      wfh: attendances.filter(a => a.status === 'WFH').length,
      cl: attendances.filter(a => a.status === 'CL').length === cl ? 0 : 1,
      sl: attendances.filter(a => a.status === 'SL').length === sl ? 0 : 1,
      compOff: attendances.filter(a => a.status === 'COMP_OFF').length,
      absent: attendances.filter(a => a.status === 'AB').length,
    };
  }

  async getUserAdminSummary(userId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all active users
    const users = await this.prisma.user.findMany({
      where: {
        role: {
          in: [UserRole.USER, UserRole.MANAGER],
        },
      },
      select: { id: true },
    });
    
    // Get users who are present today (WFO or WFH)
    const presentToday = await this.prisma.attendance.findMany({
      where: {
        date: {
          gte: today,
          lt: tomorrow,
        },
        status: {
          in: [AttendanceStatus.WFO, AttendanceStatus.WFH],
        },
      },
      distinct: ['userId'],
    });

    // Get pending leave requests (not yet approved)
    const pendingRequests = await this.prisma.leaveRequest.findMany({
      where: {
        status: {
          in: [LeaveStatus.MANAGER_APPROVED],
        },
      },
    });

    // Get users on leave today
    const onLeaveToday = await this.prisma.attendance.findMany({
      where: {
        status: {
          in: [AttendanceStatus.CL, AttendanceStatus.SL, AttendanceStatus.COMP_OFF, AttendanceStatus.AB],
        },
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
      distinct: ['userId'],
    });
    
    // Get recent leave requests
    const recentActivity = await this.prisma.leaveRequest.findMany({
      where: {
        status: {
          in: [LeaveStatus.MANAGER_APPROVED],
        },
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      totalUsers: users.length,
      presentToday: presentToday.length,
      pendingRequests: pendingRequests.length,
      onLeaveToday: onLeaveToday.length,
      recentActivity: recentActivity.map(activity => ({
        id: activity.id,
        status: activity.status,
        type: activity.type,
        fromDate: activity.fromDate,
        toDate: activity.toDate,
        reason: activity.reason,
        userName: activity.user.name,
        userEmail: activity.user.email,
        createdAt: activity.createdAt,
      })),
    };
  }
}
