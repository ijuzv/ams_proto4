'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leavesApi } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Plus, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { Leave, LeaveStatus, LeaveType } from '@/types/leaves';
import { usePagination } from '@/hooks/usePagination';
import { truncateText } from '@/lib/utils';

interface LeaveFormData {
  type: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
}

const statusColors = {
  PENDING: 'bg-warning/10 text-warning border-warning/20',
  MANAGER_APPROVED: 'bg-info/10 text-info border-info/20',
  HR_APPROVED: 'bg-success/10 text-success border-success/20',
  MANAGER_REJECTED: 'bg-destructive/10 text-destructive border-destructive/20',
  HR_REJECTED: 'bg-destructive/20 text-destructive/80 border-destructive/30',
  CANCELLED: 'bg-muted/10 text-muted-foreground border-muted/20',
  CANCELLATION_REQUESTED: 'bg-warning/10 text-warning border-warning/20',
};

const leaveTypeLabels = {
  SICK: 'Sick Leave',
  CASUAL: 'Casual Leave',
  EARNED: 'Earned Leave',
  COMP_OFF: 'Compensatory Off',
  LOP: 'Loss of Pay',
  OPTIONAL: 'Optional Leave',
};

export default function MyLeavesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth()
  const [showDialog, setShowDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [showCancelRequestDialog, setShowCancelRequestDialog] = useState(false);
  const [selectedLeaveId, setSelectedLeaveId] = useState<number | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [revokingLeaveId, setRevokingLeaveId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    type: 'CASUAL' as LeaveType,
    fromDate: format(new Date(), 'yyyy-MM-dd'),
    toDate: format(new Date(), 'yyyy-MM-dd'),
    reason: '',
  });
  const { toast } = useToast();
  const { page, limit, onPageChange } = usePagination(1, 10);

  // Fetch leaves
  const { data: leavesData, isLoading } = useQuery({
    queryKey: ['my-leaves', page, limit, statusFilter, dateFilter],
    queryFn: () =>
      (leavesApi as any).getMyLeaves({
        page,
        limit,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        date: dateFilter || undefined,
      }),
  });


  const leaves = leavesData?.data || [];
  const meta = leavesData?.meta || { total: 0, totalPages: 0 };

  // Apply for leave
  const applyLeaveMutation = useMutation({
    mutationFn: (data: LeaveFormData) => leavesApi.apply(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
      setShowDialog(false);
      setFormData({
        type: 'CASUAL',
        fromDate: format(new Date(), 'yyyy-MM-dd'),
        toDate: format(new Date(), 'yyyy-MM-dd'),
        reason: '',
      });
      toast({
        title: 'Success!',
        description: 'Leave application submitted successfully.',
        variant: 'success',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to submit leave application. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // send date-only strings (yyyy-MM-dd) to match backend expectations
    applyLeaveMutation.mutate({
      type: formData.type,
      fromDate: formData.fromDate,
      toDate: formData.toDate,
      reason: formData.reason,
    });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Fetch leave balance
  const { data: balance } = useQuery({
    queryKey: ['leave-balance'],
    queryFn: () => leavesApi.getBalance(),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading leaves...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Leaves</h1>
          <p className="mt-1 text-muted-foreground">Manage your leave applications</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="transition-smooth">
          <Plus className="mr-2 h-4 w-4" />
          Apply for Leave
        </Button>
      </motion.div>

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 rounded-xl border border-blue-100 bg-blue-50/50"
        >
          <h3 className="text-sm font-medium text-blue-600">Casual Leave (CL)</h3>
          <p className="text-2xl font-bold text-blue-700 mt-2">{(balance as any)?.clBalance || 0}</p>
          <p className="text-xs text-blue-500 mt-1">Available Balance</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 rounded-xl border border-purple-100 bg-purple-50/50"
        >
          <h3 className="text-sm font-medium text-purple-600">Sick Leave (SL)</h3>
          <p className="text-2xl font-bold text-purple-700 mt-2">{(balance as any)?.slBalance || 0}</p>
          <p className="text-xs text-purple-500 mt-1">Available Balance</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-6 rounded-xl border border-amber-100 bg-amber-50/50"
        >
          <h3 className="text-sm font-medium text-amber-600">Earned Leave (EL)</h3>
          <p className="text-2xl font-bold text-amber-700 mt-2">{(balance as any)?.elBalance || 0}</p>
          <p className="text-xs text-amber-500 mt-1">Available Balance</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-6 rounded-xl border border-teal-100 bg-teal-50/50"
        >
          <h3 className="text-sm font-medium text-teal-600">Optional Leave (OL)</h3>
          <p className="text-2xl font-bold text-teal-700 mt-2">{(balance as any)?.olBalance || 0} / 5</p>
          <p className="text-xs text-teal-500 mt-1">Available Balance</p>
        </motion.div>
      </div>

      {/* Leave Application Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
            <DialogDescription>
              Fill in the details to submit your leave application.
              {formData.type === 'OPTIONAL' && (
                <span className="block mt-1 text-xs text-muted-foreground">
                  Optional leave can only be used on optional holiday dates.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Leave Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, type: value as LeaveType }))
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(leaveTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="fromDate">From Date</Label>
                  <Input
                    id="fromDate"
                    name="fromDate"
                    type="date"
                    value={formData.fromDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="toDate">To Date</Label>
                  <Input
                    id="toDate"
                    name="toDate"
                    type="date"
                    value={formData.toDate}
                    onChange={handleInputChange}
                    min={formData.fromDate}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  placeholder="Enter reason for leave..."
                  rows={4}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={applyLeaveMutation.isPending}
                className="transition-smooth"
              >
                {applyLeaveMutation.isPending ? 'Submitting...' : 'Submit Application'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Leaves List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-border bg-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Leave History</h2>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-[150px]"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="HR_APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Days
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence>
                {leaves && leaves.length > 0 ? (
                  leaves.map((leave: Leave, index: number) => (
                    <motion.tr
                      key={leave.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className="transition-all duration-200 hover:bg-muted/30"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${statusColors[leave.status as keyof typeof statusColors] || 'bg-muted/10 text-muted-foreground border-muted/20'}`}>
                          {leave.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {format(new Date(leave.fromDate), 'MMM d, yyyy')} -{' '}
                        {format(new Date(leave.toDate), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {Math.ceil(
                          (new Date(leave.toDate).getTime() -
                            new Date(leave.fromDate).getTime()) /
                          (1000 * 60 * 60 * 24)
                        ) + 1}{' '}
                        day(s)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {leaveTypeLabels[leave.type]}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs truncate" title={leave.reason}>
                        {truncateText(leave.reason, 20)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {(leave.status === 'PENDING' || leave.status === 'MANAGER_APPROVED') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={revokingLeaveId === leave.id}
                            onClick={() => {
                              setSelectedLeaveId(leave.id);
                              setShowRevokeDialog(true);
                            }}
                            className={`transition-smooth ${
                              revokingLeaveId === leave.id
                                ? 'bg-destructive/20 text-destructive cursor-not-allowed'
                                : 'text-destructive hover:text-destructive hover:bg-destructive/10'
                            }`}
                          >
                            {revokingLeaveId === leave.id ? 'Revoking...' : 'Revoke'}
                          </Button>
                        )}
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-4 text-sm text-muted-foreground">
                        No leave requests found
                      </p>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            <span className="hidden sm:inline">Showing {leaves.length} of {meta.total} results </span>
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

      {/* Revoke Confirmation Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Revoke Leave Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this leave request? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedLeaveId && (() => {
            const selectedLeave = leaves.find((l: Leave) => l.id === selectedLeaveId);
            if (!selectedLeave) return null;
            return (
              <div className="py-4">
                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Leave Type:</span>
                      <span className="text-sm font-semibold text-foreground">{leaveTypeLabels[selectedLeave.type]}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Period:</span>
                      <span className="text-sm font-semibold text-foreground">
                        {format(new Date(selectedLeave.fromDate), 'MMM d, yyyy')} - {format(new Date(selectedLeave.toDate), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Days:</span>
                      <span className="text-sm font-semibold text-foreground">
                        {Math.ceil(
                          (new Date(selectedLeave.toDate).getTime() -
                            new Date(selectedLeave.fromDate).getTime()) /
                          (1000 * 60 * 60 * 24)
                        ) + 1} day(s)
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Status:</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium border ${statusColors[selectedLeave.status as keyof typeof statusColors] || 'bg-muted/10 text-muted-foreground border-muted/20'}`}>
                        {selectedLeave.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRevokeDialog(false);
                setSelectedLeaveId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={revokingLeaveId === selectedLeaveId}
              onClick={() => {
                if (selectedLeaveId) {
                  setRevokingLeaveId(selectedLeaveId);
                  leavesApi.revokeLeave(selectedLeaveId).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
                    toast({
                      title: 'Success',
                      description: 'Leave request revoked successfully',
                      variant: 'success',
                    });
                    setShowRevokeDialog(false);
                    setSelectedLeaveId(null);
                    setRevokingLeaveId(null);
                  }).catch((error) => {
                    toast({
                      title: 'Error',
                      description: error.response?.data?.message || 'Failed to revoke leave request',
                      variant: 'destructive',
                    });
                    setRevokingLeaveId(null);
                  });
                }
              }}
            >
              {revokingLeaveId === selectedLeaveId ? 'Revoking...' : 'Yes, Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancellation Request Dialog */}
      <Dialog open={showCancelRequestDialog} onOpenChange={setShowCancelRequestDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Request Leave Cancellation</DialogTitle>
            <DialogDescription>
              Request cancellation of your approved leave. This will be sent to HR for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cancellationReason">Reason for Cancellation</Label>
              <Textarea
                id="cancellationReason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Enter reason for cancellation request..."
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelRequestDialog(false);
                setSelectedLeaveId(null);
                setCancellationReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedLeaveId && cancellationReason.trim()) {
                  leavesApi.requestCancellation(selectedLeaveId, cancellationReason).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
                    toast({
                      title: 'Success',
                      description: 'Cancellation request submitted successfully. Waiting for HR approval.',
                      variant: 'success',
                    });
                    setShowCancelRequestDialog(false);
                    setSelectedLeaveId(null);
                    setCancellationReason('');
                  }).catch((error) => {
                    toast({
                      title: 'Error',
                      description: error.response?.data?.message || 'Failed to submit cancellation request',
                      variant: 'destructive',
                    });
                  });
                }
              }}
              disabled={!cancellationReason.trim()}
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
