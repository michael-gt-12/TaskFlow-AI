import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/checklists/checklist.service', () => ({
  ChecklistService: {
    create: vi.fn(),
    listForTask: vi.fn(),
    getTaskProgress: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('../../src/middleware/auth', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../src/middleware/validator', () => ({
  validateRequest: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../src/middleware/permission', () => ({
  checkCapability: () => (_req: any, _res: any, next: any) => next(),
}));

import { checklistRouter } from '../../src/checklists/checklist.controller';
import { ChecklistService } from '../../src/checklists/checklist.service';

function handlerFor(method: string, path: string) {
  const layer = (checklistRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route.methods[method]
  );
  if (!layer) throw new Error(`no route ${method} ${path}`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

const sampleChecklist = {
  id: 'c1',
  taskId: 't1',
  title: 'QA',
  position: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  items: [],
};

const sampleItem = {
  id: 'i1',
  checklistId: 'c1',
  content: 'do thing',
  isComplete: false,
  completedAt: null,
  position: 0,
};

describe('checklist.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST / creates a checklist and responds 201', async () => {
    (ChecklistService.create as any).mockResolvedValue(sampleChecklist);
    const req: any = { body: { taskId: 't1', title: 'QA' } };
    const res = mockRes();
    const next = vi.fn();
    await handlerFor('post', '/')(req, res, next);
    expect(ChecklistService.create).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('GET /tasks/:taskId lists checklists', async () => {
    (ChecklistService.listForTask as any).mockResolvedValue([sampleChecklist]);
    const req: any = { params: { taskId: 't1' } };
    const res = mockRes();
    await handlerFor('get', '/tasks/:taskId')(req, res, vi.fn());
    expect(ChecklistService.listForTask).toHaveBeenCalledWith('t1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('GET /tasks/:taskId/progress returns the progress roll-up', async () => {
    (ChecklistService.getTaskProgress as any).mockResolvedValue({ total: 2, completed: 1, ratio: 0.5 });
    const req: any = { params: { taskId: 't1' } };
    const res = mockRes();
    await handlerFor('get', '/tasks/:taskId/progress')(req, res, vi.fn());
    expect(ChecklistService.getTaskProgress).toHaveBeenCalledWith('t1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: { total: 2, completed: 1, ratio: 0.5 } });
  });

  it('PATCH /:checklistId renames a checklist', async () => {
    (ChecklistService.rename as any).mockResolvedValue({ ...sampleChecklist, title: 'New' });
    const req: any = { params: { checklistId: 'c1' }, body: { title: 'New' } };
    const res = mockRes();
    await handlerFor('patch', '/:checklistId')(req, res, vi.fn());
    expect(ChecklistService.rename).toHaveBeenCalledWith('c1', 'New');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('DELETE /:checklistId removes a checklist and responds 204', async () => {
    (ChecklistService.remove as any).mockResolvedValue(undefined);
    const req: any = { params: { checklistId: 'c1' } };
    const res = mockRes();
    await handlerFor('delete', '/:checklistId')(req, res, vi.fn());
    expect(ChecklistService.remove).toHaveBeenCalledWith('c1');
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('POST /:checklistId/items adds an item and responds 201', async () => {
    (ChecklistService.addItem as any).mockResolvedValue(sampleItem);
    const req: any = { params: { checklistId: 'c1' }, body: { content: 'do thing' } };
    const res = mockRes();
    await handlerFor('post', '/:checklistId/items')(req, res, vi.fn());
    expect(ChecklistService.addItem).toHaveBeenCalledWith('c1', { content: 'do thing' });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('PATCH /items/:itemId updates an item', async () => {
    (ChecklistService.updateItem as any).mockResolvedValue(sampleItem);
    const req: any = { params: { itemId: 'i1' }, body: { isComplete: true } };
    const res = mockRes();
    await handlerFor('patch', '/items/:itemId')(req, res, vi.fn());
    expect(ChecklistService.updateItem).toHaveBeenCalledWith('i1', { isComplete: true });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('DELETE /items/:itemId removes an item and responds 204', async () => {
    (ChecklistService.removeItem as any).mockResolvedValue(undefined);
    const req: any = { params: { itemId: 'i1' } };
    const res = mockRes();
    await handlerFor('delete', '/items/:itemId')(req, res, vi.fn());
    expect(ChecklistService.removeItem).toHaveBeenCalledWith('i1');
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('forwards service errors to next()', async () => {
    const boom = new Error('boom');
    (ChecklistService.create as any).mockRejectedValue(boom);
    const req: any = { body: { taskId: 't1', title: 'QA' } };
    const next = vi.fn();
    await handlerFor('post', '/')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('forwards errors from every handler to next()', async () => {
    const boom = new Error('boom');
    const cases: Array<[string, string, any]> = [
      ['get', '/tasks/:taskId', { params: { taskId: 't1' } }],
      ['get', '/tasks/:taskId/progress', { params: { taskId: 't1' } }],
      ['patch', '/:checklistId', { params: { checklistId: 'c1' }, body: { title: 'X' } }],
      ['delete', '/:checklistId', { params: { checklistId: 'c1' } }],
      ['post', '/:checklistId/items', { params: { checklistId: 'c1' }, body: { content: 'x' } }],
      ['patch', '/items/:itemId', { params: { itemId: 'i1' }, body: {} }],
      ['delete', '/items/:itemId', { params: { itemId: 'i1' } }],
    ];
    const serviceByPath: Record<string, any> = {
      'get /tasks/:taskId': ChecklistService.listForTask,
      'get /tasks/:taskId/progress': ChecklistService.getTaskProgress,
      'patch /:checklistId': ChecklistService.rename,
      'delete /:checklistId': ChecklistService.remove,
      'post /:checklistId/items': ChecklistService.addItem,
      'patch /items/:itemId': ChecklistService.updateItem,
      'delete /items/:itemId': ChecklistService.removeItem,
    };
    for (const [method, path, req] of cases) {
      (serviceByPath[`${method} ${path}`] as any).mockRejectedValue(boom);
      const next = vi.fn();
      await handlerFor(method, path)(req, mockRes(), next);
      expect(next).toHaveBeenCalledWith(boom);
    }
  });
});
