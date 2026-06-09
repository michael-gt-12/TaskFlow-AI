import { describe, it, expect } from 'vitest';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ListProjectsSchema,
  TransferLeadSchema,
  AddProjectMemberSchema,
} from '../../src/projects/project.schema';

const UUID = '11111111-1111-1111-1111-111111111111';

describe('project.schema', () => {
  describe('CreateProjectSchema', () => {
    it('accepts a minimal valid body', () => {
      const r = CreateProjectSchema.safeParse({ body: { name: 'Alpha', orgId: 'org1' } });
      expect(r.success).toBe(true);
    });

    it('accepts a fully populated body', () => {
      const r = CreateProjectSchema.safeParse({
        body: {
          name: 'Alpha Project',
          description: 'desc',
          key: 'ALP1',
          color: '#3b82f6',
          leadId: UUID,
          templateId: UUID,
          orgId: 'org1',
        },
      });
      expect(r.success).toBe(true);
    });

    it('rejects a name shorter than 2 chars', () => {
      const r = CreateProjectSchema.safeParse({ body: { name: 'A', orgId: 'org1' } });
      expect(r.success).toBe(false);
    });

    it('requires orgId', () => {
      const r = CreateProjectSchema.safeParse({ body: { name: 'Alpha' } });
      expect(r.success).toBe(false);
    });

    it('rejects a key with non-alphanumeric characters', () => {
      const r = CreateProjectSchema.safeParse({ body: { name: 'Alpha', key: 'A-1', orgId: 'o' } });
      expect(r.success).toBe(false);
    });

    it('rejects an invalid color', () => {
      const r = CreateProjectSchema.safeParse({ body: { name: 'Alpha', color: 'red', orgId: 'o' } });
      expect(r.success).toBe(false);
    });
  });

  describe('UpdateProjectSchema', () => {
    it('accepts a partial update with nullable fields', () => {
      const r = UpdateProjectSchema.safeParse({ body: { description: null, leadId: null } });
      expect(r.success).toBe(true);
    });

    it('rejects an invalid leadId', () => {
      const r = UpdateProjectSchema.safeParse({ body: { leadId: 'not-a-uuid' } });
      expect(r.success).toBe(false);
    });
  });

  describe('ListProjectsSchema', () => {
    it('coerces numeric pagination and accepts filters', () => {
      const r = ListProjectsSchema.safeParse({
        query: { page: '2', pageSize: '50', includeArchived: 'true', search: 'foo', leadId: UUID },
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.query.page).toBe(2);
    });

    it('rejects includeArchived values outside the enum', () => {
      const r = ListProjectsSchema.safeParse({ query: { includeArchived: 'maybe' } });
      expect(r.success).toBe(false);
    });

    it('rejects pageSize above 100', () => {
      const r = ListProjectsSchema.safeParse({ query: { pageSize: '500' } });
      expect(r.success).toBe(false);
    });
  });

  describe('TransferLeadSchema', () => {
    it('requires a uuid newLeadId', () => {
      expect(TransferLeadSchema.safeParse({ body: { newLeadId: UUID } }).success).toBe(true);
      expect(TransferLeadSchema.safeParse({ body: { newLeadId: 'x' } }).success).toBe(false);
    });
  });

  describe('AddProjectMemberSchema', () => {
    it('accepts a userId with optional role', () => {
      expect(AddProjectMemberSchema.safeParse({ body: { userId: UUID } }).success).toBe(true);
      expect(
        AddProjectMemberSchema.safeParse({ body: { userId: UUID, role: 'LEAD' } }).success
      ).toBe(true);
    });

    it('rejects an unknown role', () => {
      const r = AddProjectMemberSchema.safeParse({ body: { userId: UUID, role: 'KING' } });
      expect(r.success).toBe(false);
    });
  });
});
