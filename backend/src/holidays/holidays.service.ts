import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';

@Injectable()
export class HolidaysService {
  constructor(private prisma: PrismaService) { }

  async create(createHolidayDto: CreateHolidayDto) {
    const existing = await this.prisma.holiday.findUnique({
      where: { date: new Date(createHolidayDto.date) },
    });

    if (existing) {
      throw new BadRequestException('Holiday already exists on this date');
    }

    return this.prisma.holiday.create({
      data: {
        date: new Date(createHolidayDto.date),
        name: createHolidayDto.name,
        description: createHolidayDto.description,
        isMandatory: createHolidayDto.isMandatory !== undefined ? createHolidayDto.isMandatory : true,
      },
    });
  }

  findAll() {
    return this.prisma.holiday.findMany({
      orderBy: { date: 'asc' },
    });
  }

  async update(id: number, updateHolidayDto: UpdateHolidayDto) {
    if (updateHolidayDto.date) {
      const existing = await this.prisma.holiday.findUnique({
        where: { date: new Date(updateHolidayDto.date) },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Another holiday exists on this date');
      }
    }

    return this.prisma.holiday.update({
      where: { id },
      data: {
        ...updateHolidayDto,
        date: updateHolidayDto.date ? new Date(updateHolidayDto.date) : undefined,
      },
    });
  }

  remove(id: number) {
    return this.prisma.holiday.delete({
      where: { id },
    });
  }

  async isHoliday(date: Date): Promise<boolean> {
    // DATE type - just use the date directly
    const dateOnly = new Date(date.toISOString().split('T')[0]);
    const holiday = await this.prisma.holiday.findFirst({
      where: {
        date: dateOnly,
      },
    });
    return !!holiday;
  }

  async getHolidaysInRange(startDate: Date, endDate: Date) {
    return this.prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
  }

  async isMandatoryHoliday(date: Date): Promise<boolean> {
    // DATE type - just use the date directly
    const dateOnly = new Date(date.toISOString().split('T')[0]);
    const holiday = await this.prisma.holiday.findFirst({
      where: {
        date: dateOnly,
        isMandatory: true,
      },
    });
    return !!holiday;
  }

  async isWeeklyOff(date: Date): Promise<boolean> {
    const dayOfWeek = date.getUTCDay(); // 0 (Sunday) to 6 (Saturday)
    // Assuming Saturday (6) and Sunday (0) are weekly offs
    return dayOfWeek === 0 || dayOfWeek === 6;
  } 

  async getWeeklyOffsInRange(startDate: Date, endDate: Date) {
    const weeklyOffs = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      if (await this.isWeeklyOff(currentDate)) {
        weeklyOffs.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    } 
    return weeklyOffs;
  }

  async getMandatoryHolidaysInRange(startDate: Date, endDate: Date) {
    return this.prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
        isMandatory: true,
      },
      orderBy: {
        date: 'asc',
      },
    });
  }

  async getOptionalHolidaysInRange(startDate: Date, endDate: Date) {
    return this.prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
        isMandatory: false,
      },
      orderBy: {
        date: 'asc',
      },
    });
  }
}
