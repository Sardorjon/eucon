/** Dates travel as ISO date-only strings (YYYY-MM-DD) in local time; no time zone involved. */
const pad = (n: number): string => String(n).padStart(2, '0');

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso(now = new Date()): string {
  return toIsoDate(now);
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** Display format for dates across grid, editors and messages (DevExtreme/Angular pattern syntax). */
export const DATE_FORMAT = 'dd.MM.yyyy';

/** Earliest date that counts as "in the future". */
export function tomorrowIso(now = new Date()): string {
  return addDaysIso(todayIso(now), 1);
}

/** Business rule: an event date is "in the future" from tomorrow on (local calendar day). */
export function isFutureDate(iso: string, now = new Date()): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso > todayIso(now);
}

export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? parseIsoDate(value) : value;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function formatDateTime(d: Date): string {
  return `${formatDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
