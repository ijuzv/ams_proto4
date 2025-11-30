"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, leavesApi, attendanceApi } from "@/lib/api";
import { motion } from "framer-motion";
import {
  Users,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Activity,
  ToggleLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { promises } from "dns";

type TabType = "overview" | "users" | "leaves" | "attendance" | "totalleaves";

interface User {
  id: number;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
}

interface Attendance {
  id: number;
  date: string;
  status: "WFO" | "WFH" | "CL" | "SL" | "COMP_OFF" | "AB";
  user: {
    id: number;
    name: string;
    email: string;
  };
}

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

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch data based on active tab
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => usersApi.getAll() as Promise<User[]>,
    enabled: activeTab === "users",
  });

  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ["pending-leaves"],
    queryFn: () => leavesApi.getPendingLeaves() as Promise<PendingLeave[]>,
    enabled: activeTab === "leaves",
  });

  const { data: approvedLeaves = [] } = useQuery({
    queryKey: ["approved-leaves"],
    queryFn: () =>
      leavesApi.getApprovedLeaves({ type: "approvedLeaves" }) as Promise<
        PendingLeave[]
      >,
    enabled: activeTab === "totalleaves",
  });

  const tabs = [
    { id: "overview", name: "Overview", icon: Activity },
    { id: "users", name: "Users", icon: Users },
    { id: "leaves", name: "Leave Requests", icon: Calendar },
    { id: "attendance", name: "Attendance", icon: Clock },
    { id: "totalleaves", name: "Leaves", icon: ToggleLeft },
  ];

  const approveLeaveMutation = useMutation({
    mutationFn: (id: number) => leavesApi.approveLeave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-leaves"] });
      toast({
        title: "Success!",
        description: "Leave approved successfully.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve leave. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rejectLeaveMutation = useMutation({
    mutationFn: (id: number) => leavesApi.rejectLeave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-leaves"] });
      toast({
        title: "Success!",
        description: "Leave rejected successfully.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject leave. Please try again.",
        variant: "destructive",
      });
    },
  });

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab />;
      case "users":
        return <UsersTab users={Array.isArray(users) ? users : []} />;
      case "leaves":
        return (
          <LeavesTab
            leaves={Array.isArray(pendingLeaves) ? pendingLeaves : []}
            onApprove={(id) => approveLeaveMutation.mutate(id)}
            onReject={(id) => rejectLeaveMutation.mutate(id)}
          />
        );
      case "attendance":
        return <AttendanceTab />;
      case "totalleaves":
        return (
          <TotalLeavesTab
            leaves={Array.isArray(approvedLeaves) ? approvedLeaves : []}
            onApprove={(id) => approveLeaveMutation.mutate(id)}
            onReject={(id) => rejectLeaveMutation.mutate(id)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pb-6 border-b border-border"
      >
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Manage users, leaves, and attendance
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count =
              tab.id === "leaves" && Array.isArray(pendingLeaves)
                ? pendingLeaves.length
                : null;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`
                  group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium transition-all duration-200
                  ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                  }
                `}
              >
                <Icon className="mr-2 h-5 w-5" />
                {tab.name}
                {count !== null && count > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {renderTabContent()}
      </motion.div>
    </div>
  );
}

// Tab Components
function OverviewTab() {
  const stats = [
    {
      name: "Total Users",
      value: "24",
      icon: Users,
      color: "bg-primary/10 text-primary",
      bgColor: "bg-primary/5",
    },
    {
      name: "Active Today",
      value: "18",
      icon: Activity,
      color: "bg-success/10 text-success",
      bgColor: "bg-success/5",
    },
    {
      name: "Pending Leaves",
      value: "5",
      icon: Calendar,
      color: "bg-warning/10 text-warning",
      bgColor: "bg-warning/5",
    },
    {
      name: "On Leave Today",
      value: "3",
      icon: Clock,
      color: "bg-rose-100 text-rose-700",
      bgColor: "bg-rose-50",
    },
  ];

  // Sample chart data
  const chartData = [
    { name: "Mon", attendance: 22 },
    { name: "Tue", attendance: 23 },
    { name: "Wed", attendance: 24 },
    { name: "Thu", attendance: 21 },
    { name: "Fri", attendance: 20 },
    { name: "Sat", attendance: 15 },
    { name: "Sun", attendance: 10 },
  ];

  return (
    <div className="space-y-6">
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

      {/* Chart */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        custom={4}
        className="rounded-2xl border border-border bg-white p-6 shadow-sm"
      >
        <h3 className="text-lg font-semibold text-foreground mb-6">
          Weekly Attendance Trend
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="name" stroke="#64748B" />
            <YAxis stroke="#64748B" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
              }}
            />
            <Bar dataKey="attendance" fill="#4F46E5" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        custom={5}
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
          {[
            {
              id: 1,
              type: "leave",
              name: "John Doe",
              action: "applied for leave",
              date: "2h ago",
            },
            {
              id: 2,
              type: "attendance",
              name: "Jane Smith",
              action: "marked attendance",
              date: "3h ago",
            },
          ].map((activity, index) => (
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
                      <span className="font-semibold">{activity.name}</span>{" "}
                      {activity.action}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {activity.date}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function UsersTab({ users }: { users: User[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-border bg-white flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Users</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage system users and their permissions
          </p>
        </div>
        <Button className="transition-smooth">Add User</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user, index) => (
              <motion.tr
                key={user.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="transition-all duration-200 hover:bg-muted/30"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-semibold text-sm">
                        {user.name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-foreground">
                        {user.name}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
                      user.role === "ADMIN"
                        ? "bg-purple-100 text-purple-700 border-purple-200"
                        : "bg-success/10 text-success border-success/20"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-success/10 text-success border border-success/20">
                    Active
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="transition-smooth"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive transition-smooth"
                  >
                    Delete
                  </Button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function TotalLeavesTab({
  leaves,
  onApprove,
  onReject,
}: {
  leaves: PendingLeave[];
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-border bg-white">
        <h3 className="text-lg font-semibold text-foreground">
          Approved Leaves
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and manage employee leaves
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
            {leaves.length > 0 ? (
              leaves.map((leave, index) => (
                <motion.tr
                  key={leave.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="transition-all duration-200 hover:bg-muted/30"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-foreground">
                      {leave.user?.name || "N/A"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {leave.user?.email || "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                      {leave.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {format(new Date(leave.fromDate), "MMM d")} -{" "}
                    {format(new Date(leave.toDate), "MMM d, yyyy")}
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
                </motion.tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    No Approved leave requests
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function LeavesTab({
  leaves,
  onApprove,
  onReject,
}: {
  leaves: PendingLeave[];
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  return (
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
            {leaves.length > 0 ? (
              leaves.map((leave, index) => (
                <motion.tr
                  key={leave.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="transition-all duration-200 hover:bg-muted/30"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-foreground">
                      {leave.user?.name || "N/A"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {leave.user?.email || "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                      {leave.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {format(new Date(leave.fromDate), "MMM d")} -{" "}
                    {format(new Date(leave.toDate), "MMM d, yyyy")}
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
  );
}

function AttendanceTab() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ["admin-attendance", selectedDate],
    queryFn: () =>
      attendanceApi.getByDate(selectedDate) as Promise<Attendance[]>,
    enabled: !!selectedDate,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-border bg-white flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Attendance</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage employee attendance
          </p>
        </div>
        <div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Employee
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-6 py-12 text-center text-muted-foreground"
                >
                  Loading...
                </td>
              </tr>
            ) : attendance.length > 0 ? (
              attendance.map((record, index) => (
                <motion.tr
                  key={record.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="transition-all duration-200 hover:bg-muted/30"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-foreground">
                      {record.user?.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {record.user?.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
                        record.status === "WFO"
                          ? "bg-amber-100 text-amber-700 border-amber-200"
                          : record.status === "WFH"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : "bg-gray-100 text-gray-700 border-gray-200"
                      }`}
                    >
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {format(new Date(record.date), "MMM d, yyyy")}
                  </td>
                </motion.tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={3}
                  className="px-6 py-12 text-center text-muted-foreground"
                >
                  No attendance records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
