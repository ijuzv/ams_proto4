'use client';

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, getDay } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '@/lib/api';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type AttendanceStatus = 'WFO' | 'WFH' | 'CL' | 'SL' | 'EL' | 'COMP_OFF' | 'AB' | 'OL' | 'ML';

interface AttendanceRecord {
  id: string | number;
  date: string;
  status: AttendanceStatus;
}

interface Holiday {
  id: number;
  date: string;
  name: string;
  description?: string;
  isMandatory: boolean;
}

interface AttendanceResponse {
  attendances?: AttendanceRecord[];
  holidays?: Holiday[];
}

const statusConfig = {
  WFO: { label: 'Work From Office', color: 'bg-amber-100 text-amber-700 border-amber-200', badge: 'bg-amber-500' },
  WFH: { label: 'Work From Home', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', badge: 'bg-emerald-500' },
  CL: { label: 'Casual Leave', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', badge: 'bg-cyan-500' },
  SL: { label: 'Sick Leave', color: 'bg-rose-100 text-rose-700 border-rose-200', badge: 'bg-rose-500' },
  EL: { label: 'Earned Leave', color: 'bg-orange-100 text-orange-700 border-orange-200', badge: 'bg-orange-500' },
  COMP_OFF: { label: 'Compensatory Off', color: 'bg-purple-100 text-purple-700 border-purple-200', badge: 'bg-purple-500' },
  AB: { label: 'Absent', color: 'bg-red-200 text-red-800 border-red-300', badge: 'bg-red-600' },
  OL: { label: 'Optional Leave', color: 'bg-sky-100 border-sky-300 text-sky-700', badge: 'bg-sky-500' },
  ML: { label: 'Mandatory Leave', color: 'bg-slate-100 border-slate-300 text-slate-700', badge: 'bg-indigo-500' },
};

export default function AttendancePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('WFO');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Add empty cells for days before month start
  const firstDayOfWeek = getDay(monthStart);
  const emptyDays = Array(firstDayOfWeek).fill(null);

  const { data: attendanceResponse, isLoading } = useQuery({
    queryKey: ['attendance', currentDate.getFullYear(), currentDate.getMonth() + 1],
    queryFn: () =>
      attendanceApi.getMyAttendance(
        currentDate.getMonth() + 1,
        currentDate.getFullYear()
      ) as Promise<AttendanceResponse | AttendanceRecord[]>,
  });

  // Handle both old format (array) and new format (object with attendances and holidays)
  const attendance = Array.isArray(attendanceResponse)
    ? attendanceResponse
    : (attendanceResponse?.attendances || []);
  const holidays = Array.isArray(attendanceResponse)
    ? []
    : (attendanceResponse?.holidays || []);

  const markAttendanceMutation = useMutation({
    mutationFn: (status: AttendanceStatus) => attendanceApi.mark({ status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({
        title: 'Success!',
        description: 'Attendance marked successfully.',
        variant: 'success',
      });
    },
    onError: (error: any) => {
      let errorMessage = 'Failed to mark attendance. Please try again.';

      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const markAttendance = async () => {
    markAttendanceMutation.mutate(selectedStatus);
  };

  const getStatusForDay = (day: Date): AttendanceRecord | undefined => {
    if (!attendance) return undefined;
    const dateStr = format(day, 'yyyy-MM-dd');
    return attendance.find((a: AttendanceRecord) => format(new Date(a.date), 'yyyy-MM-dd') === dateStr);
  };

  const getHolidayForDay = (day: Date): Holiday | undefined => {
    if (!holidays || holidays.length === 0) return undefined;
    const dateStr = format(day, 'yyyy-MM-dd');
    return holidays.find((h: Holiday) => {
      const holidayDateStr = format(new Date(h.date), 'yyyy-MM-dd');
      return holidayDateStr === dateStr;
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
    setCurrentDate(newDate);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading attendance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground">Attendance</h1>
          <p className="mt-1 text-muted-foreground">Track and manage your attendance</p>
        </div>
      </motion.div>

      {/* Mark Attendance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border bg-white p-6 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Mark Today's Attendance</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as AttendanceStatus)}>
            <SelectTrigger className="w-full sm:w-[300px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusConfig)
                .filter(([key]) => key === 'WFO' || key === 'WFH')
                .map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            onClick={markAttendance}
            disabled={markAttendanceMutation.isPending}
            className="transition-smooth"
          >
            {markAttendanceMutation.isPending ? 'Marking...' : 'Mark Attendance'}
          </Button>
        </div>
      </motion.div>

      {/* Calendar View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border bg-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateMonth('prev')}
                className="transition-smooth"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentDate(new Date())}
                className="transition-smooth"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateMonth('next')}
                className="transition-smooth"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="p-6">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="text-center font-semibold text-sm text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-2">
            {emptyDays.map((_, index) => (
              <div key={`empty-${index}`} className="h-20" />
            ))}
            {daysInMonth.map((day) => {
              const attendanceData = getStatusForDay(day);
              const holiday = getHolidayForDay(day);
              const isCurrentDay = isToday(day);
              const status = attendanceData?.status as AttendanceStatus;
              const config = status ? statusConfig[status] : null;
              const isMandatoryHoliday = holiday?.isMandatory === true;
              const isOptionalHoliday = holiday && !isMandatoryHoliday;

              return (
                <motion.div
                  key={day.toString()}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={!isMandatoryHoliday ? { scale: 1.05 } : {}}
                  className={`relative h-20 p-2 border rounded-lg transition-all duration-200 ${isMandatoryHoliday
                      ? 'bg-slate-200 border-slate-300 cursor-default'
                      : isOptionalHoliday
                        ? 'bg-sky-100 border-sky-200 hover:bg-sky-200'
                        : isCurrentDay
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border bg-white hover:bg-muted/50'
                    } ${config && !isMandatoryHoliday ? config.color : ''}`}
                  title={holiday ? holiday.name : undefined}
                >
                  <div className="flex flex-col h-full">
                    <span
                      className={`text-sm font-medium ${isMandatoryHoliday
                          ? 'text-slate-700'
                          : isOptionalHoliday
                            ? 'text-sky-700'
                            : isCurrentDay
                              ? 'text-primary'
                              : 'text-foreground'
                        }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {isMandatoryHoliday ? (
                      <div className="mt-auto">
                        <div className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-slate-200 text-slate-700 border-slate-300">
                          <span className="hidden sm:inline">{holiday.name}</span>
                        </div>
                      </div>
                    ) : isOptionalHoliday ? (
                      <div className="mt-auto flex flex-col gap-1">
                        <div className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-sky-100 text-sky-700 border-sky-300">
                          <span className="hidden sm:inline">{holiday.name}</span>
                        </div>
                        {attendanceData && config && (
                          <div
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${config.color}`}
                          >
                            <span className="hidden sm:inline">{status}</span>
                          </div>
                        )}
                      </div>
                    ) : attendanceData && config ? (
                      <div className="mt-auto">
                        <div
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${config.color}`}
                        >
                          <span className="hidden sm:inline">{status}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Status Legend */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl border border-border bg-white p-6 shadow-sm"
      >
        <h3 className="text-sm font-semibold text-foreground mb-4">Status Legend</h3>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {Object.entries(statusConfig).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded border ${config.color}`}></div>
              <span className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{key}</span> - {config.label}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
