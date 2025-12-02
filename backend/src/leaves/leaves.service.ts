import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus, LeaveStatus, LeaveType, User, UserRole } from '@prisma/client';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { LeavesQueryDto } from './dto/leaves-query.dto';
import { MailerService } from '../mailer/mailer.service';
import { UsersService } from '../users/users.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { format } from 'date-fns';
import { AttendanceService } from 'src/attendance/attendance.service';
import { HolidaysService } from '../holidays/holidays.service';
import { convertTimestampsToIST, normalizeToDateOnly, calculateDaysBetween } from 'src/Helper/dateTime';

type LeaveWithUser = {
  id: number;
  type: LeaveType;
  fromDate: Date;
  toDate: Date;
  reason: string;
  status: LeaveStatus;
  approvedBy: number | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: number;
    name: string;
    email: string;
  };
};

@Injectable()
export class LeavesService {
  private readonly logger = new Logger(LeavesService.name);
  private readonly FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService,
    private holidaysService: HolidaysService,
  ) { }

  async applyLeave(userId: number, userRole: string,  dto: ApplyLeaveDto) {
    const { fromDate, toDate } = dto;

    // Convert string dates to Date objects (DATE type, no time component)
    const from = normalizeToDateOnly(fromDate);
    const to = normalizeToDateOnly(toDate);

    // Check for mandatory holidays
    const mandatoryHolidays = await this.holidaysService.getMandatoryHolidaysInRange(from, to);
    if (mandatoryHolidays.length > 0) {
      throw new BadRequestException(`Cannot apply leave on mandatory holidays: ${mandatoryHolidays.map(h => `${h.name} (${format(h.date, 'yyyy-MM-dd')})`).join(', ')}`);
    }

    // const isWeeklyOff = await this.holidaysService.getWeeklyOffsInRange(from, to);

    // if(isWeeklyOff) {
    //   throw new BadRequestException('Cannot apply leave on weekly off days');
    // }

    // Check for overlapping leave requests (including pending and approved ones)
    const overlappingLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        userId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.MANAGER_APPROVED, LeaveStatus.HR_APPROVED] },
        OR: [
          {
            fromDate: { lte: to },
            toDate: { gte: from },
          },
        ],
      },
    });

    if (overlappingLeaves.length > 0) {
      const statuses = overlappingLeaves.map(l => l.status).join(', ');
      throw new BadRequestException(`You already have a leave request (status: ${statuses}) for this period`);
    }

    // Get user details for notification
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check Balance
    await this.checkBalance(userId, dto.type, from, to);

    // For admins, set status to PENDING (requires manager/admin approval)
    // For regular users, also set to PENDING (requires manager approval)
    const initialStatus = userRole === 'ADMIN' ? LeaveStatus.MANAGER_APPROVED : LeaveStatus.PENDING;

    // Create leave request with Date objects (DATE type)
    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        userId,
        type: dto.type,
        fromDate: from,
        toDate: to,
        reason: dto.reason,
        status: initialStatus,
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
    });

    // Notify the employee's manager
    await this.notifyManagerAboutNewLeaveRequest(leaveRequest as unknown as LeaveWithUser);

    // Also notify the employee that their leave request was submitted
    await this.notifyUserAboutLeaveStatus(
      leaveRequest as unknown as LeaveWithUser,
      'pending',
      'Your leave request has been submitted and is pending approval.'
    );

    // Convert timestamps to IST before returning
    return convertTimestampsToIST(leaveRequest, ['createdAt', 'updatedAt', 'approvedAt', 'rejectedAt']);
  }

  async getMyLeaves(userId: number, page: number = 1, limit: number = 10, date?: string, status?: string) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const where: any = {};

    const rejectedStatuses = [LeaveStatus.HR_REJECTED, LeaveStatus.MANAGER_REJECTED];

    where.userId = userId;

    if (status) {
      if (status === "REJECTED") {
        where.status = { in: rejectedStatuses };
      } else {
        where.status = status;
      }
    }

    if (date) {
      const d = new Date(date);
      // DATE type comparison - check if date falls within fromDate-toDate range
      where.OR = [
        { fromDate: { lte: d }, toDate: { gte: d } }
      ];
    }

    try {
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.prisma.leaveRequest.findMany({
          where,
          skip,
          take: limit,
          orderBy: { fromDate: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        this.prisma.leaveRequest.count({ where: { userId } })
      ]);

      // Convert timestamps to IST for all records
      const dataWithIST = data.map(record => 
        convertTimestampsToIST(record, ['createdAt', 'updatedAt', 'approvedAt', 'rejectedAt'])
      );

      return {
        data: dataWithIST,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error in getMyLeaves:', error);
      throw new Error('Failed to fetch leaves');
    }
  }

  async getManagerApprovedLeaves() {
    const data = await this.prisma.leaveRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    // Convert timestamps to IST
    return data.map(record => 
      convertTimestampsToIST(record, ['createdAt', 'updatedAt', 'approvedAt', 'rejectedAt'])
    ) as unknown as LeaveWithUser[];
  }

  async getApprovedLeaves() {
    const data = await this.prisma.leaveRequest.findMany({
      where: { status: 'MANAGER_APPROVED' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    // Convert timestamps to IST
    return data.map(record => 
      convertTimestampsToIST(record, ['createdAt', 'updatedAt', 'approvedAt', 'rejectedAt'])
    );
  }

  async getReporteePendingLeaves(
    managerId: number,
    page: number = 1,
    limit: number = 10,
    date?: string,
    status?: string
  ) {
    const skip = (page - 1) * limit;

    // Base filter
    const where: any = {
      status: LeaveStatus.PENDING,
      user: {
        managerId: managerId,
      },
    };

    // Optional date filter (fromDate / toDate match)
    if (date) {
      const d = new Date(date);
      // DATE type comparison - check if date falls within fromDate-toDate range
      where.OR = [
        { fromDate: { lte: d }, toDate: { gte: d } }
      ];
    }

    // Optional status override
    if (status) {
      where.status = status;
    }

    try {
      const [data, total] = await Promise.all([
        this.prisma.leaveRequest.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),

        this.prisma.leaveRequest.count({ where }),
      ]);

      // Convert timestamps to IST for all records
      const dataWithIST = data.map(record => 
        convertTimestampsToIST(record, ['createdAt', 'updatedAt', 'approvedAt', 'rejectedAt'])
      );

      return {
        data: dataWithIST,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error("Error in getReporteePendingLeaves:", error);
      throw new Error("Failed to fetch pending leave requests");
    }
  }

  async approveLeave(leaveId: number, adminId: number) {
    // First, check if the admin has the correct designation
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { designation: true, role: true },
    });

    if (!admin) {
      throw new NotFoundException('Admin user not found');
    }

    // Check if admin has hradmin designation (case-insensitive)
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can approve leaves');
    }

    if (!admin.designation || admin.designation.toLowerCase() !== 'hr manager') {
      throw new ForbiddenException('Only HR admins can approve leaves');
    }

    const LeaveToAttendanceMap = {
      [LeaveType.SICK]: AttendanceStatus.SL,
      [LeaveType.CASUAL]: AttendanceStatus.CL,
      [LeaveType.EARNED]: AttendanceStatus.EL,
      [LeaveType.COMP_OFF]: AttendanceStatus.COMP_OFF,
      [LeaveType.LOP]: AttendanceStatus.AB,
      [LeaveType.OPTIONAL]: AttendanceStatus.OL, // Use OL status for optional leave
    } as const;

    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.status !== 'MANAGER_APPROVED') {
      throw new BadRequestException('Leave request is not Manager Approved');
    }

    if (adminId === leaveRequest.userId) {
      throw new ForbiddenException('You cannot approve your own leave request');
    }

    // Calculate days using standardized helper
    const days = calculateDaysBetween(leaveRequest.fromDate, leaveRequest.toDate);

    // Wrap operations in transaction for atomicity
    const updatedLeave = await this.prisma.$transaction(async (tx) => {
      // Update leave request status
      const updated = await tx.leaveRequest.update({
        where: { id: leaveId },
        data: {
          status: 'HR_APPROVED',
          approvedBy: adminId,
          approvedAt: new Date(),
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
      });

      // Mark attendance for each day of leave (will overwrite existing attendance if any)
      const status = LeaveToAttendanceMap[leaveRequest.type];
      const currentDate = normalizeToDateOnly(leaveRequest.fromDate);
      const endDate = normalizeToDateOnly(leaveRequest.toDate);
      const dateForLoop = new Date(currentDate);

      while (dateForLoop <= endDate) {
        await tx.attendance.upsert({
          where: {
            userId_date: {
              userId: leaveRequest.userId,
              date: new Date(dateForLoop),
            },
          },
          update: {
            status: status,
          },
          create: {
            userId: leaveRequest.userId,
            date: new Date(dateForLoop),
            status: status,
          },
        });
        dateForLoop.setDate(dateForLoop.getDate() + 1);
      }

      // Deduct Balance only for SICK, CASUAL, EARNED, and OPTIONAL leaves
      const leaveTypeStr = String(leaveRequest.type);
      const shouldDeductBalance = 
        leaveTypeStr === 'SICK' || 
        leaveTypeStr === 'CASUAL' || 
        leaveTypeStr === 'EARNED' || 
        leaveTypeStr === 'OPTIONAL';
      
      this.logger.log(`Leave type check: ${leaveTypeStr}, shouldDeductBalance: ${shouldDeductBalance}`);
      
      if (shouldDeductBalance) {
        // Get or create leave balance for the year
        const currentYear = new Date().getFullYear();
        let balance = await tx.leaveBalance.findUnique({
          where: { userId_year: { userId: leaveRequest.userId, year: currentYear } },
        });

        if (!balance) {
          balance = await tx.leaveBalance.create({
            data: { userId: leaveRequest.userId, year: currentYear, clBalance: 0, slBalance: 0, elBalance: 0, olBalance: 0 },
          });
        }

        const updateData: { clBalance?: number; slBalance?: number; elBalance?: number; olBalance?: number } = {};

        if (leaveTypeStr === 'CASUAL') {
          updateData.clBalance = balance.clBalance - days;
        } else if (leaveTypeStr === 'SICK') {
          updateData.slBalance = balance.slBalance - days;
        } else if (leaveTypeStr === 'EARNED') {
          updateData.elBalance = balance.elBalance - days;
        } else if (leaveTypeStr === 'OPTIONAL') {
          updateData.olBalance = balance.olBalance - days;
        }

        if (Object.keys(updateData).length > 0) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: updateData,
          });
        }
      }

      return updated;
    });
    // Notify user about approval
    await this.notifyUserAboutLeaveStatus(
      updatedLeave as unknown as LeaveWithUser,
      'approved',
      'Your leave request has been approved by HR.'
    );

    // Convert timestamps to IST before returning
    return convertTimestampsToIST(updatedLeave, ['createdAt', 'updatedAt', 'approvedAt', 'rejectedAt']);
  }

  async approveManagerLeave(leaveId: number, managerId: number) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.status !== 'PENDING') {
      throw new BadRequestException('Leave request is not in pending status');
    }

    const updatedLeave = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: 'MANAGER_APPROVED',
        approvedBy: managerId,
        approvedAt: new Date(),
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
    });

    // Notify HR about the approved leave
    await this.notifyHrAboutLeaveStatus(
      updatedLeave as unknown as LeaveWithUser,
      'approved'
    );

    // Notify employee about the approval
    await this.notifyUserAboutLeaveStatus(
      updatedLeave as unknown as LeaveWithUser,
      'approved',
      'Your leave request has been approved by your manager and is pending HR approval.'
    );

    // Convert timestamps to IST before returning
    return convertTimestampsToIST(updatedLeave, ['createdAt', 'updatedAt', 'approvedAt', 'rejectedAt']);
  }

  async rejectLeave(leaveId: number, adminId: number, comments?: string) {
    // First, check if the admin has the correct designation
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { designation: true, role: true },
    });

    if (!admin) {
      throw new NotFoundException('Admin user not found');
    }

    // Check if admin has hradmin designation (case-insensitive)
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can reject leaves');
    }

    if (!admin.designation || admin.designation.toLowerCase() !== 'hr manager') {
      throw new ForbiddenException('Only HR admins can reject leaves');
    }

    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.status !== 'MANAGER_APPROVED') {
      throw new BadRequestException('Leave request is not manager approved');
    }

    if (adminId === leaveRequest.userId) {
      throw new ForbiddenException('You cannot reject your own leave request');
    }

    const updatedLeave = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: 'HR_REJECTED',
        approvedBy: adminId,
        rejectedAt: new Date(),
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
    });

    // Notify user about rejection
    await this.notifyUserAboutLeaveStatus(
      updatedLeave as unknown as LeaveWithUser,
      'rejected',
      comments || 'Your leave request has been rejected by HR.'
    );

    // Convert timestamps to IST before returning
    return convertTimestampsToIST(updatedLeave, ['createdAt', 'updatedAt', 'approvedAt', 'rejectedAt']);
  }

  async rejectManagerLeave(leaveId: number, managerId: number, comments?: string) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            managerId: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.status !== 'PENDING') {
      throw new BadRequestException('Leave request is not in pending status');
    }

    // Verify that the rejecting user is the employee's manager
    if (leaveRequest.user.managerId !== managerId) {
      throw new ForbiddenException('You are not authorized to reject this leave request');
    }

    const updatedLeave = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: LeaveStatus.MANAGER_REJECTED,
        approvedBy: managerId,
        rejectedAt: new Date(),
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
    });

    // Notify user about rejection
    await this.notifyUserAboutLeaveStatus(
      updatedLeave as unknown as LeaveWithUser,
      'rejected',
      comments || 'Your leave request has been rejected by your manager.'
    );

    // Convert timestamps to IST before returning
    return convertTimestampsToIST(updatedLeave, ['createdAt', 'updatedAt', 'approvedAt', 'rejectedAt']);
  }

  async findAll(query: LeavesQueryDto) {
    const { page = 1, limit = 10, status, date, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    const rejectedStatuses = [
      LeaveStatus.HR_REJECTED,
      LeaveStatus.MANAGER_REJECTED,
    ];

    if (status) {
      if (status === "REJECTED") {
        where.status = { in: rejectedStatuses };
      } else {
        where.status = status;
      }
    }


    if (date) {
      const d = new Date(date);
      // DATE type comparison - check if date falls within fromDate-toDate range
      where.OR = [
        { fromDate: { lte: d }, toDate: { gte: d } }
      ];
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
      this.prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
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
          createdAt: 'desc',
        },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    // Convert timestamps to IST for all records
    const dataWithIST = data.map(record => 
      convertTimestampsToIST(record, ['createdAt', 'updatedAt', 'approvedAt', 'rejectedAt'])
    );

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

  async getAdminLeaveRequests(
    page: number = 1,
    limit: number = 10,
    date?: string,
    status?: string
  ) {
    const skip = (page - 1) * limit;

    // Base filter - only ADMIN users
    const where: any = {
      user: {
        role: UserRole.ADMIN,
      },
    };

    // Status filter - default to PENDING or MANAGER_APPROVED
    if (status) {
      where.status = status;
    } else {
      where.status = {
        in: [LeaveStatus.PENDING, LeaveStatus.MANAGER_APPROVED],
      };
    }

    // Optional date filter
    if (date) {
      const d = new Date(date);
      // DATE type comparison - check if date falls within fromDate-toDate range
      where.OR = [
        { fromDate: { lte: d }, toDate: { gte: d } }
      ];
    }

    try {
      const [data, total] = await Promise.all([
        this.prisma.leaveRequest.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        }),
        this.prisma.leaveRequest.count({ where }),
      ]);

      // Convert timestamps to IST for all records
      const dataWithIST = data.map(record => 
        convertTimestampsToIST(record, ['createdAt', 'updatedAt', 'approvedAt', 'rejectedAt'])
      );

      return {
        data: dataWithIST,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error in getAdminLeaveRequests:', error);
      throw new Error('Failed to fetch admin leave requests');
    }
  }

  async approveAdminLeave(leaveId: number, ceoId: number) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    // Verify the leave request is from an ADMIN
    if (leaveRequest.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('This leave request is not from an admin');
    }

    // Verify CEO is not approving their own leave
    if (ceoId === leaveRequest.userId) {
      throw new ForbiddenException('You cannot approve your own leave request');
    }

    // Check if leave is in valid status for CEO approval
    if (leaveRequest.status !== LeaveStatus.PENDING && leaveRequest.status !== LeaveStatus.MANAGER_APPROVED) {
      throw new BadRequestException(`Leave request status is ${leaveRequest.status}. Cannot approve.`);
    }

    const LeaveToAttendanceMap = {
      [LeaveType.SICK]: AttendanceStatus.SL,
      [LeaveType.CASUAL]: AttendanceStatus.CL,
      [LeaveType.EARNED]: AttendanceStatus.EL,
      [LeaveType.COMP_OFF]: AttendanceStatus.COMP_OFF,
      [LeaveType.LOP]: AttendanceStatus.AB,
      [LeaveType.OPTIONAL]: AttendanceStatus.OL, // Use OL status for optional leave
    } as const;

    // Calculate days using standardized helper
    const days = calculateDaysBetween(leaveRequest.fromDate, leaveRequest.toDate);

    // Wrap operations in transaction for atomicity
    const updatedLeave = await this.prisma.$transaction(async (tx) => {
      // Update leave request status
      const updated = await tx.leaveRequest.update({
        where: { id: leaveId },
        data: {
          status: 'HR_APPROVED',
          approvedBy: ceoId,
          approvedAt: new Date(),
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
      });

      // Mark attendance for each day of leave
      const status = LeaveToAttendanceMap[leaveRequest.type];
      const currentDate = normalizeToDateOnly(leaveRequest.fromDate);
      const endDate = normalizeToDateOnly(leaveRequest.toDate);
      const dateForLoop = new Date(currentDate);

      while (dateForLoop <= endDate) {
        await tx.attendance.upsert({
          where: {
            userId_date: {
              userId: leaveRequest.userId,
              date: new Date(dateForLoop),
            },
          },
          update: {
            status: status,
          },
          create: {
            userId: leaveRequest.userId,
            date: new Date(dateForLoop),
            status: status,
          },
        });
        dateForLoop.setDate(dateForLoop.getDate() + 1);
      }

      // Deduct Balance only for SICK, CASUAL, EARNED, and OPTIONAL leaves
      const leaveTypeStr = String(leaveRequest.type);
      const shouldDeductBalance = 
        leaveTypeStr === 'SICK' || 
        leaveTypeStr === 'CASUAL' || 
        leaveTypeStr === 'EARNED' || 
        leaveTypeStr === 'OPTIONAL';
      
      if (shouldDeductBalance) {
        // Get or create leave balance for the year
        const currentYear = new Date().getFullYear();
        let balance = await tx.leaveBalance.findUnique({
          where: { userId_year: { userId: leaveRequest.userId, year: currentYear } },
        });

        if (!balance) {
          balance = await tx.leaveBalance.create({
            data: { userId: leaveRequest.userId, year: currentYear, clBalance: 0, slBalance: 0, elBalance: 0, olBalance: 0 },
          });
        }

        const updateData: { clBalance?: number; slBalance?: number; elBalance?: number; olBalance?: number } = {};

        if (leaveTypeStr === 'CASUAL') {
          updateData.clBalance = balance.clBalance - days;
        } else if (leaveTypeStr === 'SICK') {
          updateData.slBalance = balance.slBalance - days;
        } else if (leaveTypeStr === 'EARNED') {
          updateData.elBalance = balance.elBalance - days;
        } else if (leaveTypeStr === 'OPTIONAL') {
          updateData.olBalance = balance.olBalance - days;
        }

        if (Object.keys(updateData).length > 0) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: updateData,
          });
        }
      }

      return updated;
    });

    // Notify admin about approval
    await this.notifyUserAboutLeaveStatus(
      updatedLeave as unknown as LeaveWithUser,
      'approved',
      'Your leave request has been approved by CEO.'
    );

    return updatedLeave;
  }

  async rejectAdminLeave(leaveId: number, ceoId: number, comments?: string) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    // Verify the leave request is from an ADMIN
    if (leaveRequest.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('This leave request is not from an admin');
    }

    // Check if leave is in valid status for CEO rejection
    if (leaveRequest.status !== LeaveStatus.PENDING && leaveRequest.status !== LeaveStatus.MANAGER_APPROVED) {
      throw new BadRequestException(`Leave request status is ${leaveRequest.status}. Cannot reject.`);
    }

    const updatedLeave = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: 'HR_REJECTED',
        rejectedAt: new Date(),
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
    });

    // Notify admin about rejection
    await this.notifyUserAboutLeaveStatus(
      updatedLeave as unknown as LeaveWithUser,
      'rejected',
      comments || 'Your leave request has been rejected by CEO.'
    );

    return updatedLeave;
  }

  async updateLeave(leaveId: number, userId: number, dto: ApplyLeaveDto) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
    });

    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.userId !== userId) throw new ForbiddenException('Not authorized');
    if (leave.status !== LeaveStatus.PENDING) throw new BadRequestException('Cannot edit non-pending leave');

    const updated = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        type: dto.type,
        fromDate: new Date(dto.fromDate),
        toDate: new Date(dto.toDate),
        reason: dto.reason,
      },
    });
    // Convert timestamps to IST before returning
    return convertTimestampsToIST(updated, ['createdAt', 'updatedAt', 'approvedAt', 'rejectedAt']);
  }

  async deleteLeave(leaveId: number, userId: number) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
    });

    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.userId !== userId) throw new ForbiddenException('Not authorized');
    if (leave.status !== LeaveStatus.PENDING) throw new BadRequestException('Cannot delete non-pending leave');

    return this.prisma.leaveRequest.delete({
      where: { id: leaveId },
    });
  }

  private async notifyManagerAboutNewLeaveRequest(leaveRequest: LeaveWithUser) {
    try {
      // Get the employee's manager
      const employee = await this.prisma.user.findUnique({
        where: { id: leaveRequest.user.id },
        include: {
        }
      });

      if (!employee?.managerId) {
        this.logger.warn(`No manager found for user ${leaveRequest.user.id}`);
        return;
      }

      const requestListLink = `${this.FRONTEND_URL}/leaves/requests`;
      const manager = await this.prisma.user.findUnique({
        where: { id: employee.managerId },
      });

      await this.mailerService.sendMail({
        to: manager.email,
        subject: `New Leave Request from ${leaveRequest.user.name}`,
        template: 'manager-leave-request',
        context: {
          managerName: manager.name,
          employeeName: leaveRequest.user.name,
          leaveType: leaveRequest.type,
          fromDate: format(leaveRequest.fromDate, 'PPP'),
          toDate: format(leaveRequest.toDate, 'PPP'),
          reason: leaveRequest.reason,
          requestListLink,
          message: `You have received a new leave request from ${leaveRequest.user.name} for ${leaveRequest.type} leave from ${format(leaveRequest.fromDate, 'PPP')} to ${format(leaveRequest.toDate, 'PPP')}. Please review and take appropriate action.`
        },
      });
    } catch (error) {
      this.logger.error(`Failed to notify manager: ${error.message}`, error.stack);
    }
  }

  private async notifyHrAboutLeaveStatus(
    leaveRequest: LeaveWithUser,
    action: 'approved' | 'rejected',
    comments?: string
  ) {
    try {
      // Get all HR users
      const hrUsers = await this.prisma.user.findMany({
        where: { role: 'ADMIN' }, // Assuming ADMIN role is for HR
        select: { email: true, name: true }
      });

      if (hrUsers.length === 0) {
        this.logger.warn('No HR users found to notify');
        return;
      }

      const hrEmails = hrUsers.map(hr => hr.email);
      const approver = await this.prisma.user.findUnique({
        where: { id: leaveRequest.approvedBy || undefined },
        select: { name: true }
      });

      const approveLink = `${this.FRONTEND_URL}/leaves/approve/${leaveRequest.id}`;
      const rejectLink = `${this.FRONTEND_URL}/leaves/reject/${leaveRequest.id}`;

      await this.mailerService.sendMail({
        to: hrEmails,
        subject: `Leave Request ${action === 'approved' ? 'Approved' : 'Rejected'} by Manager`,
        template: 'hr-leave-approval',
        context: {
          action,
          employeeName: leaveRequest.user.name,
          managerName: approver?.name || 'Manager',
          leaveType: leaveRequest.type,
          fromDate: format(leaveRequest.fromDate, 'PPP'),
          toDate: format(leaveRequest.toDate, 'PPP'),
          reason: leaveRequest.reason,
          comments,
          approveLink,
          rejectLink,
          message: `A leave request from ${leaveRequest.user.name} has been ${action} by ${approver?.name || 'Manager'} and requires your review. The employee has requested ${leaveRequest.type} leave from ${format(leaveRequest.fromDate, 'PPP')} to ${format(leaveRequest.toDate, 'PPP')}.`
        },
      });
    } catch (error) {
      this.logger.error(`Failed to notify HR: ${error.message}`, error.stack);
    }
  }

  private async notifyUserAboutLeaveStatus(
    leaveRequest: LeaveWithUser,
    status: 'approved' | 'rejected' | 'pending',
    comments?: string
  ) {
    try {
      const approver = leaveRequest.approvedBy ?
        await this.prisma.user.findUnique({
          where: { id: leaveRequest.approvedBy },
          select: { name: true, role: true }
        }) : null;

      let statusMessage = '';
      if (status === 'approved') {
        statusMessage = `We're pleased to inform you that your leave request has been approved${approver?.role === 'ADMIN' ? ' by HR' : approver?.role === 'MANAGER' ? ' by your manager' : ''}.`;
      } else if (status === 'rejected') {
        statusMessage = `We regret to inform you that your leave request has been rejected${approver?.role === 'ADMIN' ? ' by HR' : approver?.role === 'MANAGER' ? ' by your manager' : ''}.`;
      } else {
        statusMessage = `Your leave request status has been updated to pending.`;
      }

      await this.mailerService.sendMail({
        to: leaveRequest.user.email,
        subject: `Your Leave Request Has Been ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        template: 'employee-leave-status',
        context: {
          employeeName: leaveRequest.user.name,
          status,
          fromDate: format(leaveRequest.fromDate, 'PPP'),
          toDate: format(leaveRequest.toDate, 'PPP'),
          leaveType: leaveRequest.type,
          reason: leaveRequest.reason,
          approverName: approver?.name,
          approverRole: approver?.role,
          comments,
          message: statusMessage
        },
      });
    } catch (error) {
      this.logger.error(`Failed to notify user about leave status: ${error.message}`, error.stack);
    }
  }


  async getLeaveBalance(userId: number) {
    const currentYear = new Date().getFullYear();
    let balance = await this.prisma.leaveBalance.findUnique({
      where: { userId_year: { userId, year: currentYear } },
    });

    if (!balance) {
      // Initialize if not exists
      balance = await this.prisma.leaveBalance.create({
        data: { userId, year: currentYear, clBalance: 0, slBalance: 0, elBalance: 0, olBalance: 0 },
      });
    }

    return balance;
  }

  @Cron('0 0 1 * *', { timeZone: 'Asia/Kolkata' }) // At 12:00 AM IST on the 1st of each month
  async accrueMonthlyLeaves() {
    this.logger.log('Running monthly leave accrual (CL/SL)...');
    const currentYear = new Date().getFullYear();
    const users = await this.prisma.user.findMany({ where: { active: true } });

    for (const user of users) {
      let balance = await this.prisma.leaveBalance.findUnique({
        where: { userId_year: { userId: user.id, year: currentYear } },
      });

      if (!balance) {
        balance = await this.prisma.leaveBalance.create({
          data: { userId: user.id, year: currentYear, clBalance: 0, slBalance: 0, elBalance: 0 },
        });
      }

      await this.prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          clBalance: balance.clBalance + 1,
          slBalance: balance.slBalance + 1,
        },
      });
    }
    this.logger.log(`Accrued monthly leaves (CL/SL) for ${users.length} users.`);
    return { count: users.length, message: 'Monthly accrual complete' };
  }

  @Cron('0 0 * * *', { timeZone: 'Asia/Kolkata' }) // At 12:00 AM IST every day
  async accrueYearlyEL() {
    this.logger.log('Running yearly EL accrual based on joining dates...');
    const currentYear = new Date().getFullYear();
    const today = normalizeToDateOnly(new Date());

    // Get all active users with joining dates
    const users = await this.prisma.user.findMany({
      where: {
        active: true,
        joiningDate: { not: null },
      },
    });

    let accruedCount = 0;

    for (const user of users) {
      if (!user.joiningDate) continue;

      const joiningDate = normalizeToDateOnly(user.joiningDate);
      const currentYearAnniversary = new Date(currentYear, joiningDate.getMonth(), joiningDate.getDate());
      const normalizedAnniversary = normalizeToDateOnly(currentYearAnniversary);

      // Check if anniversary has passed this year
      if (today >= normalizedAnniversary) {
        // Get or create leave balance for current year
        let balance = await this.prisma.leaveBalance.findUnique({
          where: { userId_year: { userId: user.id, year: currentYear } },
        });

        if (!balance) {
          balance = await this.prisma.leaveBalance.create({
            data: { userId: user.id, year: currentYear, clBalance: 0, slBalance: 0, elBalance: 0, olBalance: 0 },
          });
        }

        // Check if EL was already accrued this year by checking:
        // 1. If balance was created/updated after the anniversary date, it means we already processed it
        // 2. If elBalance >= 12, it likely means it was accrued (unless manually set)
        // To prevent duplicate accrual, we check if the balance was updated after the anniversary
        // OR if the balance was created before this year (meaning we're in a new year and haven't accrued yet)
        const balanceCreatedDate = normalizeToDateOnly(balance.createdAt);
        const balanceUpdatedDate = normalizeToDateOnly(balance.updatedAt);
        const balanceYear = new Date(balance.createdAt).getFullYear();

        // EL was already accrued if:
        // - Balance was created this year AND (updated after anniversary OR elBalance >= 12)
        // - OR balance was created before this year but updated after anniversary this year
        const wasCreatedThisYear = balanceYear === currentYear;
        const wasUpdatedAfterAnniversary = balanceUpdatedDate >= normalizedAnniversary;
        const hasELBalance = balance.elBalance >= 12;

        // Accrue only if:
        // - Balance was just created this year and hasn't been updated after anniversary, OR
        // - Balance was created in a previous year (new year scenario)
        const shouldAccrue = !(wasCreatedThisYear && (wasUpdatedAfterAnniversary || hasELBalance));

        if (shouldAccrue) {
          // Add 12 EL, capped at 24
          const newBalance = Math.min(balance.elBalance + 12, 24);
          
          await this.prisma.leaveBalance.update({
            where: { id: balance.id },
            data: {
              elBalance: newBalance,
            },
          });

          this.logger.log(`Accrued 12 EL for user ${user.id} (${user.name}). New balance: ${newBalance}`);
          accruedCount++;
        }
      }
    }

    this.logger.log(`Yearly EL accrual complete. Accrued for ${accruedCount} users.`);
    return { count: accruedCount, message: 'Yearly EL accrual complete' };
  }

  @Cron('0 0 1 1 *', { timeZone: 'Asia/Kolkata' }) // January 1st at 12:00 AM IST
  async accrueYearlyOL() {
    this.logger.log('Running yearly optional leave allocation...');
    const currentYear = new Date().getFullYear();
    const users = await this.prisma.user.findMany({ where: { active: true } });

    let allocatedCount = 0;

    for (const user of users) {
      let balance = await this.prisma.leaveBalance.findUnique({
        where: { userId_year: { userId: user.id, year: currentYear } },
      });

      if (!balance) {
        balance = await this.prisma.leaveBalance.create({
          data: {
            userId: user.id,
            year: currentYear,
            clBalance: 0,
            slBalance: 0,
            elBalance: 0,
            olBalance: 5,
          },
        });
        allocatedCount++;
      } else {
        // Update existing balance - reset to 5 for new year
        await this.prisma.leaveBalance.update({
          where: { id: balance.id },
          data: {
            olBalance: 5,
          },
        });
        allocatedCount++;
      }
    }

    this.logger.log(`Allocated 5 optional leaves to ${allocatedCount} users for year ${currentYear}.`);
    return { count: allocatedCount, message: 'Optional leave allocation complete' };
  }

  private async checkBalance(userId: number, type: LeaveType, from: Date, to: Date) {
    const days = calculateDaysBetween(from, to);
    const balance = await this.getLeaveBalance(userId);

    if (type === LeaveType.CASUAL && balance.clBalance < days) {
      throw new BadRequestException(
        `Insufficient Casual Leave balance. Available: ${balance.clBalance} day(s), Requested: ${days} day(s). ` +
        `You need ${(days - balance.clBalance).toFixed(1)} more day(s) to apply for this leave.`
      );
    }
    if (type === LeaveType.SICK && balance.slBalance < days) {
      throw new BadRequestException(
        `Insufficient Sick Leave balance. Available: ${balance.slBalance} day(s), Requested: ${days} day(s). ` +
        `You need ${(days - balance.slBalance).toFixed(1)} more day(s) to apply for this leave.`
      );
    }
    if (type === LeaveType.EARNED && balance.elBalance < days) {
      throw new BadRequestException(
        `Insufficient Earned Leave balance. Available: ${balance.elBalance} day(s), Requested: ${days} day(s). ` +
        `You need ${(days - balance.elBalance).toFixed(1)} more day(s) to apply for this leave.`
      );
    }
    if (type === LeaveType.OPTIONAL && balance.olBalance < days) {
      throw new BadRequestException(
        `Insufficient Optional Leave balance. Available: ${balance.olBalance} day(s), Requested: ${days} day(s). ` +
        `You need ${(days - balance.olBalance).toFixed(1)} more day(s) to apply for this leave.`
      );
    }
  }

  private async deductBalance(userId: number, type: LeaveType, days: number) {
    const balance = await this.getLeaveBalance(userId);
    const data: any = {};

    if (type === LeaveType.CASUAL) data.clBalance = balance.clBalance - days;
    if (type === LeaveType.SICK) data.slBalance = balance.slBalance - days;
    if (type === LeaveType.EARNED) data.elBalance = balance.elBalance - days;
    if (type === LeaveType.OPTIONAL) data.olBalance = balance.olBalance - days;

    if (Object.keys(data).length > 0) {
      await this.prisma.leaveBalance.update({
        where: { id: balance.id },
        data
      });
    }
  }

  async revokeLeave(leaveId: number, userId: number) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.userId !== userId) {
      throw new ForbiddenException('You are not authorized to revoke this leave request');
    }

    if (leaveRequest.status !== 'PENDING' && leaveRequest.status !== 'MANAGER_APPROVED') {
      throw new BadRequestException('Cannot revoke a leave request that has been rejected or HR approved');
    }

    const updatedLeave = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: 'CANCELLED',
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
    });

    return updatedLeave;
  }

  async getUserRecentActivity(userId: number) {
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
        createdAt: true,
      },
    });

    return recentLeaves.map(leave => ({
      id: leave.id,
      type: `Leave Request - ${leave.type}`,
      details: `${leave.type} leave from ${format(leave.fromDate, 'MMM dd')} to ${format(leave.toDate, 'MMM dd')}`,
      status: leave.status,
      date: format(leave.updatedAt, 'MMM dd, yyyy'),
    }));
  }
}
