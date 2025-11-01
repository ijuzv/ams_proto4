'use client';

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '@/lib/api';

type AttendanceStatus = 'WFO' | 'WFH' | 'CL' | 'SL' | 'COMP_OFF' | 'AB';

const statusColors = {
  WFO: 'bg-blue-100 text-blue-800',
  WFH: 'bg-purple-100 text-purple-800',
  CL: 'bg-green-100 text-green-800',
  SL: 'bg-yellow-100 text-yellow-800',
  COMP_OFF: 'bg-indigo-100 text-indigo-800',
  AB: 'bg-red-100 text-red-800',
};

export default function AttendancePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('WFO');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const { data: attendance, isLoading } = useQuery({
    queryKey: ['attendance', currentDate.getFullYear(), currentDate.getMonth() + 1],
    queryFn: () => 
      attendanceApi.getMyAttendance(
        currentDate.getMonth() + 1, 
        currentDate.getFullYear()
      ),
  });

  const markAttendance = async () => {
    try {
      await attendanceApi.mark(selectedStatus);
      // Refetch attendance data
      // queryClient.invalidateQueries(['attendance']);
    } catch (error) {
      console.error('Error marking attendance:', error);
    }
  };

  const getStatusForDay = (day: Date) => {
    if (!attendance) return null;
    const dateStr = format(day, 'yyyy-MM-dd');
    return attendance.find((a: any) => format(new Date(a.date), 'yyyy-MM-dd') === dateStr);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
    setCurrentDate(newDate);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => navigateMonth('prev')}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Today
          </button>
          <button
            onClick={() => navigateMonth('next')}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Mark Attendance */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900">Mark Today's Attendance</h3>
          <div className="mt-4 flex items-center space-x-4">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as AttendanceStatus)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="WFO">Work From Office (WFO)</option>
              <option value="WFH">Work From Home (WFH)</option>
              <option value="CL">Casual Leave (CL)</option>
              <option value="SL">Sick Leave (SL)</option>
              <option value="COMP_OFF">Compensatory Off</option>
            </select>
            <button
              onClick={markAttendance}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Mark Attendance
            </button>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Attendance Calendar
          </h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center font-medium text-gray-500 text-sm py-2">
                {day}
              </div>
            ))}
            
            {daysInMonth.map((day) => {
              const attendance = getStatusForDay(day);
              const isCurrentDay = isToday(day);
              
              return (
                <div 
                  key={day.toString()}
                  className={`p-2 h-24 border border-gray-100 ${isCurrentDay ? 'bg-indigo-50' : ''}`}
                >
                  <div className="flex justify-between">
                    <span className={`text-sm ${isCurrentDay ? 'font-bold text-indigo-700' : 'text-gray-700'}`}>
                      {format(day, 'd')}
                    </span>
                    {attendance && (
                      <span 
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          statusColors[attendance.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {attendance.status}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-2">
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center">
            <span className={`inline-block w-3 h-3 rounded-full ${color.replace('text-', 'bg-').split(' ')[0]}`}></span>
            <span className="ml-1 text-sm text-gray-600">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
