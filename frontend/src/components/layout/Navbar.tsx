'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useQuery } from '@tanstack/react-query';
import { leavesApi } from '@/lib/api';
import { Menu, Bell, LogOut, User, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/avatar/UserAvatar';

function NotificationBell() {
  const { data: recentActivity } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: () => leavesApi.getRecentActivity() as Promise<any[]>,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Check if there's any recent activity (within last 7 days)
  const hasRecentActivity = recentActivity && recentActivity.length > 0 && recentActivity.some((activity: any) => {
    const activityDate = new Date(activity.date);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return activityDate >= sevenDaysAgo;
  });

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative transition-smooth hover:bg-muted"
    >
      <Bell className="h-5 w-5" />
      {hasRecentActivity && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive"></span>
      )}
    </Button>
  );
}

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm">
      <div className="flex h-[63px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden transition-smooth hover:bg-muted"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button
                variant="ghost"
                className="relative h-9 w-9 rounded-full transition-smooth hover:bg-muted"
              >
                <UserAvatar
                  avatar={user?.avatar}
                  name={user?.name}
                  size="md"
                  className="border-2 border-border"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 rounded-lg border-border bg-white shadow-md"
              align="end"
              forceMount
            >
              <DropdownMenuLabel className="font-normal">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    avatar={user?.avatar}
                    name={user?.name}
                    size="md"
                    className="border-2 border-border"
                  />
                  <div className="flex flex-col space-y-1 min-w-0">
                    <p className="text-sm font-medium leading-none text-foreground truncate">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground truncate" title={user?.email || 'user@example.com'}>
                      {user?.email || 'user@example.com'}
                    </p>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                className="cursor-pointer transition-smooth hover:bg-muted"
              >
                <Link href="/profile" className="flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                className="cursor-pointer text-destructive transition-smooth hover:bg-destructive/10 hover:text-destructive"
                onClick={handleLogout}
              >
                <button type="button" className="flex items-center w-full">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}


