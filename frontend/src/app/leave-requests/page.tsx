'use client';

import { Button } from "@/components/ui/button";
import { leavesApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from "framer-motion";
import { Calendar, CheckCircle2, User, XCircle } from "lucide-react";
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/auth-context';

interface PendingLeave {
  id: number;
  type: string;
  fromDate: string;
  toDate: string;
  reason: string;
  user: {
    name: string;
    email: string;
  };
}

export default function LeaveRequests() {

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ['pending-leaves'],
    queryFn: () => leavesApi.getManagerApprovalLeaves(user.id) as Promise<PendingLeave[]>,
  });

  const approveLeaveMutation = useMutation({
    mutationFn: (id: number) => leavesApi.approveManagerLeave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-leaves'] });
      toast({
        title: 'Success!',
        description: 'Leave approved successfully.',
        variant: 'success',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to approve leave. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const rejectLeaveMutation = useMutation({
    mutationFn: (id: number) => leavesApi.rejectManagerLeave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-leaves'] });
      toast({
        title: 'Success!',
        description: 'Leave rejected successfully.',
        variant: 'success',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to reject leave. Please try again.',
        variant: 'destructive',
      });
    },
  });

 const onApprove = (id: number) => {
  approveLeaveMutation.mutate(id);
};

const onReject = (id: number) => {
  rejectLeaveMutation.mutate(id);
};

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-border bg-white">
          <h3 className="text-lg font-semibold text-foreground">
            Pending Leave Requests
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and manage employee leave requests
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Date Range
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Days
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Reason
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pendingLeaves.length > 0 ? (
                pendingLeaves.map((leave, index) => (
                  <motion.tr
                    key={leave.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="transition-all duration-200 hover:bg-muted/30"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">
                        {leave.user?.name || 'N/A'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {leave.user?.email || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                        {leave.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(leave.fromDate), 'MMM d')} -{' '}
                      {format(new Date(leave.toDate), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {Math.ceil(
                        (new Date(leave.toDate).getTime() -
                          new Date(leave.fromDate).getTime()) /
                        (1000 * 60 * 60 * 24)
                      ) + 1}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs truncate">
                      {leave.reason}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onApprove(leave.id)}
                        className="text-success hover:text-success hover:bg-success/10 transition-smooth"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReject(leave.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-smooth"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-sm text-muted-foreground">
                      No pending leave requests
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
} 