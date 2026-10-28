import { addDaysIso, formatDate, formatDateTime, isFutureDate, parseIsoDate, toIsoDate } from './date';

describe('date utils', () => {
  it('converts to ISO in local time without UTC shift', () => {
    expect(toIsoDate(new Date(2026, 10, 4, 23, 30))).toBe('2026-11-04');
    expect(toIsoDate(new Date(2026, 10, 4, 0, 5))).toBe('2026-11-04');
    expect(parseIsoDate('2026-11-04').getDate()).toBe(4);
  });

  it('formats German dates', () => {
    expect(formatDate('2026-11-04')).toBe('04.11.2026');
    expect(formatDateTime(new Date(2026, 9, 28, 14, 32))).toBe('28.10.2026, 14:32');
  });

  it('treats only tomorrow and later as future', () => {
    const now = new Date(2026, 9, 28, 23, 59);
    expect(isFutureDate('2026-10-27', now)).toBe(false);
    expect(isFutureDate('2026-10-28', now)).toBe(false);
    expect(isFutureDate('2026-10-29', now)).toBe(true);
    expect(isFutureDate('not-a-date', now)).toBe(false);
  });

  it('adds days across year boundaries', () => {
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
  });
});
