import { BadRequestException, Injectable, NotFoundException, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus, LeaveStatus, LeaveType, User, UserRole } from '@prisma/client';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { AdminMarkAttendanceDto } from './dto/admin-mark-attendance.dto';
import { GetAttendanceDto } from './dto/get-attendance.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { getIST, convertUTCToIST, convertTimestampsToIST, normalizeToDateOnly, calculateDaysBetween } from 'src/Helper/dateTime';
import { HolidaysService } from '../holidays/holidays.service';
import { Cron } from '@nestjs/schedule';
import { MailerService } from '../mailer/mailer.service';
import { format } from 'date-fns';

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
  private readonly FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

  constructor(
    private prisma: PrismaService,
    private holidaysService: HolidaysService,
    private mailerService: MailerService,
  ) { }

  async markAttendance(userId: number, dto: MarkAttendanceDto) {
    try {

      const { istStart, istEnd, nowIST } = getIST();

      if (nowIST.isBefore(istStart) || nowIST.isAfter(istEnd)) {
        throw new BadRequestException('Attendance can only be marked between 6:00 AM and 12:00 PM IST');
      }

      // Get today's date in IST (just the date part, no time)
      const todayDate = normalizeToDateOnly(nowIST.format('YYYY-MM-DD'));

      // Check if today is a mandatory holiday
      const isMandatoryHoliday = await this.holidaysService.isMandatoryHoliday(todayDate);

      if (isMandatoryHoliday) {
        throw new BadRequestException('Cannot mark attendance on a mandatory holiday. Please enjoy your day off!');
      }

      // const isWeeklyOff = await this.holidaysService.isWeeklyOff(todayDate);

      // if (isWeeklyOff) {
      //   throw new BadRequestException('Cannot mark attendance on a weekly off. Please enjoy your day off!');
      // } 

      const existingAttendance = await this.prisma.attendance.findFirst({
        where: {
          userId,
          date: todayDate,
        },
      });

      if (existingAttendance) {
        // Update existing attendance
        this.logger.log(`Updating attendance for user ${userId} on ${nowIST.format('YYYY-MM-DD')}`);
        const updated = await this.prisma.attendance.update({
          where: { id: existingAttendance.id },
          data: { status: dto.status },
        });
        // Convert timestamps to IST before returning
        return convertTimestampsToIST(updated, ['createdAt', 'updatedAt']);
      }

      // Create new attendance record with date (DATE type, no time component)
      this.logger.log(`Creating attendance for user ${userId} on ${nowIST.format('YYYY-MM-DD')} with status ${dto.status}`);

      const created = await this.prisma.attendance.create({
        data: {
          userId,
          date: todayDate,
          status: dto.status,
        },
      });
      // Convert timestamps to IST before returning
      return convertTimestampsToIST(created, ['createdAt', 'updatedAt']);
    } catch (error: any) {
      this.logger.error(`Error marking attendance for user ${userId}:`, error);

      // Handle unique constraint violation (race condition)
      if (error.code === 'P2002') {
        const { nowIST } = getIST();
        const todayDate = normalizeToDateOnly(nowIST.format('YYYY-MM-DD'));

        // If duplicate key error, try to update existing record
        const existing = await this.prisma.attendance.findFirst({
          where: {
            userId,
            date: todayDate,
          },
        });

        if (existing) {
          this.logger.log(`Handling race condition: updating existing attendance for user ${userId}`);
          const updated = await this.prisma.attendance.update({
            where: { id: existing.id },
            data: { status: dto.status },
          });
          // Convert timestamps to IST before returning
          return convertTimestampsToIST(updated, ['createdAt', 'updatedAt']);
        }
      }

      // Re-throw the error if we can't handle it
      throw error;
    }
  }

  async markLeaveAttendance(userId: number, date: Date, status: AttendanceStatus) {
    try {
      // Convert date to DATE format (just the date part)
      const dateOnly = normalizeToDateOnly(date);
      
      const result = await this.prisma.attendance.upsert({
        where: {
          userId_date: {
            userId,
            date: dateOnly,
          }
        },
        update: {
          status: status
        },
        create: {
          userId,
          date: dateOnly,
          status: status,
        }
      });
      // Convert timestamps to IST before returning
      return convertTimestampsToIST(result, ['createdAt', 'updatedAt']);
    } catch (error) {
      this.logger.error(`Error marking leave attendance for user ${userId}`, error);
      throw new InternalServerErrorException('Failed to mark leave attendance');
    }
  }

  async adminMarkAttendance(adminId: number, dto: AdminMarkAttendanceDto) {
    try {
      const { userId, date, status } = dto;
      
      // Verify user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Parse the date string to Date object (DATE type, no time component)
      const attendanceDate = normalizeToDateOnly(date);

      // Check if the date is a mandatory holiday - even admins cannot mark attendance on mandatory holidays
      const isMandatoryHoliday = await this.holidaysService.isMandatoryHoliday(attendanceDate);
      if (isMandatoryHoliday) {
        throw new BadRequestException('Cannot mark attendance on a mandatory holiday. Even admins cannot override mandatory holidays.');
      }

      // Check for existing attendance
      const existingAttendance = await this.prisma.attendance.findUnique({
        where: {
          userId_date: {
            userId,
            date: attendanceDate,
          },
        },
      });

      if (existingAttendance) {
        const previousStatus = existingAttendance.status;
        const newStatus = status;

        // Check if we're changing from a leave type to WFO/WFH (work status)
        // If so, restore the leave balance
        const leaveStatuses: AttendanceStatus[] = [AttendanceStatus.CL, AttendanceStatus.SL, AttendanceStatus.EL, AttendanceStatus.COMP_OFF];
        const workStatuses: AttendanceStatus[] = [AttendanceStatus.WFO, AttendanceStatus.WFH];
        const isLeaveStatus = leaveStatuses.includes(previousStatus);
        const isWorkStatus = workStatuses.includes(newStatus);

        // Wrap balance restoration and attendance update in transaction
        const updated = await this.prisma.$transaction(async (tx) => {
          if (isLeaveStatus && isWorkStatus) {
            // Restore leave balance when overriding from leave to work
            await this.restoreLeaveBalanceInTransaction(tx, userId, previousStatus, attendanceDate);
            this.logger.log(
              `Admin ${adminId} overriding leave status ${previousStatus} to ${newStatus} for user ${userId} on ${date}. Leave balance restored.`
            );
            // Note: Leave request remains in the system for record-keeping purposes.
            // Balance restoration now handles multi-day leaves correctly.
          }

          // Update existing attendance
          this.logger.log(
            `Admin ${adminId} updating attendance for user ${userId} on ${date} from ${previousStatus} to ${newStatus}`
          );
          return await tx.attendance.update({
            where: { id: existingAttendance.id },
            data: { status },
          });
        });

        // Convert timestamps to IST before returning
        return convertTimestampsToIST(updated, ['createdAt', 'updatedAt']);
      }

      // Create new attendance record
      this.logger.log(
        `Admin ${adminId} creating attendance for user ${userId} on ${date} with status ${status}`
      );

      const created = await this.prisma.attendance.create({
        data: {
          userId,
          date: attendanceDate,
          status,
        },
      });
      // Convert timestamps to IST before returning
      return convertTimestampsToIST(created, ['createdAt', 'updatedAt']);
    } catch (error: any) {
      this.logger.error(
        `Error in admin marking attendance for user ${dto.userId}:`,
        error
      );
      
      // Re-throw NotFoundException as-is
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      // Handle unique constraint violation (race condition)
      if (error.code === 'P2002') {
        const attendanceDate = normalizeToDateOnly(dto.date);

        const existing = await this.prisma.attendance.findUnique({
          where: {
            userId_date: {
              userId: dto.userId,
              date: attendanceDate,
            },
          },
        });

        if (existing) {
          const previousStatus = existing.status;
          const newStatus = dto.status;

          // Check if we're changing from a leave type to WFO/WFH
          const leaveStatuses: AttendanceStatus[] = [AttendanceStatus.CL, AttendanceStatus.SL, AttendanceStatus.EL, AttendanceStatus.COMP_OFF, AttendanceStatus.OL, AttendanceStatus.ML];
          const workStatuses: AttendanceStatus[] = [AttendanceStatus.WFO, AttendanceStatus.WFH];
          const isLeaveStatus = leaveStatuses.includes(previousStatus);
          const isWorkStatus = workStatuses.includes(newStatus);

          // Wrap in transaction for consistency
          const updated = await this.prisma.$transaction(async (tx) => {
            if (isLeaveStatus && isWorkStatus) {
              await this.restoreLeaveBalanceInTransaction(tx, dto.userId, previousStatus, attendanceDate);
            }

            this.logger.log(`Handling race condition: updating existing attendance for user ${dto.userId}`);
            return await tx.attendance.update({
              where: { id: existing.id },
              data: { status: dto.status },
            });
          });

          // Convert timestamps to IST before returning
          return convertTimestampsToIST(updated, ['createdAt', 'updatedAt']);
        }
      }

      throw error;
    }
  }

  /**
   * Restores leave balance when attendance is overridden from leave status to work status
   * Transaction-safe version that finds the associated leave request to restore correct number of days
   */
  private async restoreLeaveBalanceInTransaction(
    tx: any,
    userId: number,
    leaveStatus: AttendanceStatus,
    date: Date
  ): Promise<void> {
    try {
      const currentYear = date.getFullYear();
      const normalizedDate = normalizeToDateOnly(date);

      // Find the leave request that covers this date to get the full leave period
      const leaveRequest = await tx.leaveRequest.findFirst({
        where: {
          userId,
          fromDate: { lte: normalizedDate },
          toDate: { gte: normalizedDate },
          status: { in: [LeaveStatus.MANAGER_APPROVED, LeaveStatus.HR_APPROVED] },
        },
        orderBy: { fromDate: 'desc' }, // Get the most recent one if multiple exist
      });

      // Determine number of days to restore
      let daysToRestore = 1; // Default to 1 day if no leave request found
      if (leaveRequest) {
        // If we found a leave request, restore the full period
        // However, we should only restore for the days that were actually marked as leave
        // For simplicity, restore 1 day per attendance override (as we're overriding one day)
        // This prevents over-restoration if only part of a multi-day leave is overridden
        daysToRestore = 1;
      }

      // Get or create leave balance for the year
      let balance = await tx.leaveBalance.findUnique({
        where: { userId_year: { userId, year: currentYear } },
      });

      if (!balance) {
        balance = await tx.leaveBalance.create({
          data: { userId, year: currentYear, clBalance: 0, slBalance: 0, elBalance: 0, olBalance: 0 },
        });
      }

      // Map attendance status to leave type and restore balance
      const updateData: { clBalance?: number; slBalance?: number; elBalance?: number; olBalance?: number } = {};

      switch (leaveStatus) {
        case AttendanceStatus.CL:
          updateData.clBalance = balance.clBalance + daysToRestore;
          this.logger.log(`Restoring ${daysToRestore} day(s) of CL balance for user ${userId}. New balance: ${updateData.clBalance}`);
          break;
        case AttendanceStatus.SL:
          updateData.slBalance = balance.slBalance + daysToRestore;
          this.logger.log(`Restoring ${daysToRestore} day(s) of SL balance for user ${userId}. New balance: ${updateData.slBalance}`);
          break;
        case AttendanceStatus.EL:
          updateData.elBalance = balance.elBalance + daysToRestore;
          this.logger.log(`Restoring ${daysToRestore} day(s) of EL balance for user ${userId}. New balance: ${updateData.elBalance}`);
          break;
        case AttendanceStatus.COMP_OFF:
          // Comp off doesn't use balance, so nothing to restore
          this.logger.log(`Comp off override for user ${userId} - no balance to restore`);
          return;
        default:
          // Not a leave status, nothing to restore
          return;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: updateData,
        });
      }
    } catch (error: any) {
      const normalizedDate = normalizeToDateOnly(date);
      this.logger.error(
        `Error restoring leave balance for user ${userId} on ${normalizedDate.toISOString()}: ${error?.message || error}`,
        error?.stack
      );
      throw new InternalServerErrorException(
        `Failed to restore leave balance for user ${userId}. This may require manual intervention. Original error: ${error?.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Legacy method for backward compatibility - wraps transaction version
   * Restores leave balance when attendance is overridden from leave status to work status
   */
  private async restoreLeaveBalance(userId: number, leaveStatus: AttendanceStatus, date: Date) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.restoreLeaveBalanceInTransaction(tx, userId, leaveStatus, date);
      });
    } catch (error) {
      this.logger.error(`Error restoring leave balance for user ${userId}:`, error);
      // Don't throw - we don't want to fail the attendance update if balance restoration fails
      // Log the error for manual review
    }
  }


  async getMyAttendance(userId: number, dto: GetAttendanceDto) {
    const { month, year } = dto;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Fetch both attendance and holidays in parallel
    const [attendances, holidays] = await Promise.all([
      this.prisma.attendance.findMany({
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
      }),
      this.holidaysService.getHolidaysInRange(startDate, endDate),
    ]);

    // Convert timestamps to IST for all attendance records
    const attendancesWithIST = attendances.map(att => 
      convertTimestampsToIST(att, ['createdAt', 'updatedAt'])
    );

    return {
      attendances: attendancesWithIST,
      holidays,
    };
  }

  async findAll(query: AttendanceQueryDto) {
    const { page = 1, limit = 10, status, date, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (date) {
      // DATE type comparison - just use the date directly
      const d = normalizeToDateOnly(date);
      where.date = d;
    }

    if (search) {
      where.user = {
        name: {
          contains: search,
          mode: 'insensitive',
        },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          date: 'desc',
        },
        select: {
          id: true,
          userId: true,
          date: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.attendance.count({ where }),
    ]);

    // Convert timestamps to IST for all records
    const dataWithIST = data.map(record => {
      const converted = convertTimestampsToIST(record, ['createdAt', 'updatedAt']);
      return {
        ...converted,
        checkInTime: converted.createdAt,
      };
    });

    return {
      data: dataWithIST,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAttendanceMatrixForExport(startDate: Date, endDate: Date, search?: string) {
    // DATE type - just use the date part
    const start = normalizeToDateOnly(startDate);
    const end = normalizeToDateOnly(endDate);

    // Build where clause
    const where: any = {
      date: {
        gte: start,
        lte: end,
      },
    };

    // Filter by search if provided
    if (search) {
      where.user = {
        name: {
          contains: search,
          mode: 'insensitive',
        },
      };
    }

    // Fetch all attendance records in the date range
    const attendances = await this.prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { user: { name: 'asc' } },
        { date: 'asc' },
      ],
    });

    // Get all unique dates in the range
    const dates: string[] = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Get all unique users
    const userIds = [...new Set(attendances.map(a => a.userId))];
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        active: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
      orderBy: { name: 'asc' },
    });

    // Create a map of attendance by userId and date
    const attendanceMap = new Map<string, AttendanceStatus>();
    attendances.forEach(att => {
      const dateKey = att.date.toISOString().split('T')[0];
      const mapKey = `${att.userId}_${dateKey}`;
      attendanceMap.set(mapKey, att.status);
    });

    // Build the matrix
    const matrix = users.map(user => {
      const row: any = {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        attendance: {},
      };

      dates.forEach(date => {
        const mapKey = `${user.id}_${date}`;
        row.attendance[date] = attendanceMap.get(mapKey) || null;
      });

      return row;
    });

    return {
      dates,
      users: matrix,
    };
  }

  async getAttendanceByDate(date: Date) {
    // DATE type - just use the date directly
    const dateOnly = normalizeToDateOnly(date);

    return this.prisma.attendance.findMany({
      where: {
        date: dateOnly,
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
    }).then(records => 
      records.map(record => 
        convertTimestampsToIST(record, ['createdAt', 'updatedAt'])
      )
    ) as unknown as Promise<AttendanceWithUser[]>;
  }

  async getUserAttendanceSummary(userId: number) {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const cl = 1
    const sl = 1

    const [attendances, leaveBalance] = await Promise.all([
      this.prisma.attendance.findMany({
        where: {
          userId,
          date: {
            gte: firstDay,
            lte: lastDay,
          },
        },
      }),
      this.prisma.leaveBalance.findUnique({
        where: {
          userId_year: {
            userId,
            year: now.getFullYear(),
          },
        },
      }),
    ]);

    // Get recent leave activity for the user
    const recentLeaves = await this.prisma.leaveRequest.findMany({
      where: { userId },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        type: true,
        fromDate: true,
        toDate: true,
        reason: true,
        status: true,
        updatedAt: true,
      },
    });

    return {
      totalDays: lastDay.getDate(),
      present: attendances.filter(a => a.status === 'WFO' || a.status === 'WFH').length,
      wfo: attendances.filter(a => a.status === 'WFO').length,
      wfh: attendances.filter(a => a.status === 'WFH').length,
      cl: leaveBalance?.clBalance || 0,
      sl: leaveBalance?.slBalance || 0,
      compOff: attendances.filter(a => a.status === 'COMP_OFF').length,
      absent: attendances.filter(a => a.status === 'AB').length,
      recentActivity: recentLeaves.map(leave => {
        const updatedAtIST = convertUTCToIST(leave.updatedAt);
        return {
          id: leave.id,
          type: `Leave Request - ${leave.type}`,
          details: `${leave.type} leave from ${leave.fromDate.toISOString().split('T')[0]} to ${leave.toDate.toISOString().split('T')[0]}`,
          status: leave.status,
          date: updatedAtIST ? updatedAtIST.toISOString().split('T')[0] : '',
        };
      }),
    };
  }

  async getUserAdminSummary(userId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDateOnly = normalizeToDateOnly(today);

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
        date: todayDateOnly,
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
        date: todayDateOnly,
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
            avatar: true,
          },
        },
      },
    });

    return {
      totalUsers: users.length,
      presentToday: presentToday.length,
      pendingRequests: pendingRequests.length,
      onLeaveToday: onLeaveToday.length,
      recentActivity: recentActivity.map(activity => {
        const converted = convertTimestampsToIST(activity, ['createdAt', 'updatedAt', 'approvedAt', 'rejectedAt']);
        return {
          id: activity.id,
          status: activity.status,
          type: activity.type,
          fromDate: activity.fromDate,
          toDate: activity.toDate,
          reason: activity.reason,
          userName: activity.user.name,
          userEmail: activity.user.email,
          createdAt: converted.createdAt,
        };
      }),
    };
  }
  

  @Cron('01 12 * * 1-5', { timeZone: 'Asia/Kolkata' }) // At 12:01 PM IST, Monday to Friday
  async autoMarkAbsentAttendance() {
    const { nowIST } = getIST();
    this.logger.log('Running auto-mark absent attendance job');
    const todayDate = normalizeToDateOnly(nowIST.format('YYYY-MM-DD'));
    
    // Check if today is a mandatory holiday
    const isMandatoryHoliday = await this.holidaysService.isMandatoryHoliday(todayDate);
    
    if (isMandatoryHoliday) {
      this.logger.log(`Today (${nowIST.format('YYYY-MM-DD')}) is a mandatory holiday. Marking all active users as ML.`);
      const users = await this.prisma.user.findMany({
        where: {
          active: true,
        },
        select: {
          id: true,
        },
      });
      
      for (const user of users) {
        await this.prisma.attendance.upsert({
          where: {
            userId_date: {
              userId: user.id,
              date: todayDate,
            },
          },
          update: {
            status: AttendanceStatus.ML, // Update to ML if already exists
          },
          create: {
            userId: user.id,
            date: todayDate,
            status: AttendanceStatus.ML,
          },
        });
      }
      this.logger.log('Auto-mark mandatory leave (ML) job completed');
      return;
    }
    
    // Check if today is an optional holiday
    const isHoliday = await this.holidaysService.isHoliday(todayDate);
    const holiday = isHoliday ? await this.prisma.holiday.findFirst({
      where: { date: todayDate }
    }) : null;
    const isOptionalHoliday = holiday && !holiday.isMandatory;
    
    // Get all active users
    const users = await this.prisma.user.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
      },
    });
    
    for (const user of users) {
      // Check if user already has attendance marked
      const existingAttendance = await this.prisma.attendance.findFirst({
        where: {
          userId: user.id,
          date: todayDate,
        },
      });
      
      // Only mark as absent if no attendance exists
      // This applies to both optional holidays and regular days
      if (!existingAttendance) {
        this.logger.log(`Marking user ${user.id} as absent on ${nowIST.format('YYYY-MM-DD')}`);
        await this.prisma.attendance.create({
          data: {
            userId: user.id,
            date: todayDate,
            status: AttendanceStatus.AB,
          },
        });
      }
    }
    this.logger.log('Auto-mark absent attendance job completed');
  }

  /**
   * Sends attendance reminders to employees who haven't marked their attendance by 10:30 AM IST
   * Runs every day at 10:30 AM IST
   */
  @Cron('30 10 * * 1-5', { timeZone: 'Asia/Kolkata' }) // At 10:30 AM IST, Monday to Friday
  async sendAttendanceReminders() {
    try {
      this.logger.log('Running attendance reminder job...');

      const { nowIST } = getIST();
      const today = normalizeToDateOnly(nowIST.format('YYYY-MM-DD'));

      // Find all active users who haven't marked attendance for today
      const usersWithoutAttendance = await this.prisma.user.findMany({
        where: {
          active: true,
          attendances: {
            none: {
              date: today
            }
          }
        },
        select: {
          id: true,
          name: true,
          email: true
        }
      });

      if (usersWithoutAttendance.length === 0) {
        this.logger.log('No users without attendance found');
        return { message: 'No users without attendance found', count: 0 };
      }

      // Send reminder to each user
      for (const user of usersWithoutAttendance) {
        try {
          await this.mailerService.sendMail({
            to: user.email,
            subject: 'Reminder: Mark Your Attendance',
            template: 'attendance-reminder',
            context: {
              employeeName: user.name,
              currentTime: format(nowIST.toDate(), 'PPP'),
              attendanceLink: `${this.FRONTEND_URL}/attendance`
            }
          });
          this.logger.log(`Sent attendance reminder to ${user.email}`);
        } catch (error: any) {
          this.logger.error(`Failed to send attendance reminder to ${user.email}: ${error.message}`);
        }
      }

      this.logger.log(`Sent attendance reminders to ${usersWithoutAttendance.length} users`);
      return { 
        message: `Sent attendance reminders to ${usersWithoutAttendance.length} users`,
        count: usersWithoutAttendance.length 
      };
    } catch (error: any) {
      this.logger.error(`Error in attendance reminder job: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to send attendance reminders');
    }
  }
}