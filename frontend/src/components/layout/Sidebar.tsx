'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import {
  LayoutDashboard,
  Clock,
  Calendar,
  Users,
  UserCircle,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { UserAvatar } from '@/components/avatar/UserAvatar';

const navigation = [
  { name: 'Admin', href: '/admin', icon: Users, adminOnly: true },
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Attendance', href: '/attendance', icon: Clock },
  { name: 'Leaves', href: '/leaves', icon: Calendar },
  { name: 'Team', href: '/team', icon: Users },
  { name: 'Profile', href: '/profile', icon: UserCircle },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose, collapsed, onToggle }: SidebarProps & { collapsed?: boolean; onToggle?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const filteredNavigation = navigation.filter((item) => {
    if (item.adminOnly && user?.role !== 'ADMIN') return false;
    // @ts-ignore
    if (item.managerOnly && user?.role !== 'MANAGER' && user?.role !== 'ADMIN') return false;
    return true;
  });

  return (
    <div className={cn(
      "relative flex h-full flex-col border-r border-border bg-white shadow-sm transition-all duration-300",
      collapsed ? "w-20" : "w-64"
    )}>
      {/* Logo/Brand Section */}
      <div className={cn(
        "flex h-16 items-center border-b border-border transition-all duration-300",
        collapsed ? "justify-center px-0" : "justify-between px-6"
      )}>
        <Link href="/dashboard" className="flex items-center space-x-2 group overflow-hidden">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary transition-all duration-200 group-hover:scale-105">
            <span className="text-lg font-bold text-white">A</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col whitespace-nowrap opacity-100 transition-opacity duration-300">
              <span className="text-sm font-bold text-foreground leading-tight">Attendance</span>
              <span className="text-xs text-muted-foreground leading-tight">Management</span>
            </div>
          )}
        </Link>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="md:hidden transition-smooth hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 px-3 py-6 overflow-y-auto overflow-x-hidden">
        {filteredNavigation.map((item, index) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                href={item.href}
                onClick={onClose}
                title={collapsed ? item.name : undefined}
                className={cn(
                  'group relative flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  collapsed && 'justify-center px-2'
                )}
              >
                {/* {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute left-0 top-0 bottom-0 w-2 bg-white rounded-r-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )} */}
                <Icon
                  className={cn(
                    'h-5 w-5 flex-shrink-0 transition-smooth',
                    isActive ? 'text-white' : 'text-muted-foreground group-hover:text-foreground',
                    !collapsed && 'mr-3'
                  )}
                  aria-hidden="true"
                />
                {!collapsed && (
                  <span className="flex-1 whitespace-nowrap opacity-100 transition-opacity duration-300">
                    {item.name}
                  </span>
                )}
                {isActive && !collapsed && (
                  <motion.div
                    initial={false}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.3 }}
                    className="h-2 w-2 rounded-full bg-white ml-2"
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Toggle Button - Positioned at edge (half in/half out) */}
      {onToggle && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-50">
          <Button
            variant="default"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 rounded-full shadow-lg bg-background border border-border hover:bg-muted"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 text-foreground" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-foreground" />
            )}
          </Button>
        </div>
      )}

      {/* User Info Footer */}
      <div className="border-t border-border p-4 overflow-hidden">
        <div className={cn("flex items-center gap-3", collapsed ? "justify-center px-0" : "px-2")}>
          <UserAvatar
            avatar={user?.avatar}
            name={user?.name}
            size="md"
            className="flex-shrink-0"
          />
          {!collapsed && (
            <div className="flex-1 min-w-0 opacity-100 transition-opacity duration-300">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.role || 'USER'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
