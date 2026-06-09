import { describe, it, expect } from 'vitest';
import { ChecklistMapper } from '../../src/checklists/checklist.mapper';

function baseItem(overrides: any = {}) {
  return {
    id: 'i1',
    checklistId: 'c1',
    content: 'do thing',
    isComplete: false,
    completedAt: null,
    position: 0,
    ...overrides,
  };
}

function baseChecklist(overrides: any = {}) {
  return {
    id: 'c1',
    taskId: 't1',
    title: 'QA steps',
    position: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    items: [],
    ...overrides,
  };
}

describe('ChecklistMapper', () => {
  describe('toItemDto', () => {
    it('passes scalars through and leaves completedAt null when absent', () => {
      const dto = ChecklistMapper.toItemDto(baseItem() as any);
      expect(dto).toEqual({
        id: 'i1',
        checklistId: 'c1',
        content: 'do thing',
        isComplete: false,
        completedAt: null,
        position: 0,
      });
    });

    it('serialises completedAt to an ISO string when present', () => {
      const dto = ChecklistMapper.toItemDto(
        baseItem({ isComplete: true, completedAt: new Date('2026-03-01T00:00:00.000Z') }) as any
      );
      expect(dto.completedAt).toBe('2026-03-01T00:00:00.000Z');
    });
  });

  describe('toDto', () => {
    it('serialises createdAt and rolls up progress over items', () => {
      const dto = ChecklistMapper.toDto(
        baseChecklist({
          items: [
            baseItem({ id: 'i1', isComplete: true }),
            baseItem({ id: 'i2', isComplete: false }),
            baseItem({ id: 'i3', isComplete: true }),
            baseItem({ id: 'i4', isComplete: true }),
          ],
        }) as any
      );
      expect(dto.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(dto.items).toHaveLength(4);
      expect(dto.progress).toEqual({ total: 4, completed: 3, ratio: 0.75 });
    });

    it('reports a zero ratio when there are no items', () => {
      const dto = ChecklistMapper.toDto(baseChecklist({ items: [] }) as any);
      expect(dto.progress).toEqual({ total: 0, completed: 0, ratio: 0 });
    });

    it('defaults a nullish items field to an empty array', () => {
      const dto = ChecklistMapper.toDto(baseChecklist({ items: undefined }) as any);
      expect(dto.items).toEqual([]);
      expect(dto.progress).toEqual({ total: 0, completed: 0, ratio: 0 });
    });

    it('rounds the ratio to two decimals', () => {
      // 1/3 -> 0.3333... -> rounds to 0.33
      const dto = ChecklistMapper.toDto(
        baseChecklist({
          items: [
            baseItem({ id: 'i1', isComplete: true }),
            baseItem({ id: 'i2', isComplete: false }),
            baseItem({ id: 'i3', isComplete: false }),
          ],
        }) as any
      );
      expect(dto.progress.ratio).toBe(0.33);
    });
  });

  describe('toDtoList', () => {
    it('maps a list of checklists', () => {
      const list = ChecklistMapper.toDtoList([
        baseChecklist({ id: 'c1' }),
        baseChecklist({ id: 'c2' }),
      ] as any);
      expect(list).toHaveLength(2);
      expect(list[1].id).toBe('c2');
    });
  });
});
