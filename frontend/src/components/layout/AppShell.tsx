"use client";

import { MainLayout } from './MainLayout';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return <MainLayout>{children}</MainLayout>;
}
