import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeaveStatus, LeaveType, User, UserRole } from '@prisma/client';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { MailerService } from '../mailer/mailer.service';
import { UsersService } from '../users/users.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { format } from 'date-fns';

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
    private usersService: UsersService,
  ) { }

  async applyLeave(userId: number, dto: ApplyLeaveDto) {
    const { fromDate, toDate } = dto;

    // Convert string dates to Date objects
    const from = new Date(fromDate);
    const to = new Date(toDate);

    // Validate date range
    if (from >= to) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check for overlapping leave requests
    const overlappingLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        userId,
        status: 'PENDING',
        OR: [
          {
            fromDate: { lte: to },
            toDate: { gte: from },
          },
        ],
      },
    });

    if (overlappingLeaves.length > 0) {
      throw new BadRequestException('You already have a pending leave request for this period');
    }

    // Get user details for notification
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create leave request with Date objects
    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        userId,
        type: dto.type,
        fromDate: from,
        toDate: to,
        reason: dto.reason,
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

    return leaveRequest;
  }

  async getMyLeaves(userId: number) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    try {
      return await this.prisma.leaveRequest.findMany({
        where: { userId },
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
      });
    } catch (error) {
      console.error('Error in getMyLeaves:', error);
      throw new Error('Failed to fetch leaves');
    }
  }

  async getManagerApprovedLeaves() {
    return this.prisma.leaveRequest.findMany({
      where: { status: 'MANAGER_APPROVED' },
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
    }) as unknown as Promise<LeaveWithUser[]>;
  }

  async getApprovedLeaves() {
    return this.prisma.leaveRequest.findMany({
      where: {status: 'HR_APPROVED'},
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'asc'}
    })
  }

  async getReporteePendingLeaves(managerId: number) {
    return this.prisma.leaveRequest.findMany({
      where: {
        status: 'PENDING',
        user: {
          managerId: managerId,
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
      orderBy: { createdAt: 'asc' },
    }) as unknown as Promise<LeaveWithUser[]>;
  }

  async approveLeave(leaveId: number, adminId: number) {
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

    const updatedLeave = await this.prisma.leaveRequest.update({
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

    // Notify user about approval
    await this.notifyUserAboutLeaveStatus(
      updatedLeave as unknown as LeaveWithUser,
      'approved',
      'Your leave request has been approved by HR.'
    );

    return updatedLeave;
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

    return updatedLeave;
  }

  async rejectLeave(leaveId: number, adminId: number, comments?: string) {
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

    return updatedLeave;
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

    return updatedLeave;
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

      const approveLink = `${this.FRONTEND_URL}/leaves/approve/${leaveRequest.id}`;
      const rejectLink = `${this.FRONTEND_URL}/leaves/reject/${leaveRequest.id}`;
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
          approveLink,
          rejectLink
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
          rejectLink
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
          comments
        },
      });
    } catch (error) {
      this.logger.error(`Failed to notify user about leave status: ${error.message}`, error.stack);
    }
  }

  /**
   * Sends attendance reminders to employees who haven't marked their attendance by 10:30 AM
   * Runs every day at 10:30 AM
   */
  @Cron('30 10 * * 1-5') // Monday to Friday at 10:30 AM
  async sendAttendanceReminders() {
    try {
      this.logger.log('Running attendance reminder job...');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find all active users who haven't marked attendance for today
      const usersWithoutAttendance = await this.prisma.user.findMany({
        where: {
          attendances: {
            none: {
              date: {
                gte: today,
                lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) // Next day
              }
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
        return;
      }

      // Send reminder to each user
      for (const user of usersWithoutAttendance) {
        try {
          await this.mailerService.sendMail({
            to: user.email,
            subject: 'Reminder: Mark Your Attendance',
            template: 'attendance-reminder',
            context: {
              name: user.name,
              currentDate: format(today, 'PPP'),
              attendanceLink: `${this.FRONTEND_URL}/attendance`
            }
          });
          this.logger.log(`Sent attendance reminder to ${user.email}`);
        } catch (error) {
          this.logger.error(`Failed to send attendance reminder to ${user.email}: ${error.message}`);
        }
      }
      
      this.logger.log(`Sent attendance reminders to ${usersWithoutAttendance.length} users`);
    } catch (error) {
      this.logger.error(`Error in attendance reminder job: ${error.message}`, error.stack);
    }
  }

  /**
   * Sends reminders to managers about pending leave requests that are older than 1 day
   * Runs every day at 9:00 AM
   */
  @Cron('0 9 * * 1-5') // Monday to Friday at 9:00 AM
  async sendPendingLeaveReminders() {
    try {
      this.logger.log('Running pending leave reminder job...');
      
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      // Find all pending leave requests older than 1 day
      const pendingLeaves = await this.prisma.leaveRequest.findMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: oneDayAgo
          },
          user: {
            managerId: { not: null }
          }
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              managerId: true
            }
          }
        }
      });

      if (pendingLeaves.length === 0) {
        this.logger.log('No pending leaves found for reminders');
        return;
      }

      // Group leaves by manager
      const leavesByManager = pendingLeaves.reduce((acc, leave) => {
        const managerId = leave.user.managerId;
        if (!acc[managerId]) {
          acc[managerId] = [];
        }
        acc[managerId].push(leave);
        return acc;
      }, {});

      // Send reminder to each manager
      for (const [managerId, leaves] of Object.entries(leavesByManager)) {
        try {
          const manager = await this.prisma.user.findUnique({
            where: { id: Number(managerId) },
            select: { name: true, email: true }
          });

          if (!manager) continue;

          const leaveRequests = (leaves as any[]).map(leave => ({
            employeeName: leave.user.name,
            fromDate: format(leave.fromDate, 'PPP'),
            toDate: format(leave.toDate, 'PPP'),
            leaveType: leave.type,
            days: Math.ceil((new Date(leave.toDate).getTime() - new Date(leave.fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1,
            requestDate: format(leave.createdAt, 'PPPp'),
            viewLink: `${this.FRONTEND_URL}/leaves/requests`
          }));

          await this.mailerService.sendMail({
            to: manager.email,
            subject: `Reminder: ${leaveRequests.length} Pending Leave Request${leaveRequests.length > 1 ? 's' : ''} Awaiting Your Approval`,
            template: 'pending-leave-reminder',
            context: {
              managerName: manager.name,
              leaveRequests,
              totalPending: leaveRequests.length,
              viewAllLink: `${this.FRONTEND_URL}/leaves/requests`
            }
          });
          
          this.logger.log(`Sent pending leave reminder to manager ${manager.email}`);
        } catch (error) {
          this.logger.error(`Failed to send pending leave reminder to manager ${managerId}: ${error.message}`);
        }
      }
      
      this.logger.log(`Sent pending leave reminders for ${pendingLeaves.length} leave requests`);
    } catch (error) {
      this.logger.error(`Error in pending leave reminder job: ${error.message}`, error.stack);
    }
  }
}
