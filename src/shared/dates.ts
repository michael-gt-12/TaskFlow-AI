/**
 * Date and duration helpers. The analytics and reporting modules lean heavily
 * on these for bucketing activity and computing completion times.
 */

export const MILLIS_PER_SECOND = 1000;
export const MILLIS_PER_MINUTE = 60 * MILLIS_PER_SECOND;
export const MILLIS_PER_HOUR = 60 * MILLIS_PER_MINUTE;
export const MILLIS_PER_DAY = 24 * MILLIS_PER_HOUR;

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(23, 59, 59, 999);
  return copy;
}

export function startOfWeek(date: Date, weekStartsOn = 1): Date {
  const copy = startOfDay(date);
  const day = copy.getUTCDay();
  const diff = (day - weekStartsOn + 7) % 7;
  copy.setUTCDate(copy.getUTCDate() - diff);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * MILLIS_PER_HOUR);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MILLIS_PER_MINUTE);
}

export function differenceInDays(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / MILLIS_PER_DAY);
}

export function differenceInHours(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / MILLIS_PER_HOUR;
}

export function differenceInMinutes(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / MILLIS_PER_MINUTE);
}

export function isPast(date: Date, reference: Date = new Date()): boolean {
  return date.getTime() < reference.getTime();
}

export function isWithin(date: Date, start: Date, end: Date): boolean {
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

/**
 * Format a duration in minutes into a compact human string such as "2h 15m".
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  return parts.join(' ') || '0m';
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Generate an inclusive range of day buckets between two dates. Used by
 * analytics to produce time series even for days with no underlying activity.
 */
export function eachDayBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor.getTime() <= last.getTime()) {
    days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function relativeTime(date: Date, reference: Date = new Date()): string {
  const diffMs = reference.getTime() - date.getTime();
  const minutes = Math.round(diffMs / MILLIS_PER_MINUTE);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}
