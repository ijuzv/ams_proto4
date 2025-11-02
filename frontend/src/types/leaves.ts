export type LeaveStatus = 'PENDING' | 'MANAGER_APPROVED' | 'MANAGER_REJECTED' | 'HR_APPROVED' | 'HR_REJECTED' | 'CANCELLED';

export type LeaveType = 'SICK' | 'CASUAL' | 'EARNED' | 'COMP_OFF' | 'LOP';

export interface Leave {
  id: number;
  userId: number;
  type: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  approvedBy?: number | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    name: string;
    email: string;
  };
}
