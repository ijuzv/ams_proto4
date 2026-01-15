"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { leavesApi, adminDashboardApi } from "@/lib/api";
import { motion } from "framer-motion";
import { AdminStatsCards } from "@/components/AdminStatsCards";
import { TrendChart } from "@/components/TrendChart";
import { ActivityFeed } from "@/components/ActivityFeed";
import { GlobalExportDialog } from "@/components/GlobalExportDialog";
import { UsersTab } from "./components/UsersTab";
import { AttendanceTab } from "./components/AttendanceTab";
import { LeavesTab } from "./components/LeavesTab";
import { ManageAttendanceTab } from "./components/ManageAttendanceTab";
import {
  Users,
  Clock,
  Activity,
  ToggleLeft,
  UserCheck,
} from "lucide-react";

type TabType = "overview" | "users" | "leaves" | "attendance" | "totalleaves" | "manage-attendance";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ["pending-leaves"],
    queryFn: () => leavesApi.getPendingLeaves() as Promise<any[]>,
  });

  const tabs = [
    { id: "overview", name: "Overview", icon: Activity },
    { id: "users", name: "Users", icon: Users },
    { id: "attendance", name: "Attendance", icon: Clock },
    { id: "manage-attendance", name: "Manage Attendance", icon: UserCheck },
    { id: "totalleaves", name: "Leave requests", icon: ToggleLeft },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab />;
      case "users":
        return <UsersTab />;
      case "attendance":
        return <AttendanceTab />;
      case "manage-attendance":
        return <ManageAttendanceTab />;
      case "totalleaves":
        return <LeavesTab />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pb-6 border-b border-border flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Manage users, leaves, and attendance
          </p>
        </div>
        <GlobalExportDialog />
      </motion.div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-2 sm:space-x-8 overflow-x-auto" aria-label="Tabs">
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
                  ${isActive
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
  const [trendPeriod, setTrendPeriod] = useState<'week' | 'month' | 'year'>('week');

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminDashboardApi.getStats() as Promise<any>,
  });

  const { data: trends = [] } = useQuery({
    queryKey: ['admin-trends', trendPeriod],
    queryFn: () => adminDashboardApi.getTrends(trendPeriod) as Promise<any[]>,
  });

  const { data: activity = [] } = useQuery({
    queryKey: ['admin-activity'],
    queryFn: () => adminDashboardApi.getActivity() as Promise<any[]>,
  });

  const handleTrendFilterChange = (period: string) => {
    setTrendPeriod(period as 'week' | 'month' | 'year');
  };

  if (!stats) return <div>Loading stats...</div>;

  return (
    <div className="space-y-6">
      <AdminStatsCards stats={stats} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        <TrendChart data={trends} onFilterChange={handleTrendFilterChange} />
        <ActivityFeed activities={activity} />
      </div>
    </div>
  );
}