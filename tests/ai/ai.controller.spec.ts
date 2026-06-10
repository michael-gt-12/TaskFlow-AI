import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/ai/ai.service', () => ({
  AiService: {
    getTaskSummary: vi.fn(),
    suggestTaskDescription: vi.fn(),
    getAccounting: vi.fn(),
  },
}));

vi.mock('../../src/middleware/auth', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));

import { aiRouter } from '../../src/ai/ai.controller';
import { AiService } from '../../src/ai/ai.service';

function handlerFor(method: string, path: string) {
  const layer = (aiRouter as any).stack.find(
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
  return res;
}

describe('ai.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /summarize passes title and description through', async () => {
    (AiService.getTaskSummary as any).mockResolvedValue({ summary: 'short' });
    const req: any = { body: { title: 'Fix bug', description: 'details' } };
    const res = mockRes();
    await handlerFor('post', '/summarize')(req, res, vi.fn());
    expect(AiService.getTaskSummary).toHaveBeenCalledWith('Fix bug', 'details');
    expect(res.json).toHaveBeenCalledWith({ summary: 'short' });
  });

  it('POST /summarize defaults a missing description to empty string', async () => {
    (AiService.getTaskSummary as any).mockResolvedValue({ summary: 's' });
    const req: any = { body: { title: 'Fix bug' } };
    await handlerFor('post', '/summarize')(req, mockRes(), vi.fn());
    expect(AiService.getTaskSummary).toHaveBeenCalledWith('Fix bug', '');
  });

  it('POST /suggest-description suggests from the title', async () => {
    (AiService.suggestTaskDescription as any).mockResolvedValue({ description: 'auto' });
    const req: any = { body: { title: 'Title' } };
    const res = mockRes();
    await handlerFor('post', '/suggest-description')(req, res, vi.fn());
    expect(AiService.suggestTaskDescription).toHaveBeenCalledWith('Title');
    expect(res.json).toHaveBeenCalledWith({ description: 'auto' });
  });

  it('GET /accounting returns usage accounting', async () => {
    (AiService.getAccounting as any).mockReturnValue({ calls: 3 });
    const res = mockRes();
    await handlerFor('get', '/accounting')({}, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith({ calls: 3 });
  });

  it('forwards summarize errors to next()', async () => {
    const boom = new Error('model down');
    (AiService.getTaskSummary as any).mockRejectedValue(boom);
    const next = vi.fn();
    await handlerFor('post', '/summarize')({ body: { title: 't' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('forwards suggest-description errors to next()', async () => {
    const boom = new Error('boom');
    (AiService.suggestTaskDescription as any).mockRejectedValue(boom);
    const next = vi.fn();
    await handlerFor('post', '/suggest-description')({ body: { title: 't' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('forwards accounting errors to next()', async () => {
    const boom = new Error('boom');
    (AiService.getAccounting as any).mockImplementation(() => { throw boom; });
    const next = vi.fn();
    await handlerFor('get', '/accounting')({}, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
