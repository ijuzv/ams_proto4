import { Module } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailerModule } from '../mailer/mailer.module';
import { UsersModule } from '../users/users.module';
import { AttendanceModule } from 'src/attendance/attendance.module';
import { HolidaysModule } from '../holidays/holidays.module';

@Module({
  imports: [PrismaModule, MailerModule, UsersModule, AttendanceModule, HolidaysModule],
  providers: [LeavesService],
  controllers: [LeavesController],
  exports: [LeavesService],
})
export class LeavesModule { }
