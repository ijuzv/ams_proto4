import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus, User } from '@prisma/client';
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
  constructor(private prisma: PrismaService) {}

  async markAttendance(userId: number, dto: MarkAttendanceDto) {
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
      return this.prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: { status: dto.status },
      });
    }

    // Create new attendance record
    return this.prisma.attendance.create({
      data: {
        userId,
        date: new Date(),
        status: dto.status,
      },
    });
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
      cl: attendances.filter(a => a.status === 'CL').length,
      sl: attendances.filter(a => a.status === 'SL').length,
      compOff: attendances.filter(a => a.status === 'COMP_OFF').length,
      absent: attendances.filter(a => a.status === 'AB').length,
    };
  }
}
