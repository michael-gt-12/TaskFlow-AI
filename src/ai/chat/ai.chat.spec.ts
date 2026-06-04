import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIChatService } from './ai.chat.service';
import { prisma } from '../../database/client';
import { BillingService } from '../../billing/billing.service';

vi.mock('../../database/client', () => ({
  prisma: {
    project: {
      findUnique: vi.fn()
    },
    task: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('../../billing/billing.service', () => ({
  BillingService: {
    checkAiAccess: vi.fn()
  }
}));

describe('Advanced AI Chat Subsystem', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should block AI assistant if billing validation fails', async () => {
    vi.mocked(BillingService.checkAiAccess).mockRejectedValue(
      new Error('Billing limit reached')
    );

    await expect(
      AIChatService.askQuestion('u1', 'org1', 'proj1', 'What tasks are urgent?')
    ).rejects.toThrow(/Billing limit reached/);
  });

  it('should filter tasks by urgent/high priority keyword', async () => {
    const mockProject = { id: 'proj1', name: 'Alpha Project' };
    const mockTasks = [
      { id: 't1', title: 'Task 1', priority: 'URGENT', status: 'TODO', assignee: null },
      { id: 't2', title: 'Task 2', priority: 'LOW', status: 'TODO', assignee: null }
    ];

    vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
    vi.mocked(prisma.task.findMany).mockResolvedValue(mockTasks as any);

    const reply = await AIChatService.askQuestion('u1', 'org1', 'proj1', 'Show me urgent tasks');
    
    expect(reply.content).toContain('Task 1');
    expect(reply.content).not.toContain('Task 2');
    expect(reply.content).toContain('Status: `TODO`');
  });

  it('should filter tasks by assignee Bob', async () => {
    const mockProject = { id: 'proj1', name: 'Alpha Project' };
    const mockTasks = [
      { id: 't1', title: 'Task 1', priority: 'LOW', status: 'TODO', assignee: { name: 'Bob Smith', email: 'bob@test.com' } },
      { id: 't2', title: 'Task 2', priority: 'LOW', status: 'TODO', assignee: null }
    ];

    vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
    vi.mocked(prisma.task.findMany).mockResolvedValue(mockTasks as any);

    const reply = await AIChatService.askQuestion('u1', 'org1', 'proj1', 'tasks assigned to Bob');

    expect(reply.content).toContain('Task 1');
    expect(reply.content).not.toContain('Task 2');
    expect(reply.content).toContain('Bob Smith');
  });

  it('should answer when no tasks are found matching criteria', async () => {
    const mockProject = { id: 'proj1', name: 'Alpha Project' };
    vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);
    vi.mocked(prisma.task.findMany).mockResolvedValue([]);

    const reply = await AIChatService.askQuestion('u1', 'org1', 'proj1', 'Show completed tasks');

    expect(reply.content).toContain("couldn't find any tasks matching your criteria");
  });
});
