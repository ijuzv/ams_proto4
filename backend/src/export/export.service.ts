import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ExportGlobalDto, DataType, TimeFilter, ExportType } from './dto/export-global.dto';
import { normalizeToDateOnly } from '../Helper/dateTime';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { AttendanceStatus, LeaveStatus, LeaveType } from '@prisma/client';

@Injectable()
export class ExportService {
  constructor(
    private prisma: PrismaService,
    private attendanceService: AttendanceService,
  ) { }

  async exportGlobal(dto: ExportGlobalDto, res: Response) {
    const workbook = new ExcelJS.Workbook();
    const { dataTypes, timeFilter, specificDate, fromDate, toDate, fileType, fileName } = dto;

    let startDate: Date;
    let endDate: Date;

    // If custom range is provided, use those dates
    if (timeFilter === TimeFilter.CUSTOM_RANGE && fromDate && toDate) {
      startDate = new Date(fromDate);
      endDate = new Date(toDate);
    } else {
      startDate = this.calculateStartDate(timeFilter, specificDate);
      endDate = specificDate ? new Date(specificDate) : new Date();
    }

    // DATE type - convert to date-only using helper function
    const startDateOnly = normalizeToDateOnly(startDate);
    const endDateOnly = normalizeToDateOnly(endDate);

    if (dataTypes.includes(DataType.USERS)) {
      await this.addUsersSheet(workbook);
    }

    if (dataTypes.includes(DataType.ATTENDANCE)) {
      await this.addAttendanceSheet(workbook, startDateOnly, endDateOnly);
    }

    if (dataTypes.includes(DataType.APPROVED_LEAVES)) {
      await this.addApprovedLeavesSheet(workbook, startDateOnly, endDateOnly);
    }

    if (dataTypes.includes(DataType.LEAVE_SUMMARY)) {
      await this.addLeaveSummarySheet(workbook);
    }

    if (fileType === ExportType.CSV) {

      const sheet = workbook.worksheets[0];
      if (sheet) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}.csv`);
        await workbook.csv.write(res, { sheetId: sheet.id });
      }
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}.xlsx`);
      await workbook.xlsx.write(res);
    }
  }

  private calculateStartDate(filter: TimeFilter, specificDate?: string): Date {
    const now = new Date();
    switch (filter) {
      case TimeFilter.LAST_7_DAYS:
        return new Date(now.setDate(now.getDate() - 7));
      case TimeFilter.LAST_30_DAYS:
        return new Date(now.setDate(now.getDate() - 30));
      case TimeFilter.LAST_3_MONTHS:
        return new Date(now.setMonth(now.getMonth() - 3));
      case TimeFilter.LAST_6_MONTHS:
        return new Date(now.setMonth(now.getMonth() - 6));
      case TimeFilter.LAST_1_YEAR:
        return new Date(now.setFullYear(now.getFullYear() - 1));
      case TimeFilter.DATE_SPECIFIC:
        return specificDate ? new Date(specificDate) : new Date();
      default:
        return new Date(now.setDate(now.getDate() - 7));
    }
  }

  private async addUsersSheet(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet('Users');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Role', key: 'role', width: 15 },
      { header: 'Designation', key: 'designation', width: 20 },
      { header: 'Shift', key: 'shift', width: 15 },
      { header: 'Status', key: 'active', width: 10 },
    ];

    const users = await this.prisma.user.findMany();
    users.forEach(user => {
      sheet.addRow({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation || 'N/A',
        shift: user.shift || 'N/A',
        active: user.active ? 'Active' : 'Inactive',
      });
    });
  }

  private async addAttendanceSheet(workbook: ExcelJS.Workbook, startDate: Date, endDate: Date) {
    const sheet = workbook.addWorksheet('Attendance');

    // Use matrix format: users as rows, dates as columns
    const matrix = await this.attendanceService.getAttendanceMatrixForExport(
      startDate,
      endDate
    );

    // Create header row: User Name, Email, then all dates
    const headerRow = ['User Name', 'Email', ...matrix.dates];
    sheet.addRow(headerRow);

    // Style header row
    const headerRowObj = sheet.getRow(1);
    headerRowObj.font = { bold: true };
    headerRowObj.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data rows
    matrix.users.forEach(user => {
      const row = [
        user.userName,
        user.userEmail,
        ...matrix.dates.map(date => user.attendance[date] || ''),
      ];
      sheet.addRow(row);
    });

    // Auto-fit columns
    sheet.columns.forEach((column, index) => {
      if (index === 0 || index === 1) {
        column.width = 20; // User Name and Email columns
      } else {
        column.width = 12; // Date columns
      }
    });
  }

  private async addApprovedLeavesSheet(workbook: ExcelJS.Workbook, startDate: Date, endDate: Date) {
    const sheet = workbook.addWorksheet('Approved Leaves');
    sheet.columns = [
      { header: 'User Name', key: 'userName', width: 30 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'From', key: 'fromDate', width: 15 },
      { header: 'To', key: 'toDate', width: 15 },
      { header: 'Reason', key: 'reason', width: 30 },
      { header: 'Approved By', key: 'approvedBy', width: 20 }, // Could fetch approver name if needed
    ];

    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        status: { in: ['MANAGER_APPROVED', 'HR_APPROVED'] },
        OR: [
          { fromDate: { gte: startDate, lte: endDate } },
          { toDate: { gte: startDate, lte: endDate } }
        ]
      },
      include: {
        user: true,
      },
      orderBy: {
        fromDate: 'desc',
      },
    });

    leaves.forEach(leave => {
      sheet.addRow({
        userName: leave.user.name,
        type: leave.type,
        fromDate: leave.fromDate.toISOString().split('T')[0],
        toDate: leave.toDate.toISOString().split('T')[0],
        reason: leave.reason,
        approvedBy: leave.approvedBy,
      });
    });
  }


  private async addLeaveSummarySheet(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet('Leave Summary');
    sheet.columns = [
      { header: 'Employee', key: 'name', width: 30 },
      { header: 'Email', key: 'email', width: 30 },

      { header: 'CL Total', key: 'clTotal', width: 15 },
      { header: 'SL Total', key: 'slTotal', width: 15 },
      { header: 'EL Total', key: 'elTotal', width: 15 },
      { header: 'CL Balance', key: 'clBal', width: 15 },
      { header: 'SL Balance', key: 'slBal', width: 15 },
      { header: 'EL Balance', key: 'elBal', width: 15 },
      { header: 'CL Taken', key: 'clTaken', width: 15 },
      { header: 'SL Taken', key: 'slTaken', width: 15 },
      { header: 'EL Taken', key: 'elTaken', width: 15 },
    ];

    const currentYear = new Date().getFullYear();
    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear, 11, 31);

    // 1. Get Balances
    const balances = await this.prisma.leaveBalance.findMany({
      where: { year: currentYear },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    // 2. Get Taken (Attendance) - DATE type
    const taken = await this.prisma.attendance.groupBy({
      by: ['userId', 'status'],
      where: {
        date: { gte: startDate, lte: endDate },
        status: { in: [AttendanceStatus.CL, AttendanceStatus.SL, AttendanceStatus.EL] }
      },
      _count: { status: true }
    });

    // 3. Get Pending (LeaveRequests) - DATE type
    const pending = await this.prisma.leaveRequest.findMany({
      where: {
        status: LeaveStatus.PENDING,
        fromDate: { gte: startDate }
      },
      select: { userId: true, type: true, fromDate: true, toDate: true }
    });

    // Map helpers
    const getTakenCount = (userId: number, status: AttendanceStatus) =>
      taken.find(t => t.userId === userId && t.status === status)?._count.status || 0;

    const getPendingCount = (userId: number, type: LeaveType) =>
      pending.filter(p => p.userId === userId && p.type === type).reduce((acc, curr) => {
        const days = Math.ceil((new Date(curr.toDate).getTime() - new Date(curr.fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return acc + days;
      }, 0);

    balances.forEach(b => {
      sheet.addRow({
        name: b.user.name,
        email: b.user.email,

        clTotal: 12,
        slTotal: 12,
        elTotal: getPendingCount(b.userId, LeaveType.EARNED),
        clBal: b.clBalance,
        slBal: b.slBalance,
        elBal: b.elBalance,
        clTaken: getTakenCount(b.userId, AttendanceStatus.CL),
        slTaken: getTakenCount(b.userId, AttendanceStatus.SL),
        elTaken: getTakenCount(b.userId, AttendanceStatus.EL),
      });
    });
  }
}
