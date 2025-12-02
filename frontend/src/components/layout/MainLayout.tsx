'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useAuth } from '@/contexts/auth-context';
import { usePathname } from 'next/navigation';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  // Don't render layout elements on login page
  const isLoginPage = pathname?.startsWith('/login');

  // Don't render anything if not authenticated - the auth context will handle redirection
  // UNLESS we are on the login page (to avoid redirect loops/flashing)
  if (!isAuthenticated && !isLoginPage) {
    return <>{children}</>;
  }

  // If on login page, just render children without sidebar/navbar
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden transition-all duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Desktop sidebar */}
      <aside 
        className={`hidden md:fixed md:inset-y-0 md:flex md:flex-col transition-all duration-300 ${
          sidebarCollapsed ? 'md:w-20' : 'md:w-64'
        }`}
      >
        <Sidebar 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />
      </aside>

      {/* Main content */}
      <div 
        className={`flex flex-1 flex-col transition-all duration-300 h-full overflow-hidden ${
          sidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
        }`}
      >
        <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/50 p-6">
          <div className="mx-auto max-w-7xl h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}