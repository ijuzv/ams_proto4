import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function getStatusBadgeColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'present':
    case 'approved':
      return 'bg-success/10 text-success';
    case 'absent':
    case 'rejected':
      return 'bg-destructive/10 text-destructive';
    case 'late':
    case 'pending':
      return 'bg-warning/10 text-warning';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function getDiceBearAvatar(name: string, gender?: string | null): string {
  const style = gender === 'FEMALE' ? 'avataaars' : gender === 'MALE' ? 'male' : 'avataaars';
  const seed = name.toLowerCase().replace(/\s+/g, '');
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
}

export function truncateText(text: string | null | undefined, maxLength: number = 20): string {
  if (!text) return '-';
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}