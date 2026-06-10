import { describe, it, expect } from 'vitest';
import { TimeEntryMapper } from '../../src/time-tracking/time-entry.mapper';

function baseEntry(overrides: any = {}) {
  return {
    id: 'e1',
    taskId: 't1',
    userId: 'u1',
    minutes: 90,
    description: 'work',
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    loggedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('TimeEntryMapper', () => {
  describe('toDto', () => {
    it('serialises dates to ISO strings and passes scalars through', () => {
      const dto = TimeEntryMapper.toDto(baseEntry() as any);
      expect(dto).toEqual({
        id: 'e1',
        taskId: 't1',
        userId: 'u1',
        minutes: 90,
        description: 'work',
        startedAt: '2026-01-01T00:00:00.000Z',
        loggedAt: '2026-01-02T00:00:00.000Z',
      });
    });

    it('maps a null startedAt and null description', () => {
      const dto = TimeEntryMapper.toDto(baseEntry({ startedAt: null, description: null }) as any);
      expect(dto.startedAt).toBeNull();
      expect(dto.description).toBeNull();
    });
  });

  describe('toDtoList', () => {
    it('maps a list of entries', () => {
      const list = TimeEntryMapper.toDtoList([baseEntry(), baseEntry({ id: 'e2' })] as any);
      expect(list).toHaveLength(2);
      expect(list[1].id).toBe('e2');
    });

    it('returns an empty array for no entries', () => {
      expect(TimeEntryMapper.toDtoList([])).toEqual([]);
    });
  });

  describe('toSummaryDto', () => {
    it('passes summary fields straight through', () => {
      const dto = TimeEntryMapper.toSummaryDto({
        taskId: 't1',
        totalMinutes: 150,
        totalHours: 2.5,
        byUser: [{ userId: 'u1', minutes: 150 }],
      } as any);
      expect(dto).toEqual({
        taskId: 't1',
        totalMinutes: 150,
        totalHours: 2.5,
        byUser: [{ userId: 'u1', minutes: 150 }],
      });
    });
  });
});
