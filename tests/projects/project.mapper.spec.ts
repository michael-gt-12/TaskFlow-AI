import { describe, it, expect } from 'vitest';
import { ProjectMapper } from '../../src/projects/project.mapper';

function baseProject(overrides: any = {}) {
  return {
    id: 'p1',
    organizationId: 'org1',
    key: 'ALP',
    name: 'Alpha',
    description: 'desc',
    color: '#3b82f6',
    isArchived: false,
    archivedAt: null,
    leadId: 'u1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('ProjectMapper', () => {
  describe('toDto', () => {
    it('serialises dates to ISO strings and passes scalars through', () => {
      const dto = ProjectMapper.toDto(baseProject() as any);
      expect(dto).toEqual({
        id: 'p1',
        organizationId: 'org1',
        key: 'ALP',
        name: 'Alpha',
        description: 'desc',
        color: '#3b82f6',
        isArchived: false,
        archivedAt: null,
        leadId: 'u1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      });
    });

    it('serialises archivedAt when present', () => {
      const dto = ProjectMapper.toDto(
        baseProject({ isArchived: true, archivedAt: new Date('2026-03-01T00:00:00.000Z') }) as any
      );
      expect(dto.archivedAt).toBe('2026-03-01T00:00:00.000Z');
    });
  });

  describe('toDetailDto', () => {
    it('maps organization, members and counts', () => {
      const dto = ProjectMapper.toDetailDto(
        baseProject({
          organization: { id: 'org1', name: 'Org', slug: 'org' },
          members: [{ userId: 'u1', role: 'LEAD', user: { name: 'Alice', email: 'a@x.io' } }],
          _count: { tasks: 5, members: 2, sprints: 1, milestones: 3 },
        }) as any
      );
      expect(dto.organization).toEqual({ id: 'org1', name: 'Org', slug: 'org' });
      expect(dto.members).toEqual([{ userId: 'u1', role: 'LEAD', name: 'Alice', email: 'a@x.io' }]);
      expect(dto.counts).toEqual({ tasks: 5, members: 2, sprints: 1, milestones: 3 });
    });

    it('defaults members to an empty array and counts to undefined', () => {
      const dto = ProjectMapper.toDetailDto(baseProject() as any);
      expect(dto.members).toEqual([]);
      expect(dto.counts).toBeUndefined();
    });

    it('coalesces missing _count entries to zero', () => {
      const dto = ProjectMapper.toDetailDto(baseProject({ _count: {} }) as any);
      expect(dto.counts).toEqual({ tasks: 0, members: 0, sprints: 0, milestones: 0 });
    });
  });

  describe('toDtoList', () => {
    it('maps a list of projects', () => {
      const list = ProjectMapper.toDtoList([baseProject(), baseProject({ id: 'p2' })] as any);
      expect(list).toHaveLength(2);
      expect(list[1].id).toBe('p2');
    });
  });
});
