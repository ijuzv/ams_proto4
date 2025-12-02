'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { leavesApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from "framer-motion";
import { Calendar, CheckCircle2, XCircle, Search, ChevronLeft, ChevronRight, X } from "lucide-react";
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { usePagination } from '@/hooks/usePagination';
import { useSearch } from '@/hooks/useSearch';
import { useEffect, useState } from 'react';
import { truncateText } from '@/lib/utils';

interface PendingLeave {
  id: number;
  type: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  user: {
    name: string;
    email: string;
  };
}

export default function LeaveRequestsPage() {

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, isAdmin, isCEO } = useAuth();
  const { page, limit, onPageChange } = usePagination(1, 10);
  const { searchTerm, setSearchTerm, debouncedSearchTerm } = useSearch();
  const [searchTxt, setSearchTxt] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [processingLeaveId, setProcessingLeaveId] = useState<number | null>(null);
  const [processingAction, setProcessingAction] = useState<'approve' | 'reject' | null>(null);

  // For managers - get pending leaves with pagination
  const { data: managerLeavesData, isLoading: isManagerLoading } = useQuery({
    queryKey: ['manager-pending-leaves', page, limit, searchTxt, dateFilter],
    queryFn: () => leavesApi.getManagerApprovalLeaves({
      managerId: user?.id,
      page,
      limit,
      search: searchTxt,
      status: 'PENDING',
      date: dateFilter || undefined,
    }) as Promise<{ data: PendingLeave[], meta: { total: number, page: number, limit: number, totalPages: number } }>,
    enabled: user?.role === 'MANAGER',
  });

  // For admins - get manager approved leaves with pagination  
  const { data: adminLeavesData, isLoading: isAdminLoading } = useQuery({
    queryKey: ['admin-pending-leaves', page, limit, searchTxt, dateFilter],
    queryFn: () => leavesApi.getAll({
      page,
      limit,
      search: searchTxt,
      status: 'MANAGER_APPROVED',
      date: dateFilter || undefined,
    }) as Promise<{ data: PendingLeave[], meta: { total: number, page: number, limit: number, totalPages: number } }>,
    enabled: isAdmin && !isCEO,
  });

  // For CEO - get admin leave requests with pagination
  const { data: ceoLeavesData, isLoading: isCeoLoading } = useQuery({
    queryKey: ['ceo-admin-leaves', page, limit, dateFilter],
    queryFn: () => leavesApi.getAdminLeaveRequests({
      page,
      limit,
      status: undefined, // Backend defaults to PENDING and MANAGER_APPROVED for admin leaves
      date: dateFilter || undefined,
    }) as Promise<{ data: PendingLeave[], meta: { total: number, page: number, limit: number, totalPages: number } }>,
    enabled: isCEO,
  });

  const pendingLeaves = isCEO 
    ? (ceoLeavesData?.data || []) 
    : isAdmin 
      ? (adminLeavesData?.data || []) 
      : (managerLeavesData?.data || []);
  const meta = isCEO
    ? (ceoLeavesData?.meta || { total: 0, totalPages: 0 })
    : isAdmin
      ? (adminLeavesData?.meta || { total: 0, totalPages: 0 })
      : (managerLeavesData?.meta || { total: 0, totalPages: 0 });
  const isLoading = isCEO ? isCeoLoading : isAdmin ? isAdminLoading : isManagerLoading;

  const approveLeaveMutation = useMutation({
    mutationFn: (id: number) => {
      if (isCEO) {
        return leavesApi.approveAdminLeave(id);
      } else if (isAdmin) {
        return leavesApi.approveLeave(id);
      } else {
        return leavesApi.approveManagerLeave(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-pending-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['ceo-admin-leaves'] });
      toast({
        title: 'Success!',
        description: 'Leave approved successfully.',
        variant: 'success',
      });
      setProcessingLeaveId(null);
      setProcessingAction(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to approve leave. Please try again.',
        variant: 'destructive',
      });
      setProcessingLeaveId(null);
      setProcessingAction(null);
    },
  });

  const rejectLeaveMutation = useMutation({
    mutationFn: (id: number) => {
      if (isCEO) {
        return leavesApi.rejectAdminLeave(id);
      } else if (isAdmin) {
        return leavesApi.rejectLeave(id);
      } else {
        return leavesApi.rejectManagerLeave(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-pending-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['ceo-admin-leaves'] });
      toast({
        title: 'Success!',
        description: 'Leave rejected successfully.',
        variant: 'success',
      });
      setProcessingLeaveId(null);
      setProcessingAction(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to reject leave. Please try again.',
        variant: 'destructive',
      });
      setProcessingLeaveId(null);
      setProcessingAction(null);
    },
  });

  const onApprove = (id: number) => {
    setProcessingLeaveId(id);
    setProcessingAction('approve');
    approveLeaveMutation.mutate(id);
  };

  const onReject = (id: number) => {
    setProcessingLeaveId(id);
    setProcessingAction('reject');
    rejectLeaveMutation.mutate(id);
  };

  const handleSearch = () => {
    setSearchTxt(searchTerm);
  };

  // If user is not manager or admin, show message or redirect (though layout handles tabs)
  if (!isAdmin && user?.role !== 'MANAGER' && user?.role !== 'CEO') {
    return <div className="p-6">You do not have permission to view this page.</div>;
  }

  return (
    <div className="space-y-6 pt-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isCEO 
              ? 'Admin Leave Requests' 
              : isAdmin 
                ? 'Manager Approved Leave Requests' 
                : 'Pending Leave Requests'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isCEO 
              ? 'Review and manage admin employee leave requests' 
              : 'Review and manage employee leave requests'}
          </p>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-border bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Leave Requests</h2>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employee..."
                  value={searchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchTerm(value);

                    if (value === '') {
                      setSearchTxt('');
                      queryClient.invalidateQueries({ queryKey: ['manager-pending-leaves'] });
                      queryClient.invalidateQueries({ queryKey: ['admin-pending-leaves'] });
                      queryClient.invalidateQueries({ queryKey: ['ceo-admin-leaves'] });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                  className="pl-8 pr-8 w-[180px]"
                />

                {searchTerm && (
                  <X
                    onClick={() => {
                      setSearchTerm('');
                      setSearchTxt('');
                      queryClient.invalidateQueries({ queryKey: ['manager-pending-leaves'] });
                      queryClient.invalidateQueries({ queryKey: ['admin-pending-leaves'] });
                      queryClient.invalidateQueries({ queryKey: ['ceo-admin-leaves'] });
                    }}
                    className="absolute right-2 top-2.5 cursor-pointer w-4 h-4 text-muted-foreground"
                  />
                )}
              </div>
              {searchTerm.length > 3 && (
                <Button variant="default" onClick={handleSearch}>
                  Search
                </Button>
              )}
            </div>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-[150px]"
            />
          </div>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-full">
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
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-4">Loading...</td></tr>
              ) : pendingLeaves.length > 0 ? (
                pendingLeaves.map((leave, index) => (
                  <motion.tr
                    key={leave.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="transition-all duration-200 hover:bg-muted/30"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground" title={leave.user?.name || undefined}>
                        {truncateText(leave.user?.name, 20) || 'N/A'}
                      </div>
                      <div className="text-sm text-muted-foreground" title={leave.user?.email || undefined}>
                        {truncateText(leave.user?.email, 20) || 'N/A'}
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
                    <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs truncate" title={leave.reason}>
                      {truncateText(leave.reason, 20)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={processingLeaveId === leave.id}
                        onClick={() => onApprove(leave.id)}
                        className={`transition-smooth ${
                          processingLeaveId === leave.id && processingAction === 'approve'
                            ? 'bg-success/20 text-success cursor-not-allowed'
                            : 'text-success hover:text-success hover:bg-success/10'
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        {processingLeaveId === leave.id && processingAction === 'approve' ? 'Approving...' : 'Approve'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={processingLeaveId === leave.id}
                        onClick={() => onReject(leave.id)}
                        className={`transition-smooth ${
                          processingLeaveId === leave.id && processingAction === 'reject'
                            ? 'bg-destructive/20 text-destructive cursor-not-allowed'
                            : 'text-destructive hover:text-destructive hover:bg-destructive/10'
                        }`}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        {processingLeaveId === leave.id && processingAction === 'reject' ? 'Rejecting...' : 'Reject'}
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

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            <span className="hidden sm:inline">Showing {pendingLeaves.length} of {meta.total} results </span>
            {meta.totalPages > 0 && (
              <>
                <span className="hidden sm:inline">(</span>
                Page {page} of {meta.totalPages}
                <span className="hidden sm:inline">)</span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= meta.totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
