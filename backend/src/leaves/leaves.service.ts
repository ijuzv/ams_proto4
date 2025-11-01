import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeaveStatus, LeaveType, User } from '@prisma/client';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { MailerService } from '../mailer/mailer.service';
import { UsersService } from '../users/users.service';

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
  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService,
    private usersService: UsersService,
  ) {}

  async applyLeave(userId: number, dto: ApplyLeaveDto) {
    const { fromDate, toDate } = dto;
    
    // Validate date range
    if (new Date(fromDate) >= new Date(toDate)) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check for overlapping leave requests
    const overlappingLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        userId,
        status: 'PENDING',
        OR: [
          {
            fromDate: { lte: new Date(toDate) },
            toDate: { gte: new Date(fromDate) },
          },
        ],
      },
    });

    if (overlappingLeaves.length > 0) {
      throw new BadRequestException('You already have a pending leave request for this period');
    }

    // Create leave request
    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        userId,
        ...dto,
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

    // Notify admin
    await this.notifyAdminAboutNewLeaveRequest(leaveRequest as unknown as LeaveWithUser);

    return leaveRequest;
  }

  async getMyLeaves(userId: number) {
    return this.prisma.leaveRequest.findMany({
      where: { userId },
      orderBy: { fromDate: 'desc' },
    });
  }

  async getPendingLeaves() {
    return this.prisma.leaveRequest.findMany({
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

    if (leaveRequest.status !== 'PENDING') {
      throw new BadRequestException('Leave request is not pending');
    }

    const updatedLeave = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: 'APPROVED',
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
    );

    return updatedLeave;
  }

  async rejectLeave(leaveId: number, adminId: number) {
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
      throw new BadRequestException('Leave request is not pending');
    }

    const updatedLeave = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: 'REJECTED',
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
    );

    return updatedLeave;
  }

  private async notifyAdminAboutNewLeaveRequest(leaveRequest: LeaveWithUser) {
    const admins = await this.usersService.findAll();
    const adminEmails = admins
      .filter((user) => user.role === 'ADMIN')
      .map((admin) => admin.email);

    if (adminEmails.length > 0) {
      await this.mailerService.sendMail({
        to: adminEmails,
        subject: `New Leave Request from ${leaveRequest.user.name}`,
        template: 'new-leave-request',
        context: {
          userName: leaveRequest.user.name,
          fromDate: leaveRequest.fromDate.toDateString(),
          toDate: leaveRequest.toDate.toDateString(),
          reason: leaveRequest.reason,
          leaveType: leaveRequest.type,
          leaveId: leaveRequest.id,
        },
      });
    }
  }

  private async notifyUserAboutLeaveStatus(
    leaveRequest: LeaveWithUser,
    status: 'approved' | 'rejected',
  ) {
    await this.mailerService.sendMail({
      to: leaveRequest.user.email,
      subject: `Your Leave Request has been ${status}`,
      template: 'leave-status-update',
      context: {
        userName: leaveRequest.user.name,
        status,
        fromDate: leaveRequest.fromDate.toDateString(),
        toDate: leaveRequest.toDate.toDateString(),
        leaveType: leaveRequest.type,
      },
    });
  }
}
