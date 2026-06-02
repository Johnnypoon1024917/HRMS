/**
 * Inclusive working-day count between two dates (Mon–Fri). Public-holiday
 * calendars are a tenant config hook (code table) — out of scope for the
 * scaffold; weekends only here.
 */
export function workingDays(start: Date, end: Date, halfDay = false): number {
  let d = new Date(start);
  d.setUTCHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setUTCHours(0, 0, 0, 0);
  let count = 0;
  while (d <= last) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  if (halfDay && count > 0) count -= 0.5;
  return count;
}
