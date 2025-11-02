'use client';

import { useAuth } from '@/contexts/auth-context';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '@/lib/api';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Users, 
  Clock, 
  TrendingUp,
  Activity,
  Briefcase,
  Home
} from 'lucide-react';

interface ActivityItem {
  id: string | number;
  type: string;
  details: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  date: string;
}

interface AttendanceSummary {
  present?: number;
  wfo?: number;
  wfh?: number;
  cl?: number;
  sl?: number;
  recentActivity?: ActivityItem[];
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.3,
    },
  }),
};

export default function DashboardPage() {
  const { user } = useAuth();
  
  const { data: summary, isLoading } = useQuery({
    queryKey: ['attendance-summary'],
    queryFn: () => attendanceApi.getSummary() as Promise<AttendanceSummary>,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = [
    {
      name: 'Total Present',
      value: summary?.present || 0,
      icon: Calendar,
      color: 'bg-primary/10 text-primary',
      bgColor: 'bg-primary/5',
    },
    {
      name: 'Work From Office',
      value: summary?.wfo || 0,
      icon: Briefcase,
      color: 'bg-amber-100 text-amber-700',
      bgColor: 'bg-amber-50',
    },
    {
      name: 'Work From Home',
      value: summary?.wfh || 0,
      icon: Home,
      color: 'bg-emerald-100 text-emerald-700',
      bgColor: 'bg-emerald-50',
    },
    {
      name: 'Leave Balance',
      value: `${summary?.cl || 0} CL • ${summary?.sl || 0} SL`,
      icon: Clock,
      color: 'bg-blue-100 text-blue-700',
      bgColor: 'bg-blue-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="pb-6 border-b border-border"
      >
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, {user?.name?.split(' ')[0]}! 👋
        </h1>
        <p className="mt-2 text-muted-foreground">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.name}
              custom={index}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              whileHover={{ scale: 1.02 }}
              className={`relative overflow-hidden rounded-2xl border border-border bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md ${stat.bgColor}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.name}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
                <div className={`rounded-xl p-3 ${stat.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        custom={4}
        className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-border bg-white">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              Recent Activity
            </h3>
          </div>
        </div>
        <div className="divide-y divide-border">
          {summary?.recentActivity && summary.recentActivity.length > 0 ? (
            summary.recentActivity.map((activity: ActivityItem, index: number) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="px-6 py-4 transition-all duration-200 hover:bg-muted/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {activity.type}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {activity.details}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        activity.status === 'APPROVED'
                          ? 'bg-success/10 text-success'
                          : activity.status === 'PENDING'
                          ? 'bg-warning/10 text-warning'
                          : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      {activity.status}
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {activity.date}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="px-6 py-12 text-center">
              <Activity className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                No recent activity
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
