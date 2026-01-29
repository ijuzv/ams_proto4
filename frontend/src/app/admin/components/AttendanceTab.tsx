import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { attendanceApi } from "@/lib/api";
import { usePagination } from "@/hooks/usePagination";
import { useSearch } from "@/hooks/useSearch";
import { useExport } from "@/hooks/useExport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import { Download, Search, ChevronLeft, ChevronRight, X, Clock } from "lucide-react";
import { format } from "date-fns";
import { truncateText } from "@/lib/utils";

// Status color mapping function
function getAttendanceStatusColor(status: string): string {
  switch (status) {
    case "WFO":
      return "bg-green-100 text-green-800";
    case "WFH":
      return "bg-blue-100 text-blue-800";
    case "CL":
      return "bg-purple-100 text-purple-800";
    case "SL":
      return "bg-orange-100 text-orange-800";
    case "EL":
      return "bg-teal-100 text-teal-800";
    case "COMP_OFF":
      return "bg-pink-100 text-pink-800";
    case "AB":
      return "bg-red-100 text-red-800";
    case "OL":
      return "bg-blue-100 text-blue-800";
    case "ML":
      return "bg-indigo-100 text-indigo-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function AttendanceTab() {
  const queryClient = useQueryClient();
  const { page, limit, onPageChange } = usePagination(1, 10);
  const { searchTerm, setSearchTerm, debouncedSearchTerm } = useSearch();
  const [searchTxt, setSearchTxt] = useState<string>("");
  const { exportData, isExporting } = useExport();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );

  const { data: attendanceData, isLoading } = useQuery({
    queryKey: [
      "admin-attendance",
      page,
      limit,
      searchTxt,
      statusFilter,
      dateFilter,
    ],
    queryFn: () =>
      attendanceApi.getAll({
        page,
        limit,
        search: searchTxt,
        status: statusFilter !== "all" ? statusFilter : undefined,
        date: dateFilter || undefined,
      }),
  });

  const attendance = attendanceData?.data || [];
  const meta = attendanceData?.meta || { total: 0, totalPages: 0 };

  const handleExport = () => {
    exportData(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/attendance/export`,
      {
        search: searchTxt,
        status: statusFilter !== "all" ? statusFilter : undefined,
        date: dateFilter || undefined,
      },
      "attendance_export.xlsx"
    );
  };

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
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">Attendance</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor employee attendance records
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

                  if (value === "") {
                    setSearchTxt("");
                    queryClient.invalidateQueries({
                      queryKey: ["admin-attendance"],
                    });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                className="pl-8 pr-8 w-full sm:w-[180px] min-w-[150px]"
              />
              {searchTerm && (
                <X
                  onClick={() => {
                    setSearchTerm("");
                    setSearchTxt("");
                    queryClient.invalidateQueries({
                      queryKey: ["admin-users"],
                    });
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
                <SelectItem value="WFO">WFO</SelectItem>
                <SelectItem value="WFH">WFH</SelectItem>
                <SelectItem value="LEAVE">Leave</SelectItem>
                <SelectItem value="ABSENT">Absent</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={handleExport}
              disabled={isExporting}
              className="flex-shrink-0"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                Employee
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                Check In
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-4">
                  Loading...
                </td>
              </tr>
            ) : attendance.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    No records found
                  </p>
                </td>
              </tr>
            ) : (
              attendance.map((record: any) => (
                <tr key={record.id} className="hover:bg-muted/30">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {format(new Date(record.date), "MMM dd, yyyy")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium" title={record.user.name}>
                    {truncateText(record.user.name, 20)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground" title={record.user.email}>
                    {truncateText(record.user.email, 20)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getAttendanceStatusColor(record.status)}`}
                    >
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {record.checkInTime
                      ? format(new Date(record.checkInTime), "HH:mm:ss")
                      : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-border flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="hidden sm:inline">Showing {attendance.length} of {meta.total || 0} results </span>
          {meta.totalPages > 0 && (
            <>
              <span className="hidden sm:inline">(</span>
              Page {page} of {meta.totalPages}
              <span className="hidden sm:inline">)</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="ml-1">Previous</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= meta.totalPages || isLoading}
          >
            <span className="mr-1">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
