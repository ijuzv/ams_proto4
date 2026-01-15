import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, attendanceApi } from "@/lib/api";
import { usePagination } from "@/hooks/usePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";
import { Calendar, Edit, UserCheck, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import * as React from "react";
import { truncateText } from "@/lib/utils";

type AttendanceStatus = "WFO" | "WFH" | "CL" | "SL" | "EL" | "COMP_OFF" | "AB" | "OL" | "ML";

const statusLabels: Record<AttendanceStatus, string> = {
  WFO: "Work From Office",
  WFH: "Work From Home",
  CL: "Casual Leave",
  SL: "Sick Leave",
  EL: "Earned Leave",
  COMP_OFF: "Compensatory Off",
  AB: "Absent",
  OL: "Optional Leave",
  ML: "Mandatory Leave",
};

interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

interface AttendanceRecord {
  id: number;
  userId: number;
  date: string;
  status: AttendanceStatus;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

export function ManageAttendanceTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { page, limit, onPageChange } = usePagination(1, 10);
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>("WFO");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchTxt, setSearchTxt] = useState<string>("");

  // Fetch users with pagination
  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["admin-users-for-attendance", page, limit, searchTxt],
    queryFn: () =>
      usersApi.getAll({
        page,
        limit,
        search: searchTxt,
      }) as Promise<{ data: User[]; meta: { total: number; page: number; limit: number; totalPages: number } }>,
  });

  const users = usersData?.data?.filter((u: User) => u.active) || [];
  const meta = usersData?.meta || { total: 0, totalPages: 0 };

  // Fetch attendance for selected date
  const isValidDate = !!(selectedDate && !isNaN(new Date(selectedDate).getTime()));
  const { data: attendanceData, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ["attendance-by-date", selectedDate],
    queryFn: () => attendanceApi.getByDate(selectedDate) as Promise<AttendanceRecord[]>,
    enabled: isValidDate,
  });

  // Create a map of userId -> attendance for quick lookup
  const attendanceMap = new Map<number, AttendanceRecord>();
  attendanceData?.forEach((record) => {
    attendanceMap.set(record.userId, record);
  });

  const handleSearch = () => {
    setSearchTxt(searchTerm);
    // Reset to first page when searching
    onPageChange(1);
  };

  const openMarkDialog = (user: User) => {
    const existingAttendance = attendanceMap.get(user.id);
    setSelectedUser(user);
    setSelectedStatus(existingAttendance?.status || "WFO");
    setIsDialogOpen(true);
  };

  // Get available statuses for dropdown: always WFO and WFH, plus current status if different
  const getAvailableStatuses = (currentStatus: AttendanceStatus): AttendanceStatus[] => {
    const statuses: AttendanceStatus[] = ["WFO", "WFH"];
    if (currentStatus && currentStatus !== "WFO" && currentStatus !== "WFH") {
      statuses.push(currentStatus);
    }
    return statuses;
  };

  const markAttendanceMutation = useMutation({
    mutationFn: (data: { userId: number; date: string; status: AttendanceStatus }) =>
      attendanceApi.adminMarkAttendance(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-by-date"] });
      queryClient.invalidateQueries({ queryKey: ["admin-attendance"] });
      toast({
        title: "Attendance marked successfully",
        variant: "success",
      });
      setIsDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to mark attendance",
        description: error?.response?.data?.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedUser) return;
    
    // Validate date before submitting
    if (!selectedDate || isNaN(new Date(selectedDate).getTime())) {
      toast({
        title: "Invalid date",
        description: "Please select a valid date",
        variant: "destructive",
      });
      return;
    }

    markAttendanceMutation.mutate({
      userId: selectedUser.id,
      date: selectedDate,
      status: selectedStatus,
    });
  };

  const getStatusBadgeClass = (status: AttendanceStatus) => {
    switch (status) {
      case "WFO":
        return "bg-green-100 text-green-800";
      case "WFH":
        return "bg-blue-100 text-blue-800";
      case "CL":
        return "bg-yellow-100 text-yellow-800";
      case "SL":
        return "bg-orange-100 text-orange-800";
      case "EL":
        return "bg-purple-100 text-purple-800";
      case "COMP_OFF":
        return "bg-cyan-100 text-cyan-800";
      case "AB":
        return "bg-red-100 text-red-800";
      case "OL":
        return "bg-blue-100 text-blue-800";
      case "ML":
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden relative"
    >
      <div className="px-6 py-5 border-b border-border bg-white flex flex-wrap justify-between items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Manage Attendance</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mark or update attendance on behalf of users
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
                    onPageChange(1);
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
                    onPageChange(1);
                  }}
                  className="absolute right-2 top-2.5 cursor-pointer w-4 h-4 text-muted-foreground"
                />
              )}
            </div>
            {searchTerm.length > 0 && (
              <Button variant="default" onClick={handleSearch} className="whitespace-nowrap">
                Search
              </Button>
            )}
          </div>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              const newDate = e.target.value;
              // If date is cleared, set to today's date
              if (!newDate) {
                const today = format(new Date(), "yyyy-MM-dd");
                setSelectedDate(today);
                onPageChange(1);
              } else {
                setSelectedDate(newDate);
                // Reset to page 1 when date changes
                if (!isNaN(new Date(newDate).getTime())) {
                  onPageChange(1);
                }
              }
            }}
            className="w-full sm:w-[150px] min-w-[140px]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                Employee
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoadingUsers || isLoadingAttendance ? (
              <tr>
                <td colSpan={4} className="text-center py-4">
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <UserCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    No records found
                  </p>
                </td>
              </tr>
            ) : (
              users.map((user: User) => {
                const attendance = attendanceMap.get(user.id);
                const hasAttendance = !!attendance;

                return (
                  <tr
                    key={user.id}
                    className={`hover:bg-muted/30 ${
                      !hasAttendance ? "bg-yellow-50/50" : ""
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap font-medium" title={user.name}>
                      {truncateText(user.name, 30)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground" title={user.email}>
                      {truncateText(user.email, 30)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {hasAttendance ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(
                            attendance.status
                          )}`}
                        >
                          {attendance.status}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                          Not Marked
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openMarkDialog(user)}
                      >
                        {hasAttendance ? (
                          <>
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-4 w-4 mr-1" />
                            Mark
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-border flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="hidden sm:inline">Showing {users.length} of {meta.total || 0} results </span>
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
            disabled={page === 1 || isLoadingUsers}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="ml-1">Previous</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= meta.totalPages || isLoadingUsers}
          >
            <span className="mr-1">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mark Attendance Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle {...({} as any)}>
              {selectedUser ? `Mark Attendance for ${selectedUser.name}` : "Mark Attendance"}
            </DialogTitle>
            <DialogDescription {...({} as any)}>
              {selectedDate && !isNaN(new Date(selectedDate).getTime())
                ? `Select the attendance status${selectedUser ? ` for ${selectedUser.name}` : ""} on ${format(new Date(selectedDate), "MMM dd, yyyy")}`
                : `Select the attendance status${selectedUser ? ` for ${selectedUser.name}` : ""}`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user">Employee</Label>
              <Input
                id="user"
                value={selectedUser?.name || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={selectedStatus}
                onValueChange={(value) => setSelectedStatus(value as AttendanceStatus)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableStatuses(selectedStatus).map((status) => (
                    <SelectItem key={status} value={status}>
                      {status} - {statusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setSelectedUser(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={markAttendanceMutation.isPending}
            >
              {markAttendanceMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

