/**
 * Format a date as YYYY-MM-DD in the user's local timezone, for
 * <input type="date"> values and per-day grouping.
 *
 * Avoid `toISOString().substring(0, 10)` for this: it gives the UTC date,
 * which is a day off for much of the day in timezones far from UTC.
 */
export function toLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse a YYYY-MM-DD value as local midnight (the inverse of toLocalDateKey). */
export function fromLocalDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}
