import { describe, it, expect } from 'vitest';
import {
  MILLIS_PER_SECOND,
  MILLIS_PER_MINUTE,
  MILLIS_PER_HOUR,
  MILLIS_PER_DAY,
  startOfDay,
  endOfDay,
  startOfWeek,
  addDays,
  addHours,
  addMinutes,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  isPast,
  isWithin,
  formatDuration,
  toIsoDate,
  eachDayBetween,
  relativeTime,
} from '../../src/shared/dates';

describe('dates', () => {
  describe('constants', () => {
    it('derives larger units from smaller ones', () => {
      expect(MILLIS_PER_SECOND).toBe(1000);
      expect(MILLIS_PER_MINUTE).toBe(60_000);
      expect(MILLIS_PER_HOUR).toBe(3_600_000);
      expect(MILLIS_PER_DAY).toBe(86_400_000);
    });
  });

  describe('startOfDay / endOfDay', () => {
    it('zeroes the time to UTC midnight without mutating the input', () => {
      const input = new Date('2026-03-15T13:45:30.500Z');
      const result = startOfDay(input);
      expect(result.toISOString()).toBe('2026-03-15T00:00:00.000Z');
      expect(input.toISOString()).toBe('2026-03-15T13:45:30.500Z');
    });

    it('endOfDay sets the last millisecond of the UTC day', () => {
      const result = endOfDay(new Date('2026-03-15T13:45:30.500Z'));
      expect(result.toISOString()).toBe('2026-03-15T23:59:59.999Z');
    });
  });

  describe('startOfWeek', () => {
    it('defaults to Monday as the start of the week', () => {
      // 2026-03-15 is a Sunday; the Monday before is 2026-03-09.
      const result = startOfWeek(new Date('2026-03-15T12:00:00Z'));
      expect(result.toISOString()).toBe('2026-03-09T00:00:00.000Z');
    });

    it('honours a custom weekStartsOn (Sunday = 0)', () => {
      const result = startOfWeek(new Date('2026-03-18T12:00:00Z'), 0);
      // Wednesday 2026-03-18 -> Sunday 2026-03-15
      expect(result.toISOString()).toBe('2026-03-15T00:00:00.000Z');
    });
  });

  describe('add helpers', () => {
    it('addDays crosses month boundaries', () => {
      expect(addDays(new Date('2026-01-30T00:00:00Z'), 3).toISOString()).toBe(
        '2026-02-02T00:00:00.000Z'
      );
    });

    it('addHours and addMinutes shift by the right amount', () => {
      const base = new Date('2026-01-01T00:00:00Z');
      expect(addHours(base, 5).toISOString()).toBe('2026-01-01T05:00:00.000Z');
      expect(addMinutes(base, 90).toISOString()).toBe('2026-01-01T01:30:00.000Z');
    });

    it('supports negative offsets', () => {
      expect(addDays(new Date('2026-01-01T00:00:00Z'), -1).toISOString()).toBe(
        '2025-12-31T00:00:00.000Z'
      );
    });
  });

  describe('difference helpers', () => {
    const earlier = new Date('2026-01-01T00:00:00Z');

    it('differenceInDays floors partial days', () => {
      expect(differenceInDays(new Date('2026-01-04T12:00:00Z'), earlier)).toBe(3);
    });

    it('differenceInHours returns a fractional value', () => {
      expect(differenceInHours(new Date('2026-01-01T01:30:00Z'), earlier)).toBe(1.5);
    });

    it('differenceInMinutes rounds to the nearest minute', () => {
      expect(differenceInMinutes(new Date('2026-01-01T00:02:40Z'), earlier)).toBe(3);
    });
  });

  describe('isPast', () => {
    it('compares against an explicit reference', () => {
      const ref = new Date('2026-06-01T00:00:00Z');
      expect(isPast(new Date('2026-05-01T00:00:00Z'), ref)).toBe(true);
      expect(isPast(new Date('2026-07-01T00:00:00Z'), ref)).toBe(false);
    });
  });

  describe('isWithin', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-31T00:00:00Z');

    it('is inclusive of the boundaries', () => {
      expect(isWithin(start, start, end)).toBe(true);
      expect(isWithin(end, start, end)).toBe(true);
      expect(isWithin(new Date('2026-01-15T00:00:00Z'), start, end)).toBe(true);
    });

    it('is false outside the range', () => {
      expect(isWithin(new Date('2025-12-31T23:59:59Z'), start, end)).toBe(false);
    });
  });

  describe('formatDuration', () => {
    it('returns 0m for zero or negative minutes', () => {
      expect(formatDuration(0)).toBe('0m');
      expect(formatDuration(-30)).toBe('0m');
    });

    it('formats minutes, hours and days', () => {
      expect(formatDuration(45)).toBe('45m');
      expect(formatDuration(135)).toBe('2h 15m');
      expect(formatDuration(24 * 60)).toBe('1d');
      expect(formatDuration(24 * 60 + 90)).toBe('1d 1h 30m');
    });
  });

  describe('toIsoDate', () => {
    it('returns the YYYY-MM-DD portion', () => {
      expect(toIsoDate(new Date('2026-03-15T18:00:00Z'))).toBe('2026-03-15');
    });
  });

  describe('eachDayBetween', () => {
    it('produces an inclusive list of day buckets', () => {
      const days = eachDayBetween(
        new Date('2026-03-01T10:00:00Z'),
        new Date('2026-03-03T20:00:00Z')
      );
      expect(days.map(toIsoDate)).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
    });

    it('returns a single day when start and end are the same day', () => {
      const days = eachDayBetween(
        new Date('2026-03-01T01:00:00Z'),
        new Date('2026-03-01T23:00:00Z')
      );
      expect(days).toHaveLength(1);
      expect(toIsoDate(days[0])).toBe('2026-03-01');
    });
  });

  describe('relativeTime', () => {
    const ref = new Date('2026-06-09T12:00:00Z');

    it('returns "just now" for sub-minute differences', () => {
      expect(relativeTime(new Date('2026-06-09T11:59:40Z'), ref)).toBe('just now');
    });

    it('scales up through minutes, hours, days, months and years', () => {
      expect(relativeTime(new Date('2026-06-09T11:30:00Z'), ref)).toBe('30m ago');
      expect(relativeTime(new Date('2026-06-09T09:00:00Z'), ref)).toBe('3h ago');
      expect(relativeTime(new Date('2026-06-04T12:00:00Z'), ref)).toBe('5d ago');
      expect(relativeTime(new Date('2026-04-09T12:00:00Z'), ref)).toBe('2mo ago');
      expect(relativeTime(new Date('2024-06-09T12:00:00Z'), ref)).toBe('2y ago');
    });
  });
});
