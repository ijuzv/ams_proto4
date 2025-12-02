import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  let color = 'bg-gray-500';
  let label = status;

  switch (status) {
    case 'WFO':
      color = 'bg-green-500';
      break;
    case 'WFH':
      color = 'bg-blue-500';
      break;
    case 'LEAVE':
      color = 'bg-red-500';
      break;
    case 'PENDING':
      color = 'bg-yellow-500';
      break;
    default:
      color = 'bg-gray-400';
  }

  // Smaller, pill-shaped for the avatar overlap look
  return (
    <div className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white border-2 border-white", color, className)}>
      {label}
    </div>
  );
};
