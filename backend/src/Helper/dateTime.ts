import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Get current time in IST
 * Used for attendance time restrictions (6:00 AM - 12:00 PM IST)
 */
export function getIST() {
  const nowIST = dayjs().tz(IST_TIMEZONE);

  // Custom IST start (6:00 AM)
  const istStart = nowIST.hour(6).minute(0).second(0).millisecond(0);

  // Custom IST end (12:00 PM)
  const istEnd = nowIST.hour(24).minute(0).second(0).millisecond(0);

  return {
    nowIST: nowIST,
    istStart: istStart,
    istEnd: istEnd,
  };
}

/**
 * Convert UTC timestamp from database to IST Date for API responses
 * Used for createdAt, updatedAt, approvedAt, rejectedAt fields
 */
export function convertUTCToIST(utcDate: Date | null | undefined): Date | null {
  if (!utcDate) return null;
  return dayjs.utc(utcDate).tz(IST_TIMEZONE).toDate();
}

/**
 * Convert UTC timestamp array to IST Date array for API responses
 */
export function convertUTCArrayToIST(dates: (Date | null)[]): (Date | null)[] {
  return dates.map(date => convertUTCToIST(date));
}

/**
 * Convert object with timestamp fields from UTC to IST
 * Helper to convert common timestamp fields in API responses
 */
export function convertTimestampsToIST<T extends Record<string, any>>(
  obj: T,
  timestampFields: (keyof T)[]
): T {
  const converted = { ...obj };
  timestampFields.forEach(field => {
    const value = converted[field];
    if (value && (typeof value === 'object') && Object.prototype.toString.call(value) === '[object Date]') {
      converted[field] = convertUTCToIST(value) as T[keyof T];
    }
  });
  return converted;
}

/**
 * Normalize a date to date-only (no time component)
 * Ensures consistent date handling across the application
 */
export function normalizeToDateOnly(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Date(d.toISOString().split('T')[0]);
}

/**
 * Calculate the number of days between two dates (inclusive)
 * Returns the count including both fromDate and toDate
 */
export function calculateDaysBetween(fromDate: Date, toDate: Date): number {
  const from = normalizeToDateOnly(fromDate);
  const to = normalizeToDateOnly(toDate);
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}