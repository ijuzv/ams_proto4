import React from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TeamToolbarProps {
  onSearch: (term: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
}

export const TeamToolbar = ({
  onSearch,
  statusFilter,
  onStatusFilterChange,
}: TeamToolbarProps) => {
  return (
    <div className="bg-white w-full mx-auto p-4 rounded-lg shadow-sm border flex items-center justify-between gap-4 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
        <Input
          placeholder="Search by name..."
          className="pl-9"
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Filter Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Status</SelectItem>
          <SelectItem value="WFO">WFO</SelectItem>
          <SelectItem value="WFH">WFH</SelectItem>
          <SelectItem value="LEAVE">On Leave</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
