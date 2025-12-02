'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';

export default function LeavesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();

  // Checking permissions
  const isManager = user?.role === 'MANAGER' || isAdmin;
  const isCeo = user?.role === 'CEO';
  const isUser = !!user;

  const tabs = [
    { name: 'My Leaves', href: '/leaves/my-leaves', show: isUser },
    { name: 'Requests', href: '/leaves/requests', show: isManager || isCeo },
    { name: 'Holidays', href: '/leaves/holidays', show: isUser },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Fixed tabs header */}
      <div className="border-b border-border bg-white sticky top-0 z-10 flex-shrink-0 rounded-md">
        <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
          {tabs.filter(t => t.show).map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={cn(
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-foreground',
                  'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.name}
              </Link>
            )
          })}
        </nav>
      </div>
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {children}
        </div>
      </div>
    </div>
  );
}