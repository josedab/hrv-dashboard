/**
 * Returns the date portion (YYYY-MM-DD) from an ISO timestamp.
 */
export function toDateString(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

/**
 * Returns today's date as YYYY-MM-DD in local time.
 */
export function todayString(): string {
  return localDateString(new Date());
}

/**
 * Formats a Date object as YYYY-MM-DD in local time.
 * Uses explicit year/month/day to avoid locale-dependent formatting.
 */
export function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a duration in seconds as MM:SS.
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Formats an ISO timestamp as a human-readable date.
 */
export function formatDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats an ISO timestamp as a human-readable date and time.
 */
export function formatDateTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Returns a date N days before the given date, as YYYY-MM-DD in local time.
 * Uses noon to avoid DST boundary issues with setDate arithmetic.
 */
export function daysAgo(n: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  d.setDate(d.getDate() - n);
  return localDateString(d);
}

/**
 * Calculates consecutive-day streak ending at today.
 * Uses localDateString for DST-safe date comparisons.
 */
export function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const uniqueDates = [...new Set(dates)].sort().reverse();
  const today = todayString();
  const yesterday = daysAgo(1);

  // Streak must include today or yesterday
  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const expectedPrev = daysAgo(1, parseDateString(uniqueDates[i - 1]));
    if (uniqueDates[i] === expectedPrev) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Parses a YYYY-MM-DD string into a Date at noon local time.
 * Using noon avoids DST edge cases.
 */
function parseDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
