import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportService } from '../../src/reports/report.service';
import { prisma } from '../../src/database/client';
import { CSVExporter } from '../../src/reports/csv.exporter';

vi.mock('../../src/database/client', () => ({
  prisma: {
    project: {
      findUnique: vi.fn()
    },
    task: {
      findMany: vi.fn()
    },
    organization: {
      findUnique: vi.fn()
    }
  }
}));

describe('Reporting & Exports Module', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('CSVExporter', () => {
    it('should format rows correctly and handle commas', () => {
      const data = [
        { id: '1', name: 'Task 1', desc: 'Hello, World!' },
        { id: '2', name: 'Task 2', desc: 'No commas' }
      ];

      const csv = CSVExporter.export(data);
      const lines = csv.split('\r\n');
      expect(lines.length).toBe(3);
      expect(lines[0]).toBe('id,name,desc');
      expect(lines[1]).toBe('1,Task 1,"Hello, World!"');
      expect(lines[2]).toBe('2,Task 2,No commas');
    });

    it('should return empty string if data is empty', () => {
      expect(CSVExporter.export([])).toBe('');
    });
  });

  describe('ReportService', () => {
    it('should fetch tasks and build project CSV', async () => {
      const mockProject = { id: 'p1', name: 'Proj 1', organizationId: 'org1' };
      const mockTasks = [
        {
          id: 't1',
          title: 'Design DB',
          status: 'DONE',
          priority: 'HIGH',
          dueDate: new Date('2026-06-10T12:00:00Z'),
          createdAt: new Date('2026-06-01T12:00:00Z'),
          updatedAt: new Date('2026-06-02T12:00:00Z'),
          creator: { name: 'Alice', email: 'alice@test.com' },
          assignee: { name: 'Bob', email: 'bob@test.com' }
        }
      ];

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue(mockTasks as any);

      const csv = await ReportService.exportProjectTasksToCSV('p1');
      expect(csv).toContain('Design DB');
      expect(csv).toContain('Alice');
      expect(csv).toContain('Bob');
      expect(csv).toContain('DONE');
    });

    it('should throw NotFoundError if project is missing', async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

      await expect(ReportService.exportProjectTasksToCSV('missing')).rejects.toThrow(
        /Project/
      );
    });

    it('should fetch organization summary metrics correctly', async () => {
      const mockOrg = {
        id: 'org1',
        name: 'Acme Inc',
        projects: [
          {
            id: 'p1',
            tasks: [
              { id: 't1', status: 'DONE' },
              { id: 't2', status: 'TODO' }
            ]
          }
        ],
        members: [{ id: 'm1' }, { id: 'm2' }]
      };

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrg as any);

      const summary = await ReportService.exportOrganizationSummary('org1');
      expect(summary.orgName).toBe('Acme Inc');
      expect(summary.totalProjects).toBe(1);
      expect(summary.totalTasks).toBe(2);
      expect(summary.completedTasks).toBe(1);
      expect(summary.membersCount).toBe(2);
    });
  });
});
