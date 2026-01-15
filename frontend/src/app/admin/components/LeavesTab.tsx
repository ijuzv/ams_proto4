import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { leavesApi } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { useSearch } from '@/hooks/useSearch';
import { useExport } from '@/hooks/useExport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { Download, Search, ChevronLeft, ChevronRight, X, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { truncateText } from '@/lib/utils';

export function LeavesTab() {
  const queryClient = useQueryClient();
  const { page, limit, onPageChange } = usePagination(1, 10);
  const { searchTerm, setSearchTerm, debouncedSearchTerm } = useSearch();
  const { exportData, isExporting } = useExport();
  const [statusFilter, setStatusFilter] = useState<string>('PENDING'); // Default to pending leave requests
  const [dateFilter, setDateFilter] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [searchTxt, setSearchTxt] = useState<string>('');

  const { data: leavesData, isLoading } = useQuery({
    queryKey: ['admin-leaves', page, limit, searchTxt, statusFilter, dateFilter],
    queryFn: () => (leavesApi as any).getAll({ // Assuming getAll is added to leavesApi
      page,
      limit,
      search: searchTxt,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      date: dateFilter || undefined
    }),
  });

  const leaves = leavesData?.data || [];
  const meta = leavesData?.meta || { total: 0, totalPages: 0 };

  const handleExport = () => {
    exportData('http://localhost:3001/leaves/export', {
      search: searchTxt,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      date: dateFilter || undefined
    }, 'leaves_export.xlsx');
  }

  const handleSearch = () => {
    setSearchTxt(searchTerm);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden relative"
    >
      <div className="px-6 py-5 border-b border-border bg-white flex flex-wrap justify-between items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Leave requests</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage leave requests
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
          <div className="relative flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employee..."
                value={searchTerm}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTerm(value);

                  if (value === '') {
                    setSearchTxt('');
                    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                className="pl-8 pr-8 w-full sm:w-[180px] min-w-[150px]"
              />
              {searchTerm && (
                <X
                  onClick={() => {
                    setSearchTerm('');
                    setSearchTxt('');
                    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                  }}
                  className="absolute right-2 top-2.5 cursor-pointer w-4 h-4 text-muted-foreground"
                />
              )}
            </div>
            {searchTerm.length > 3 && (
              <Button variant="default" onClick={handleSearch} className="whitespace-nowrap">
                Search
              </Button>
            )}
          </div>
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full sm:w-[150px] min-w-[140px]"
          />
          <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[130px] min-w-[120px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="HR_APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={handleExport} disabled={isExporting} className="flex-shrink-0">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">From</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">To</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Reason</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border overflow-x-auto">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-4">Loading...</td></tr>
            ) : leaves.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    No leave requests found
                  </p>
                </td>
              </tr>
            ) : leaves.map((leave: any) => (
              <tr key={leave.id} className="hover:bg-muted/30">
                <td className="px-6 py-4 whitespace-nowrap font-medium">{leave.user.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                    {leave.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">{format(new Date(leave.fromDate), 'MMM dd, yyyy')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">{format(new Date(leave.toDate), 'MMM dd, yyyy')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-muted-foreground max-w-[200px] truncate" title={leave.reason}>{truncateText(leave.reason, 20)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${leave.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    leave.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                    {leave.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-6 py-4 border-t border-border flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="hidden sm:inline">Showing {leaves.length} of {meta.total || 0} results </span>
          {meta.totalPages > 0 && (
            <>
              <span className="hidden sm:inline">(</span>
              Page {page} of {meta.totalPages}
              <span className="hidden sm:inline">)</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 1 || isLoading}>
            <ChevronLeft className="h-4 w-4" />
            <span className="ml-1">Previous</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= meta.totalPages || isLoading}>
            <span className="mr-1">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
